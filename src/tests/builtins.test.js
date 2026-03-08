import { describe, it, expect, beforeEach } from "vitest";
import { builtin_block_types, builtin_section_types, register_builtins } from "../dnd/builtins.js";
import { create_dnd, $document, create_document } from "../dnd.js";
import { create_hook_system } from "../hooks.js";

/* ── Mock Preact engine ──────────────────────────── */

const mock_h = (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat() });
const mock_Fragment = ({ children }) => children;

beforeEach(() => {
  globalThis.XkinEngine = { h: mock_h, Fragment: mock_Fragment, renderToString: () => "" };
});

/* ── Built-in Block Types ────────────────────────── */

describe("builtin block types", () => {
  it("defines all expected block types", () => {
    const types = builtin_block_types.map((d) => d.type);
    expect(types).toContain("heading");
    expect(types).toContain("text");
    expect(types).toContain("image");
    expect(types).toContain("button");
    expect(types).toContain("divider");
    expect(types).toContain("video");
    expect(types).toContain("code");
    expect(types).toContain("columns");
  });

  it("each block type has required fields", () => {
    for (const def of builtin_block_types) {
      expect(def.type).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(def.icon).toBeTruthy();
      expect(def.category).toBeTruthy();
      expect(def.defaults).toBeDefined();
      expect(typeof def.render).toBe("function");
    }
  });

  it("heading render returns correct tag", () => {
    const heading = builtin_block_types.find((d) => d.type === "heading");
    const block = { content: { text: "Hello", level: 3 }, settings: {} };
    const vnode = heading.render(block, { h: mock_h });
    expect(vnode.tag).toBe("h3");
    expect(vnode.children).toContain("Hello");
  });

  it("heading render uses settings.level over content.level", () => {
    const heading = builtin_block_types.find((d) => d.type === "heading");
    const block = { content: { text: "Hi", level: 2 }, settings: { level: 4 } };
    const vnode = heading.render(block, { h: mock_h });
    expect(vnode.tag).toBe("h4");
  });

  it("text render returns <p>", () => {
    const text = builtin_block_types.find((d) => d.type === "text");
    const block = { content: { text: "Paragraph" }, settings: {} };
    const vnode = text.render(block, { h: mock_h });
    expect(vnode.tag).toBe("p");
    expect(vnode.children).toContain("Paragraph");
  });

  it("image render returns <img>", () => {
    const image = builtin_block_types.find((d) => d.type === "image");
    const block = { content: { src: "pic.jpg", alt: "A picture" }, settings: {} };
    const vnode = image.render(block, { h: mock_h });
    expect(vnode.tag).toBe("img");
    expect(vnode.props.src).toBe("pic.jpg");
    expect(vnode.props.alt).toBe("A picture");
  });

  it("button render uses settings.style", () => {
    const btn = builtin_block_types.find((d) => d.type === "button");
    const block = { content: { text: "Go", url: "/go" }, settings: { style: "outline" } };
    const vnode = btn.render(block, { h: mock_h });
    expect(vnode.tag).toBe("a");
    expect(vnode.props.class).toContain("outline");
    expect(vnode.props.href).toBe("/go");
  });

  it("divider render returns <hr>", () => {
    const divider = builtin_block_types.find((d) => d.type === "divider");
    const block = { content: {}, settings: {} };
    const vnode = divider.render(block, { h: mock_h });
    expect(vnode.tag).toBe("hr");
  });

  it("code render returns <pre><code>", () => {
    const code = builtin_block_types.find((d) => d.type === "code");
    const block = { content: { code: "let x = 1;", language: "js" }, settings: {} };
    const vnode = code.render(block, { h: mock_h });
    expect(vnode.tag).toBe("pre");
    const inner = vnode.children[0];
    expect(inner.tag).toBe("code");
    expect(inner.props.class).toBe("language-js");
  });

  it("columns render uses grid layout", () => {
    const columns = builtin_block_types.find((d) => d.type === "columns");
    const block = { content: { columns: 3 }, settings: {} };
    const vnode = columns.render(block, { h: mock_h });
    expect(vnode.tag).toBe("div");
    expect(vnode.props.class).toBe("columns");
    expect(vnode.props.style).toContain("repeat(3,1fr)");
  });

  it("columns render uses settings.columns over content", () => {
    const columns = builtin_block_types.find((d) => d.type === "columns");
    const block = { content: { columns: 2 }, settings: { columns: "4" } };
    const vnode = columns.render(block, { h: mock_h });
    expect(vnode.props.style).toContain("repeat(4,1fr)");
  });
});

/* ── Built-in Section Types ──────────────────────── */

describe("builtin section types", () => {
  it("defines all expected section types", () => {
    const types = builtin_section_types.map((d) => d.type);
    expect(types).toContain("generic");
    expect(types).toContain("hero");
    expect(types).toContain("features");
    expect(types).toContain("content");
    expect(types).toContain("footer");
  });

  it("each section type has required fields", () => {
    for (const def of builtin_section_types) {
      expect(def.type).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(def.icon).toBeTruthy();
      expect(def.category).toBeTruthy();
      expect(def.constraints).toBeDefined();
      expect(typeof def.render).toBe("function");
    }
  });

  it("hero has constrained allowed_blocks", () => {
    const hero = builtin_section_types.find((d) => d.type === "hero");
    expect(hero.constraints.allowed_blocks).toContain("heading");
    expect(hero.constraints.allowed_blocks).toContain("text");
    expect(hero.constraints.max_blocks).toBe(10);
  });

  it("footer renders <footer>", () => {
    const footer_def = builtin_section_types.find((d) => d.type === "footer");
    const section = { settings: {}, blocks: [] };
    const render_blocks = () => [];
    const vnode = footer_def.render(section, { h: mock_h, render_blocks });
    expect(vnode.tag).toBe("footer");
  });

  it("features renders grid with columns setting", () => {
    const features = builtin_section_types.find((d) => d.type === "features");
    const section = { settings: { columns: "4" }, blocks: [] };
    const render_blocks = () => [];
    const vnode = features.render(section, { h: mock_h, render_blocks });
    expect(vnode.props.style).toContain("repeat(4,1fr)");
  });
});

/* ── register_builtins ───────────────────────────── */

describe("register_builtins", () => {
  let dnd, hooks;

  beforeEach(() => {
    hooks = create_hook_system();
    dnd = create_dnd(hooks);
    $document.set(create_document());
  });

  it("registers all built-in types and returns dispose function", () => {
    const dispose = register_builtins(dnd);

    expect(dnd.list_section_types().length).toBe(builtin_section_types.length);
    expect(dnd.list_block_types().length).toBe(builtin_block_types.length);

    dispose();

    expect(dnd.list_section_types().length).toBe(0);
    expect(dnd.list_block_types().length).toBe(0);
  });

  it("dnd.register_builtins() method works", () => {
    const dispose = dnd.register_builtins();
    expect(dnd.get_section_type("hero")).not.toBeNull();
    expect(dnd.get_block_type("text")).not.toBeNull();
    dispose();
  });

  it("built-in types integrate with add_section/add_block", async () => {
    register_builtins(dnd);

    await dnd.add_section("hero");
    const section_id = $document.get().sections[0].id;
    await dnd.add_block(section_id, "text", { template: { text: "Hello" } });

    const doc = $document.get();
    expect(doc.sections[0].type).toBe("hero");
    expect(doc.sections[0].blocks[0].type).toBe("text");
    expect(doc.sections[0].blocks[0].content.text).toBe("Hello");
  });

  it("hero constraints enforce allowed_blocks via dnd.add_block", async () => {
    register_builtins(dnd);

    await dnd.add_section("hero", {
      constraints: { max_blocks: 10, allowed_blocks: ["heading", "text", "image", "button"], min_blocks: 0 },
    });
    const section_id = $document.get().sections[0].id;

    // "text" is allowed
    await dnd.add_block(section_id, "text");
    expect($document.get().sections[0].blocks).toHaveLength(1);

    // "code" is not in hero's allowed_blocks
    await expect(dnd.add_block(section_id, "code")).rejects.toThrow("cannot accept");
  });
});
