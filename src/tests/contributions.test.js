import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setup_mock, teardown_mock, mock_monaco } from "./setup.js";
import { create_hook_system } from "../hooks.js";
import { create_plugin_registry } from "../plugins.js";
import { create_keys_manager } from "../keys.js";
import { register_contribution_handlers } from "../contributions.js";

let hooks, plugins, keys;

beforeEach(() => {
  setup_mock();
  hooks = create_hook_system();
  keys = create_keys_manager();
  plugins = create_plugin_registry(hooks);
  register_contribution_handlers(plugins, keys, hooks);

  // Set up editor for keybindings
  const ed = mock_monaco.editor.create(null, {});
  keys._set_editor(ed);
});

afterEach(() => {
  hooks.clear();
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

/* ── Command Target ──────────────────────────────── */

describe("command contribution", () => {
  it("registers a command with keybinding", async () => {
    const run_fn = vi.fn();
    plugins.register(make_plugin({
      permissions: ["commands"],
      activate(ctx) {
        ctx.contribute("command", {
          id: "test.run",
          label: "Run Test",
          keys: "ctrl+shift+t",
          run: run_fn,
        });
      },
    }));
    await plugins.activate("test-plugin");

    // Verify keybinding was registered
    const bindings = keys.list();
    expect(bindings.some((b) => b.id === "test.run")).toBe(true);
  });

  it("registers a command without keybinding", async () => {
    const run_fn = vi.fn();
    plugins.register(make_plugin({
      permissions: ["commands"],
      activate(ctx) {
        ctx.contribute("command", {
          id: "test.nokeys",
          run: run_fn,
        });
      },
    }));
    await plugins.activate("test-plugin");
    // Should not throw, command registered without keys
  });

  it("throws if missing id or run", async () => {
    plugins.register(make_plugin({
      permissions: ["commands"],
      activate(ctx) {
        ctx.contribute("command", { label: "Bad" });
      },
    }));
    await expect(plugins.activate("test-plugin")).rejects.toThrow("id");
  });

  it("disposes command on deactivation", async () => {
    plugins.register(make_plugin({
      permissions: ["commands"],
      activate(ctx) {
        ctx.contribute("command", {
          id: "test.disposable",
          keys: "ctrl+d",
          run: () => {},
        });
      },
    }));
    await plugins.activate("test-plugin");
    expect(keys.list().some((b) => b.id === "test.disposable")).toBe(true);

    await plugins.deactivate("test-plugin");
    expect(keys.list().some((b) => b.id === "test.disposable")).toBe(false);
  });

  it("rejects without commands permission", async () => {
    plugins.register(make_plugin({
      permissions: [], // no commands
      activate(ctx) {
        ctx.contribute("command", { id: "x", run: () => {} });
      },
    }));
    await expect(plugins.activate("test-plugin")).rejects.toThrow("commands");
  });
});

/* ── Theme Target ────────────────────────────────── */

describe("theme contribution", () => {
  it("defines a theme in Monaco", async () => {
    const theme_data = {
      base: "vs-dark",
      inherit: true,
      rules: [{ token: "comment", foreground: "888888" }],
      colors: { "editor.background": "#1e1e1e" },
    };

    plugins.register(make_plugin({
      permissions: ["editor"],
      activate(ctx) {
        ctx.contribute("theme", {
          id: "monokai",
          label: "Monokai",
          data: theme_data,
        });
      },
    }));
    await plugins.activate("test-plugin");

    expect(mock_monaco._defined_themes.has("monokai")).toBe(true);
    expect(mock_monaco._defined_themes.get("monokai")).toEqual(theme_data);
  });

  it("throws if missing id or data", async () => {
    plugins.register(make_plugin({
      permissions: ["editor"],
      activate(ctx) {
        ctx.contribute("theme", { id: "bad" }); // missing data
      },
    }));
    await expect(plugins.activate("test-plugin")).rejects.toThrow("data");
  });

  it("rejects without editor permission", async () => {
    plugins.register(make_plugin({
      permissions: [],
      activate(ctx) {
        ctx.contribute("theme", { id: "x", data: {} });
      },
    }));
    await expect(plugins.activate("test-plugin")).rejects.toThrow("editor");
  });
});

/* ── Language Target ─────────────────────────────── */

describe("language contribution", () => {
  it("registers a language with tokenizer", async () => {
    const monarch_config = {
      tokenizer: {
        root: [[/[a-z]+/, "keyword"]],
      },
    };

    plugins.register(make_plugin({
      permissions: ["editor"],
      activate(ctx) {
        ctx.contribute("language", {
          id: "myLang",
          extensions: [".my"],
          aliases: ["MyLang"],
          config: monarch_config,
        });
      },
    }));
    await plugins.activate("test-plugin");

    expect(mock_monaco._registered_languages.some((l) => l.id === "myLang")).toBe(true);
    expect(mock_monaco._monarch_providers.has("myLang")).toBe(true);
  });

  it("registers language without tokenizer config", async () => {
    plugins.register(make_plugin({
      permissions: ["editor"],
      activate(ctx) {
        ctx.contribute("language", {
          id: "simple",
          extensions: [".sim"],
        });
      },
    }));
    await plugins.activate("test-plugin");

    expect(mock_monaco._registered_languages.some((l) => l.id === "simple")).toBe(true);
    expect(mock_monaco._monarch_providers.has("simple")).toBe(false);
  });

  it("throws if missing id", async () => {
    plugins.register(make_plugin({
      permissions: ["editor"],
      activate(ctx) {
        ctx.contribute("language", { extensions: [".x"] });
      },
    }));
    await expect(plugins.activate("test-plugin")).rejects.toThrow("id");
  });
});

/* ── Formatter Target ────────────────────────────── */

describe("formatter contribution", () => {
  it("registers a formatter as a hook", async () => {
    plugins.register(make_plugin({
      permissions: ["tools"],
      activate(ctx) {
        ctx.contribute("formatter", {
          language: "javascript",
          format: (source) => source.toUpperCase(),
        });
      },
    }));
    await plugins.activate("test-plugin");

    // The formatter should be wired as a file.before_format hook
    expect(hooks.has("file.before_format")).toBe(true);
  });

  it("formatter transforms source for matching files", async () => {
    plugins.register(make_plugin({
      permissions: ["tools"],
      activate(ctx) {
        ctx.contribute("formatter", {
          language: "javascript",
          format: (source) => source.toUpperCase(),
        });
      },
    }));
    await plugins.activate("test-plugin");

    const opts = { source: "hello", parser: "babel" };
    const result = await hooks.fire("file.before_format", opts, { path: "/app.js" });
    expect(result.source).toBe("HELLO");
  });

  it("formatter skips non-matching files", async () => {
    plugins.register(make_plugin({
      permissions: ["tools"],
      activate(ctx) {
        ctx.contribute("formatter", {
          language: "javascript",
          format: (source) => source.toUpperCase(),
        });
      },
    }));
    await plugins.activate("test-plugin");

    const opts = { source: "hello", parser: "css" };
    const result = await hooks.fire("file.before_format", opts, { path: "/style.css" });
    expect(result.source).toBe("hello"); // unchanged
  });

  it("throws if missing language or format", async () => {
    plugins.register(make_plugin({
      permissions: ["tools"],
      activate(ctx) {
        ctx.contribute("formatter", { language: "js" }); // missing format
      },
    }));
    await expect(plugins.activate("test-plugin")).rejects.toThrow("format");
  });

  it("disposes formatter hook on deactivation", async () => {
    plugins.register(make_plugin({
      permissions: ["tools"],
      activate(ctx) {
        ctx.contribute("formatter", {
          language: "javascript",
          format: (source) => source.toUpperCase(),
        });
      },
    }));
    await plugins.activate("test-plugin");
    expect(hooks.has("file.before_format")).toBe(true);

    await plugins.deactivate("test-plugin");
    expect(hooks.has("file.before_format")).toBe(false);
  });

  it("handles async formatters", async () => {
    plugins.register(make_plugin({
      permissions: ["tools"],
      activate(ctx) {
        ctx.contribute("formatter", {
          language: "typescript",
          format: async (source) => source.trim(),
        });
      },
    }));
    await plugins.activate("test-plugin");

    const opts = { source: "  hello  " };
    const result = await hooks.fire("file.before_format", opts, { path: "/app.ts" });
    expect(result.source).toBe("hello");
  });
});

/* ── UI Slot Targets ─────────────────────────────── */

describe("UI slot contributions (placeholder)", () => {
  const slots = ["sidebar_left", "sidebar_right", "toolbar", "editor_title", "bottom_panel", "status_bar", "overlay"];

  for (const slot of slots) {
    it(`registers ${slot} contribution`, async () => {
      plugins.register(make_plugin({
        id: `test-${slot}`,
        permissions: ["ui"],
        activate(ctx) {
          ctx.contribute(slot, {
            id: `test.${slot}`,
            label: "Test",
            render: () => {},
          });
        },
      }));
      await plugins.activate(`test-${slot}`);
      // Should not throw
    });
  }

  it("throws without ui permission for sidebar", async () => {
    plugins.register(make_plugin({
      permissions: [],
      activate(ctx) {
        ctx.contribute("sidebar_left", { id: "x", render: () => {} });
      },
    }));
    await expect(plugins.activate("test-plugin")).rejects.toThrow("ui");
  });
});
