/* ── Hook System ─────────────────────────────────── */

const create_hook_system = () => {
  // Map<hook_name, Set<{ callback, priority }>>
  const hooks = new Map();

  const is_filter = (name) => {
    const last_dot = name.lastIndexOf(".");
    const segment = last_dot >= 0 ? name.slice(last_dot + 1) : name;
    return segment.startsWith("before_");
  };

  const get_sorted = (name) => {
    const set = hooks.get(name);
    if (!set || set.size === 0) return [];
    return [...set].sort((a, b) => a.priority - b.priority);
  };

  const system = {
    add(name, callback, priority = 10) {
      if (!hooks.has(name)) hooks.set(name, new Set());
      const entry = { callback, priority };
      hooks.get(name).add(entry);
      return () => {
        const set = hooks.get(name);
        if (set) {
          set.delete(entry);
          if (set.size === 0) hooks.delete(name);
        }
      };
    },

    async fire(name, value, context) {
      const sorted = get_sorted(name);
      if (sorted.length === 0) return is_filter(name) ? value : undefined;

      if (is_filter(name)) {
        let result = value;
        for (const { callback } of sorted) {
          try {
            const returned = await callback(result, context);
            if (returned !== undefined) result = returned;
          } catch (err) {
            console.error(`[hooks] Error in filter "${name}":`, err);
          }
        }
        return result;
      }

      // Action — fire all, ignore return values
      for (const { callback } of sorted) {
        try {
          await callback(value, context);
        } catch (err) {
          console.error(`[hooks] Error in action "${name}":`, err);
        }
      }
      return undefined;
    },

    has(name) {
      const set = hooks.get(name);
      return !!set && set.size > 0;
    },

    list() {
      return [...hooks.keys()];
    },

    clear() {
      hooks.clear();
    },
  };

  return system;
};

export { create_hook_system };
