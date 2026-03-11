import type { XkinAPI, VNode } from "../../types.ts";
import type { ProjectStore } from "../project.ts";

/**
 * StatusBar — bottom info bar.
 *
 * Shows: mode · entity name · active file language · dirty state · file count.
 */
export function create_status_bar(xkin: XkinAPI, project: ProjectStore) {
  const { h } = xkin.engine;

  return (): VNode => {
    const mode = project.$mode.get();
    const entity = project.active_ref();
    const active = xkin.$active_file.get();
    const entry = active ? xkin.files.entry(active) : null;
    const dirty_files = xkin.$dirty_files.get();
    const files = xkin.$files.get();

    const mode_label = mode === "components" ? "Component" : "Layout";

    return h("div", { class: "cs-status-bar" },
      h("div", { class: "cs-status-left" },
        h("span", { class: "cs-status-item cs-status-mode" }, mode_label),
        entity
          ? h("span", { class: "cs-status-item" }, entity.name)
          : h("span", { class: "cs-status-item cs-status-muted" }, "No entity"),
        h("span", { class: "cs-status-item cs-status-sep" }, "|"),
        h("span", { class: "cs-status-item" },
          `${files.length} file${files.length !== 1 ? "s" : ""}`,
        ),
      ),
      h("div", { class: "cs-status-right" },
        entry
          ? h("span", { class: "cs-status-item" }, entry.language.toUpperCase())
          : null,
        dirty_files.length > 0
          ? h("span", { class: "cs-status-item cs-status-dirty" },
              `${dirty_files.length} unsaved`,
            )
          : null,
      ),
    );
  };
}
