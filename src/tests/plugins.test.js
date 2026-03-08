import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setup_mock, teardown_mock } from "./setup.js";
import { create_hook_system } from "../hooks.js";
import { create_plugin_registry } from "../plugins.js";

let hooks, plugins;

beforeEach(() => {
  setup_mock();
  hooks = create_hook_system();
  plugins = create_plugin_registry(hooks);
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

/* ── Registration ────────────────────────────────── */

describe("register", () => {
  it("registers a valid plugin", () => {
    const p = make_plugin();
    plugins.register(p);
    expect(plugins.get("test-plugin")).not.toBeNull();
    expect(plugins.get("test-plugin").state).toBe("installed");
  });

  it("rejects missing required fields", () => {
    expect(() => plugins.register({ id: "x" })).toThrow("name");
    expect(() => plugins.register({ id: "x", name: "X" })).toThrow("version");
  });

  it("rejects duplicate registration", () => {
    plugins.register(make_plugin());
    expect(() => plugins.register(make_plugin())).toThrow("already registered");
  });

  it("rejects unknown permissions", () => {
    expect(() => plugins.register(make_plugin({ permissions: ["invalid_perm"] }))).toThrow("Unknown permission");
  });

  it("auto-activates on_load plugins", async () => {
    const activate = vi.fn();
    plugins.register(make_plugin({ activation: "on_load", activate }));
    // Allow microtask for async activation
    await new Promise((r) => setTimeout(r, 0));
    expect(activate).toHaveBeenCalled();
    expect(plugins.is_active("test-plugin")).toBe(true);
  });
});

/* ── Unregister ──────────────────────────────────── */

describe("unregister", () => {
  it("removes plugin", () => {
    plugins.register(make_plugin());
    plugins.unregister("test-plugin");
    expect(plugins.get("test-plugin")).toBeNull();
  });

  it("no-ops for unknown id", () => {
    plugins.unregister("nope"); // should not throw
  });
});

/* ── Activation / Deactivation ───────────────────── */

describe("activate / deactivate", () => {
  it("activates and deactivates", async () => {
    const deactivate = vi.fn();
    plugins.register(make_plugin({ deactivate }));
    await plugins.activate("test-plugin");
    expect(plugins.is_active("test-plugin")).toBe(true);

    await plugins.deactivate("test-plugin");
    expect(plugins.is_active("test-plugin")).toBe(false);
    expect(deactivate).toHaveBeenCalled();
  });

  it("throws when activating unregistered plugin", async () => {
    await expect(plugins.activate("nope")).rejects.toThrow("not registered");
  });

  it("enters error state on activate failure", async () => {
    plugins.register(make_plugin({
      activate: () => { throw new Error("boom"); },
    }));
    await expect(plugins.activate("test-plugin")).rejects.toThrow("boom");
    expect(plugins.get("test-plugin").state).toBe("error");
  });

  it("no-ops deactivate on inactive plugin", async () => {
    plugins.register(make_plugin());
    await plugins.deactivate("test-plugin"); // should not throw
  });
});

/* ── Context: settings ───────────────────────────── */

describe("ctx.settings", () => {
  it("initializes from schema defaults", async () => {
    plugins.register(make_plugin({
      settings: {
        greeting: { type: "string", default: "Hello", label: "Greeting" },
        count: { type: "number", default: 5, label: "Count" },
      },
      activate(ctx) {
        expect(ctx.settings.get()).toEqual({ greeting: "Hello", count: 5 });
        expect(ctx.defaults).toEqual({ greeting: "Hello", count: 5 });
      },
    }));
    await plugins.activate("test-plugin");
  });

  it("validates settings mutations", async () => {
    let settings_ref;
    plugins.register(make_plugin({
      settings: {
        name: { type: "string", default: "world", label: "Name" },
        count: { type: "number", default: 0, min: 0, max: 10, label: "Count" },
        mode: { type: "select", default: "a", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }], label: "Mode" },
      },
      activate(ctx) { settings_ref = ctx.settings; },
    }));
    await plugins.activate("test-plugin");

    // Valid mutation
    settings_ref.set({ ...settings_ref.get(), name: "test" });
    expect(settings_ref.get().name).toBe("test");

    // Invalid type — preserved
    settings_ref.set({ ...settings_ref.get(), name: 42 });
    expect(settings_ref.get().name).toBe("test");

    // Out of range — preserved
    settings_ref.set({ ...settings_ref.get(), count: 99 });
    expect(settings_ref.get().count).toBe(0);

    // Invalid select option — preserved
    settings_ref.set({ ...settings_ref.get(), mode: "invalid" });
    expect(settings_ref.get().mode).toBe("a");

    // Valid select
    settings_ref.set({ ...settings_ref.get(), mode: "b" });
    expect(settings_ref.get().mode).toBe("b");
  });
});

/* ── Context: hooks ──────────────────────────────── */

describe("ctx.hook", () => {
  it("registers hooks when permission granted", async () => {
    plugins.register(make_plugin({
      permissions: ["hooks"],
      activate(ctx) {
        ctx.hook("file.after_create", () => {});
      },
    }));
    await plugins.activate("test-plugin");
    expect(hooks.has("file.after_create")).toBe(true);
  });

  it("throws without hooks permission", async () => {
    plugins.register(make_plugin({
      permissions: [],
      activate(ctx) {
        ctx.hook("file.after_create", () => {});
      },
    }));
    await expect(plugins.activate("test-plugin")).rejects.toThrow("hooks");
  });

  it("disposes hooks on deactivation", async () => {
    plugins.register(make_plugin({
      permissions: ["hooks"],
      activate(ctx) {
        ctx.hook("file.after_create", () => {});
      },
    }));
    await plugins.activate("test-plugin");
    expect(hooks.has("file.after_create")).toBe(true);
    await plugins.deactivate("test-plugin");
    expect(hooks.has("file.after_create")).toBe(false);
  });
});

/* ── Context: contribute ─────────────────────────── */

describe("ctx.contribute", () => {
  it("dispatches to registered handler", async () => {
    const contributed = [];
    plugins._register_handler("command", (plugin_id, contribution) => {
      contributed.push({ plugin_id, ...contribution });
      return () => {};
    });

    plugins.register(make_plugin({
      permissions: ["commands"],
      activate(ctx) {
        ctx.contribute("command", { id: "test.run", label: "Run", run: () => {} });
      },
    }));
    await plugins.activate("test-plugin");
    expect(contributed).toHaveLength(1);
    expect(contributed[0].id).toBe("test.run");
  });

  it("throws for unknown target", async () => {
    plugins.register(make_plugin({
      permissions: ["ui"],
      activate(ctx) {
        ctx.contribute("unknown_target", {});
      },
    }));
    await expect(plugins.activate("test-plugin")).rejects.toThrow("Unknown contribution target");
  });

  it("throws without required permission", async () => {
    plugins._register_handler("command", () => () => {});
    plugins.register(make_plugin({
      permissions: [], // no "commands" permission
      activate(ctx) {
        ctx.contribute("command", { id: "x", run: () => {} });
      },
    }));
    await expect(plugins.activate("test-plugin")).rejects.toThrow("commands");
  });

  it("auto-disposes contributions on deactivation", async () => {
    let disposed = false;
    plugins._register_handler("command", () => () => { disposed = true; });

    plugins.register(make_plugin({
      permissions: ["commands"],
      activate(ctx) {
        ctx.contribute("command", { id: "test.run", run: () => {} });
      },
    }));
    await plugins.activate("test-plugin");
    await plugins.deactivate("test-plugin");
    expect(disposed).toBe(true);
  });
});

/* ── Context: subscriptions ──────────────────────── */

describe("ctx.subscriptions", () => {
  it("always available regardless of permissions", async () => {
    plugins.register(make_plugin({
      permissions: [],
      activate(ctx) {
        expect(ctx.subscriptions).toBeDefined();
        expect(Array.isArray(ctx.subscriptions)).toBe(true);
        const dispose = vi.fn();
        ctx.subscriptions.push(dispose);
      },
    }));
    await plugins.activate("test-plugin");
  });
});

/* ── Context: ui ─────────────────────────────────── */

describe("ctx.ui", () => {
  it("available with ui permission", async () => {
    plugins.register(make_plugin({
      permissions: ["ui"],
      activate(ctx) {
        expect(ctx.ui).toBeDefined();
        expect(ctx.ui.show_notification).toBeDefined();
        expect(ctx.ui.show_quick_pick).toBeDefined();
        expect(ctx.ui.show_input).toBeDefined();
      },
    }));
    await plugins.activate("test-plugin");
  });

  it("undefined without ui permission", async () => {
    plugins.register(make_plugin({
      permissions: [],
      activate(ctx) {
        expect(ctx.ui).toBeUndefined();
      },
    }));
    await plugins.activate("test-plugin");
  });
});

/* ── Dependencies ────────────────────────────────── */

describe("dependencies", () => {
  it("activates dependencies first", async () => {
    const order = [];
    plugins.register(make_plugin({
      id: "dep",
      name: "Dep",
      activate: () => order.push("dep"),
    }));
    plugins.register(make_plugin({
      id: "main",
      name: "Main",
      dependencies: { dep: ">=1.0.0" },
      activate: () => order.push("main"),
    }));
    await plugins.activate("main");
    expect(order).toEqual(["dep", "main"]);
  });

  it("rejects missing dependencies", () => {
    // Can't register with a dep that doesn't exist
    expect(() => plugins.register(make_plugin({
      id: "orphan",
      name: "Orphan",
      dependencies: { nonexistent: ">=1.0.0" },
    }))).toThrow("Missing dependency");
  });

  it("deactivates dependents on deactivation", async () => {
    plugins.register(make_plugin({ id: "base", name: "Base" }));
    plugins.register(make_plugin({
      id: "child",
      name: "Child",
      dependencies: { base: ">=1.0.0" },
    }));

    await plugins.activate("child"); // activates base first
    expect(plugins.is_active("base")).toBe(true);
    expect(plugins.is_active("child")).toBe(true);

    await plugins.deactivate("base");
    expect(plugins.is_active("child")).toBe(false);
    expect(plugins.is_active("base")).toBe(false);
  });
});

/* ── list / get / is_active ──────────────────────── */

describe("list / get / is_active", () => {
  it("list returns all plugins", () => {
    plugins.register(make_plugin({ id: "a", name: "A" }));
    plugins.register(make_plugin({ id: "b", name: "B" }));
    expect(plugins.list()).toHaveLength(2);
  });

  it("get returns null for unknown", () => {
    expect(plugins.get("nope")).toBeNull();
  });

  it("is_active returns false for unknown", () => {
    expect(plugins.is_active("nope")).toBe(false);
  });
});

/* ── Events ──────────────────────────────────────── */

describe("events", () => {
  it("fires register, activate, deactivate", async () => {
    const log = [];
    plugins.on("*", (d) => log.push(d.event));

    plugins.register(make_plugin());
    await plugins.activate("test-plugin");
    await plugins.deactivate("test-plugin");

    expect(log).toContain("register");
    expect(log).toContain("activate");
    expect(log).toContain("deactivate");
  });

  it("fires error on activation failure", async () => {
    const errors = [];
    plugins.on("error", (d) => errors.push(d));

    plugins.register(make_plugin({
      activate: () => { throw new Error("fail"); },
    }));
    try { await plugins.activate("test-plugin"); } catch {}

    expect(errors).toHaveLength(1);
    expect(errors[0].error.message).toBe("fail");
  });

  it("dispose stops listener", async () => {
    const log = [];
    const dispose = plugins.on("register", () => log.push(1));
    plugins.register(make_plugin({ id: "a", name: "A" }));
    dispose();
    plugins.register(make_plugin({ id: "b", name: "B" }));
    expect(log).toHaveLength(1);
  });
});
