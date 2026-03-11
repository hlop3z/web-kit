/**
 * Project — manages the collection of Components and Layouts.
 *
 * Each entity (component or layout) is a named workspace with its own files.
 * Switching entities saves the current file set and loads the target entity's files.
 *
 * Data model:
 *   Project
 *     ├── components: EntityRef[]   (each has its own file snapshot)
 *     ├── layouts: EntityRef[]
 *     └── active: { mode, entity_id }
 *
 * The project store is reactive (nanostores atoms) so the UI re-renders
 * when entities are added, removed, or switched.
 */

import type { XkinAPI, Dispose } from "../types.ts";

/* ── Types ─────────────────────────────────────── */

export type StudioMode = "components" | "layouts";

export interface EntityRef {
  id: string;
  name: string;
  mode: StudioMode;
  created_at: number;
}

export interface EntitySnapshot {
  ref: EntityRef;
  files: Record<string, string>;
  file_meta: Record<string, { main?: boolean; language?: string; meta?: Record<string, unknown> }>;
}

/* ── Project Store ─────────────────────────────── */

export function create_project(xkin: XkinAPI) {
  const { atom } = xkin.store;

  const $mode = atom<StudioMode>("components");
  const $entities = atom<EntityRef[]>([]);
  const $active_entity = atom<string | null>(null);
  const snapshots = new Map<string, EntitySnapshot>();

  /* ── Helpers ───────────────────────────────── */

  /** Capture current workspace files into a snapshot */
  function capture(): EntitySnapshot | null {
    const id = $active_entity.get();
    if (!id) return null;

    const ref = $entities.get().find((e) => e.id === id);
    if (!ref) return null;

    const files: Record<string, string> = {};
    const file_meta: EntitySnapshot["file_meta"] = {};

    for (const entry of xkin.files.list()) {
      files[entry.path] = xkin.files.read(entry.path) ?? "";
      file_meta[entry.path] = {
        main: entry.main || undefined,
        language: entry.language,
        meta: Object.keys(entry.meta).length > 0 ? entry.meta : undefined,
      };
    }

    const snap: EntitySnapshot = { ref, files, file_meta };
    snapshots.set(id, snap);
    return snap;
  }

  /** Load a snapshot into the workspace */
  async function restore(id: string): Promise<boolean> {
    const snap = snapshots.get(id);
    if (!snap) return false;

    await xkin.files.clear();

    for (const [path, content] of Object.entries(snap.files)) {
      const meta = snap.file_meta[path];
      await xkin.files.create(path, content, {
        main: meta?.main,
        language: meta?.language,
        meta: meta?.meta,
      });
    }

    xkin.files.mark_all_clean();

    // Auto-open main file + style file
    const entries = xkin.files.list();
    const main_file = entries.find((e) => e.main);
    const style_file = entries.find((e) => e.language === "scss" || e.language === "css");

    if (main_file) {
      xkin.files.open(main_file.path);
      xkin.files.set_active(main_file.path, null);
    }
    if (style_file) {
      xkin.files.open(style_file.path);
    }

    return true;
  }

  /* ── API ───────────────────────────────────── */

  /** Create a new entity with scaffolded files */
  async function create_entity(
    name: string,
    mode: StudioMode,
  ): Promise<EntityRef> {
    const id = `${mode.slice(0, -1)}_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now().toString(36)}`;

    const ref: EntityRef = {
      id,
      name,
      mode,
      created_at: Date.now(),
    };

    // Scaffold files based on mode
    const files: Record<string, string> = {};
    const file_meta: EntitySnapshot["file_meta"] = {};

    if (mode === "components") {
      const pascal = name.replace(/[^a-zA-Z0-9]/g, " ")
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("");

      files["index.tsx"] = [
        `interface ${pascal}Props {}`,
        "",
        `export const ${pascal} = ({}: ${pascal}Props) => (`,
        `  <div class={styles.${name.toLowerCase()}}>`,
        `    <h2>${name}</h2>`,
        "  </div>",
        ");",
        "",
        `render(<${pascal} />, document.getElementById("root"));`,
      ].join("\n");
      file_meta["index.tsx"] = { main: true };

      files["styles.scss"] = [
        `$primary: #569cd6;`,
        "",
        `.${name.toLowerCase()} {`,
        "  padding: 16px;",
        "  color: #d4d4d4;",
        "}",
      ].join("\n");
      file_meta["styles.scss"] = {};

    } else if (mode === "layouts") {
      files["layout.tsx"] = [
        `interface LayoutProps {`,
        `  children?: unknown;`,
        `}`,
        "",
        `export const Layout = ({ children }: LayoutProps) => (`,
        `  <div class={styles.layout}>`,
        `    <header class={styles.header}>`,
        `      <h1>${name}</h1>`,
        `    </header>`,
        `    <main class={styles.main}>`,
        `      {children}`,
        `    </main>`,
        `  </div>`,
        ");",
      ].join("\n");
      file_meta["layout.tsx"] = { main: true };

      files["styles.scss"] = [
        ".layout {",
        "  display: grid;",
        "  grid-template-rows: auto 1fr;",
        "  min-height: 100vh;",
        "}",
        "",
        ".header {",
        "  padding: 16px 24px;",
        "  background: #2d2d2d;",
        "  border-bottom: 1px solid #3e3e3e;",
        "}",
        "",
        ".main {",
        "  padding: 24px;",
        "}",
      ].join("\n");
      file_meta["styles.scss"] = {};
    }

    const snap: EntitySnapshot = { ref, files, file_meta };
    snapshots.set(id, snap);

    $entities.set([...$entities.get(), ref]);

    return ref;
  }

  /** Switch to a different entity */
  async function switch_entity(id: string): Promise<boolean> {
    const current = $active_entity.get();
    if (current === id) return true;

    // Save current
    if (current) capture();

    // Load target
    const ok = await restore(id);
    if (ok) {
      $active_entity.set(id);
      const ref = $entities.get().find((e) => e.id === id);
      if (ref) $mode.set(ref.mode);
    }

    return ok;
  }

  /** Switch mode (components/layouts) — selects first entity of that mode or clears */
  function set_mode(mode: StudioMode) {
    $mode.set(mode);
    const entities = $entities.get().filter((e) => e.mode === mode);
    const active = $active_entity.get();
    const current_ref = active ? $entities.get().find((e) => e.id === active) : null;

    // If already in the right mode, do nothing
    if (current_ref?.mode === mode) return;

    // Switch to first entity of target mode, or clear
    if (entities.length > 0) {
      switch_entity(entities[0].id);
    } else {
      // No entities — clear workspace
      if (active) capture();
      xkin.files.clear();
      $active_entity.set(null);
    }
  }

  /** Delete an entity */
  async function delete_entity(id: string): Promise<void> {
    snapshots.delete(id);
    $entities.set($entities.get().filter((e) => e.id !== id));

    if ($active_entity.get() === id) {
      // Switch to next available entity in same mode
      const mode = $mode.get();
      const remaining = $entities.get().filter((e) => e.mode === mode);
      if (remaining.length > 0) {
        await switch_entity(remaining[0].id);
      } else {
        await xkin.files.clear();
        $active_entity.set(null);
      }
    }
  }

  /** Rename an entity */
  function rename_entity(id: string, new_name: string) {
    const list = $entities.get();
    const idx = list.findIndex((e) => e.id === id);
    if (idx < 0) return;

    const updated = { ...list[idx], name: new_name };
    const next = [...list];
    next[idx] = updated;
    $entities.set(next);

    const snap = snapshots.get(id);
    if (snap) snap.ref = updated;
  }

  /** List entities for the current mode */
  function list_current(): EntityRef[] {
    const mode = $mode.get();
    return $entities.get().filter((e) => e.mode === mode);
  }

  /** Get the active entity ref */
  function active_ref(): EntityRef | null {
    const id = $active_entity.get();
    if (!id) return null;
    return $entities.get().find((e) => e.id === id) ?? null;
  }

  return {
    $mode,
    $entities,
    $active_entity,

    create_entity,
    switch_entity,
    delete_entity,
    rename_entity,
    set_mode,
    list_current,
    active_ref,
    capture,
  };
}

export type ProjectStore = ReturnType<typeof create_project>;
