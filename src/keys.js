/* ── Keybindings System ───────────────────────────── */

const get_editor = () => globalThis.XkinEditor;

/* ── Key Parser ───────────────────────────────────── */

const KEY_CODE_MAP = {
  backspace: "Backspace", tab: "Tab", enter: "Enter", escape: "Escape",
  space: "Space", delete: "Delete", insert: "Insert",
  home: "Home", end: "End", pageup: "PageUp", pagedown: "PageDown",
  uparrow: "UpArrow", downarrow: "DownArrow",
  leftarrow: "LeftArrow", rightarrow: "RightArrow",
  up: "UpArrow", down: "DownArrow", left: "LeftArrow", right: "RightArrow",
  f1: "F1", f2: "F2", f3: "F3", f4: "F4", f5: "F5", f6: "F6",
  f7: "F7", f8: "F8", f9: "F9", f10: "F10", f11: "F11", f12: "F12",
  ",": "Comma", ".": "Period", "/": "Slash", "\\": "Backslash",
  ";": "Semicolon", "'": "Quote", "[": "BracketLeft", "]": "BracketRight",
  "`": "Backquote", "-": "Minus", "=": "Equal",
};

const parse_single = (str) => {
  const monaco = get_editor();
  if (!monaco) return 0;

  const parts = str.toLowerCase().trim().split("+");
  let mods = 0;
  let key_part = null;

  for (const p of parts) {
    switch (p) {
      case "ctrl":
      case "cmd":
      case "meta":
        mods |= monaco.KeyMod.CtrlCmd;
        break;
      case "shift":
        mods |= monaco.KeyMod.Shift;
        break;
      case "alt":
      case "option":
        mods |= monaco.KeyMod.Alt;
        break;
      case "winctrl":
        mods |= monaco.KeyMod.WinCtrl;
        break;
      default:
        key_part = p;
    }
  }

  if (!key_part) return mods;

  // Map key to Monaco KeyCode
  let key_code;
  const mapped = KEY_CODE_MAP[key_part];
  if (mapped) {
    key_code = monaco.KeyCode[mapped];
  } else if (key_part.length === 1) {
    // Single character: try KeyA..KeyZ, Digit0..Digit9
    const upper = key_part.toUpperCase();
    if (upper >= "A" && upper <= "Z") {
      key_code = monaco.KeyCode["Key" + upper];
    } else if (upper >= "0" && upper <= "9") {
      key_code = monaco.KeyCode["Digit" + upper];
    }
  }

  if (key_code == null) {
    // Try direct lookup
    key_code = monaco.KeyCode[key_part] || monaco.KeyCode[key_part.charAt(0).toUpperCase() + key_part.slice(1)];
  }

  return key_code != null ? mods | key_code : mods;
};

const parse_keys = (str) => {
  const monaco = get_editor();
  if (!monaco) return 0;

  // Check for chord (space-separated key combos)
  const chord_parts = str.trim().split(/\s+/);
  if (chord_parts.length === 2) {
    return monaco.KeyMod.chord(parse_single(chord_parts[0]), parse_single(chord_parts[1]));
  }
  if (chord_parts.length > 2) {
    // Monaco only supports two-part chords
    return monaco.KeyMod.chord(parse_single(chord_parts[0]), parse_single(chord_parts[1]));
  }

  return parse_single(str);
};

/* ── Keys Manager ─────────────────────────────────── */

const create_keys_manager = () => {
  const bindings = new Map();
  const queue = [];
  let editor_instance = null;

  const apply_binding = (binding) => {
    const monaco = get_editor();
    if (!monaco || !editor_instance) return null;

    const keybinding = parse_keys(binding.keys);
    const action = editor_instance.addAction({
      id: binding.id,
      label: binding.label || binding.id,
      keybindings: [keybinding],
      precondition: binding.when || undefined,
      contextMenuGroupId: binding.menu || undefined,
      contextMenuOrder: binding.menu_order || undefined,
      run: binding.run,
    });

    return action;
  };

  const flush_queue = () => {
    while (queue.length) {
      const binding = queue.shift();
      const action = apply_binding(binding);
      if (action) {
        bindings.set(binding.id, { binding, dispose: () => action.dispose() });
      }
    }
  };

  const keys = {
    _set_editor(ed) {
      editor_instance = ed;
      flush_queue();
    },

    add(binding) {
      // If already registered, remove old one
      if (bindings.has(binding.id)) {
        keys.remove(binding.id);
      }

      if (!editor_instance) {
        queue.push(binding);
        return () => {
          const idx = queue.findIndex((b) => b.id === binding.id);
          if (idx >= 0) queue.splice(idx, 1);
          if (bindings.has(binding.id)) keys.remove(binding.id);
        };
      }

      const action = apply_binding(binding);
      if (action) {
        bindings.set(binding.id, { binding, dispose: () => action.dispose() });
      }

      return () => keys.remove(binding.id);
    },

    add_all(binding_list) {
      const disposes = binding_list.map((b) => keys.add(b));
      return () => disposes.forEach((d) => d());
    },

    remove(id) {
      const entry = bindings.get(id);
      if (entry) {
        entry.dispose();
        bindings.delete(id);
      }
      // Also remove from queue
      const idx = queue.findIndex((b) => b.id === id);
      if (idx >= 0) queue.splice(idx, 1);
    },

    override(id, { keys: key_str, run, when } = {}) {
      return keys.add({
        id,
        keys: key_str,
        run,
        when,
      });
    },

    unbind(builtin_id) {
      if (!editor_instance) {
        const binding = {
          id: `__unbind_${builtin_id}`,
          keys: "",
          run: () => {},
          _unbind_target: builtin_id,
        };
        queue.push(binding);
        return () => keys.remove(binding.id);
      }

      const monaco = get_editor();
      if (!monaco) return () => {};

      // Override the action with a no-op and keybinding 0
      const action = editor_instance.addAction({
        id: `__unbind_${builtin_id}`,
        label: `Unbind ${builtin_id}`,
        keybindings: [0],
        run: () => {},
      });

      // Use createContextKey to disable the built-in
      editor_instance.addCommand(0, () => {}, builtin_id);

      const id = `__unbind_${builtin_id}`;
      bindings.set(id, { binding: { id }, dispose: () => action.dispose() });
      return () => keys.remove(id);
    },

    list() {
      const result = [];
      for (const [id, entry] of bindings) {
        if (entry.binding) result.push({ ...entry.binding });
      }
      for (const b of queue) {
        result.push({ ...b });
      }
      return result;
    },

    context(name, default_value) {
      let current = default_value;

      const api = {
        set(value) {
          current = value;
          if (editor_instance) {
            const monaco = get_editor();
            if (monaco) {
              editor_instance.createContextKey(name, value);
            }
          }
        },
        get() {
          return current;
        },
        reset() {
          api.set(default_value);
        },
      };

      // Initialize if editor exists
      if (editor_instance) {
        const monaco = get_editor();
        if (monaco) {
          editor_instance.createContextKey(name, default_value);
        }
      }

      return api;
    },
  };

  return keys;
};

export { create_keys_manager, parse_keys };
