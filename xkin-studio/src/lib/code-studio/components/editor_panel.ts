import type { XkinAPI, Dispose, VNode } from "../../types.ts";

/**
 * EditorPanel — code editor with Monaco or textarea fallback.
 *
 * Tries xkin.editor() (Monaco). If the returned instance has no real
 * getModel(), falls back to a <textarea> that reads/writes via xkin.files.
 * This makes the editor usable in dev mode without Monaco.
 */
export function create_editor_panel(xkin: XkinAPI) {
  const { h } = xkin.engine;

  let editor_instance: unknown = null;
  let has_monaco = false;
  let content_dispose: Dispose | null = null;
  let active_sub: Dispose | null = null;
  let textarea_el: HTMLTextAreaElement | null = null;

  /* ── Monaco path ─────────────────────────────── */

  const mount_monaco = (container: HTMLElement) => {
    if (editor_instance) return;

    const active = xkin.$active_file.get();
    const content = active ? xkin.files.read(active) ?? "" : "";
    const entry = active ? xkin.files.entry(active) : null;

    editor_instance = xkin.editor({
      element: container,
      value: content,
      language: entry?.language ?? "javascript",
      theme: "xkin-dark",
      minimap: false,
      font_size: 14,
      auto_layout: true,
    });

    // Check if Monaco actually mounted (mock returns noop getModel)
    const ed = editor_instance as {
      getModel(): unknown;
      onDidChangeModelContent(cb: () => void): { dispose(): void };
    };
    if (ed.getModel() !== null || (active && xkin.files.get(active))) {
      has_monaco = true;
    } else {
      // Monaco not available — dispose and let textarea handle it
      has_monaco = false;
      (editor_instance as { dispose(): void }).dispose();
      editor_instance = null;
      return;
    }

    // Track content changes
    const change_handler = ed.onDidChangeModelContent(() => {
      const model = ed.getModel() as { getValue(): string } | null;
      if (!model) return;
      const path = xkin.$active_file.get();
      if (path) xkin.files.update(path, model.getValue());
    });
    content_dispose = () => change_handler.dispose();

    // Subscribe to active file changes
    active_sub = xkin.$active_file.subscribe((new_path) => {
      if (!editor_instance || !new_path) return;
      const model = xkin.files.get(new_path);
      if (model) {
        const ed_typed = editor_instance as { setModel(m: unknown): void };
        const current = xkin.$active_file.get();
        if (current && current !== new_path) {
          xkin.files.save_view_state(current, editor_instance);
        }
        ed_typed.setModel(model);
        xkin.files.restore_view_state(new_path, editor_instance);
      }
    });
  };

  /* ── Textarea fallback ───────────────────────── */

  const sync_textarea = () => {
    if (!textarea_el) return;
    const active = xkin.$active_file.get();
    if (active) {
      const content = xkin.files.read(active);
      if (content !== null && textarea_el.value !== content) {
        textarea_el.value = content;
      }
    } else {
      textarea_el.value = "";
    }
  };

  const on_textarea_input = () => {
    if (!textarea_el) return;
    const active = xkin.$active_file.get();
    if (active) {
      xkin.files.update(active, textarea_el.value);
    }
  };

  /** Tab inserts 2 spaces instead of moving focus */
  const on_textarea_keydown = (e: KeyboardEvent) => {
    if (!textarea_el) return;
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const start = textarea_el.selectionStart;
      const end = textarea_el.selectionEnd;

      if (e.shiftKey) {
        // Shift+Tab: dedent current line(s)
        const val = textarea_el.value;
        const line_start = val.lastIndexOf("\n", start - 1) + 1;
        if (val.substring(line_start, line_start + 2) === "  ") {
          textarea_el.value = val.substring(0, line_start) + val.substring(line_start + 2);
          textarea_el.selectionStart = Math.max(start - 2, line_start);
          textarea_el.selectionEnd = Math.max(end - 2, line_start);
          on_textarea_input();
        }
      } else {
        // Tab: insert 2 spaces
        textarea_el.value =
          textarea_el.value.substring(0, start) +
          "  " +
          textarea_el.value.substring(end);
        textarea_el.selectionStart = textarea_el.selectionEnd = start + 2;
        on_textarea_input();
      }
    }
  };

  const mount_textarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    textarea_el = el;
    sync_textarea();

    // Subscribe to active file changes for textarea
    if (!active_sub) {
      active_sub = xkin.$active_file.subscribe(() => sync_textarea());
    }
  };

  /* ── Lifecycle ───────────────────────────────── */

  const dispose = () => {
    if (content_dispose) { content_dispose(); content_dispose = null; }
    if (active_sub) { active_sub(); active_sub = null; }
    if (editor_instance) {
      (editor_instance as { dispose(): void }).dispose();
      editor_instance = null;
    }
    textarea_el = null;
  };

  /* ── Render ──────────────────────────────────── */

  let mount_attempted = false;

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

    // Try Monaco on first mount
    if (!mount_attempted) {
      return h("div", {
        class: "cs-editor-panel",
        ref: (el: HTMLElement | null) => {
          if (el && !mount_attempted) {
            mount_attempted = true;
            mount_monaco(el);
            // If Monaco failed, force a re-render by touching a file atom
            if (!has_monaco) {
              xkin.$active_file.set(xkin.$active_file.get());
            }
          }
        },
        style: { width: "100%", height: "100%" },
      });
    }

    // Monaco mounted successfully
    if (has_monaco) {
      return h("div", {
        class: "cs-editor-panel",
        style: { width: "100%", height: "100%" },
      });
    }

    // Textarea fallback
    const content = xkin.files.read(active) ?? "";
    return h("div", { class: "cs-editor-panel cs-editor-fallback" },
      h("textarea", {
        class: "cs-editor-textarea",
        value: content,
        onInput: on_textarea_input,
        onKeyDown: on_textarea_keydown,
        ref: mount_textarea,
        spellcheck: false,
        autocomplete: "off",
        autocapitalize: "off",
      }),
    );
  };

  return { render, dispose, mount_editor: mount_monaco };
}
