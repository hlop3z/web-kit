import type { XkinAPI, VNode } from "../../types.ts";

/**
 * Tabs — open file tab bar.
 *
 * Reads xkin.$open_files and xkin.$active_file.
 * Clicking a tab calls xkin.files.set_active().
 * Close button calls xkin.files.close().
 */
export function create_tabs(xkin: XkinAPI) {
  const { h } = xkin.engine;

  const file_name = (path: string) => {
    const parts = path.split("/");
    return parts[parts.length - 1] || path;
  };

  return (): VNode => {
    const open = xkin.$open_files.get();
    const active = xkin.$active_file.get();

    if (open.length === 0) {
      return h("div", { class: "cs-tabs cs-empty" });
    }

    return h("div", { class: "cs-tabs" },
      ...open.map((path) => {
        const is_active = path === active;
        const entry = xkin.files.entry(path);
        const is_dirty = entry ? entry.dirty : false;

        return h("div", {
          key: path,
          class: `cs-tab ${is_active ? "active" : ""}`,
          onClick: () => xkin.files.set_active(path, null),
          title: path,
        },
          h("span", { class: "cs-tab-label" },
            is_dirty ? h("span", { class: "cs-dirty-dot" }, "\u2022 ") : null,
            file_name(path),
          ),
          h("button", {
            class: "cs-tab-close",
            onClick: (e: Event) => {
              e.stopPropagation();
              xkin.files.close(path);
            },
            title: "Close",
          }, "\u00d7"),
        );
      }),
    );
  };
}
