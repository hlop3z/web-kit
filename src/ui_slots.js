import { atom } from "nanostores";
import { create_emitter } from "./files.js";

/* ── UI Slot Manager ─────────────────────────────── */

const get_engine = () => globalThis.XkinEngine;

const SLOT_NAMES = [
  "sidebar_left", "sidebar_right", "toolbar",
  "editor_title", "bottom_panel", "status_bar", "overlay",
];

const create_ui_slot_manager = () => {
  const emitter = create_emitter();

  // Each slot: Map<contribution_id, { plugin_id, label, render, alignment, order, ... }>
  const slots = new Map();
  for (const name of SLOT_NAMES) {
    slots.set(name, new Map());
  }

  // Mounted DOM containers per slot
  const containers = new Map();

  // Reactive atom: tracks contribution counts per slot for UI reactivity
  const $slots = atom(build_slot_state());

  function build_slot_state() {
    const state = {};
    for (const [name, contributions] of slots) {
      state[name] = [...contributions.values()].map((c) => ({
        id: c.id,
        plugin_id: c.plugin_id,
        label: c.label,
        alignment: c.alignment,
        order: c.order,
      }));
    }
    return state;
  }

  function notify() {
    $slots.set(build_slot_state());
  }

  /* ── Rendering ─────────────────────────────────── */

  const render_contribution = (slot_name, contribution) => {
    const engine = get_engine();
    if (!engine) return;

    const container = containers.get(slot_name);
    if (!container) return;

    // Find or create the wrapper div for this contribution
    let wrapper = container.querySelector(`[data-contribution="${contribution.id}"]`);
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.setAttribute("data-contribution", contribution.id);
      wrapper.setAttribute("data-plugin", contribution.plugin_id);

      // Insert in order
      const existing = [...container.children];
      const order = contribution.order || 0;
      let inserted = false;
      for (const child of existing) {
        const child_order = parseInt(child.getAttribute("data-order") || "0", 10);
        if (order < child_order) {
          container.insertBefore(wrapper, child);
          inserted = true;
          break;
        }
      }
      if (!inserted) container.appendChild(wrapper);
      wrapper.setAttribute("data-order", String(order));
    }

    // Render using Preact
    const { h, render } = engine;
    if (contribution.render) {
      render(h(contribution.render, null), wrapper);
    }
  };

  const unmount_contribution = (slot_name, contribution_id) => {
    const engine = get_engine();
    const container = containers.get(slot_name);
    if (!container) return;

    const wrapper = container.querySelector(`[data-contribution="${contribution_id}"]`);
    if (wrapper) {
      if (engine) {
        engine.render(null, wrapper);
      }
      wrapper.remove();
    }
  };

  const render_slot = (slot_name) => {
    const slot_contributions = slots.get(slot_name);
    if (!slot_contributions) return;

    for (const contribution of slot_contributions.values()) {
      render_contribution(slot_name, contribution);
    }
  };

  /* ── Notifications ─────────────────────────────── */

  const notifications = [];
  const $notifications = atom([]);

  const show_notification = (plugin_id, message, opts = {}) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const notification = {
      id,
      plugin_id,
      message,
      type: opts.type || "info", // "info" | "warning" | "error"
      timeout: opts.timeout ?? 5000,
      created_at: Date.now(),
    };

    notifications.push(notification);
    $notifications.set([...notifications]);
    emitter.emit("notification", notification);

    // Auto-dismiss
    if (notification.timeout > 0) {
      setTimeout(() => {
        dismiss_notification(id);
      }, notification.timeout);
    }

    return id;
  };

  const dismiss_notification = (id) => {
    const idx = notifications.findIndex((n) => n.id === id);
    if (idx >= 0) {
      notifications.splice(idx, 1);
      $notifications.set([...notifications]);
    }
  };

  /* ── Quick Pick / Input Dialogs ────────────────── */

  // These use a promise-based pattern. The host UI reads $dialog and renders it.
  // When the user makes a selection, resolve_dialog() is called.

  const $dialog = atom(null); // { type, props, resolve }

  const show_quick_pick = (plugin_id, items, opts = {}) => {
    return new Promise((resolve) => {
      $dialog.set({
        type: "quick_pick",
        plugin_id,
        items,
        placeholder: opts.placeholder || "",
        resolve: (selected) => {
          $dialog.set(null);
          resolve(selected);
        },
      });
      emitter.emit("dialog", { type: "quick_pick", plugin_id });
    });
  };

  const show_input = (plugin_id, opts = {}) => {
    return new Promise((resolve) => {
      $dialog.set({
        type: "input",
        plugin_id,
        placeholder: opts.placeholder || "",
        value: opts.value || "",
        resolve: (value) => {
          $dialog.set(null);
          resolve(value);
        },
      });
      emitter.emit("dialog", { type: "input", plugin_id });
    });
  };

  /* ── Settings UI Generation ────────────────────── */

  const generate_settings_ui = (plugin_id, schema, settings_atom) => {
    const engine = get_engine();
    if (!engine || !schema) return null;

    const { h } = engine;

    return () => {
      const values = settings_atom.get();

      const fields = Object.entries(schema).map(([key, field]) => {
        const value = values[key];
        let input;

        switch (field.type) {
          case "string":
            input = h("input", {
              type: "text",
              value: value || "",
              onInput: (e) => settings_atom.set({ ...settings_atom.get(), [key]: e.target.value }),
            });
            break;
          case "number":
            input = h("input", {
              type: "number",
              value: value ?? 0,
              min: field.min,
              max: field.max,
              onInput: (e) => settings_atom.set({ ...settings_atom.get(), [key]: Number(e.target.value) }),
            });
            break;
          case "boolean":
            input = h("input", {
              type: "checkbox",
              checked: !!value,
              onChange: (e) => settings_atom.set({ ...settings_atom.get(), [key]: e.target.checked }),
            });
            break;
          case "select":
            input = h("select", {
              value: value,
              onChange: (e) => settings_atom.set({ ...settings_atom.get(), [key]: e.target.value }),
            }, (field.options || []).map((opt) =>
              h("option", { value: opt.value, key: opt.value }, opt.label)
            ));
            break;
          case "color":
            input = h("input", {
              type: "color",
              value: value || "#000000",
              onInput: (e) => settings_atom.set({ ...settings_atom.get(), [key]: e.target.value }),
            });
            break;
          case "json":
            input = h("textarea", {
              value: typeof value === "string" ? value : JSON.stringify(value, null, 2),
              onInput: (e) => {
                try {
                  settings_atom.set({ ...settings_atom.get(), [key]: JSON.parse(e.target.value) });
                } catch { /* ignore invalid JSON while typing */ }
              },
            });
            break;
          default:
            input = h("span", null, String(value));
        }

        return h("div", { class: "xkin-setting-field", key },
          h("label", null,
            h("span", { class: "xkin-setting-label" }, field.label || key),
            field.description ? h("span", { class: "xkin-setting-desc" }, field.description) : null,
          ),
          input,
        );
      });

      return h("div", { class: "xkin-settings-form", "data-plugin": plugin_id }, fields);
    };
  };

  /* ── Manager API ───────────────────────────────── */

  const manager = {
    $slots,
    $notifications,
    $dialog,

    // Add a contribution to a slot
    add(slot_name, plugin_id, contribution) {
      const slot = slots.get(slot_name);
      if (!slot) throw new Error(`Unknown UI slot: "${slot_name}"`);
      if (!contribution.id) throw new Error(`UI contribution requires "id"`);

      const entry = { ...contribution, plugin_id };
      slot.set(contribution.id, entry);
      notify();
      emitter.emit("add", { slot: slot_name, id: contribution.id, plugin_id });

      // Render if container is mounted
      if (containers.has(slot_name)) {
        render_contribution(slot_name, entry);
      }

      return () => {
        manager.remove(slot_name, contribution.id);
      };
    },

    // Remove a contribution from a slot
    remove(slot_name, contribution_id) {
      const slot = slots.get(slot_name);
      if (!slot) return;

      if (slot.has(contribution_id)) {
        unmount_contribution(slot_name, contribution_id);
        slot.delete(contribution_id);
        notify();
        emitter.emit("remove", { slot: slot_name, id: contribution_id });
      }
    },

    // Get all contributions for a slot
    get(slot_name) {
      const slot = slots.get(slot_name);
      return slot ? [...slot.values()] : [];
    },

    // Mount a DOM container for a slot — triggers rendering of existing contributions
    mount(slot_name, element) {
      if (!SLOT_NAMES.includes(slot_name)) {
        throw new Error(`Unknown UI slot: "${slot_name}"`);
      }
      containers.set(slot_name, element);
      render_slot(slot_name);
    },

    // Unmount a slot container
    unmount(slot_name) {
      const container = containers.get(slot_name);
      if (container) {
        const engine = get_engine();
        // Unmount all contributions
        const slot = slots.get(slot_name);
        if (slot) {
          for (const id of slot.keys()) {
            unmount_contribution(slot_name, id);
          }
        }
        containers.delete(slot_name);
      }
    },

    // Notification API
    show_notification,
    dismiss_notification,

    // Dialog API
    show_quick_pick,
    show_input,

    // Settings UI
    generate_settings_ui,

    // Events
    on(event, callback) {
      return emitter.on(event, callback);
    },

    // List slot names
    slot_names() {
      return [...SLOT_NAMES];
    },
  };

  return manager;
};

export { create_ui_slot_manager, SLOT_NAMES };
