/* ── Built-in Section & Block Types ──────────────── */

/**
 * Default block type definitions.
 * Each has a render function that takes (block, { h, Fragment }) and returns a VNode.
 */
const builtin_block_types = [
  {
    type: "heading",
    label: "Heading",
    icon: "heading",
    category: "content",
    defaults: { text: "Heading", level: 2 },
    settings: {
      level: {
        type: "select", label: "Level", default: "2",
        options: [
          { label: "H1", value: "1" }, { label: "H2", value: "2" },
          { label: "H3", value: "3" }, { label: "H4", value: "4" },
          { label: "H5", value: "5" }, { label: "H6", value: "6" },
        ],
      },
    },
    render: (block, { h }) => {
      const tag = `h${block.settings.level || block.content.level || 2}`;
      return h(tag, null, block.content.text || "");
    },
  },
  {
    type: "text",
    label: "Text",
    icon: "type",
    category: "content",
    defaults: { text: "" },
    settings: {},
    render: (block, { h }) => h("p", null, block.content.text || ""),
  },
  {
    type: "image",
    label: "Image",
    icon: "image",
    category: "media",
    defaults: { src: "", alt: "" },
    settings: {},
    render: (block, { h }) =>
      h("img", { src: block.content.src || "", alt: block.content.alt || "" }),
  },
  {
    type: "button",
    label: "Button",
    icon: "mouse-pointer",
    category: "content",
    defaults: { text: "Click me", url: "#" },
    settings: {
      style: {
        type: "select", label: "Style", default: "primary",
        options: [
          { label: "Primary", value: "primary" },
          { label: "Secondary", value: "secondary" },
          { label: "Outline", value: "outline" },
        ],
      },
    },
    render: (block, { h }) =>
      h("a", {
        href: block.content.url || "#",
        class: `btn btn--${block.settings.style || "primary"}`,
        role: "button",
      }, block.content.text || "Button"),
  },
  {
    type: "divider",
    label: "Divider",
    icon: "minus",
    category: "layout",
    defaults: {},
    settings: {},
    render: (_block, { h }) => h("hr", null),
  },
  {
    type: "video",
    label: "Video",
    icon: "play",
    category: "media",
    defaults: { src: "", poster: "" },
    settings: {},
    render: (block, { h }) =>
      h("video", {
        src: block.content.src || "",
        poster: block.content.poster || "",
        controls: true,
      }),
  },
  {
    type: "code",
    label: "Code",
    icon: "code",
    category: "content",
    defaults: { code: "", language: "" },
    settings: {},
    render: (block, { h }) =>
      h("pre", null,
        h("code", {
          class: block.content.language ? `language-${block.content.language}` : undefined,
        }, block.content.code || "")),
  },
  {
    type: "columns",
    label: "Columns",
    icon: "columns",
    category: "layout",
    defaults: { columns: 2 },
    settings: {
      columns: {
        type: "select", label: "Columns", default: "2",
        options: [
          { label: "2 Columns", value: "2" },
          { label: "3 Columns", value: "3" },
          { label: "4 Columns", value: "4" },
        ],
      },
    },
    render: (block, { h }) =>
      h("div", {
        class: "columns",
        style: `display:grid;grid-template-columns:repeat(${block.settings.columns || block.content.columns || 2},1fr);gap:1rem`,
      }),
  },
];

/**
 * Default section type definitions.
 * Each has a render function that takes (section, { h, Fragment, render_blocks }) and returns a VNode.
 */
const builtin_section_types = [
  {
    type: "generic",
    label: "Generic",
    icon: "layout",
    category: "layout",
    defaults: {},
    constraints: { max_blocks: 50, allowed_blocks: null, min_blocks: 0 },
    settings: {},
    render: (section, { h, render_blocks }) =>
      h("div", { class: "section section--generic" }, render_blocks()),
  },
  {
    type: "hero",
    label: "Hero",
    icon: "star",
    category: "layout",
    defaults: {},
    constraints: { max_blocks: 10, allowed_blocks: ["heading", "text", "image", "button"], min_blocks: 0 },
    settings: {
      alignment: {
        type: "select", label: "Alignment", default: "center",
        options: [
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
    },
    render: (section, { h, render_blocks }) =>
      h("div", {
        class: "section section--hero",
        style: `text-align:${section.settings.alignment || "center"}`,
      }, render_blocks()),
  },
  {
    type: "features",
    label: "Features",
    icon: "grid",
    category: "layout",
    defaults: {},
    constraints: { max_blocks: 12, allowed_blocks: null, min_blocks: 0 },
    settings: {
      columns: {
        type: "select", label: "Columns", default: "3",
        options: [
          { label: "2 Columns", value: "2" },
          { label: "3 Columns", value: "3" },
          { label: "4 Columns", value: "4" },
        ],
      },
    },
    render: (section, { h, render_blocks }) =>
      h("div", {
        class: "section section--features",
        style: `display:grid;grid-template-columns:repeat(${section.settings.columns || 3},1fr);gap:1rem`,
      }, render_blocks()),
  },
  {
    type: "content",
    label: "Content",
    icon: "file-text",
    category: "layout",
    defaults: {},
    constraints: { max_blocks: 25, allowed_blocks: null, min_blocks: 0 },
    settings: {},
    render: (section, { h, render_blocks }) =>
      h("div", { class: "section section--content" }, render_blocks()),
  },
  {
    type: "footer",
    label: "Footer",
    icon: "chevrons-down",
    category: "layout",
    defaults: {},
    constraints: { max_blocks: 10, allowed_blocks: null, min_blocks: 0 },
    settings: {},
    render: (section, { h, render_blocks }) =>
      h("footer", { class: "section section--footer" }, render_blocks()),
  },
];

/**
 * Register all built-in section and block types on a DnD manager.
 * Returns a dispose function that unregisters all types.
 */
const register_builtins = (dnd) => {
  const disposers = [];

  for (const def of builtin_section_types) {
    dnd.register_section(def);
    disposers.push(() => dnd.unregister_section(def.type));
  }

  for (const def of builtin_block_types) {
    dnd.register_block(def);
    disposers.push(() => dnd.unregister_block(def.type));
  }

  return () => disposers.forEach((fn) => fn());
};

export { builtin_block_types, builtin_section_types, register_builtins };
