import type { XkinAPI, VNode } from "../../types.ts";
import type { ProjectStore, StudioMode } from "../project.ts";
import { confirm_delete } from "../confirm.ts";

/**
 * Toolbar — two-row top bar.
 *
 * Row 1: Mode tabs [Components · Layouts · (Widgets) · (Views)] + actions
 * Row 2: File pills for the active entity (horizontal) + [+ Add]
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │ Core [Components · Layouts]    Apps [Widgets · Views]     │
 * │ ▸ index.tsx  ◈ styles.scss  header.tsx  [+ Add]   [Save] │
 * └──────────────────────────────────────────────────────────┘
 */
export function create_toolbar(xkin: XkinAPI, project: ProjectStore) {
  const { h } = xkin.engine;

  const STYLE_LANGS = new Set(["scss", "css"]);

  const modes: Array<{ id: StudioMode; label: string }> = [
    { id: "components", label: "Components" },
    { id: "layouts",    label: "Layouts" },
  ];

  const future_modes = ["Widgets", "Views"];

  const file_name = (path: string) => {
    const parts = path.split("/");
    return parts[parts.length - 1] || path;
  };

  const open_file = (path: string) => {
    xkin.files.open(path);
    xkin.files.set_active(path, null);
  };

  const actions = {
    async save() {
      const path = xkin.$active_file.get();
      if (path) {
        xkin.files.mark_clean(path);
        await xkin.workspace.save();
      }
    },
    async save_all() {
      xkin.files.mark_all_clean();
      await xkin.workspace.save();
    },
  };

  const add_part = async () => {
    // Auto-name: find next available part_N.tsx
    const existing = xkin.$files.get();
    let n = 1;
    while (existing.some((f) => f.path === `part_${n}.tsx`)) n++;
    const path = `part_${n}.tsx`;

    await xkin.files.create(path, "");
    open_file(path);
  };

  return (): VNode => {
    const is_dirty = xkin.$is_dirty.get();
    const current_mode = project.$mode.get();
    const active_entity = project.$active_entity.get();

    const all_files = xkin.$files.get();
    const active_file = xkin.$active_file.get();

    /* ── Row 1: Mode tabs ────────────────────── */

    const row1 = h("div", { class: "cs-toolbar-row cs-toolbar-modes" },
      h("div", { class: "cs-toolbar-left" },
        h("div", { class: "cs-mode-tabs" },
          h("span", { class: "cs-mode-group-label" }, "Core"),
          ...modes.map((m) =>
            h("button", {
              key: m.id,
              class: `cs-mode-tab ${current_mode === m.id ? "active" : ""}`,
              onClick: () => project.set_mode(m.id),
            }, m.label),
          ),
          h("span", { class: "cs-mode-sep" }),
          h("span", { class: "cs-mode-group-label" }, "Apps"),
          ...future_modes.map((label) =>
            h("button", {
              key: label,
              class: "cs-mode-tab disabled",
              disabled: true,
              title: `${label} (Layer 2)`,
            }, label),
          ),
        ),
      ),
      h("div", { class: "cs-toolbar-right" },
        h("button", {
          class: `cs-btn ${is_dirty ? "cs-btn-accent" : ""}`,
          onClick: actions.save,
          title: "Save (Ctrl+S)",
          disabled: !is_dirty,
        }, "Save"),
        h("button", {
          class: "cs-btn",
          onClick: actions.save_all,
          title: "Save All (Ctrl+Shift+S)",
        }, "Save All"),
      ),
    );

    /* ── Row 2: File pills ───────────────────── */

    const row2_content = active_entity
      ? [
          h("div", { class: "cs-file-bar" },
            ...all_files.map((f) => {
              const is_active = f.path === active_file;
              const is_main = f.main;
              const is_style = STYLE_LANGS.has(f.language);
              const icon = is_main ? "\u25b8" : is_style ? "\u25c8" : "\u25aa";

              // Main and style files can't be deleted
              const deletable = !is_main && !is_style;

              return h("div", {
                key: f.path,
                class: `cs-file-pill ${is_active ? "active" : ""} ${f.dirty ? "dirty" : ""}`,
                onClick: () => open_file(f.path),
                title: f.path,
              },
                h("span", { class: "cs-file-pill-icon" }, icon),
                h("span", null, file_name(f.path)),
                f.dirty
                  ? h("span", { class: "cs-dirty-dot" }, "\u2022")
                  : null,
                deletable
                  ? h("button", {
                      class: "cs-file-pill-close",
                      onClick: async (e: Event) => {
                        e.stopPropagation();
                        const ok = await confirm_delete(`Delete "${file_name(f.path)}"?`);
                        if (ok) xkin.files.delete(f.path);
                      },
                      title: "Delete part",
                    }, "\u00d7")
                  : null,
              );
            }),
          ),
          h("button", {
            class: "cs-btn cs-btn-sm cs-file-add-btn",
            onClick: add_part,
            title: "Add file",
          }, "+ Add"),
        ]
      : [
          h("span", { class: "cs-hint" }, "Select an entity to see its files"),
        ];

    const row2 = h("div", { class: "cs-toolbar-row cs-toolbar-files" }, ...row2_content);

    return h("div", { class: "cs-toolbar" }, row1, row2);
  };
}
