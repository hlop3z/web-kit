/* ── @dnd-kit/dom Engine Integration ────────────── */

import { DragDropManager, Draggable, Droppable, Feedback,
  AutoScroller, Accessibility, Cursor, KeyboardSensor,
  PointerSensor, PreventSelection } from "@dnd-kit/dom";
import { Sortable, isSortable, isSortableOperation } from "@dnd-kit/dom/sortable";

/**
 * Creates the @dnd-kit/dom engine layer.
 * Manages the DragDropManager lifecycle and provides factory functions
 * for creating Sortable, Draggable, and Droppable instances.
 */
const create_dnd_engine = () => {
  let manager = null;
  const instances = new Map();
  const event_cleanups = [];

  /* ── Lifecycle ──────────────────────────────────── */

  const init = (container, options = {}) => {
    if (manager) destroy();

    manager = new DragDropManager({
      plugins: [
        AutoScroller,
        Accessibility,
        Cursor,
        Feedback,
        PreventSelection,
        ...(options.plugins || []),
      ],
      sensors: [
        PointerSensor,
        KeyboardSensor,
        ...(options.sensors || []),
      ],
      modifiers: options.modifiers || [],
    });

    return manager;
  };

  const destroy = () => {
    for (const cleanup of event_cleanups) cleanup();
    event_cleanups.length = 0;

    for (const [, instance] of instances) {
      if (instance.destroy) instance.destroy();
    }
    instances.clear();

    if (manager) {
      manager.destroy();
      manager = null;
    }
  };

  /* ── Sortable Factories ─────────────────────────── */

  /**
   * Create a sortable section in the sidebar list.
   */
  const create_section_sortable = (element, { id, index, handle } = {}) => {
    if (!manager) throw new Error("DnD engine not initialized");

    const sortable = new Sortable({
      id,
      index,
      group: "sections",
      type: "section",
      element,
      handle,
      data: { type: "section", section_id: id },
    }, manager);

    instances.set(id, sortable);
    return sortable;
  };

  /**
   * Create a sortable block within a section.
   * Blocks share group="blocks" enabling cross-container transfer.
   */
  const create_block_sortable = (element, { id, index, section_id, handle } = {}) => {
    if (!manager) throw new Error("DnD engine not initialized");

    const sortable = new Sortable({
      id,
      index,
      group: "blocks",
      type: "block",
      element,
      handle,
      data: { type: "block", block_id: id, section_id },
    }, manager);

    instances.set(id, sortable);
    return sortable;
  };

  /* ── Draggable Factories ────────────────────────── */

  /**
   * Create a palette block item (clone feedback, not sortable).
   */
  const create_palette_item = (element, { block_type, template } = {}) => {
    if (!manager) throw new Error("DnD engine not initialized");

    const draggable_id = `palette-${block_type}`;
    const draggable = new Draggable({
      id: draggable_id,
      type: "palette-block",
      element,
      feedback: "clone",
      data: { type: "palette-block", block_type, template },
    }, manager);

    instances.set(draggable_id, draggable);
    return draggable;
  };

  /**
   * Create a palette section item (clone feedback).
   */
  const create_section_palette_item = (element, { section_type, template } = {}) => {
    if (!manager) throw new Error("DnD engine not initialized");

    const draggable_id = `template-${section_type}`;
    const draggable = new Draggable({
      id: draggable_id,
      type: "palette-section",
      element,
      feedback: "clone",
      data: { type: "palette-section", section_type, template },
    }, manager);

    instances.set(draggable_id, draggable);
    return draggable;
  };

  /* ── Droppable Factory ──────────────────────────── */

  /**
   * Create a drop zone for a section (accepts blocks and palette blocks).
   */
  const create_section_drop_zone = (element, { section_id, accept } = {}) => {
    if (!manager) throw new Error("DnD engine not initialized");

    const droppable_id = `drop-${section_id}`;
    const droppable = new Droppable({
      id: droppable_id,
      element,
      accept: accept || undefined,
      data: { type: "section-drop", section_id },
    }, manager);

    instances.set(droppable_id, droppable);
    return droppable;
  };

  /* ── Instance Management ────────────────────────── */

  const remove = (id) => {
    const instance = instances.get(id);
    if (instance) {
      if (instance.destroy) instance.destroy();
      instances.delete(id);
    }
  };

  const get = (id) => instances.get(id) || null;

  /* ── Event Binding ──────────────────────────────── */

  const on = (event_name, callback) => {
    if (!manager) return () => {};
    const cleanup = manager.monitor.addEventListener(event_name, callback);
    event_cleanups.push(cleanup);
    return cleanup;
  };

  /* ── Public API ─────────────────────────────────── */

  return {
    init,
    destroy,
    get manager() { return manager; },
    instances,

    // Factories
    create_section_sortable,
    create_block_sortable,
    create_palette_item,
    create_section_palette_item,
    create_section_drop_zone,

    // Instance management
    remove,
    get,

    // Events
    on,

    // Re-exports
    isSortable,
    isSortableOperation,
    DragDropManager,
    Draggable,
    Droppable,
    Sortable,
  };
};

export { create_dnd_engine };
