/* ── Preact Rendering Pipeline ───────────────────── */

/**
 * Creates a renderer that turns a document model into VNodes or HTML.
 * Depends on the type registry for section/block renderers and on XkinEngine for Preact.
 */
const create_renderer = (type_registry) => {
  const get_engine = () => globalThis.XkinEngine;

  /**
   * Render a full document to a Preact VNode tree.
   */
  const render_document = (doc) => {
    const engine = get_engine();
    if (!engine) throw new Error("XkinEngine not available — cannot render");

    const { h, Fragment } = engine;

    return h(
      Fragment,
      null,
      doc.sections.map((section) => {
        const type_def = type_registry.get_section_type(section.type);
        if (!type_def || !type_def.render) return null;

        return h(
          "section",
          {
            key: section.id,
            "data-section-id": section.id,
            "data-section-type": section.type,
          },
          type_def.render(section, {
            h,
            Fragment,
            render_blocks: () =>
              section.blocks.map((block) => {
                const block_def = type_registry.get_block_type(block.type);
                if (!block_def || !block_def.render) return null;
                return h(
                  "div",
                  {
                    key: block.id,
                    "data-block-id": block.id,
                    "data-block-type": block.type,
                  },
                  block_def.render(block, { h, Fragment }),
                );
              }),
          }),
        );
      }),
    );
  };

  /**
   * Render a document to an HTML string.
   */
  const render_html = (doc) => {
    const engine = get_engine();
    if (!engine || !engine.renderToString) {
      throw new Error("XkinEngine.renderToString not available");
    }
    const vnode = render_document(doc);
    return engine.renderToString(vnode);
  };

  return { render_document, render_html };
};

export { create_renderer };
