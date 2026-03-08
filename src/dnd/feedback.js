/* ── Visual Feedback for Drag-and-Drop ──────────── */

/**
 * Creates visual feedback components and CSS for the DnD system.
 * Components use Preact's h() from globalThis.XkinEngine.
 */
const create_feedback = () => {
  const get_engine = () => globalThis.XkinEngine;

  /**
   * DropIndicator — renders a thin line at the insertion point.
   *
   * Props:
   *   position  "horizontal" (default) | "vertical"
   *   visible   boolean (default true)
   *   style     optional style overrides (object)
   */
  const DropIndicator = (props = {}) => {
    const engine = get_engine();
    if (!engine) return null;
    const { h } = engine;

    const { position = "horizontal", visible = true, style = {} } = props;
    if (!visible) return null;

    const is_h = position === "horizontal";

    return h("div", {
      class: "xkin-drop-indicator",
      "data-position": position,
      "aria-hidden": "true",
      style: {
        position: "absolute",
        background: "var(--xkin-drop-indicator-color, #2563eb)",
        borderRadius: "2px",
        pointerEvents: "none",
        zIndex: 9999,
        transition: "all 150ms ease",
        ...(is_h
          ? { left: 0, right: 0, height: "2px" }
          : { top: 0, bottom: 0, width: "2px" }),
        ...style,
      },
    });
  };

  /**
   * DragOverlay — wrapper for the floating drag preview.
   *
   * Props:
   *   children  VNode content
   *   style     optional style overrides
   */
  const DragOverlay = (props = {}) => {
    const engine = get_engine();
    if (!engine) return null;
    const { h } = engine;

    const { children, style = {} } = props;

    return h("div", {
      class: "xkin-drag-overlay",
      "aria-hidden": "true",
      style: {
        position: "fixed",
        pointerEvents: "none",
        zIndex: 99999,
        opacity: 0.85,
        boxShadow: "0 4px 12px rgba(0,0,0,.15)",
        ...style,
      },
    }, children);
  };

  /**
   * DropTarget — visual highlight on valid drop targets.
   *
   * Props:
   *   active    boolean — whether this target is currently hovered
   *   children  VNode content
   *   style     optional style overrides
   */
  const DropTarget = (props = {}) => {
    const engine = get_engine();
    if (!engine) return null;
    const { h } = engine;

    const { active = false, children, style = {} } = props;

    return h("div", {
      class: "xkin-drop-target",
      "data-xkin-drop-target": active ? "true" : undefined,
      style: {
        position: "relative",
        ...style,
      },
    }, children);
  };

  /**
   * CSS rules for DnD visual feedback.
   * Inject into <style> or use @dnd-kit's StyleSheetManager.
   */
  const css = `
.xkin-drop-indicator {
  pointer-events: none;
  z-index: 9999;
}
.xkin-drag-overlay {
  pointer-events: none;
  z-index: 99999;
}
[data-xkin-dragging="true"] {
  opacity: 0.4;
}
[data-xkin-drop-target="true"] {
  outline: 2px dashed var(--xkin-drop-target-color, #2563eb);
  outline-offset: 2px;
}
[data-xkin-drag-handle] {
  cursor: grab;
}
[data-xkin-drag-handle]:active {
  cursor: grabbing;
}
`.trim();

  /**
   * Inject the feedback CSS into a document or shadow root.
   * Returns a cleanup function.
   */
  const inject_css = (root = document) => {
    const doc = root === document ? document : root;
    const style = doc.createElement ? doc.createElement("style") : null;
    if (!style) return () => {};

    style.setAttribute("data-xkin-dnd", "");
    style.textContent = css;

    const target = doc.head || doc;
    target.appendChild(style);
    return () => style.remove();
  };

  return { DropIndicator, DragOverlay, DropTarget, css, inject_css };
};

export { create_feedback };
