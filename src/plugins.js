import { atom } from "nanostores";
import { create_emitter } from "./files.js";

/* ── Plugin Registry ─────────────────────────────── */

const VALID_PERMISSIONS = new Set([
  "files", "files.read", "keys", "hooks", "ui",
  "workspace", "workspace.read", "tools", "editor",
  "store", "commands", "settings",
]);

const REQUIRED_FIELDS = ["id", "name", "version", "activate"];

const STATES = { installed: "installed", active: "active", inactive: "inactive", error: "error", lazy: "lazy" };

const parse_activation = (activation) => {
  if (!activation || typeof activation !== "string") return null;
  const colon = activation.indexOf(":");
  if (colon < 0) return null;
  const kind = activation.slice(0, colon);     // "on_language" | "on_command"
  const target = activation.slice(colon + 1);  // e.g. "javascript", "myPlugin.run"
  if (kind === "on_language" || kind === "on_command") return { kind, target };
  return null;
};

const create_plugin_registry = (hook_system, ui_slot_manager) => {
  const plugins = new Map();     // id -> { manifest, state, ctx, error }
  const emitter = create_emitter();
  const contribution_handlers = new Map(); // target -> handler fn

  // Lazy activation triggers: Map<trigger_key, Set<plugin_id>>
  const lazy_triggers = new Map(); // e.g. "on_language:javascript" -> Set(["my-plugin"])

  // Performance tracking: Map<plugin_id, { activation_ms, hook_calls, hook_time_ms }>
  const perf = new Map();

  /* ── Contribution Handlers ─────────────────────── */

  const register_handler = (target, handler) => {
    contribution_handlers.set(target, handler);
  };

  /* ── Settings Helpers ──────────────────────────── */

  const extract_defaults = (schema) => {
    if (!schema) return {};
    const defaults = {};
    for (const [key, def] of Object.entries(schema)) {
      defaults[key] = def.default !== undefined ? def.default : null;
    }
    return defaults;
  };

  const validate_setting = (key, value, field_schema) => {
    if (!field_schema) return false;
    switch (field_schema.type) {
      case "string":
        return typeof value === "string";
      case "number": {
        if (typeof value !== "number") return false;
        if (field_schema.min != null && value < field_schema.min) return false;
        if (field_schema.max != null && value > field_schema.max) return false;
        return true;
      }
      case "boolean":
        return typeof value === "boolean";
      case "select": {
        if (!field_schema.options) return false;
        return field_schema.options.some((o) => o.value === value);
      }
      case "color":
        return typeof value === "string";
      case "json":
        return true; // Accept any value for json type
      default:
        return true;
    }
  };

  const create_settings_atom = (schema, persisted) => {
    const defaults = extract_defaults(schema);
    const initial = { ...defaults };

    // Merge persisted values (only valid ones)
    if (persisted && schema) {
      for (const [key, value] of Object.entries(persisted)) {
        if (key in schema && validate_setting(key, value, schema[key])) {
          initial[key] = value;
        }
      }
    }

    const $settings = atom(initial);

    // Wrap set to validate
    const original_set = $settings.set.bind($settings);
    $settings.set = (next_value) => {
      if (!schema) {
        original_set(next_value);
        return;
      }
      const validated = {};
      const current = $settings.get();
      for (const [key, field_schema] of Object.entries(schema)) {
        if (key in next_value) {
          if (validate_setting(key, next_value[key], field_schema)) {
            validated[key] = next_value[key];
          } else {
            validated[key] = current[key]; // Preserve previous value
          }
        } else {
          validated[key] = current[key];
        }
      }
      original_set(validated);
    };

    return { $settings, defaults };
  };

  /* ── Context Factory ───────────────────────────── */

  const create_context = (manifest, persisted_settings) => {
    const permissions = new Set(manifest.permissions || []);
    const subscriptions = [];
    const schema = manifest.settings || null;
    const { $settings, defaults } = create_settings_atom(schema, persisted_settings);

    const has_permission = (perm) => {
      if (permissions.has(perm)) return true;
      // Check parent permission (e.g., "files" grants "files.read")
      const dot = perm.indexOf(".");
      if (dot >= 0) return permissions.has(perm.slice(0, dot));
      return false;
    };

    const ctx = {
      settings: $settings,
      defaults,
      subscriptions,

      contribute(target, contribution) {
        // Permission check
        const perm_map = {
          sidebar_left: "ui", sidebar_right: "ui", toolbar: "ui",
          editor_title: "ui", bottom_panel: "ui", status_bar: "ui", overlay: "ui",
          command: "commands", theme: "editor", language: "editor",
          formatter: "tools",
        };
        const required_perm = perm_map[target];
        if (required_perm && !has_permission(required_perm)) {
          throw new Error(`Plugin "${manifest.id}" lacks "${required_perm}" permission for target "${target}"`);
        }

        const handler = contribution_handlers.get(target);
        if (!handler) {
          throw new Error(`Unknown contribution target: "${target}"`);
        }

        const dispose = handler(manifest.id, contribution);
        if (typeof dispose === "function") {
          subscriptions.push(dispose);
        }
        return dispose || (() => {});
      },

      hook(name, callback, priority) {
        if (!has_permission("hooks")) {
          throw new Error(`Plugin "${manifest.id}" lacks "hooks" permission`);
        }
        const dispose = hook_system.add(name, callback, priority);
        subscriptions.push(dispose);
        return dispose;
      },
    };

    // Conditionally add ctx.ui
    if (has_permission("ui")) {
      ctx.ui = {
        show_notification(message, opts) {
          if (ui_slot_manager) {
            return ui_slot_manager.show_notification(manifest.id, message, opts);
          }
          console.log(`[${manifest.id}] notification:`, message);
        },
        async show_quick_pick(items, opts) {
          if (ui_slot_manager) {
            return ui_slot_manager.show_quick_pick(manifest.id, items, opts);
          }
          return items.length > 0 ? items[0] : null;
        },
        async show_input(opts) {
          if (ui_slot_manager) {
            return ui_slot_manager.show_input(manifest.id, opts);
          }
          return null;
        },
      };
    }

    return ctx;
  };

  /* ── Dependency Resolution ─────────────────────── */

  const resolve_dependencies = (id, visited = new Set(), stack = new Set()) => {
    if (stack.has(id)) {
      throw new Error(`Circular dependency detected: ${[...stack, id].join(" -> ")}`);
    }
    if (visited.has(id)) return [];

    stack.add(id);
    visited.add(id);

    const plugin = plugins.get(id);
    if (!plugin) throw new Error(`Missing dependency: "${id}"`);

    const deps = plugin.manifest.dependencies || {};
    const order = [];

    for (const dep_id of Object.keys(deps)) {
      order.push(...resolve_dependencies(dep_id, visited, new Set(stack)));
    }

    order.push(id);
    return order;
  };

  const get_dependents = (id) => {
    const dependents = [];
    for (const [pid, plugin] of plugins) {
      const deps = plugin.manifest.dependencies || {};
      if (id in deps) dependents.push(pid);
    }
    return dependents;
  };

  /* ── Persistence Key ───────────────────────────── */

  const settings_key = (id) => `xkin_plugin_settings:${id}`;

  const load_persisted_settings = (id) => {
    try {
      const raw = globalThis.localStorage?.getItem(settings_key(id));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const save_persisted_settings = (id, values) => {
    try {
      globalThis.localStorage?.setItem(settings_key(id), JSON.stringify(values));
    } catch { /* ignore */ }
  };

  /* ── Registry API ──────────────────────────────── */

  const registry = {
    register(manifest) {
      // Validate required fields
      for (const field of REQUIRED_FIELDS) {
        if (!manifest[field]) {
          throw new Error(`Plugin manifest missing required field: "${field}"`);
        }
      }

      // Validate permissions
      if (manifest.permissions) {
        for (const perm of manifest.permissions) {
          if (!VALID_PERMISSIONS.has(perm)) {
            throw new Error(`Unknown permission: "${perm}"`);
          }
        }
      }

      // Check for duplicate
      if (plugins.has(manifest.id)) {
        throw new Error(`Plugin "${manifest.id}" is already registered`);
      }

      // Check dependencies exist (or will exist)
      if (manifest.dependencies) {
        const dep_ids = Object.keys(manifest.dependencies);
        // Cycle detection via dry-run after insertion
        plugins.set(manifest.id, { manifest, state: STATES.installed, ctx: null, error: null });
        try {
          for (const dep_id of dep_ids) {
            if (!plugins.has(dep_id)) {
              plugins.delete(manifest.id);
              throw new Error(`Missing dependency: "${dep_id}" required by "${manifest.id}"`);
            }
          }
          resolve_dependencies(manifest.id);
        } catch (err) {
          plugins.delete(manifest.id);
          throw err;
        }
      } else {
        plugins.set(manifest.id, { manifest, state: STATES.installed, ctx: null, error: null });
      }

      emitter.emit("register", { id: manifest.id, manifest });

      // Auto-activate on_load plugins
      if (manifest.activation === "on_load") {
        registry.activate(manifest.id).catch((err) => {
          console.error(`[plugins] Auto-activation failed for "${manifest.id}":`, err);
        });
      }

      // Register lazy triggers
      const trigger = parse_activation(manifest.activation);
      if (trigger) {
        plugins.get(manifest.id).state = STATES.lazy;
        const key = `${trigger.kind}:${trigger.target}`;
        if (!lazy_triggers.has(key)) lazy_triggers.set(key, new Set());
        lazy_triggers.get(key).add(manifest.id);
      }
    },

    unregister(id) {
      const plugin = plugins.get(id);
      if (!plugin) return;

      // Deactivate first if active
      if (plugin.state === STATES.active) {
        // Synchronous best-effort deactivation
        try {
          const dependents = get_dependents(id);
          for (const dep_id of dependents) {
            const dep = plugins.get(dep_id);
            if (dep && dep.state === STATES.active) {
              registry.deactivate(dep_id);
            }
          }

          if (plugin.manifest.deactivate) {
            plugin.manifest.deactivate();
          }
          if (plugin.ctx) {
            for (const dispose of plugin.ctx.subscriptions) {
              try { dispose(); } catch { /* ignore */ }
            }
          }
        } catch { /* ignore */ }
      }

      plugins.delete(id);
      perf.delete(id);

      // Clean up lazy triggers
      for (const [key, ids] of lazy_triggers) {
        ids.delete(id);
        if (ids.size === 0) lazy_triggers.delete(key);
      }

      emitter.emit("deactivate", { id });
    },

    async activate(id) {
      const plugin = plugins.get(id);
      if (!plugin) throw new Error(`Plugin "${id}" is not registered`);
      if (plugin.state === STATES.active) return;

      // Activate dependencies first
      const order = resolve_dependencies(id);
      for (const dep_id of order) {
        if (dep_id === id) continue;
        const dep = plugins.get(dep_id);
        if (dep && dep.state !== STATES.active) {
          try {
            await registry.activate(dep_id);
          } catch (err) {
            plugin.state = STATES.error;
            plugin.error = err;
            emitter.emit("error", { id, error: err });
            throw new Error(`Dependency "${dep_id}" failed to activate for "${id}": ${err.message}`);
          }
        }
      }

      // Create context
      const persisted = load_persisted_settings(id);
      const ctx = create_context(plugin.manifest, persisted);
      plugin.ctx = ctx;

      // Persist settings on change
      if (plugin.manifest.settings) {
        const unsub = ctx.settings.subscribe((values) => {
          save_persisted_settings(id, values);
        });
        ctx.subscriptions.push(unsub);
      }

      try {
        const t0 = performance.now();
        await plugin.manifest.activate(ctx);
        const activation_ms = performance.now() - t0;
        plugin.state = STATES.active;
        perf.set(id, { activation_ms, hook_calls: 0, hook_time_ms: 0 });
        emitter.emit("activate", { id, activation_ms });
      } catch (err) {
        plugin.state = STATES.error;
        plugin.error = err;
        // Clean up subscriptions on failure
        for (const dispose of ctx.subscriptions) {
          try { dispose(); } catch { /* ignore */ }
        }
        emitter.emit("error", { id, error: err });
        throw err;
      }
    },

    async deactivate(id) {
      const plugin = plugins.get(id);
      if (!plugin || plugin.state !== STATES.active) return;

      // Deactivate dependents first (reverse order)
      const dependents = get_dependents(id);
      for (const dep_id of dependents) {
        const dep = plugins.get(dep_id);
        if (dep && dep.state === STATES.active) {
          await registry.deactivate(dep_id);
        }
      }

      // Call deactivate lifecycle
      if (plugin.manifest.deactivate) {
        try {
          await plugin.manifest.deactivate();
        } catch (err) {
          console.error(`[plugins] deactivate() error for "${id}":`, err);
        }
      }

      // Dispose all subscriptions
      if (plugin.ctx) {
        for (const dispose of plugin.ctx.subscriptions) {
          try { dispose(); } catch { /* ignore */ }
        }
        plugin.ctx.subscriptions.length = 0;
      }

      plugin.state = STATES.inactive;
      plugin.ctx = null;
      emitter.emit("deactivate", { id });
    },

    get(id) {
      const plugin = plugins.get(id);
      if (!plugin) return null;
      return {
        id: plugin.manifest.id,
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        state: plugin.state,
        error: plugin.error,
      };
    },

    list() {
      return [...plugins.values()].map((p) => ({
        id: p.manifest.id,
        name: p.manifest.name,
        version: p.manifest.version,
        state: p.state,
        error: p.error,
      }));
    },

    is_active(id) {
      const plugin = plugins.get(id);
      return plugin ? plugin.state === STATES.active : false;
    },

    on(event, callback) {
      return emitter.on(event, callback);
    },

    /* ── Lazy Activation Trigger ────────────────────── */

    async trigger_activation(kind, target) {
      const key = `${kind}:${target}`;
      const ids = lazy_triggers.get(key);
      if (!ids || ids.size === 0) return [];

      const activated = [];
      for (const id of [...ids]) {
        const plugin = plugins.get(id);
        if (plugin && plugin.state === STATES.lazy) {
          try {
            await registry.activate(id);
            activated.push(id);
          } catch (err) {
            console.error(`[plugins] Lazy activation failed for "${id}":`, err);
          }
        }
      }
      return activated;
    },

    /* ── Dynamic Loading ────────────────────────────── */

    async load_from_url(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch plugin from "${url}": ${response.status}`);
      }
      const source = await response.text();
      // Evaluate as a module-like function that returns a manifest
      const factory = new Function(`"use strict";\n${source}\n`);
      const manifest = factory();
      if (!manifest || !manifest.id) {
        throw new Error(`Plugin loaded from "${url}" did not return a valid manifest`);
      }
      manifest._source_url = url;
      registry.register(manifest);
      return manifest.id;
    },

    /* ── Performance Stats ──────────────────────────── */

    perf_stats(id) {
      if (id) return perf.get(id) || null;
      const all = {};
      for (const [pid, stats] of perf) {
        all[pid] = { ...stats };
      }
      return all;
    },

    _track_hook(plugin_id, duration_ms) {
      const stats = perf.get(plugin_id);
      if (stats) {
        stats.hook_calls += 1;
        stats.hook_time_ms += duration_ms;
      }
    },

    // Internal: register a contribution target handler
    _register_handler: register_handler,

    // Internal: access lazy triggers for testing
    _lazy_triggers: lazy_triggers,
  };

  return registry;
};

export { create_plugin_registry };
