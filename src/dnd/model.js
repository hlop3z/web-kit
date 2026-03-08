/* ── Document Model ──────────────────────────────── */

import { atom, computed } from "nanostores";

/**
 * Compact, collision-resistant ID generator.
 * Short, sortable-by-creation, unique enough for local use.
 */
const uid = (prefix = "") =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/**
 * Create a blank section.
 */
const create_section = (type, overrides = {}) => ({
  id: uid("s-"),
  type,
  order: "a0",
  blocks: [],
  settings: {},
  constraints: {
    max_blocks: 50,
    allowed_blocks: null,
    min_blocks: 0,
  },
  meta: {},
  ...overrides,
});

/**
 * Create a blank block.
 */
const create_block = (type, section_id, overrides = {}) => ({
  id: uid("b-"),
  type,
  order: "a0",
  section_id,
  content: {},
  settings: {},
  children: [],
  meta: {},
  ...overrides,
});

/**
 * Create a blank document.
 */
const create_document = (overrides = {}) => ({
  id: uid("p-"),
  sections: [],
  meta: { max_sections: 25 },
  ...overrides,
});

/* ── Reactive Atoms ──────────────────────────────── */

const $document = atom(create_document());

const $sections = computed($document, (doc) => doc.sections);

const $selection = atom({
  type: null,  // "section" | "block" | null
  ids: [],     // string[]
});

const $drag_state = atom({
  status: "idle",    // "idle" | "pending" | "dragging"
  source: null,      // { type, id, section_id? }
  target: null,      // { type, id, section_id?, index? }
  operation: null,   // "reorder" | "transfer" | "clone"
});

export {
  uid,
  create_section,
  create_block,
  create_document,
  $document,
  $sections,
  $selection,
  $drag_state,
};
