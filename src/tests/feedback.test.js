import { describe, it, expect, beforeEach } from "vitest";
import { create_feedback } from "../dnd/feedback.js";

/* ── Mock Preact engine ──────────────────────────── */

const mock_h = (tag, props, ...children) => ({
  tag,
  props: props || {},
  children: children.flat(),
});

describe("feedback", () => {
  let fb;

  beforeEach(() => {
    globalThis.XkinEngine = { h: mock_h, Fragment: ({ children }) => children };
    fb = create_feedback();
  });

  describe("DropIndicator", () => {
    it("returns a VNode with correct class", () => {
      const vnode = fb.DropIndicator();
      expect(vnode.tag).toBe("div");
      expect(vnode.props.class).toBe("xkin-drop-indicator");
    });

    it("defaults to horizontal position", () => {
      const vnode = fb.DropIndicator();
      expect(vnode.props["data-position"]).toBe("horizontal");
    });

    it("supports vertical position", () => {
      const vnode = fb.DropIndicator({ position: "vertical" });
      expect(vnode.props["data-position"]).toBe("vertical");
    });

    it("returns null when not visible", () => {
      const vnode = fb.DropIndicator({ visible: false });
      expect(vnode).toBeNull();
    });

    it("returns null without XkinEngine", () => {
      globalThis.XkinEngine = null;
      const vnode = fb.DropIndicator();
      expect(vnode).toBeNull();
    });

    it("is aria-hidden", () => {
      const vnode = fb.DropIndicator();
      expect(vnode.props["aria-hidden"]).toBe("true");
    });
  });

  describe("DragOverlay", () => {
    it("returns a VNode with correct class", () => {
      const vnode = fb.DragOverlay({ children: "hello" });
      expect(vnode.tag).toBe("div");
      expect(vnode.props.class).toBe("xkin-drag-overlay");
    });

    it("passes children through", () => {
      const vnode = fb.DragOverlay({ children: "content" });
      expect(vnode.children).toContain("content");
    });

    it("returns null without XkinEngine", () => {
      globalThis.XkinEngine = null;
      const vnode = fb.DragOverlay();
      expect(vnode).toBeNull();
    });
  });

  describe("DropTarget", () => {
    it("returns a VNode with correct class", () => {
      const vnode = fb.DropTarget({ children: "zone" });
      expect(vnode.tag).toBe("div");
      expect(vnode.props.class).toBe("xkin-drop-target");
    });

    it("sets data attribute when active", () => {
      const vnode = fb.DropTarget({ active: true });
      expect(vnode.props["data-xkin-drop-target"]).toBe("true");
    });

    it("omits data attribute when inactive", () => {
      const vnode = fb.DropTarget({ active: false });
      expect(vnode.props["data-xkin-drop-target"]).toBeUndefined();
    });

    it("returns null without XkinEngine", () => {
      globalThis.XkinEngine = null;
      const vnode = fb.DropTarget();
      expect(vnode).toBeNull();
    });
  });

  describe("css", () => {
    it("contains drop indicator styles", () => {
      expect(fb.css).toContain(".xkin-drop-indicator");
    });

    it("contains drag overlay styles", () => {
      expect(fb.css).toContain(".xkin-drag-overlay");
    });

    it("contains dragging state styles", () => {
      expect(fb.css).toContain("[data-xkin-dragging");
    });

    it("contains drop target styles", () => {
      expect(fb.css).toContain("[data-xkin-drop-target");
    });

    it("contains drag handle cursor styles", () => {
      expect(fb.css).toContain("[data-xkin-drag-handle]");
      expect(fb.css).toContain("cursor: grab");
    });
  });

  describe("inject_css", () => {
    it("is a function", () => {
      expect(typeof fb.inject_css).toBe("function");
    });
  });
});
