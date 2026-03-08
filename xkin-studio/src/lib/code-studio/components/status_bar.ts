import type { XkinAPI, VNode } from "../../types.ts";

/**
 * StatusBar — bottom info bar.
 *
 * Shows workspace name, active file language, dirty state, and file count.
 */
export function create_status_bar(xkin: XkinAPI) {
  const { h } = xkin.engine;

  return (): VNode => {
    const ws = xkin.$workspace.get();
    const active = xkin.$active_file.get();
    const entry = active ? xkin.files.entry(active) : null;
    const dirty_files = xkin.$dirty_files.get();
    const files = xkin.$files.get();

    return h("div", { class: "cs-status-bar" },
      h("div", { class: "cs-status-left" },
        h("span", { class: "cs-status-item" },
          ws ? ws.name : "No workspace",
        ),
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
