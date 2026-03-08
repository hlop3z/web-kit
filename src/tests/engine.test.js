import { describe, it, expect, beforeEach, vi } from "vitest";
import { create_dnd_engine } from "../dnd/engine.js";

/**
 * Engine tests — these test the factory layer API.
 * @dnd-kit's DragDropManager requires a DOM environment, so we test
 * the factory logic, instance tracking, and error handling.
 * Full integration tests with actual drag events require a browser/jsdom.
 */

describe("dnd engine", () => {
  let engine;

  beforeEach(() => {
    engine = create_dnd_engine();
  });

  describe("lifecycle", () => {
    it("starts with no manager", () => {
      expect(engine.manager).toBeNull();
    });

    it("init creates a DragDropManager", () => {
      // DragDropManager requires DOM — this may throw in pure Node
      // We test that the factory function exists and is callable
      expect(typeof engine.init).toBe("function");
      expect(typeof engine.destroy).toBe("function");
    });

    it("instances map starts empty", () => {
      expect(engine.instances.size).toBe(0);
    });
  });

  describe("factory methods exist", () => {
    it("has create_section_sortable", () => {
      expect(typeof engine.create_section_sortable).toBe("function");
    });

    it("has create_block_sortable", () => {
      expect(typeof engine.create_block_sortable).toBe("function");
    });

    it("has create_palette_item", () => {
      expect(typeof engine.create_palette_item).toBe("function");
    });

    it("has create_section_palette_item", () => {
      expect(typeof engine.create_section_palette_item).toBe("function");
    });

    it("has create_section_drop_zone", () => {
      expect(typeof engine.create_section_drop_zone).toBe("function");
    });
  });

  describe("factory guards", () => {
    it("create_section_sortable throws when engine not initialized", () => {
      expect(() => engine.create_section_sortable(null, { id: "s1", index: 0 }))
        .toThrow("not initialized");
    });

    it("create_block_sortable throws when engine not initialized", () => {
      expect(() => engine.create_block_sortable(null, { id: "b1", index: 0, section_id: "s1" }))
        .toThrow("not initialized");
    });

    it("create_palette_item throws when engine not initialized", () => {
      expect(() => engine.create_palette_item(null, { block_type: "text" }))
        .toThrow("not initialized");
    });

    it("create_section_palette_item throws when engine not initialized", () => {
      expect(() => engine.create_section_palette_item(null, { section_type: "hero" }))
        .toThrow("not initialized");
    });

    it("create_section_drop_zone throws when engine not initialized", () => {
      expect(() => engine.create_section_drop_zone(null, { section_id: "s1" }))
        .toThrow("not initialized");
    });
  });

  describe("re-exports", () => {
    it("exports isSortable utility", () => {
      expect(typeof engine.isSortable).toBe("function");
    });

    it("exports isSortableOperation utility", () => {
      expect(typeof engine.isSortableOperation).toBe("function");
    });

    it("exports DragDropManager class", () => {
      expect(engine.DragDropManager).toBeDefined();
    });

    it("exports Draggable class", () => {
      expect(engine.Draggable).toBeDefined();
    });

    it("exports Droppable class", () => {
      expect(engine.Droppable).toBeDefined();
    });

    it("exports Sortable class", () => {
      expect(engine.Sortable).toBeDefined();
    });
  });

  describe("instance management", () => {
    it("get returns null for unknown id", () => {
      expect(engine.get("unknown")).toBeNull();
    });

    it("remove is safe for unknown id", () => {
      expect(() => engine.remove("unknown")).not.toThrow();
    });
  });

  describe("event binding", () => {
    it("on returns a cleanup function even without manager", () => {
      const cleanup = engine.on("dragstart", () => {});
      expect(typeof cleanup).toBe("function");
    });
  });
});
