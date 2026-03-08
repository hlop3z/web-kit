import { describe, it, expect, beforeEach } from "vitest";
import { create_dnd, $document, $sections, $selection, $drag_state, create_document } from "../dnd.js";
import { generate_key_between, generate_n_keys_between, reindex } from "../dnd/fractional_index.js";
import { operations, find_section, find_block, find_sections, find_blocks } from "../dnd/operations.js";
import { can_accept_block, can_accept_section, can_remove_block } from "../dnd/constraints.js";
import { create_undo_stack } from "../dnd/undo.js";
import { create_type_registry } from "../dnd/types.js";
import { create_section, create_block, uid } from "../dnd/model.js";
import { create_hook_system } from "../hooks.js";
import { atom } from "nanostores";

/* ── Fractional Indexing ─────────────────────────── */

describe("fractional indexing", () => {
  it("generates a key between null and null", () => {
    const key = generate_key_between(null, null);
    expect(key).toBe("a0");
  });

  it("generates a key after an existing key", () => {
    const key = generate_key_between("a0", null);
    expect(key > "a0").toBe(true);
  });

  it("generates a key before an existing key", () => {
    const key = generate_key_between(null, "a0");
    expect(key < "a0").toBe(true);
  });

  it("generates a key between two keys", () => {
    const key = generate_key_between("a0", "a2");
    expect(key > "a0").toBe(true);
    expect(key < "a2").toBe(true);
  });

  it("generates n keys in sorted order", () => {
    const keys = generate_n_keys_between(null, null, 5);
    expect(keys).toHaveLength(5);
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i] > keys[i - 1]).toBe(true);
    }
  });

  it("reindex assigns fresh order keys", () => {
    const items = [
      { id: "a", order: "z9" },
      { id: "b", order: "a0" },
      { id: "c", order: "m5" },
    ];
    const result = reindex(items);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("a");
    expect(result[1].id).toBe("b");
    expect(result[2].id).toBe("c");
    // Order keys should be sorted
    for (let i = 1; i < result.length; i++) {
      expect(result[i].order > result[i - 1].order).toBe(true);
    }
  });
});

/* ── Model ───────────────────────────────────────── */

describe("model", () => {
  it("uid generates unique IDs", () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(uid());
    expect(ids.size).toBe(100);
  });

  it("uid supports prefixes", () => {
    const id = uid("test-");
    expect(id.startsWith("test-")).toBe(true);
  });

  it("create_section returns valid section", () => {
    const section = create_section("hero");
    expect(section.type).toBe("hero");
    expect(section.id).toMatch(/^s-/);
    expect(section.blocks).toEqual([]);
    expect(section.constraints.max_blocks).toBe(50);
  });

  it("create_block returns valid block", () => {
    const block = create_block("text", "s-123");
    expect(block.type).toBe("text");
    expect(block.section_id).toBe("s-123");
    expect(block.id).toMatch(/^b-/);
    expect(block.content).toEqual({});
  });

  it("create_document returns valid document", () => {
    const doc = create_document();
    expect(doc.id).toMatch(/^p-/);
    expect(doc.sections).toEqual([]);
    expect(doc.meta.max_sections).toBe(25);
  });
});

/* ── Constraints ─────────────────────────────────── */

describe("constraints", () => {
  it("can_accept_block respects max_blocks", () => {
    const section = create_section("hero", {
      constraints: { max_blocks: 2, allowed_blocks: null, min_blocks: 0 },
      blocks: [create_block("text", "s"), create_block("text", "s")],
    });
    expect(can_accept_block(section, { block_type: "text" })).toBe(false);
  });

  it("can_accept_block allows when under limit", () => {
    const section = create_section("hero", {
      constraints: { max_blocks: 3, allowed_blocks: null, min_blocks: 0 },
      blocks: [create_block("text", "s")],
    });
    expect(can_accept_block(section, { block_type: "text" })).toBe(true);
  });

  it("can_accept_block checks allowed_blocks", () => {
    const section = create_section("hero", {
      constraints: { max_blocks: 50, allowed_blocks: ["text", "image"], min_blocks: 0 },
      blocks: [],
    });
    expect(can_accept_block(section, { block_type: "text" })).toBe(true);
    expect(can_accept_block(section, { block_type: "video" })).toBe(false);
  });

  it("can_accept_section respects max_sections", () => {
    const doc = create_document({ meta: { max_sections: 2 } });
    doc.sections = [create_section("a"), create_section("b")];
    expect(can_accept_section(doc)).toBe(false);
  });

  it("can_accept_section allows when under limit", () => {
    const doc = create_document({ meta: { max_sections: 5 } });
    doc.sections = [create_section("a")];
    expect(can_accept_section(doc)).toBe(true);
  });

  it("can_remove_block respects min_blocks", () => {
    const section = create_section("hero", {
      constraints: { max_blocks: 50, allowed_blocks: null, min_blocks: 1 },
      blocks: [create_block("text", "s")],
    });
    expect(can_remove_block(section)).toBe(false);
  });

  it("can_remove_block allows when above minimum", () => {
    const section = create_section("hero", {
      constraints: { max_blocks: 50, allowed_blocks: null, min_blocks: 1 },
      blocks: [create_block("text", "s"), create_block("text", "s")],
    });
    expect(can_remove_block(section)).toBe(true);
  });
});

/* ── Operations ──────────────────────────────────── */

describe("operations", () => {
  let doc;

  beforeEach(() => {
    doc = create_document({
      sections: reindex([
        create_section("hero", {
          id: "s1",
          blocks: reindex([
            create_block("text", "s1", { id: "b1" }),
            create_block("image", "s1", { id: "b2" }),
            create_block("button", "s1", { id: "b3" }),
          ]),
        }),
        create_section("features", {
          id: "s2",
          blocks: reindex([
            create_block("card", "s2", { id: "b4" }),
          ]),
        }),
        create_section("footer", { id: "s3", blocks: [] }),
      ]),
    });
  });

  describe("reorder_section", () => {
    it("moves section from index 0 to 2", () => {
      const result = operations.reorder_section(doc, {
        section_id: "s1", from_index: 0, to_index: 2,
      });
      expect(result.sections[2].id).toBe("s1");
      expect(result.sections[0].id).toBe("s2");
    });

    it("no-op when from === to", () => {
      const result = operations.reorder_section(doc, {
        section_id: "s1", from_index: 0, to_index: 0,
      });
      expect(result).toBe(doc);
    });
  });

  describe("reorder_block", () => {
    it("moves block within section", () => {
      const result = operations.reorder_block(doc, {
        section_id: "s1", block_id: "b1", from_index: 0, to_index: 2,
      });
      const s1 = result.sections.find((s) => s.id === "s1");
      expect(s1.blocks[2].id).toBe("b1");
      expect(s1.blocks[0].id).toBe("b2");
    });

    it("no-op when from === to", () => {
      const result = operations.reorder_block(doc, {
        section_id: "s1", block_id: "b1", from_index: 0, to_index: 0,
      });
      expect(result).toBe(doc);
    });
  });

  describe("transfer_block", () => {
    it("moves block from one section to another", () => {
      const result = operations.transfer_block(doc, {
        block_id: "b1", from_section: "s1", to_section: "s2", to_index: 0,
      });
      const s1 = result.sections.find((s) => s.id === "s1");
      const s2 = result.sections.find((s) => s.id === "s2");
      expect(s1.blocks).toHaveLength(2);
      expect(s2.blocks).toHaveLength(2);
      expect(s2.blocks[0].id).toBe("b1");
      expect(s2.blocks[0].section_id).toBe("s2");
    });

    it("appends to end when to_index is null", () => {
      const result = operations.transfer_block(doc, {
        block_id: "b1", from_section: "s1", to_section: "s2",
      });
      const s2 = result.sections.find((s) => s.id === "s2");
      expect(s2.blocks[s2.blocks.length - 1].id).toBe("b1");
    });

    it("returns original doc when same section", () => {
      const result = operations.transfer_block(doc, {
        block_id: "b1", from_section: "s1", to_section: "s1",
      });
      expect(result).toBe(doc);
    });
  });

  describe("add_block", () => {
    it("adds a new block to a section", () => {
      const result = operations.add_block(doc, {
        section_id: "s3", block_type: "text", template: { text: "hello" },
      });
      const s3 = result.sections.find((s) => s.id === "s3");
      expect(s3.blocks).toHaveLength(1);
      expect(s3.blocks[0].type).toBe("text");
      expect(s3.blocks[0].content.text).toBe("hello");
    });

    it("inserts at specified index", () => {
      const result = operations.add_block(doc, {
        section_id: "s1", block_type: "text", at_index: 1,
      });
      const s1 = result.sections.find((s) => s.id === "s1");
      expect(s1.blocks).toHaveLength(4);
      expect(s1.blocks[1].type).toBe("text");
    });
  });

  describe("add_section", () => {
    it("adds a new section to the document", () => {
      const result = operations.add_section(doc, {
        section_type: "cta", template: { bg: "blue" },
      });
      expect(result.sections).toHaveLength(4);
      expect(result.sections[3].type).toBe("cta");
    });

    it("inserts at specified index", () => {
      const result = operations.add_section(doc, {
        section_type: "cta", at_index: 1,
      });
      expect(result.sections[1].type).toBe("cta");
    });
  });

  describe("delete_block", () => {
    it("removes a block from a section", () => {
      const result = operations.delete_block(doc, {
        section_id: "s1", block_id: "b2",
      });
      const s1 = result.sections.find((s) => s.id === "s1");
      expect(s1.blocks).toHaveLength(2);
      expect(s1.blocks.find((b) => b.id === "b2")).toBeUndefined();
    });
  });

  describe("delete_section", () => {
    it("removes a section from the document", () => {
      const result = operations.delete_section(doc, { section_id: "s2" });
      expect(result.sections).toHaveLength(2);
      expect(result.sections.find((s) => s.id === "s2")).toBeUndefined();
    });
  });

  describe("update_block_content", () => {
    it("merges content into a block", () => {
      const result = operations.update_block_content(doc, {
        section_id: "s1", block_id: "b1", content: { text: "updated" },
      });
      const s1 = result.sections.find((s) => s.id === "s1");
      expect(s1.blocks[0].content.text).toBe("updated");
    });
  });

  describe("update_section_settings", () => {
    it("merges settings into a section", () => {
      const result = operations.update_section_settings(doc, {
        section_id: "s1", settings: { bg: "red" },
      });
      expect(result.sections[0].settings.bg).toBe("red");
    });
  });

  describe("update_block_settings", () => {
    it("merges settings into a block", () => {
      const result = operations.update_block_settings(doc, {
        section_id: "s1", block_id: "b1", settings: { align: "center" },
      });
      const s1 = result.sections.find((s) => s.id === "s1");
      expect(s1.blocks[0].settings.align).toBe("center");
    });
  });

  describe("find_block", () => {
    it("finds a block across all sections", () => {
      const found = find_block(doc, "b4");
      expect(found).not.toBeNull();
      expect(found.block.id).toBe("b4");
      expect(found.section.id).toBe("s2");
    });

    it("returns null for non-existent block", () => {
      expect(find_block(doc, "nope")).toBeNull();
    });
  });

  describe("find_sections", () => {
    it("returns all sections with no query", () => {
      const result = find_sections(doc);
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it("filters by type", () => {
      const result = find_sections(doc, { type: "hero" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("s1");
      expect(result.total).toBe(1);
    });

    it("filters with custom predicate", () => {
      const result = find_sections(doc, {
        filter: (s) => s.blocks.length > 0,
      });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("paginates with offset/limit", () => {
      const result = find_sections(doc, { offset: 1, limit: 1 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("s2");
      expect(result.total).toBe(3);
    });

    it("paginates with page/page_size", () => {
      const p1 = find_sections(doc, { page: 1, page_size: 2 });
      expect(p1.items).toHaveLength(2);
      expect(p1.page).toBe(1);
      expect(p1.pages).toBe(2);
      expect(p1.total).toBe(3);

      const p2 = find_sections(doc, { page: 2, page_size: 2 });
      expect(p2.items).toHaveLength(1);
      expect(p2.page).toBe(2);
    });

    it("page defaults to page_size 10", () => {
      const result = find_sections(doc, { page: 1 });
      expect(result.items).toHaveLength(3);
      expect(result.pages).toBe(1);
    });

    it("combines filter with pagination", () => {
      const result = find_sections(doc, {
        filter: (s) => s.blocks.length > 0,
        page: 1,
        page_size: 1,
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(2);
      expect(result.pages).toBe(2);
    });
  });

  describe("find_blocks", () => {
    it("returns all blocks across sections with no query", () => {
      const result = find_blocks(doc);
      expect(result.items).toHaveLength(4);
      expect(result.total).toBe(4);
    });

    it("filters by section_id", () => {
      const result = find_blocks(doc, { section_id: "s1" });
      expect(result.items).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it("filters by type", () => {
      const result = find_blocks(doc, { type: "text" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("b1");
    });

    it("filters by type within a section", () => {
      const result = find_blocks(doc, { section_id: "s1", type: "image" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("b2");
    });

    it("filters with custom predicate", () => {
      const result = find_blocks(doc, {
        filter: (b) => b.type === "text" || b.type === "card",
      });
      expect(result.items).toHaveLength(2);
    });

    it("paginates with offset/limit", () => {
      const result = find_blocks(doc, { offset: 2, limit: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe("b3");
      expect(result.items[1].id).toBe("b4");
      expect(result.total).toBe(4);
    });

    it("paginates with page/page_size", () => {
      const p1 = find_blocks(doc, { page: 1, page_size: 2 });
      expect(p1.items).toHaveLength(2);
      expect(p1.page).toBe(1);
      expect(p1.pages).toBe(2);
      expect(p1.total).toBe(4);

      const p2 = find_blocks(doc, { page: 2, page_size: 2 });
      expect(p2.items).toHaveLength(2);
      expect(p2.page).toBe(2);
    });

    it("returns empty for non-existent section", () => {
      const result = find_blocks(doc, { section_id: "nope" });
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});

/* ── Undo / Redo ─────────────────────────────────── */

describe("undo stack", () => {
  it("push / undo / redo cycle", () => {
    const $target = atom({ value: 0 });
    const stack = create_undo_stack($target);

    stack.push({ value: 0 }, { value: 1 });
    $target.set({ value: 1 });

    expect(stack.$can_undo.get()).toBe(true);
    expect(stack.$can_redo.get()).toBe(false);

    stack.undo();
    expect($target.get().value).toBe(0);
    expect(stack.$can_redo.get()).toBe(true);

    stack.redo();
    expect($target.get().value).toBe(1);
  });

  it("redo stack is cleared on new push", () => {
    const $target = atom({ value: 0 });
    const stack = create_undo_stack($target);

    stack.push({ value: 0 }, { value: 1 });
    $target.set({ value: 1 });
    stack.undo();
    expect(stack.$can_redo.get()).toBe(true);

    stack.push({ value: 0 }, { value: 2 });
    expect(stack.$can_redo.get()).toBe(false);
  });

  it("respects max_size", () => {
    const $target = atom({ value: 0 });
    const stack = create_undo_stack($target, 3);

    for (let i = 0; i < 5; i++) {
      stack.push({ value: i }, { value: i + 1 });
    }

    // Should only be able to undo 3 times
    let undo_count = 0;
    while (stack.$can_undo.get()) {
      stack.undo();
      undo_count++;
    }
    expect(undo_count).toBe(3);
  });

  it("clear empties both stacks", () => {
    const $target = atom({ value: 0 });
    const stack = create_undo_stack($target);

    stack.push({ value: 0 }, { value: 1 });
    stack.push({ value: 1 }, { value: 2 });
    stack.clear();

    expect(stack.$can_undo.get()).toBe(false);
    expect(stack.$can_redo.get()).toBe(false);
  });
});

/* ── Type Registry ───────────────────────────────── */

describe("type registry", () => {
  let reg;

  beforeEach(() => {
    reg = create_type_registry();
  });

  it("registers and retrieves section types", () => {
    reg.register_section_type({ type: "hero", label: "Hero" });
    expect(reg.get_section_type("hero")).toEqual({ type: "hero", label: "Hero" });
  });

  it("registers and retrieves block types", () => {
    reg.register_block_type({ type: "text", label: "Text" });
    expect(reg.get_block_type("text")).toEqual({ type: "text", label: "Text" });
  });

  it("unregisters section types", () => {
    reg.register_section_type({ type: "hero", label: "Hero" });
    reg.unregister_section_type("hero");
    expect(reg.get_section_type("hero")).toBeNull();
  });

  it("unregisters block types", () => {
    reg.register_block_type({ type: "text", label: "Text" });
    reg.unregister_block_type("text");
    expect(reg.get_block_type("text")).toBeNull();
  });

  it("lists all registered types", () => {
    reg.register_section_type({ type: "hero", label: "Hero" });
    reg.register_section_type({ type: "cta", label: "CTA" });
    expect(reg.list_section_types()).toHaveLength(2);
  });

  it("$section_types atom is reactive", () => {
    const values = [];
    reg.$section_types.subscribe((m) => values.push(m.size));
    reg.register_section_type({ type: "hero", label: "Hero" });
    reg.register_section_type({ type: "cta", label: "CTA" });
    expect(values).toEqual([0, 1, 2]);
  });

  it("throws on missing type field", () => {
    expect(() => reg.register_section_type({})).toThrow("type");
    expect(() => reg.register_block_type({})).toThrow("type");
  });

  it("clear removes all types", () => {
    reg.register_section_type({ type: "hero", label: "Hero" });
    reg.register_block_type({ type: "text", label: "Text" });
    reg.clear();
    expect(reg.list_section_types()).toHaveLength(0);
    expect(reg.list_block_types()).toHaveLength(0);
  });
});

/* ── DnD Manager (Integration) ──────────────────── */

describe("dnd manager", () => {
  let dnd;
  let hooks;

  beforeEach(() => {
    hooks = create_hook_system();
    dnd = create_dnd(hooks);
    // Reset document
    $document.set(create_document());
    $selection.set({ type: null, ids: [] });
    $drag_state.set({ status: "idle", source: null, target: null, operation: null });
  });

  describe("init / destroy", () => {
    it("init sets up document", () => {
      dnd.init({ max_sections: 10 });
      expect($document.get().meta.max_sections).toBe(10);
    });

    it("destroy resets all state", () => {
      dnd.init({ max_sections: 10 });
      dnd.register_section({ type: "hero", label: "Hero" });
      dnd.destroy();
      expect($document.get().sections).toEqual([]);
      expect($selection.get().type).toBeNull();
    });
  });

  describe("section operations", () => {
    beforeEach(() => {
      dnd.register_section({ type: "hero", label: "Hero" });
      dnd.register_section({ type: "cta", label: "CTA" });
    });

    it("add_section adds a section", async () => {
      await dnd.add_section("hero");
      expect($document.get().sections).toHaveLength(1);
      expect($document.get().sections[0].type).toBe("hero");
    });

    it("add_section respects max_sections", async () => {
      dnd.init({ max_sections: 1 });
      await dnd.add_section("hero");
      await expect(dnd.add_section("cta")).rejects.toThrow("max sections");
    });

    it("remove_section removes a section", async () => {
      await dnd.add_section("hero");
      const section_id = $document.get().sections[0].id;
      await dnd.remove_section(section_id);
      expect($document.get().sections).toHaveLength(0);
    });

    it("move_section reorders sections", async () => {
      await dnd.add_section("hero");
      await dnd.add_section("cta");
      const s1 = $document.get().sections[0].id;
      await dnd.move_section(s1, 1);
      expect($document.get().sections[1].id).toBe(s1);
    });
  });

  describe("block operations", () => {
    let section_id;

    beforeEach(async () => {
      dnd.register_section({ type: "hero", label: "Hero" });
      dnd.register_block({ type: "text", label: "Text", defaults: { text: "" } });
      dnd.register_block({ type: "image", label: "Image", defaults: { src: "" } });
      await dnd.add_section("hero");
      section_id = $document.get().sections[0].id;
    });

    it("add_block adds a block to a section", async () => {
      await dnd.add_block(section_id, "text", { template: { text: "hello" } });
      const blocks = $document.get().sections[0].blocks;
      expect(blocks).toHaveLength(1);
      expect(blocks[0].content.text).toBe("hello");
    });

    it("add_block uses type defaults when no template", async () => {
      await dnd.add_block(section_id, "text");
      const blocks = $document.get().sections[0].blocks;
      expect(blocks[0].content).toEqual({ text: "" });
    });

    it("remove_block removes a block", async () => {
      await dnd.add_block(section_id, "text");
      const block_id = $document.get().sections[0].blocks[0].id;
      await dnd.remove_block(section_id, block_id);
      expect($document.get().sections[0].blocks).toHaveLength(0);
    });

    it("move_block reorders within same section", async () => {
      await dnd.add_block(section_id, "text");
      await dnd.add_block(section_id, "image");
      const blocks = $document.get().sections[0].blocks;
      await dnd.move_block(blocks[0].id, section_id, 1);
      expect($document.get().sections[0].blocks[1].type).toBe("text");
    });

    it("move_block transfers between sections", async () => {
      dnd.register_section({ type: "footer", label: "Footer" });
      await dnd.add_section("footer");
      await dnd.add_block(section_id, "text");

      const doc = $document.get();
      const block_id = doc.sections[0].blocks[0].id;
      const s2_id = doc.sections[1].id;

      await dnd.move_block(block_id, s2_id, 0);

      const updated = $document.get();
      expect(updated.sections[0].blocks).toHaveLength(0);
      expect(updated.sections[1].blocks).toHaveLength(1);
      expect(updated.sections[1].blocks[0].section_id).toBe(s2_id);
    });

    it("update_block updates content", async () => {
      await dnd.add_block(section_id, "text");
      const block_id = $document.get().sections[0].blocks[0].id;
      await dnd.update_block(section_id, block_id, { text: "updated" });
      expect($document.get().sections[0].blocks[0].content.text).toBe("updated");
    });

    it("update_block_settings updates settings", async () => {
      await dnd.add_block(section_id, "text");
      const block_id = $document.get().sections[0].blocks[0].id;
      await dnd.update_block_settings(section_id, block_id, { align: "center" });
      expect($document.get().sections[0].blocks[0].settings.align).toBe("center");
    });
  });

  describe("constraint enforcement", () => {
    let section_id;

    beforeEach(async () => {
      dnd.register_section({
        type: "limited",
        label: "Limited",
        constraints: { max_blocks: 2, allowed_blocks: ["text"], min_blocks: 0 },
      });
      dnd.register_block({ type: "text", label: "Text" });
      dnd.register_block({ type: "image", label: "Image" });
      await dnd.add_section("limited", {
        constraints: { max_blocks: 2, allowed_blocks: ["text"], min_blocks: 0 },
      });
      section_id = $document.get().sections[0].id;
    });

    it("rejects block when max_blocks reached", async () => {
      await dnd.add_block(section_id, "text");
      await dnd.add_block(section_id, "text");
      await expect(dnd.add_block(section_id, "text")).rejects.toThrow("cannot accept");
    });

    it("rejects disallowed block type", async () => {
      await expect(dnd.add_block(section_id, "image")).rejects.toThrow("cannot accept");
    });
  });

  describe("undo / redo", () => {
    beforeEach(() => {
      dnd.register_section({ type: "hero", label: "Hero" });
    });

    it("undo reverts add_section", async () => {
      await dnd.add_section("hero");
      expect($document.get().sections).toHaveLength(1);
      dnd.undo();
      expect($document.get().sections).toHaveLength(0);
    });

    it("redo restores undone action", async () => {
      await dnd.add_section("hero");
      dnd.undo();
      dnd.redo();
      expect($document.get().sections).toHaveLength(1);
    });

    it("$can_undo and $can_redo reflect state", async () => {
      expect(dnd.$can_undo.get()).toBe(false);
      await dnd.add_section("hero");
      expect(dnd.$can_undo.get()).toBe(true);
      dnd.undo();
      expect(dnd.$can_redo.get()).toBe(true);
    });
  });

  describe("selection", () => {
    it("select sets selection state", () => {
      dnd.select("section", ["s1", "s2"]);
      expect($selection.get()).toEqual({ type: "section", ids: ["s1", "s2"] });
    });

    it("select wraps single id in array", () => {
      dnd.select("block", "b1");
      expect($selection.get().ids).toEqual(["b1"]);
    });

    it("clear_selection resets", () => {
      dnd.select("section", ["s1"]);
      dnd.clear_selection();
      expect($selection.get()).toEqual({ type: null, ids: [] });
    });

    it("delete_selected removes selected sections", async () => {
      dnd.register_section({ type: "hero", label: "Hero" });
      await dnd.add_section("hero");
      const id = $document.get().sections[0].id;
      dnd.select("section", [id]);
      await dnd.delete_selected();
      expect($document.get().sections).toHaveLength(0);
      expect($selection.get().type).toBeNull();
    });
  });

  describe("drag state", () => {
    it("set_drag_state merges state", () => {
      dnd.set_drag_state({ status: "dragging", operation: "reorder" });
      const state = $drag_state.get();
      expect(state.status).toBe("dragging");
      expect(state.operation).toBe("reorder");
      expect(state.source).toBeNull();
    });
  });

  describe("hook integration", () => {
    beforeEach(() => {
      dnd.register_section({ type: "hero", label: "Hero" });
    });

    it("fires before_ filter hook", async () => {
      const log = [];
      hooks.add("dnd.before_add_section", (params) => {
        log.push("before");
        return params;
      });
      await dnd.add_section("hero");
      expect(log).toEqual(["before"]);
    });

    it("fires after_ action hook", async () => {
      const log = [];
      hooks.add("dnd.after_add_section", () => {
        log.push("after");
      });
      await dnd.add_section("hero");
      expect(log).toEqual(["after"]);
    });

    it("before_ hook can modify params", async () => {
      hooks.add("dnd.before_add_section", (params) => {
        return { ...params, template: { bg: "injected" } };
      });
      await dnd.add_section("hero");
      expect($document.get().sections[0].settings.bg).toBe("injected");
    });
  });

  describe("type registration via API", () => {
    it("register and list section types", () => {
      dnd.register_section({ type: "hero", label: "Hero" });
      dnd.register_section({ type: "cta", label: "CTA" });
      expect(dnd.list_section_types()).toHaveLength(2);
    });

    it("register and list block types", () => {
      dnd.register_block({ type: "text", label: "Text" });
      expect(dnd.list_block_types()).toHaveLength(1);
    });

    it("unregister removes types", () => {
      dnd.register_section({ type: "hero", label: "Hero" });
      dnd.unregister_section("hero");
      expect(dnd.get_section_type("hero")).toBeNull();
    });

    it("$section_types and $block_types atoms are exposed", () => {
      dnd.register_block({ type: "text", label: "Text" });
      expect(dnd.$block_types.get().size).toBe(1);
    });
  });

  describe("plugin contribution handlers", () => {
    it("registers section_type handler on plugin registry", () => {
      const mock_registry = {
        _register_handler: (target, handler) => {
          mock_registry._handlers = mock_registry._handlers || {};
          mock_registry._handlers[target] = handler;
        },
      };

      const dnd2 = create_dnd(hooks, mock_registry);
      expect(mock_registry._handlers).toHaveProperty("section_type");
      expect(mock_registry._handlers).toHaveProperty("block_type");

      // Test the handler
      const dispose = mock_registry._handlers.block_type("my-plugin", {
        type: "custom",
        label: "Custom",
      });
      expect(dnd2.get_block_type("custom")).not.toBeNull();

      dispose();
      expect(dnd2.get_block_type("custom")).toBeNull();
    });
  });

  describe("find_sections / find_blocks via manager", () => {
    beforeEach(async () => {
      dnd.register_section({ type: "hero", label: "Hero" });
      dnd.register_section({ type: "footer", label: "Footer" });
      dnd.register_block({ type: "text", label: "Text" });
      dnd.register_block({ type: "image", label: "Image" });
      await dnd.add_section("hero");
      await dnd.add_section("footer");
      const s1 = $document.get().sections[0].id;
      await dnd.add_block(s1, "text");
      await dnd.add_block(s1, "image");
      await dnd.add_block(s1, "text");
    });

    it("find_sections returns all", () => {
      const result = dnd.find_sections();
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it("find_sections filters by type", () => {
      const result = dnd.find_sections({ type: "hero" });
      expect(result.total).toBe(1);
    });

    it("find_sections paginates with page", () => {
      const result = dnd.find_sections({ page: 1, page_size: 1 });
      expect(result.items).toHaveLength(1);
      expect(result.pages).toBe(2);
    });

    it("find_blocks returns all", () => {
      const result = dnd.find_blocks();
      expect(result.total).toBe(3);
    });

    it("find_blocks filters by type", () => {
      const result = dnd.find_blocks({ type: "text" });
      expect(result.total).toBe(2);
    });

    it("find_blocks filters by section_id", () => {
      const s1 = $document.get().sections[0].id;
      const result = dnd.find_blocks({ section_id: s1 });
      expect(result.total).toBe(3);
    });

    it("find_blocks paginates with page", () => {
      const result = dnd.find_blocks({ page: 1, page_size: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.pages).toBe(2);
    });

    it("find_blocks paginates with offset/limit", () => {
      const result = dnd.find_blocks({ offset: 1, limit: 1 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(3);
    });
  });
});
