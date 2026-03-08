/* ── Plugin DevTools ─────────────────────────────── */

const create_devtools_manifest = () => ({
  id: "xkin.devtools",
  name: "Xkin DevTools",
  version: "1.0.0",
  permissions: ["ui", "hooks"],
  activation: "on_demand",

  activate(ctx) {
    // Contribute a status bar indicator
    ctx.contribute("status_bar", {
      id: "devtools-status",
      label: "DevTools",
      order: 999,
      render: () => ({ tag: "span", props: { class: "xkin-devtools-indicator" }, children: ["DevTools"] }),
    });

    // Contribute a bottom panel for plugin inspection
    ctx.contribute("bottom_panel", {
      id: "devtools-panel",
      label: "Plugin Inspector",
      order: 0,
      render: null, // Will be set dynamically via refresh
    });
  },

  deactivate() {},
});

/* ── DevTools Utility Functions ───────────────────── */

const create_devtools = (plugin_registry) => {
  const snapshot = () => {
    const list = plugin_registry.list();
    const stats = plugin_registry.perf_stats();
    return list.map((p) => ({
      ...p,
      perf: stats[p.id] || null,
    }));
  };

  const inspect = (id) => {
    const info = plugin_registry.get(id);
    if (!info) return null;
    const stats = plugin_registry.perf_stats(id);
    return { ...info, perf: stats };
  };

  return { snapshot, inspect, manifest: create_devtools_manifest() };
};

export { create_devtools, create_devtools_manifest };
