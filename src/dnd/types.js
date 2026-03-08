/* ── Type Registries ─────────────────────────────── */

import { atom } from "nanostores";

/**
 * Creates a type registry for section types and block types.
 * Types are stored in nanostores atoms so the palette and constraint system stay reactive.
 */
const create_type_registry = () => {
  const $section_types = atom(new Map());
  const $block_types = atom(new Map());

  const register_section_type = (definition) => {
    if (!definition || !definition.type) {
      throw new Error("Section type definition requires a 'type' field");
    }
    const current = $section_types.get();
    const next = new Map(current);
    next.set(definition.type, definition);
    $section_types.set(next);
  };

  const unregister_section_type = (type) => {
    const current = $section_types.get();
    if (!current.has(type)) return;
    const next = new Map(current);
    next.delete(type);
    $section_types.set(next);
  };

  const register_block_type = (definition) => {
    if (!definition || !definition.type) {
      throw new Error("Block type definition requires a 'type' field");
    }
    const current = $block_types.get();
    const next = new Map(current);
    next.set(definition.type, definition);
    $block_types.set(next);
  };

  const unregister_block_type = (type) => {
    const current = $block_types.get();
    if (!current.has(type)) return;
    const next = new Map(current);
    next.delete(type);
    $block_types.set(next);
  };

  const get_section_type = (type) => $section_types.get().get(type) || null;
  const get_block_type = (type) => $block_types.get().get(type) || null;

  const list_section_types = () => [...$section_types.get().values()];
  const list_block_types = () => [...$block_types.get().values()];

  const clear = () => {
    $section_types.set(new Map());
    $block_types.set(new Map());
  };

  return {
    $section_types,
    $block_types,
    register_section_type,
    unregister_section_type,
    register_block_type,
    unregister_block_type,
    get_section_type,
    get_block_type,
    list_section_types,
    list_block_types,
    clear,
  };
};

export { create_type_registry };
