import type { XkinAPI, Dispose, VNode } from "../../types.ts";

/**
 * EditorPanel — Monaco Editor wrapper.
 *
 * Creates and manages a Monaco editor instance. Reacts to $active_file
 * changes by switching the editor model. Tracks dirty state on content
 * changes.
 */
export function create_editor_panel(xkin: XkinAPI) {
  const { h } = xkin.engine;

  let editor_instance: unknown = null;
  let content_dispose: Dispose | null = null;
  let active_sub: Dispose | null = null;

  const mount_editor = (container: HTMLElement) => {
    if (editor_instance) return;

    const active = xkin.$active_file.get();
    const content = active ? xkin.files.read(active) ?? "" : "";
    const entry = active ? xkin.files.entry(active) : null;

    editor_instance = xkin.editor({
      element: container,
      value: content,
      language: entry?.language ?? "javascript",
      theme: "vs-dark",
      minimap: false,
      font_size: 14,
      auto_layout: true,
    });

    // If there's an active file, restore its model
    if (active) {
      const model = xkin.files.get(active);
      if (model && editor_instance) {
        (editor_instance as { setModel(m: unknown): void }).setModel(model);
        xkin.files.restore_view_state(active, editor_instance);
      }
    }

    // Track content changes → update file content
    const ed = editor_instance as {
      onDidChangeModelContent(cb: () => void): { dispose(): void };
      getModel(): { getValue(): string; uri: { path: string } } | null;
    };

    const change_handler = ed.onDidChangeModelContent(() => {
      const model = ed.getModel();
      if (!model) return;
      const path = xkin.$active_file.get();
      if (path) {
        // File content is synced through the Monaco model,
        // we just need to mark it dirty via update
        xkin.files.update(path, model.getValue());
      }
    });
    content_dispose = () => change_handler.dispose();

    // Subscribe to active file changes
    active_sub = xkin.$active_file.subscribe((new_path) => {
      if (!editor_instance || !new_path) return;
      const model = xkin.files.get(new_path);
      if (model) {
        const ed_typed = editor_instance as {
          setModel(m: unknown): void;
          getModel(): unknown;
        };
        // Save current view state before switching
        const current = xkin.$active_file.get();
        if (current && current !== new_path) {
          xkin.files.save_view_state(current, editor_instance);
        }
        ed_typed.setModel(model);
        xkin.files.restore_view_state(new_path, editor_instance);
      }
    });
  };

  const dispose = () => {
    if (content_dispose) { content_dispose(); content_dispose = null; }
    if (active_sub) { active_sub(); active_sub = null; }
    if (editor_instance) {
      (editor_instance as { dispose(): void }).dispose();
      editor_instance = null;
    }
  };

  const render = (): VNode => {
    const active = xkin.$active_file.get();

    if (!active) {
      return h("div", { class: "cs-editor-panel cs-empty" },
        h("div", { class: "cs-welcome" },
          h("h2", null, "Xkin Studio"),
          h("p", null, "Open a file to start editing"),
        ),
      );
    }

    // The editor container. We use a ref-like pattern:
    // the plugin's mount() will call mount_editor when the DOM is ready.
    return h("div", {
      class: "cs-editor-panel",
      ref: (el: HTMLElement | null) => {
        if (el && !editor_instance) {
          mount_editor(el);
        }
      },
      style: { width: "100%", height: "100%" },
    });
  };

  return { render, dispose, mount_editor };
}
