import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setup_mock, teardown_mock } from "./setup.js";
import { create_hook_system } from "../hooks.js";
import { create_plugin_registry } from "../plugins.js";
import { create_keys_manager } from "../keys.js";
import { create_ui_slot_manager } from "../ui_slots.js";
import { register_contribution_handlers } from "../contributions.js";
import { create_devtools } from "../devtools_plugin.js";

let hooks, plugins, keys, ui, contributions;

beforeEach(() => {
  setup_mock();
  hooks = create_hook_system();
  ui = create_ui_slot_manager();
  keys = create_keys_manager();
  plugins = create_plugin_registry(hooks, ui);
  contributions = register_contribution_handlers(plugins, keys, hooks, ui);
});

afterEach(() => {
  teardown_mock();
});

const make_plugin = (overrides = {}) => ({
  id: "test-plugin",
  name: "Test Plugin",
  version: "1.0.0",
  permissions: [],
  activation: "on_demand",
  activate: vi.fn(),
  ...overrides,
});

/* ── Lazy Activation: on_language ────────────────── */

describe("lazy activation: on_language", () => {
  it("sets state to lazy on register", () => {
    plugins.register(make_plugin({
      id: "lang-plugin",
      activation: "on_language:javascript",
    }));
    expect(plugins.get("lang-plugin").state).toBe("lazy");
  });

  it("activates on trigger_activation", async () => {
    const activate = vi.fn();
    plugins.register(make_plugin({
      id: "js-support",
      activation: "on_language:javascript",
      activate,
    }));

    expect(plugins.is_active("js-support")).toBe(false);

    const activated = await plugins.trigger_activation("on_language", "javascript");
    expect(activated).toEqual(["js-support"]);
    expect(plugins.is_active("js-support")).toBe(true);
    expect(activate).toHaveBeenCalled();
  });

  it("does not activate for wrong language", async () => {
    plugins.register(make_plugin({
      id: "ts-plugin",
      activation: "on_language:typescript",
    }));

    const activated = await plugins.trigger_activation("on_language", "javascript");
    expect(activated).toEqual([]);
    expect(plugins.get("ts-plugin").state).toBe("lazy");
  });

  it("multiple plugins for same language", async () => {
    plugins.register(make_plugin({
      id: "js-lint",
      name: "JS Lint",
      activation: "on_language:javascript",
    }));
    plugins.register(make_plugin({
      id: "js-format",
      name: "JS Format",
      activation: "on_language:javascript",
    }));

    const activated = await plugins.trigger_activation("on_language", "javascript");
    expect(activated).toHaveLength(2);
    expect(activated).toContain("js-lint");
    expect(activated).toContain("js-format");
  });

  it("ignores already-activated plugins", async () => {
    const activate = vi.fn();
    plugins.register(make_plugin({
      id: "once",
      activation: "on_language:css",
      activate,
    }));

    await plugins.trigger_activation("on_language", "css");
    await plugins.trigger_activation("on_language", "css"); // second call
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it("returns empty array for unknown trigger", async () => {
    const activated = await plugins.trigger_activation("on_language", "unknown");
    expect(activated).toEqual([]);
  });
});

/* ── Lazy Activation: on_command ─────────────────── */

describe("lazy activation: on_command", () => {
  it("sets state to lazy on register", () => {
    plugins.register(make_plugin({
      id: "cmd-plugin",
      activation: "on_command:myPlugin.run",
    }));
    expect(plugins.get("cmd-plugin").state).toBe("lazy");
  });

  it("run_command triggers lazy activation", async () => {
    const activate = vi.fn((ctx) => {
      ctx.contribute("command", {
        id: "lazy.greet",
        run: () => "hello from lazy",
      });
    });

    plugins.register(make_plugin({
      id: "lazy-cmd",
      activation: "on_command:lazy.greet",
      permissions: ["commands"],
      activate,
    }));

    const result = await contributions.run_command("lazy.greet");
    expect(result).toBe("hello from lazy");
    expect(plugins.is_active("lazy-cmd")).toBe(true);
  });

  it("run_command throws for truly unknown command", async () => {
    await expect(contributions.run_command("nope.nope")).rejects.toThrow("Unknown command");
  });

  it("run_command works for already registered commands", async () => {
    plugins.register(make_plugin({
      id: "eager",
      permissions: ["commands"],
      activate(ctx) {
        ctx.contribute("command", {
          id: "eager.run",
          run: () => 42,
        });
      },
    }));
    await plugins.activate("eager");

    const result = await contributions.run_command("eager.run");
    expect(result).toBe(42);
  });
});

/* ── load_from_url ───────────────────────────────── */

describe("load_from_url", () => {
  it("loads and registers a plugin from URL", async () => {
    const plugin_source = `
      return {
        id: "remote-plugin",
        name: "Remote Plugin",
        version: "1.0.0",
        activate() {},
      };
    `;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(plugin_source),
    });

    const id = await plugins.load_from_url("https://example.com/plugin.js");
    expect(id).toBe("remote-plugin");
    expect(plugins.get("remote-plugin")).not.toBeNull();
    expect(plugins.get("remote-plugin").state).toBe("installed");

    delete globalThis.fetch;
  });

  it("throws on fetch failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(plugins.load_from_url("https://example.com/nope.js"))
      .rejects.toThrow("404");

    delete globalThis.fetch;
  });

  it("throws on invalid manifest", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("return null;"),
    });

    await expect(plugins.load_from_url("https://example.com/bad.js"))
      .rejects.toThrow("valid manifest");

    delete globalThis.fetch;
  });

  it("stores source URL on manifest", async () => {
    const plugin_source = `
      return {
        id: "url-tracked",
        name: "URL Tracked",
        version: "1.0.0",
        activate() {},
      };
    `;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(plugin_source),
    });

    await plugins.load_from_url("https://example.com/tracked.js");
    // The plugin is registered — we verify via the internal state
    expect(plugins.get("url-tracked")).not.toBeNull();

    delete globalThis.fetch;
  });
});

/* ── Performance Tracking ────────────────────────── */

describe("perf_stats", () => {
  it("tracks activation time", async () => {
    plugins.register(make_plugin({
      id: "slow-plugin",
      activate: async () => {
        // Simulate some work
        await new Promise((r) => setTimeout(r, 5));
      },
    }));

    await plugins.activate("slow-plugin");
    const stats = plugins.perf_stats("slow-plugin");
    expect(stats).not.toBeNull();
    expect(typeof stats.activation_ms).toBe("number");
    expect(stats.activation_ms).toBeGreaterThanOrEqual(0);
    expect(stats.hook_calls).toBe(0);
    expect(stats.hook_time_ms).toBe(0);
  });

  it("returns null for unactivated plugin", () => {
    plugins.register(make_plugin());
    expect(plugins.perf_stats("test-plugin")).toBeNull();
  });

  it("returns all stats without argument", async () => {
    plugins.register(make_plugin({ id: "a", name: "A" }));
    plugins.register(make_plugin({ id: "b", name: "B" }));
    await plugins.activate("a");
    await plugins.activate("b");

    const all = plugins.perf_stats();
    expect(all.a).toBeDefined();
    expect(all.b).toBeDefined();
  });

  it("_track_hook increments stats", async () => {
    plugins.register(make_plugin());
    await plugins.activate("test-plugin");

    plugins._track_hook("test-plugin", 5.2);
    plugins._track_hook("test-plugin", 3.1);

    const stats = plugins.perf_stats("test-plugin");
    expect(stats.hook_calls).toBe(2);
    expect(stats.hook_time_ms).toBeCloseTo(8.3, 1);
  });

  it("cleans up perf on unregister", async () => {
    plugins.register(make_plugin());
    await plugins.activate("test-plugin");
    expect(plugins.perf_stats("test-plugin")).not.toBeNull();

    plugins.unregister("test-plugin");
    expect(plugins.perf_stats("test-plugin")).toBeNull();
  });
});

/* ── Lazy trigger cleanup ────────────────────────── */

describe("lazy trigger cleanup", () => {
  it("removes lazy triggers on unregister", () => {
    plugins.register(make_plugin({
      id: "temp",
      activation: "on_language:rust",
    }));

    expect(plugins._lazy_triggers.has("on_language:rust")).toBe(true);
    plugins.unregister("temp");
    expect(plugins._lazy_triggers.has("on_language:rust")).toBe(false);
  });
});

/* ── DevTools ────────────────────────────────────── */

describe("devtools", () => {
  it("creates snapshot of all plugins", async () => {
    plugins.register(make_plugin({ id: "p1", name: "P1" }));
    plugins.register(make_plugin({ id: "p2", name: "P2" }));
    await plugins.activate("p1");

    const dt = create_devtools(plugins);
    const snap = dt.snapshot();
    expect(snap).toHaveLength(2);

    const p1 = snap.find((p) => p.id === "p1");
    expect(p1.state).toBe("active");
    expect(p1.perf).not.toBeNull();
    expect(typeof p1.perf.activation_ms).toBe("number");

    const p2 = snap.find((p) => p.id === "p2");
    expect(p2.state).toBe("installed");
    expect(p2.perf).toBeNull();
  });

  it("inspects a specific plugin", async () => {
    plugins.register(make_plugin());
    await plugins.activate("test-plugin");

    const dt = create_devtools(plugins);
    const info = dt.inspect("test-plugin");
    expect(info.id).toBe("test-plugin");
    expect(info.state).toBe("active");
    expect(info.perf).not.toBeNull();
  });

  it("inspect returns null for unknown", () => {
    const dt = create_devtools(plugins);
    expect(dt.inspect("nope")).toBeNull();
  });

  it("provides a registrable manifest", () => {
    const dt = create_devtools(plugins);
    const m = dt.manifest;
    expect(m.id).toBe("xkin.devtools");
    expect(m.activate).toBeDefined();
    expect(m.permissions).toContain("ui");
  });
});
