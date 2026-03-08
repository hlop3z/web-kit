/* ── Contribution Target Handlers ─────────────────── */

const get_editor = () => globalThis.XkinEditor;

/**
 * Registers all built-in contribution target handlers on a plugin registry.
 * Each handler receives (plugin_id, contribution) and returns a Dispose function.
 */
const register_contribution_handlers = (registry, keys_manager, hook_system, ui_slot_manager) => {

  /* ── Command Target ────────────────────────────── */

  const commands = new Map(); // id -> { plugin_id, label, menu, menu_order, keys_dispose, run }

  registry._register_handler("command", (plugin_id, contribution) => {
    const { id, label, keys, when, menu, menu_order, run } = contribution;
    if (!id || !run) {
      throw new Error(`Command contribution requires "id" and "run"`);
    }

    // Delegate keybinding to keys_manager
    let keys_dispose = null;
    if (keys) {
      keys_dispose = keys_manager.add({
        id,
        label: label || id,
        keys,
        when,
        menu,
        menu_order,
        run,
      });
    }

    commands.set(id, { plugin_id, label, menu, menu_order, keys_dispose, run });

    return () => {
      if (keys_dispose) keys_dispose();
      commands.delete(id);
    };
  });

  /* ── Run Command (with lazy activation) ─────────── */

  const run_command = async (command_id, ...args) => {
    // If command not registered, try lazy activation
    if (!commands.has(command_id)) {
      await registry.trigger_activation("on_command", command_id);
    }

    const entry = commands.get(command_id);
    if (!entry) throw new Error(`Unknown command: "${command_id}"`);
    return entry.run(...args);
  };

  /* ── Theme Target ──────────────────────────────── */

  const themes = new Map(); // id -> { plugin_id, label, data }

  registry._register_handler("theme", (plugin_id, contribution) => {
    const { id, label, data } = contribution;
    if (!id || !data) {
      throw new Error(`Theme contribution requires "id" and "data"`);
    }

    const monaco = get_editor();
    if (monaco) {
      monaco.editor.defineTheme(id, data);
    }

    themes.set(id, { plugin_id, label, data });

    return () => {
      themes.delete(id);
      // Monaco doesn't support undefining themes, so we leave it registered
    };
  });

  /* ── Language Target ───────────────────────────── */

  const languages = new Map(); // id -> { plugin_id, dispose }

  registry._register_handler("language", (plugin_id, contribution) => {
    const { id, extensions, aliases, config } = contribution;
    if (!id) {
      throw new Error(`Language contribution requires "id"`);
    }

    const monaco = get_editor();
    let dispose_lang = null;
    let dispose_tokens = null;

    if (monaco) {
      // Register the language
      monaco.languages.register({
        id,
        extensions: extensions || [],
        aliases: aliases || [],
      });

      // Register Monarch tokenizer if config provided
      if (config) {
        monaco.languages.setMonarchTokensProvider(id, config);
      }
    }

    languages.set(id, { plugin_id });

    return () => {
      languages.delete(id);
      // Monaco doesn't support unregistering languages
    };
  });

  /* ── Formatter Target ──────────────────────────── */

  const formatters = new Map(); // key -> { plugin_id, dispose }

  registry._register_handler("formatter", (plugin_id, contribution) => {
    const { language, format } = contribution;
    if (!language || !format) {
      throw new Error(`Formatter contribution requires "language" and "format"`);
    }

    // Register as a hook on file.before_format so it integrates with the format pipeline
    const dispose = hook_system.add("file.before_format", (opts, context) => {
      // Only intercept if the file matches this formatter's language
      if (context && context.path) {
        const ext_map = {
          javascript: /\.[jm]?jsx?$/,
          typescript: /\.tsx?$/,
          css: /\.css$/,
          scss: /\.s[ac]ss$/,
          html: /\.html?$/,
          json: /\.json$/,
          markdown: /\.md$/,
          python: /\.py$/,
        };
        const pattern = ext_map[language];
        if (pattern && !pattern.test(context.path)) return opts;
      }

      // Override the source with the formatted output
      const formatted = format(opts.source, opts);
      if (formatted !== undefined && formatted !== null) {
        // If format returns a promise, we handle it; if string, wrap it
        if (typeof formatted === "string") {
          return { ...opts, source: formatted };
        }
        if (typeof formatted.then === "function") {
          return formatted.then((result) => {
            if (typeof result === "string") return { ...opts, source: result };
            return opts;
          });
        }
      }
      return opts;
    }, 20); // priority 20 — runs after default hooks but before late ones

    const key = `${plugin_id}:${language}`;
    formatters.set(key, { plugin_id, dispose });

    return () => {
      dispose();
      formatters.delete(key);
    };
  });

  /* ── UI Slot Targets ────────────────────────────── */

  const ui_slots = ["sidebar_left", "sidebar_right", "toolbar", "editor_title", "bottom_panel", "status_bar", "overlay"];

  for (const slot of ui_slots) {
    registry._register_handler(slot, (plugin_id, contribution) => {
      if (ui_slot_manager) {
        return ui_slot_manager.add(slot, plugin_id, contribution);
      }

      // Fallback if no UI slot manager (e.g., tests without one)
      const { id } = contribution;
      if (!id) {
        throw new Error(`UI slot "${slot}" contribution requires "id"`);
      }
      return () => {};
    });
  }

  return { commands, themes, languages, formatters, run_command };
};

export { register_contribution_handlers };
