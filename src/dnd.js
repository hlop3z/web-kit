/* ── DnD Module ──────────────────────────────────── */

import {
  uid,
  create_section,
  create_block,
  create_document,
  $document,
  $sections,
  $selection,
  $drag_state,
} from "./dnd/model.js";
import { operations, find_section, find_block } from "./dnd/operations.js";
import { can_accept_block, can_accept_section, can_remove_block } from "./dnd/constraints.js";
import { create_undo_stack } from "./dnd/undo.js";
import { create_type_registry } from "./dnd/types.js";
import { create_renderer } from "./dnd/render.js";
import { create_dnd_engine } from "./dnd/engine.js";
import { register_builtins, builtin_section_types, builtin_block_types } from "./dnd/builtins.js";
import { create_feedback } from "./dnd/feedback.js";

/**
 * Creates the DnD system, wired to a hook system and plugin registry.
 *
 * @param {object} hook_system - Xkin hook system instance
 * @param {object} [plugin_registry] - Xkin plugin registry (optional, for contribution handlers)
 * @returns {object} DnD manager API
 */
const create_dnd = (hook_system, plugin_registry) => {
  const undo_stack = create_undo_stack($document);
  const type_registry = create_type_registry();
  const renderer = create_renderer(type_registry);
  const engine = create_dnd_engine();
  const feedback = create_feedback();

  /* ── Execute with hooks + undo ─────────────────── */

  const execute = async (op_name, params) => {
    // Filter hook — plugins can modify or cancel (throw to cancel)
    const hook_name = `dnd.before_${op_name}`;
    let final_params = params;

    if (hook_system) {
      final_params = await hook_system.fire(hook_name, params);
    }

    const before = $document.get();
    const op = operations[op_name];
    if (!op) throw new Error(`Unknown DnD operation: "${op_name}"`);

    const after = op(before, final_params);
    $document.set(after);
    undo_stack.push(before, after);

    // Action hook — fire-and-forget
    if (hook_system) {
      hook_system.fire(`dnd.after_${op_name}`, final_params);
    }

    return after;
  };

  /* ── Drop Resolution ─────────────────────────────── */

  const resolve_drop = (source, target) => {
    const s_data = source.data || {};
    const t_data = target.data || {};

    try {
      // Palette block → section drop zone
      if (s_data.type === "palette-block" && t_data.section_id) {
        execute("add_block", {
          section_id: t_data.section_id,
          block_type: s_data.block_type,
          template: s_data.template || {},
          at_index: t_data.index,
        });
        return;
      }

      // Palette section → document
      if (s_data.type === "palette-section") {
        execute("add_section", {
          section_type: s_data.section_type,
          template: s_data.template || {},
          at_index: t_data.index,
        });
        return;
      }

      // Block reorder or transfer
      if (s_data.type === "block" && t_data.type === "block") {
        const from_section = s_data.section_id;
        const to_section = t_data.section_id;

        if (from_section === to_section) {
          const doc = $document.get();
          const section = find_section(doc, from_section);
          if (!section) return;
          const from_index = section.blocks.findIndex((b) => b.id === s_data.block_id);
          const to_index = target.sortable
            ? target.sortable.index
            : section.blocks.findIndex((b) => b.id === t_data.block_id);

          execute("reorder_block", {
            section_id: from_section,
            block_id: s_data.block_id,
            from_index,
            to_index,
          });
        } else {
          execute("transfer_block", {
            block_id: s_data.block_id,
            from_section,
            to_section,
            to_index: t_data.index,
          });
        }
        return;
      }

      // Section reorder
      if (s_data.type === "section" && t_data.type === "section") {
        const doc = $document.get();
        const from_index = doc.sections.findIndex((s) => s.id === s_data.section_id);
        const to_index = doc.sections.findIndex((s) => s.id === t_data.section_id);

        if (from_index >= 0 && to_index >= 0) {
          execute("reorder_section", {
            section_id: s_data.section_id,
            from_index,
            to_index,
          });
        }
      }
    } catch (err) {
      // Operation failed (constraint violation, etc.) — silently drop
      if (hook_system) hook_system.fire("dnd.drop_error", { error: err, source: s_data, target: t_data });
    }
  };

  /* ── Public API ────────────────────────────────── */

  const dnd = {
    // Setup
    init(options = {}) {
      if (options.document) {
        $document.set(options.document);
      }
      if (options.max_sections != null) {
        const doc = $document.get();
        $document.set({
          ...doc,
          meta: { ...doc.meta, max_sections: options.max_sections },
        });
      }

      // Initialize @dnd-kit engine when a container element is provided
      if (options.container) {
        engine.init(options.container, options.engine);

        // Wire drag events to $drag_state and document operations
        engine.on("dragstart", (event) => {
          const source = event.operation.source;
          $drag_state.set({
            status: "dragging",
            source: source ? { type: source.type, id: source.id, ...(source.data || {}) } : null,
            target: null,
            operation: null,
          });
          if (hook_system) hook_system.fire("dnd.after_drag_start", { source });
        });

        engine.on("dragover", (event) => {
          const target = event.operation.target;
          if (target) {
            $drag_state.set({
              ...$drag_state.get(),
              target: { type: target.type, id: target.id, ...(target.data || {}) },
            });
          }
        });

        engine.on("dragend", (event) => {
          const { source, target } = event.operation;

          if (event.canceled) {
            $drag_state.set({ status: "idle", source: null, target: null, operation: null });
            if (hook_system) hook_system.fire("dnd.after_drag_cancel", { source });
            return;
          }

          // Resolve operation from source/target types
          if (source && target) {
            resolve_drop(source, target);
          }

          $drag_state.set({ status: "idle", source: null, target: null, operation: null });
          if (hook_system) hook_system.fire("dnd.after_drop", { source, target });
        });
      }

      // Register built-in types if requested
      if (options.builtins) {
        register_builtins(dnd);
      }
    },

    destroy() {
      engine.destroy();
      $document.set(create_document());
      $selection.set({ type: null, ids: [] });
      $drag_state.set({ status: "idle", source: null, target: null, operation: null });
      undo_stack.clear();
    },

    // Type registration
    register_section(definition) {
      type_registry.register_section_type(definition);
    },

    register_block(definition) {
      type_registry.register_block_type(definition);
    },

    unregister_section(type) {
      type_registry.unregister_section_type(type);
    },

    unregister_block(type) {
      type_registry.unregister_block_type(type);
    },

    get_section_type(type) {
      return type_registry.get_section_type(type);
    },

    get_block_type(type) {
      return type_registry.get_block_type(type);
    },

    list_section_types() {
      return type_registry.list_section_types();
    },

    list_block_types() {
      return type_registry.list_block_types();
    },

    // Document operations
    async add_section(type, options = {}) {
      const type_def = type_registry.get_section_type(type);
      const doc = $document.get();

      if (!can_accept_section(doc)) {
        throw new Error(`Cannot add section: max sections (${doc.meta.max_sections || 25}) reached`);
      }

      return execute("add_section", {
        section_type: type,
        template: options.template || (type_def && type_def.defaults) || {},
        at_index: options.at_index,
        constraints: options.constraints || (type_def && type_def.constraints),
      });
    },

    async add_block(section_id, type, options = {}) {
      const doc = $document.get();
      const section = find_section(doc, section_id);
      if (!section) throw new Error(`Section "${section_id}" not found`);

      const type_def = type_registry.get_block_type(type);
      const source = { block_type: type };

      if (!can_accept_block(section, source)) {
        throw new Error(`Section "${section_id}" cannot accept block type "${type}"`);
      }

      return execute("add_block", {
        section_id,
        block_type: type,
        template: options.template || (type_def && type_def.defaults) || {},
        at_index: options.at_index,
      });
    },

    async remove_section(section_id) {
      return execute("delete_section", { section_id });
    },

    async remove_block(section_id, block_id) {
      const doc = $document.get();
      const section = find_section(doc, section_id);
      if (section && !can_remove_block(section)) {
        throw new Error(`Cannot remove block: min_blocks constraint (${section.constraints.min_blocks}) would be violated`);
      }
      return execute("delete_block", { section_id, block_id });
    },

    async move_section(section_id, to_index) {
      const doc = $document.get();
      const from_index = doc.sections.findIndex((s) => s.id === section_id);
      if (from_index < 0) throw new Error(`Section "${section_id}" not found`);
      return execute("reorder_section", { section_id, from_index, to_index });
    },

    async move_block(block_id, to_section_id, to_index) {
      const doc = $document.get();
      const found = find_block(doc, block_id);
      if (!found) throw new Error(`Block "${block_id}" not found`);

      const { block, section: from_section } = found;

      if (from_section.id === to_section_id) {
        // Reorder within same section
        const from_index = from_section.blocks.findIndex((b) => b.id === block_id);
        return execute("reorder_block", {
          section_id: to_section_id,
          block_id,
          from_index,
          to_index,
        });
      }

      // Transfer between sections
      const to_section = find_section(doc, to_section_id);
      if (!to_section) throw new Error(`Section "${to_section_id}" not found`);

      if (!can_accept_block(to_section, { block_type: block.type })) {
        throw new Error(`Section "${to_section_id}" cannot accept block type "${block.type}"`);
      }

      if (!can_remove_block(from_section)) {
        throw new Error(`Cannot transfer block: min_blocks constraint would be violated on source section`);
      }

      return execute("transfer_block", {
        block_id,
        from_section: from_section.id,
        to_section: to_section_id,
        to_index,
      });
    },

    async update_block(section_id, block_id, content) {
      return execute("update_block_content", { section_id, block_id, content });
    },

    async update_section_settings(section_id, settings) {
      return execute("update_section_settings", { section_id, settings });
    },

    async update_block_settings(section_id, block_id, settings) {
      return execute("update_block_settings", { section_id, block_id, settings });
    },

    // Rendering
    render(doc) {
      return renderer.render_document(doc || $document.get());
    },

    export_html(doc) {
      return renderer.render_html(doc || $document.get());
    },

    // Undo / redo
    undo() {
      undo_stack.undo();
    },

    redo() {
      undo_stack.redo();
    },

    $can_undo: undo_stack.$can_undo,
    $can_redo: undo_stack.$can_redo,

    // Selection
    select(type, ids) {
      $selection.set({ type, ids: Array.isArray(ids) ? ids : [ids] });
    },

    clear_selection() {
      $selection.set({ type: null, ids: [] });
    },

    async delete_selected() {
      const sel = $selection.get();
      if (!sel.type || sel.ids.length === 0) return;

      const doc = $document.get();

      if (sel.type === "section") {
        for (const id of sel.ids) {
          await execute("delete_section", { section_id: id });
        }
      } else if (sel.type === "block") {
        for (const id of sel.ids) {
          const found = find_block(doc, id);
          if (found) {
            await execute("delete_block", {
              section_id: found.section.id,
              block_id: id,
            });
          }
        }
      }

      $selection.set({ type: null, ids: [] });
    },

    // Drag state management
    set_drag_state(state) {
      $drag_state.set({ ...$drag_state.get(), ...state });
    },

    // Direct access to atoms
    $document,
    $sections,
    $selection,
    $drag_state,
    $section_types: type_registry.$section_types,
    $block_types: type_registry.$block_types,

    // Engine (@dnd-kit integration)
    engine,

    // Visual feedback
    feedback,

    // Built-in type registration
    register_builtins() {
      return register_builtins(dnd);
    },

    // Internals for advanced use
    _type_registry: type_registry,
    _undo_stack: undo_stack,
    _operations: operations,
  };

  /* ── Register contribution handlers ────────────── */

  if (plugin_registry) {
    plugin_registry._register_handler("section_type", (plugin_id, definition) => {
      type_registry.register_section_type(definition);
      return () => type_registry.unregister_section_type(definition.type);
    });

    plugin_registry._register_handler("block_type", (plugin_id, definition) => {
      type_registry.register_block_type(definition);
      return () => type_registry.unregister_block_type(definition.type);
    });
  }

  return dnd;
};

export {
  create_dnd,
  // Re-export model utilities for direct use
  uid,
  create_section,
  create_block,
  create_document,
  $document,
  $sections,
  $selection,
  $drag_state,
  // Re-export builtins
  builtin_section_types,
  builtin_block_types,
};
