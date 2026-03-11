/**
 * Mock Xkin — a lightweight stand-in for Xkin Core during development.
 *
 * Provides the full XkinAPI surface using nanostores + stubs so Code Studio
 * can run without building web-kit. No Monaco editor — just the reactive
 * state and slot system.
 */

import { atom, computed } from "nanostores";
import { h, Fragment, render } from "preact";
import type { XkinAPI, FileEntry, TreeNode, Workspace, Dispose } from "../lib/types.ts";

/* ── Helpers ────────────────────────────────────── */

const noop = () => {};
const noop_async = async () => {};
const noop_dispose: Dispose = () => {};

function build_tree(entries: FileEntry[]): TreeNode[] {
  const dirs = new Map<string, TreeNode>();
  const root: TreeNode[] = [];

  const ensure_dir = (dir_path: string): TreeNode => {
    if (dirs.has(dir_path)) return dirs.get(dir_path)!;
    const parts = dir_path.split("/").filter(Boolean);
    const name = parts[parts.length - 1] || dir_path;
    const node: TreeNode = { name, path: dir_path, type: "directory", children: [] };
    dirs.set(dir_path, node);

    if (parts.length > 1) {
      const parent_path = parts.slice(0, -1).join("/");
      const parent = ensure_dir(parent_path);
      parent.children!.push(node);
    } else {
      root.push(node);
    }
    return node;
  };

  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    const file_node: TreeNode = {
      name: parts[parts.length - 1] || entry.path,
      path: entry.path,
      type: "file",
      entry,
    };

    if (parts.length > 1) {
      const dir_path = parts.slice(0, -1).join("/");
      const dir = ensure_dir(dir_path);
      dir.children!.push(file_node);
    } else {
      root.push(file_node);
    }
  }

  return root;
}

function infer_language(path: string): string {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  const map: Record<string, string> = {
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript",
    ".ts": "typescript", ".tsx": "typescript",
    ".css": "css", ".scss": "scss",
    ".html": "html", ".htm": "html",
    ".json": "json", ".md": "markdown",
    ".py": "python", ".rs": "rust", ".go": "go",
  };
  return map[ext] || "plaintext";
}

/* ── Create Mock ────────────────────────────────── */

export function create_mock_xkin(): XkinAPI {
  // File storage
  const file_contents = new Map<string, string>();
  const file_entries_map = new Map<string, FileEntry>();
  const view_states = new Map<string, unknown>();

  // Reactive atoms
  const $workspace = atom<Workspace | null>({
    id: "dev",
    name: "Dev Workspace",
    created_at: Date.now(),
    updated_at: Date.now(),
    meta: {},
  });
  const $files = atom<FileEntry[]>([]);
  const $active_file = atom<string | null>(null);
  const $open_files = atom<string[]>([]);
  const $file_tree = computed($files, (files) => build_tree(files));
  const $is_dirty = computed($files, (files) => files.some((f) => f.dirty));
  const $dirty_files = computed($files, (files) => files.filter((f) => f.dirty));
  const $active_entry = computed(
    [$files, $active_file],
    (files: FileEntry[], active: string | null) =>
      active ? files.find((f) => f.path === active) ?? null : null,
  );

  const $types = atom<Array<{ path: string; content: string }>>([]);

  // DnD stubs
  const $document = atom({ id: "doc", sections: [], meta: {} });
  const $sections = computed($document, (doc) => doc.sections);
  const $selection = atom({ type: null as "section" | "block" | null, ids: [] as string[] });
  const $drag_state = atom({
    status: "idle" as const,
    source: null,
    target: null,
    operation: null,
  });

  const refresh_files = () => {
    $files.set([...file_entries_map.values()]);
  };

  // Event emitter
  const listeners = new Map<string, Set<Function>>();
  const emit = (event: string, data: unknown) => {
    listeners.get(event)?.forEach((cb) => cb(data));
    listeners.get("*")?.forEach((cb) => cb(data));
  };

  // Slot storage for UI
  const slots = new Map<string, Array<{ id: string; plugin_id: string; label?: string; render?: Function; order?: number; alignment?: string }>>();
  const $slots = atom<Record<string, unknown[]>>({});
  const $notifications = atom<unknown[]>([]);
  const $dialog = atom<unknown>(null);

  // Plugin storage
  const plugins_map = new Map<string, { manifest: Record<string, unknown>; state: string }>();

  /* ── File Registry ────────────────────────────── */

  const files = {
    async create(path: string, content = "", opts?: Record<string, unknown>) {
      const entry: FileEntry = {
        path,
        language: infer_language(path),
        main: (opts?.main as boolean) ?? false,
        dirty: false,
        created_at: Date.now(),
        updated_at: Date.now(),
        meta: (opts?.meta as Record<string, unknown>) ?? {},
      };
      file_contents.set(path, content);
      file_entries_map.set(path, entry);
      refresh_files();
      emit("create", { path, content });
      return {};
    },
    read(path: string) {
      return file_contents.get(path) ?? null;
    },
    async update(path: string, content: string) {
      file_contents.set(path, content);
      const entry = file_entries_map.get(path);
      if (entry) {
        entry.dirty = true;
        entry.updated_at = Date.now();
        refresh_files();
      }
      emit("update", { path, content });
      return {};
    },
    async delete(path: string) {
      file_contents.delete(path);
      file_entries_map.delete(path);
      const open = $open_files.get().filter((p) => p !== path);
      $open_files.set(open);
      if ($active_file.get() === path) {
        $active_file.set(open[0] ?? null);
      }
      refresh_files();
      emit("delete", { path });
    },
    get(path: string) {
      // In mock, return a fake model-like object
      return file_contents.has(path) ? { getValue: () => file_contents.get(path) } : null;
    },
    entry(path: string) {
      return file_entries_map.get(path) ?? null;
    },
    set_meta(path: string, meta: Record<string, unknown>) {
      const entry = file_entries_map.get(path);
      if (entry) {
        entry.meta = { ...entry.meta, ...meta };
        refresh_files();
      }
      return entry ?? null;
    },
    async rename(old_path: string, new_path: string) {
      const content = file_contents.get(old_path);
      if (content == null) return null;
      const entry = file_entries_map.get(old_path);
      file_contents.delete(old_path);
      file_entries_map.delete(old_path);
      file_contents.set(new_path, content);
      if (entry) {
        entry.path = new_path;
        entry.language = infer_language(new_path);
        file_entries_map.set(new_path, entry);
      }
      const open = $open_files.get().map((p) => (p === old_path ? new_path : p));
      $open_files.set(open);
      if ($active_file.get() === old_path) $active_file.set(new_path);
      refresh_files();
      return {};
    },
    async move(old_path: string, new_path: string) {
      return files.rename(old_path, new_path);
    },
    list(_dir?: string) {
      return [...file_entries_map.values()];
    },
    dirs() { return [] as string[]; },
    async delete_dir() {},
    async rename_dir() {},
    mark_clean(path: string) {
      const entry = file_entries_map.get(path);
      if (entry) { entry.dirty = false; refresh_files(); }
    },
    mark_all_clean() {
      for (const entry of file_entries_map.values()) entry.dirty = false;
      refresh_files();
    },
    is_dirty(path: string) {
      return file_entries_map.get(path)?.dirty ?? false;
    },
    save_view_state(path: string, _editor: unknown) {
      view_states.set(path, { path });
    },
    restore_view_state(path: string, _editor: unknown) {
      return view_states.get(path) ?? null;
    },
    set_active(path: string, _editor: unknown) {
      $active_file.set(path);
      return files.get(path);
    },
    open(path: string) {
      const open = $open_files.get();
      if (!open.includes(path)) $open_files.set([...open, path]);
    },
    close(path: string, _editor?: unknown) {
      const open = $open_files.get().filter((p) => p !== path);
      $open_files.set(open);
      if ($active_file.get() === path) {
        $active_file.set(open[open.length - 1] ?? null);
      }
    },
    merge() {
      const entries = [...file_entries_map.values()].filter(
        (e) => e.language === "typescript" || e.language === "javascript",
      );
      const non_main = entries.filter((e) => !e.main);
      const main_entry = entries.find((e) => e.main);
      const parts: string[] = [];

      for (const e of non_main) {
        let src = file_contents.get(e.path) ?? "";
        src = src
          .replace(/^import\s+.*from\s+["']\.\/.+["'];?\s*$/gm, "")
          .replace(/^export\s+(?=const |function |class |interface |type |enum )/gm, "");
        parts.push(src.trim());
      }

      if (main_entry) {
        let src = file_contents.get(main_entry.path) ?? "";
        src = src.replace(/^import\s+.*from\s+["']\.\/.+["'];?\s*$/gm, "");
        parts.push(src.trim());
      }

      return parts.join("\n\n");
    },
    async format(_path: string) { return null; },
    async format_all() { return {}; },
    async clear() {
      file_contents.clear();
      file_entries_map.clear();
      $open_files.set([]);
      $active_file.set(null);
      refresh_files();
    },
    on(event: string, callback: (data: unknown) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(callback);
      return () => { listeners.get(event)?.delete(callback); };
    },
  } satisfies XkinAPI["files"];

  /* ── Hooks (stub) ─────────────────────────────── */

  const hooks_listeners = new Map<string, Array<{ cb: Function; priority: number }>>();

  const hooks = {
    add(name: string, callback: Function, priority = 10) {
      if (!hooks_listeners.has(name)) hooks_listeners.set(name, []);
      const entry = { cb: callback, priority };
      hooks_listeners.get(name)!.push(entry);
      hooks_listeners.get(name)!.sort((a, b) => a.priority - b.priority);
      return () => {
        const arr = hooks_listeners.get(name);
        if (arr) {
          const idx = arr.indexOf(entry);
          if (idx >= 0) arr.splice(idx, 1);
        }
      };
    },
    async fire(name: string, value?: unknown, _context?: unknown) {
      const arr = hooks_listeners.get(name);
      if (!arr) return value;
      let v = value;
      for (const { cb } of arr) {
        const result = await cb(v);
        if (name.includes("before_") && result !== undefined) v = result;
      }
      return v;
    },
    has(name: string) { return hooks_listeners.has(name); },
    list() { return [...hooks_listeners.keys()]; },
    clear() { hooks_listeners.clear(); },
  } satisfies XkinAPI["hooks"];

  /* ── Plugins (minimal) ────────────────────────── */

  const plugin_emitter = new Map<string, Set<Function>>();

  const plugins = {
    register(manifest: Record<string, unknown>) {
      const id = manifest.id as string;
      plugins_map.set(id, { manifest, state: "installed" });
      plugin_emitter.get("register")?.forEach((cb) => cb({ id, manifest }));

      if (manifest.activation === "on_load") {
        plugins.activate(id).catch(console.error);
      }
    },
    unregister(id: string) {
      plugins_map.delete(id);
    },
    async activate(id: string) {
      const plugin = plugins_map.get(id);
      if (!plugin) throw new Error(`Plugin "${id}" not registered`);
      if (plugin.state === "active") return;

      const ctx = {
        settings: atom({}),
        defaults: {},
        subscriptions: [] as Dispose[],
        contribute(target: string, contribution: Record<string, unknown>) {
          if (!slots.has(target)) slots.set(target, []);
          const entry = { id: contribution.id as string, plugin_id: id, ...contribution };
          slots.get(target)!.push(entry);
          // Update reactive slots
          const snapshot: Record<string, unknown[]> = {};
          for (const [k, v] of slots) snapshot[k] = [...v];
          $slots.set(snapshot);
          return () => {
            const arr = slots.get(target);
            if (arr) {
              const idx = arr.findIndex((e) => e.id === contribution.id);
              if (idx >= 0) arr.splice(idx, 1);
            }
          };
        },
        hook: hooks.add,
      };

      try {
        await (plugin.manifest.activate as Function)(ctx);
        plugin.state = "active";
      } catch (err) {
        plugin.state = "error";
        throw err;
      }
    },
    async deactivate(id: string) {
      const plugin = plugins_map.get(id);
      if (plugin) plugin.state = "inactive";
    },
    get(id: string) {
      const p = plugins_map.get(id);
      if (!p) return null;
      return { id: p.manifest.id as string, name: p.manifest.name as string, version: p.manifest.version as string, state: p.state, error: null };
    },
    list() {
      return [...plugins_map.values()].map((p) => ({
        id: p.manifest.id as string,
        name: p.manifest.name as string,
        version: p.manifest.version as string,
        state: p.state,
        error: null,
      }));
    },
    is_active(id: string) {
      return plugins_map.get(id)?.state === "active";
    },
    on(event: string, callback: Function) {
      if (!plugin_emitter.has(event)) plugin_emitter.set(event, new Set());
      plugin_emitter.get(event)!.add(callback);
      return () => { plugin_emitter.get(event)?.delete(callback); };
    },
    async trigger_activation() { return []; },
    async load_from_url() { return ""; },
    perf_stats() { return {}; },
  } satisfies XkinAPI["plugins"];

  /* ── Keys (real DOM listeners) ─────────────────── */

  const bindings: Array<Record<string, unknown>> = [];

  /** Parse "ctrl+s" → { ctrl: true, shift: false, alt: false, key: "s" } */
  function parse_keys(combo: string) {
    const parts = combo.toLowerCase().split("+");
    return {
      ctrl: parts.includes("ctrl") || parts.includes("mod"),
      shift: parts.includes("shift"),
      alt: parts.includes("alt"),
      key: parts.filter((p) => !["ctrl", "shift", "alt", "mod"].includes(p))[0] || "",
    };
  }

  function matches_event(e: KeyboardEvent, combo: string): boolean {
    const parsed = parse_keys(combo);
    const key = e.key.toLowerCase();
    // Handle special key names
    const key_match =
      parsed.key === "tab" ? key === "tab" :
      parsed.key === "escape" ? key === "escape" :
      key === parsed.key;
    return (
      key_match &&
      e.ctrlKey === parsed.ctrl &&
      e.shiftKey === parsed.shift &&
      e.altKey === parsed.alt
    );
  }

  // Global keydown listener
  const keydown_handler = (e: KeyboardEvent) => {
    for (const binding of bindings) {
      const combo = binding.keys as string;
      if (combo && matches_event(e, combo)) {
        e.preventDefault();
        e.stopPropagation();
        const run = binding.run as Function;
        if (run) run(e);
        return;
      }
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("keydown", keydown_handler);
  }

  const keys = {
    add(binding: Record<string, unknown>) {
      bindings.push(binding);
      return () => {
        const idx = bindings.indexOf(binding);
        if (idx >= 0) bindings.splice(idx, 1);
      };
    },
    add_all(list: Array<Record<string, unknown>>) {
      list.forEach((b) => bindings.push(b));
      return () => { list.forEach((b) => { const i = bindings.indexOf(b); if (i >= 0) bindings.splice(i, 1); }); };
    },
    remove(id: string) {
      const idx = bindings.findIndex((b) => b.id === id);
      if (idx >= 0) bindings.splice(idx, 1);
    },
    override() { return noop_dispose; },
    unbind() { return noop_dispose; },
    list() { return bindings as never[]; },
    context<T>(_name: string, default_value: T) {
      let val = default_value;
      return { set(v: T) { val = v; }, get() { return val; }, reset() { val = default_value; } };
    },
  } satisfies XkinAPI["keys"];

  /* ── UI Slot Manager (stub) ───────────────────── */

  const ui = {
    $slots,
    $notifications,
    $dialog,
    add(slot: string, plugin_id: string, contribution: Record<string, unknown>) {
      if (!slots.has(slot)) slots.set(slot, []);
      slots.get(slot)!.push({ id: contribution.id as string, plugin_id, ...contribution });
      return noop_dispose;
    },
    remove() {},
    get(slot: string) { return slots.get(slot) ?? []; },
    mount() {},
    unmount() {},
    show_notification(_pid: string, message: string) {
      console.log(`[notification] ${message}`);
      return crypto.randomUUID();
    },
    dismiss_notification() {},
    async show_quick_pick<T>(_pid: string, items: T[]) { return items[0] ?? null; },
    async show_input(_pid: string, opts?: { placeholder?: string; value?: string }) {
      return prompt(opts?.placeholder ?? "Input:", opts?.value ?? "") ?? null;
    },
    on() { return noop_dispose; },
    slot_names() { return ["sidebar_left", "sidebar_right", "toolbar", "editor_title", "bottom_panel", "status_bar", "overlay"] as never[]; },
    generate_settings_ui() { return null; },
  } satisfies XkinAPI["ui"];

  /* ── Assemble XkinAPI ─────────────────────────── */

  const xkin: XkinAPI = {
    // Atoms
    $workspace, $files, $active_file, $open_files,
    $file_tree, $is_dirty, $dirty_files, $active_entry,
    $types,
    $document, $sections, $selection, $drag_state,

    // Modules
    files,
    workspace: {
      async create(id: string, opts?: Record<string, unknown>) {
        const ws = { id, name: (opts?.name as string) || id, created_at: Date.now(), updated_at: Date.now(), meta: {} };
        $workspace.set(ws);
        return ws;
      },
      async switch() { return $workspace.get(); },
      current() { return $workspace.get(); },
      async list() { const ws = $workspace.get(); return ws ? [ws] : []; },
      async delete() { $workspace.set(null); },
      update() { return $workspace.get(); },
      snapshot() { return null; },
      async mount() { return null; },
      to_json() { const result: Record<string, string> = {}; for (const [k, v] of file_contents) result[k] = v; return result; },
      async from_json(id: string, file_map: Record<string, string>) {
        for (const [path, content] of Object.entries(file_map)) {
          await files.create(path, content);
        }
        const ws = { id, name: id, created_at: Date.now(), updated_at: Date.now(), meta: {} };
        $workspace.set(ws);
        return ws;
      },
      set_persistence: noop,
      set_format_on_save: noop,
      get_format_on_save() { return false; },
      save: noop_async,
      auto_save() { return noop_dispose; },
      on() { return noop_dispose; },
    },
    persistence: {
      local_storage() { return { save: noop_async, load: async () => null, delete: noop_async, list: async () => [] }; },
      indexed_db() { return { save: noop_async, load: async () => null, delete: noop_async, list: async () => [] }; },
      remote() { return { save: noop_async, load: async () => null, delete: noop_async, list: async () => [] }; },
    },
    keys,
    hooks,
    plugins,
    ui,
    commands: {
      async run_command(id: string, ...args: unknown[]) {
        const binding = bindings.find((b) => b.id === id);
        if (binding?.run) await (binding.run as Function)(null, ...args);
      },
    },
    dnd: {
      init: noop,
      destroy: noop,
      register_section: noop,
      register_block: noop,
      unregister_section: noop,
      unregister_block: noop,
      async add_section() { return $document.get(); },
      async add_block() { return $document.get(); },
      async remove_section() { return $document.get(); },
      async remove_block() { return $document.get(); },
      async move_section() { return $document.get(); },
      async move_block() { return $document.get(); },
      async update_block() { return $document.get(); },
      render() { return null; },
      export_html() { return ""; },
      undo: noop,
      redo: noop,
      $can_undo: computed($document, () => false),
      $can_redo: computed($document, () => false),
      select: noop,
      clear_selection: noop,
      async delete_selected() {},
      engine: null as unknown,
      feedback: null as unknown,
      $document, $sections, $selection, $drag_state,
    },

    // Store & Engine
    store: { atom, computed, map: atom },
    get engine() { return { h, Fragment, render, createElement: h, renderToString: () => "" }; },

    // Editor (mock — no Monaco in dev mode)
    editor(_opts) {
      console.log("[mock] editor() — Monaco not available in dev mode");
      return {
        dispose: noop,
        setModel: noop,
        getModel: () => null,
        onDidChangeModelContent: () => ({ dispose: noop }),
      };
    },
    set_theme: noop,
    set_language: noop,
    create_model() { return null; },
    get_model() { return null; },
    delete_model: noop,

    // Types
    add_types: noop,
    set_types: noop,
    get_types() { return []; },
    set_compiler: noop,

    // Tools (stubs — no Babel/Prettier/Sass in dev)
    async tsx(args) {
      // Minimal JSX→JS transform: replace <Tag ...> with h() calls
      // Not a real transpiler — enough to make preview work in dev mode
      let code = args.source;
      // Strip TypeScript type annotations (simple cases)
      code = code.replace(/:\s*(string|number|boolean|any|unknown|void|never)\b/g, "");
      code = code.replace(/interface\s+\w+\s*\{[^}]*\}/g, "");
      // Strip import type statements
      code = code.replace(/^import\s+type\s+.*$/gm, "");
      return { code };
    },
    async format(args) { return args.source; },
    markdown(args) { return `<p>${args.source}</p>`; },
    async mdx(_args) {
      // Minimal MDX: extract ui-* tags as symbols
      const tag_re = /<((?:ui|layout|widget|app|data|form|nav|icon)-[\w-]+)/g;
      const symbols: string[] = [];
      let match;
      while ((match = tag_re.exec(_args.source)) !== null) {
        const tag = match[1];
        const name = tag.slice(tag.indexOf("-") + 1);
        if (!symbols.includes(name)) symbols.push(name);
      }
      return { tree: { type: "root", source: _args.source }, symbols };
    },
    async sass(args) { return { css: args.source }; },
    async css_modules(args) {
      // Extract class names from SCSS/CSS source and generate token map
      const tokens: Record<string, string> = {};
      const class_re = /\.([a-zA-Z_][\w-]*)\s*[{,]/g;
      let match;
      while ((match = class_re.exec(args.source)) !== null) {
        const name = match[1];
        if (!tokens[name]) {
          tokens[name] = name; // In dev mode, class names pass through unscoped
        }
      }
      return { css: args.source, tokens };
    },

    // Utilities
    detect_language: infer_language,
    async run_command(id: string, ...args: unknown[]) {
      const binding = bindings.find((b) => b.id === id);
      if (binding?.run) await (binding.run as Function)(null, ...args);
    },
  };

  return xkin;
}
