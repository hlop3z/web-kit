import type { XkinAPI, VNode } from "../../types.ts";

/**
 * Toolbar — top action bar.
 *
 * Provides Save, Format, New File actions. Wired to xkin.files and
 * xkin.workspace APIs.
 */
export function create_toolbar(xkin: XkinAPI) {
  const { h } = xkin.engine;

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

    async format() {
      const path = xkin.$active_file.get();
      if (path) {
        await xkin.files.format(path);
      }
    },

    async new_file() {
      // Use ui.show_input to prompt for filename
      const name = await xkin.ui.show_input("xkin-studio", {
        placeholder: "Enter file path (e.g., src/app.tsx)",
      });
      if (name) {
        await xkin.files.create(name, "");
        xkin.files.open(name);
        xkin.files.set_active(name, null);
      }
    },
  };

  return (): VNode => {
    const is_dirty = xkin.$is_dirty.get();

    return h("div", { class: "cs-toolbar" },
      h("div", { class: "cs-toolbar-left" },
        h("button", {
          class: "cs-btn",
          onClick: actions.new_file,
          title: "New File",
        }, "+ New"),
      ),
      h("div", { class: "cs-toolbar-right" },
        h("button", {
          class: `cs-btn ${is_dirty ? "cs-btn-accent" : ""}`,
          onClick: actions.save,
          title: "Save current file (Ctrl+S)",
          disabled: !is_dirty,
        }, "Save"),
        h("button", {
          class: "cs-btn",
          onClick: actions.save_all,
          title: "Save all files",
        }, "Save All"),
        h("button", {
          class: "cs-btn",
          onClick: actions.format,
          title: "Format current file",
        }, "Format"),
      ),
    );
  };
}
