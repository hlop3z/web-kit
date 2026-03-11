import type { XkinAPI, VNode } from "../../types.ts";
import type { ProjectStore } from "../project.ts";
import { confirm_delete } from "../confirm.ts";

/**
 * Explorer — entity list sidebar.
 *
 * Shows all Components or Layouts (depending on mode) as a vertical list.
 * The file tree is now in the toolbar (row 2), not here.
 *
 * ┌──────────────────────┐
 * │ [+ New]              │
 * │ ● Counter        ×   │
 * │ ○ Button         ×   │
 * │ ○ Card           ×   │
 * │ ○ Modal          ×   │
 * │ ...                  │
 * └──────────────────────┘
 */
export function create_explorer(xkin: XkinAPI, project: ProjectStore) {
  const { h } = xkin.engine;

  const add_entity = async () => {
    const mode = project.$mode.get();
    const label = mode === "components" ? "Component" : "Layout";
    const name = await xkin.ui.show_input("cs.explorer", {
      placeholder: `New ${label} name`,
    });
    if (!name) return;
    const ref = await project.create_entity(name, mode);
    await project.switch_entity(ref.id);
  };

  const delete_entity = async (id: string, name: string, e: Event) => {
    e.stopPropagation();
    const ok = await confirm_delete(`Delete "${name}" and all its files?`);
    if (ok) await project.delete_entity(id);
  };

  return (): VNode => {
    const mode = project.$mode.get();
    const entities = project.list_current();
    const active_id = project.$active_entity.get();
    const mode_label = mode === "components" ? "Components" : "Layouts";

    return h("div", { class: "cs-explorer" },
      // Header with + New
      h("div", { class: "cs-explorer-header" },
        h("span", { class: "cs-explorer-title" }, mode_label),
        h("button", {
          class: "cs-btn cs-btn-sm cs-btn-accent",
          onClick: add_entity,
          title: `New ${mode === "components" ? "Component" : "Layout"}`,
        }, "+ New"),
      ),

      // Entity list
      entities.length === 0
        ? h("p", { class: "cs-hint cs-explorer-hint" },
            `No ${mode} yet`,
          )
        : h("div", { class: "cs-entity-list" },
            ...entities.map((ref) => {
              const is_active = ref.id === active_id;
              return h("div", {
                key: ref.id,
                class: `cs-entity-row ${is_active ? "active" : ""}`,
                onClick: () => project.switch_entity(ref.id),
                title: ref.name,
              },
                h("span", { class: "cs-entity-dot" }, is_active ? "\u25cf" : "\u25cb"),
                h("span", { class: "cs-entity-name" }, ref.name),
                h("button", {
                  class: "cs-entity-delete",
                  onClick: (e: Event) => delete_entity(ref.id, ref.name, e),
                  title: "Delete",
                }, "\u00d7"),
              );
            }),
          ),
    );
  };
}
