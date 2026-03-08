/* ── Command Pattern Operations ──────────────────── */

import { reindex } from "./fractional_index.js";
import { create_section, create_block, uid } from "./model.js";

/**
 * Helper: update a specific section within a document immutably.
 */
const update_section = (doc, section_id, updater) => ({
  ...doc,
  sections: doc.sections.map((s) =>
    s.id === section_id ? updater(s) : s
  ),
});

/**
 * Find a section by ID in a document.
 */
const find_section = (doc, section_id) =>
  doc.sections.find((s) => s.id === section_id) || null;

/**
 * Find a block by ID across all sections.
 * Returns { block, section } or null.
 */
const find_block = (doc, block_id) => {
  for (const section of doc.sections) {
    const block = section.blocks.find((b) => b.id === block_id);
    if (block) return { block, section };
  }
  return null;
};

/**
 * Resolve offset/limit from either page-based or offset-based params.
 * Supports: { page, page_size } or { offset, limit }
 */
const resolve_pagination = (opts = {}) => {
  if (opts.page != null) {
    const page = Math.max(1, opts.page);
    const page_size = opts.page_size || 10;
    return { offset: (page - 1) * page_size, limit: page_size };
  }
  return { offset: opts.offset || 0, limit: opts.limit || Infinity };
};

/**
 * Query sections with optional filter and pagination.
 *
 * @param {object} doc
 * @param {object} [query]
 * @param {string} [query.type] - filter by section type
 * @param {function} [query.filter] - custom predicate (section) => boolean
 * @param {number} [query.page] - 1-based page number
 * @param {number} [query.page_size] - items per page (default 10)
 * @param {number} [query.offset] - skip N items (alternative to page)
 * @param {number} [query.limit] - max items to return (alternative to page_size)
 * @returns {{ items: Section[], total: number, page?: number, pages?: number }}
 */
const find_sections = (doc, query = {}) => {
  let items = doc.sections;

  if (query.type) items = items.filter((s) => s.type === query.type);
  if (query.filter) items = items.filter(query.filter);

  const total = items.length;
  const { offset, limit } = resolve_pagination(query);
  items = items.slice(offset, offset + limit);

  const result = { items, total };
  if (query.page != null) {
    const page_size = query.page_size || 10;
    result.page = Math.max(1, query.page);
    result.pages = Math.ceil(total / page_size);
  }
  return result;
};

/**
 * Query blocks across all sections (or within one) with optional filter and pagination.
 *
 * @param {object} doc
 * @param {object} [query]
 * @param {string} [query.section_id] - limit to a specific section
 * @param {string} [query.type] - filter by block type
 * @param {function} [query.filter] - custom predicate (block) => boolean
 * @param {number} [query.page] - 1-based page number
 * @param {number} [query.page_size] - items per page (default 10)
 * @param {number} [query.offset] - skip N items (alternative to page)
 * @param {number} [query.limit] - max items to return (alternative to page_size)
 * @returns {{ items: Block[], total: number, page?: number, pages?: number }}
 */
const find_blocks = (doc, query = {}) => {
  let items = [];

  const sections = query.section_id
    ? doc.sections.filter((s) => s.id === query.section_id)
    : doc.sections;

  for (const section of sections) {
    for (const block of section.blocks) {
      items.push(block);
    }
  }

  if (query.type) items = items.filter((b) => b.type === query.type);
  if (query.filter) items = items.filter(query.filter);

  const total = items.length;
  const { offset, limit } = resolve_pagination(query);
  items = items.slice(offset, offset + limit);

  const result = { items, total };
  if (query.page != null) {
    const page_size = query.page_size || 10;
    result.page = Math.max(1, query.page);
    result.pages = Math.ceil(total / page_size);
  }
  return result;
};

/* ── Operations (pure: state => new_state) ──────── */

const operations = {
  /**
   * Reorder a section within the page.
   */
  reorder_section(doc, { section_id, from_index, to_index }) {
    if (from_index === to_index) return doc;
    const sections = [...doc.sections];
    const [moved] = sections.splice(from_index, 1);
    if (!moved || moved.id !== section_id) return doc;
    sections.splice(to_index, 0, moved);
    return { ...doc, sections: reindex(sections) };
  },

  /**
   * Reorder a block within the same section.
   */
  reorder_block(doc, { section_id, block_id, from_index, to_index }) {
    if (from_index === to_index) return doc;
    return update_section(doc, section_id, (section) => {
      const blocks = [...section.blocks];
      const [moved] = blocks.splice(from_index, 1);
      if (!moved || moved.id !== block_id) return section;
      blocks.splice(to_index, 0, moved);
      return { ...section, blocks: reindex(blocks) };
    });
  },

  /**
   * Transfer a block from one section to another.
   */
  transfer_block(doc, { block_id, from_section, to_section, to_index }) {
    if (from_section === to_section) return doc;

    let block_to_move = null;

    // Remove from source section
    let result = update_section(doc, from_section, (section) => {
      const idx = section.blocks.findIndex((b) => b.id === block_id);
      if (idx < 0) return section;
      block_to_move = section.blocks[idx];
      const blocks = [...section.blocks];
      blocks.splice(idx, 1);
      return { ...section, blocks: reindex(blocks) };
    });

    if (!block_to_move) return doc;

    // Insert into target section
    result = update_section(result, to_section, (section) => {
      const blocks = [...section.blocks];
      const insert_at = to_index != null ? to_index : blocks.length;
      blocks.splice(insert_at, 0, {
        ...block_to_move,
        section_id: to_section,
      });
      return { ...section, blocks: reindex(blocks) };
    });

    return result;
  },

  /**
   * Add a new block to a section (clone from palette).
   */
  add_block(doc, { section_id, block_type, template, at_index }) {
    return update_section(doc, section_id, (section) => {
      const new_block = create_block(block_type, section_id, {
        content: template ? { ...template } : {},
      });
      const blocks = [...section.blocks];
      const insert_at = at_index != null ? at_index : blocks.length;
      blocks.splice(insert_at, 0, new_block);
      return { ...section, blocks: reindex(blocks) };
    });
  },

  /**
   * Add a new section to the document (clone from palette).
   */
  add_section(doc, { section_type, template, at_index, constraints }) {
    const new_section = create_section(section_type, {
      settings: template ? { ...template } : {},
      constraints: constraints || {
        max_blocks: 50,
        allowed_blocks: null,
        min_blocks: 0,
      },
    });
    const sections = [...doc.sections];
    const insert_at = at_index != null ? at_index : sections.length;
    sections.splice(insert_at, 0, new_section);
    return { ...doc, sections: reindex(sections) };
  },

  /**
   * Delete a block from a section.
   */
  delete_block(doc, { section_id, block_id }) {
    return update_section(doc, section_id, (section) => {
      const blocks = section.blocks.filter((b) => b.id !== block_id);
      if (blocks.length === section.blocks.length) return section;
      return { ...section, blocks: reindex(blocks) };
    });
  },

  /**
   * Delete a section from the document.
   */
  delete_section(doc, { section_id }) {
    const sections = doc.sections.filter((s) => s.id !== section_id);
    if (sections.length === doc.sections.length) return doc;
    return { ...doc, sections: reindex(sections) };
  },

  /**
   * Update a block's content.
   */
  update_block_content(doc, { section_id, block_id, content }) {
    return update_section(doc, section_id, (section) => ({
      ...section,
      blocks: section.blocks.map((b) =>
        b.id === block_id ? { ...b, content: { ...b.content, ...content } } : b
      ),
    }));
  },

  /**
   * Update a block's settings.
   */
  update_block_settings(doc, { section_id, block_id, settings }) {
    return update_section(doc, section_id, (section) => ({
      ...section,
      blocks: section.blocks.map((b) =>
        b.id === block_id ? { ...b, settings: { ...b.settings, ...settings } } : b
      ),
    }));
  },

  /**
   * Update a section's settings.
   */
  update_section_settings(doc, { section_id, settings }) {
    return update_section(doc, section_id, (section) => ({
      ...section,
      settings: { ...section.settings, ...settings },
    }));
  },
};

export { operations, find_section, find_block, find_sections, find_blocks };
