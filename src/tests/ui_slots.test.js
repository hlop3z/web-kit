import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { create_ui_slot_manager, SLOT_NAMES } from "../ui_slots.js";

let ui;

beforeEach(() => {
  ui = create_ui_slot_manager();
});

/* ── Slot Names ──────────────────────────────────── */

describe("slot_names", () => {
  it("returns all slot names", () => {
    const names = ui.slot_names();
    expect(names).toContain("sidebar_left");
    expect(names).toContain("sidebar_right");
    expect(names).toContain("toolbar");
    expect(names).toContain("editor_title");
    expect(names).toContain("bottom_panel");
    expect(names).toContain("status_bar");
    expect(names).toContain("overlay");
    expect(names).toHaveLength(7);
  });
});

/* ── Add / Remove / Get ──────────────────────────── */

describe("add / remove / get", () => {
  it("adds a contribution to a slot", () => {
    ui.add("sidebar_left", "my-plugin", { id: "panel1", label: "My Panel", render: () => {} });
    const items = ui.get("sidebar_left");
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("panel1");
    expect(items[0].plugin_id).toBe("my-plugin");
    expect(items[0].label).toBe("My Panel");
  });

  it("adds multiple contributions to the same slot", () => {
    ui.add("status_bar", "p1", { id: "s1", render: () => {} });
    ui.add("status_bar", "p2", { id: "s2", render: () => {} });
    expect(ui.get("status_bar")).toHaveLength(2);
  });

  it("removes a contribution", () => {
    ui.add("toolbar", "p1", { id: "btn1", render: () => {} });
    ui.remove("toolbar", "btn1");
    expect(ui.get("toolbar")).toHaveLength(0);
  });

  it("dispose function removes contribution", () => {
    const dispose = ui.add("toolbar", "p1", { id: "btn1", render: () => {} });
    expect(ui.get("toolbar")).toHaveLength(1);
    dispose();
    expect(ui.get("toolbar")).toHaveLength(0);
  });

  it("get returns empty array for empty slot", () => {
    expect(ui.get("overlay")).toEqual([]);
  });

  it("get returns empty array for unknown slot", () => {
    expect(ui.get("nonexistent")).toEqual([]);
  });

  it("throws for unknown slot on add", () => {
    expect(() => ui.add("nonexistent", "p1", { id: "x" })).toThrow("Unknown UI slot");
  });

  it("throws if contribution missing id", () => {
    expect(() => ui.add("toolbar", "p1", { render: () => {} })).toThrow("id");
  });
});

/* ── $slots reactive atom ────────────────────────── */

describe("$slots", () => {
  it("updates reactively on add/remove", () => {
    const states = [];
    ui.$slots.subscribe((s) => states.push(s));

    ui.add("sidebar_left", "p1", { id: "x", label: "X" });
    expect(states.length).toBeGreaterThanOrEqual(2); // initial + after add
    const latest = states[states.length - 1];
    expect(latest.sidebar_left).toHaveLength(1);
    expect(latest.sidebar_left[0].id).toBe("x");

    ui.remove("sidebar_left", "x");
    const after_remove = states[states.length - 1];
    expect(after_remove.sidebar_left).toHaveLength(0);
  });
});

/* ── Notifications ───────────────────────────────── */

describe("notifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates and auto-dismisses a notification", () => {
    const id = ui.show_notification("p1", "Hello!", { timeout: 1000 });
    expect(id).toBeDefined();
    expect(ui.$notifications.get()).toHaveLength(1);
    expect(ui.$notifications.get()[0].message).toBe("Hello!");
    expect(ui.$notifications.get()[0].plugin_id).toBe("p1");

    vi.advanceTimersByTime(1000);
    expect(ui.$notifications.get()).toHaveLength(0);
  });

  it("supports manual dismiss", () => {
    const id = ui.show_notification("p1", "Sticky", { timeout: 0 });
    expect(ui.$notifications.get()).toHaveLength(1);

    ui.dismiss_notification(id);
    expect(ui.$notifications.get()).toHaveLength(0);
  });

  it("defaults to info type", () => {
    ui.show_notification("p1", "Test");
    expect(ui.$notifications.get()[0].type).toBe("info");
  });

  it("accepts type option", () => {
    ui.show_notification("p1", "Oops", { type: "error", timeout: 0 });
    expect(ui.$notifications.get()[0].type).toBe("error");
  });

  it("fires notification event", () => {
    const log = [];
    ui.on("notification", (n) => log.push(n.message));
    ui.show_notification("p1", "Event test", { timeout: 0 });
    expect(log).toEqual(["Event test"]);
  });
});

/* ── Quick Pick ──────────────────────────────────── */

describe("show_quick_pick", () => {
  it("sets $dialog and resolves on selection", async () => {
    const promise = ui.show_quick_pick("p1", [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ]);

    // Dialog should be set
    const dialog = ui.$dialog.get();
    expect(dialog).not.toBeNull();
    expect(dialog.type).toBe("quick_pick");
    expect(dialog.items).toHaveLength(2);

    // Simulate user selection
    dialog.resolve({ label: "B", value: "b" });
    const result = await promise;
    expect(result).toEqual({ label: "B", value: "b" });
    expect(ui.$dialog.get()).toBeNull();
  });

  it("resolves null on cancel", async () => {
    const promise = ui.show_quick_pick("p1", [{ label: "A", value: "a" }]);
    ui.$dialog.get().resolve(null);
    expect(await promise).toBeNull();
  });
});

/* ── Input Dialog ────────────────────────────────── */

describe("show_input", () => {
  it("sets $dialog and resolves on submit", async () => {
    const promise = ui.show_input("p1", { placeholder: "Enter name..." });

    const dialog = ui.$dialog.get();
    expect(dialog.type).toBe("input");
    expect(dialog.placeholder).toBe("Enter name...");

    dialog.resolve("my-file");
    expect(await promise).toBe("my-file");
    expect(ui.$dialog.get()).toBeNull();
  });

  it("resolves null on cancel", async () => {
    const promise = ui.show_input("p1", {});
    ui.$dialog.get().resolve(null);
    expect(await promise).toBeNull();
  });
});

/* ── Events ──────────────────────────────────────── */

describe("events", () => {
  it("fires add/remove events", () => {
    const log = [];
    ui.on("add", (d) => log.push(`add:${d.id}`));
    ui.on("remove", (d) => log.push(`remove:${d.id}`));

    ui.add("toolbar", "p1", { id: "btn1", render: () => {} });
    ui.remove("toolbar", "btn1");

    expect(log).toEqual(["add:btn1", "remove:btn1"]);
  });

  it("fires dialog event", () => {
    const log = [];
    ui.on("dialog", (d) => log.push(d.type));
    ui.show_quick_pick("p1", []);
    expect(log).toEqual(["quick_pick"]);
    // Clean up the pending dialog
    ui.$dialog.get().resolve(null);
  });
});

/* ── Settings UI Generation ──────────────────────── */

describe("generate_settings_ui", () => {
  it("returns null when no engine available", () => {
    const { atom } = require("nanostores");
    const $settings = atom({ name: "test" });
    const schema = { name: { type: "string", default: "test", label: "Name" } };
    const result = ui.generate_settings_ui("p1", schema, $settings);
    // No engine available → null
    expect(result).toBeNull();
  });

  it("returns null when no schema", () => {
    const result = ui.generate_settings_ui("p1", null, null);
    expect(result).toBeNull();
  });

  it("returns a render function when engine is available", () => {
    const { atom } = require("nanostores");
    // Mock engine
    globalThis.XkinEngine = {
      h: (type, props, ...children) => ({ type, props, children: children.flat() }),
      render: () => {},
    };

    const $settings = atom({ name: "test", count: 5 });
    const schema = {
      name: { type: "string", default: "test", label: "Name" },
      count: { type: "number", default: 5, label: "Count", min: 0, max: 10 },
    };
    const component = ui.generate_settings_ui("p1", schema, $settings);
    expect(typeof component).toBe("function");

    // Call the component to get vnode
    const vnode = component();
    expect(vnode.type).toBe("div");
    expect(vnode.props.class).toBe("xkin-settings-form");
    expect(vnode.props["data-plugin"]).toBe("p1");
    expect(vnode.children).toHaveLength(2); // two fields

    globalThis.XkinEngine = undefined;
  });
});

/* ── Mount / Unmount ─────────────────────────────── */

describe("mount / unmount", () => {
  it("throws for unknown slot", () => {
    expect(() => ui.mount("nonexistent", {})).toThrow("Unknown UI slot");
  });

  it("mounts and unmounts without error", () => {
    // Without a real DOM, just verify no throws
    const fake_element = {
      querySelector: () => null,
      children: [],
      appendChild: vi.fn(),
      insertBefore: vi.fn(),
    };
    ui.mount("toolbar", fake_element);
    ui.unmount("toolbar");
  });

  it("renders contributions when container is mounted with engine", () => {
    const rendered = [];

    // Minimal DOM element mock
    const create_element = () => {
      const attrs = {};
      const children = [];
      return {
        setAttribute: (k, v) => { attrs[k] = v; },
        getAttribute: (k) => attrs[k] || null,
        get children() { return children; },
        appendChild: (el) => children.push(el),
        insertBefore: (el, ref) => children.splice(children.indexOf(ref), 0, el),
        remove: () => {},
        querySelector: (sel) => {
          // Match [data-contribution="..."]
          const match = sel.match(/\[data-contribution="([^"]+)"\]/);
          if (match) return children.find((c) => c.getAttribute("data-contribution") === match[1]) || null;
          return null;
        },
      };
    };

    // Mock document.createElement
    const orig = globalThis.document;
    globalThis.document = { createElement: () => create_element() };

    globalThis.XkinEngine = {
      h: (type, props) => ({ type, props }),
      render: (vnode, container) => { rendered.push({ vnode, container }); },
    };

    // Add contribution before mounting
    ui.add("status_bar", "p1", {
      id: "widget1",
      render: () => ({ type: "span", props: { class: "w" } }),
    });

    const fake_container = create_element();

    // Mount should trigger rendering
    ui.mount("status_bar", fake_container);

    // A wrapper div should have been created and render called
    expect(fake_container.children.length).toBe(1);
    expect(fake_container.children[0].getAttribute("data-contribution")).toBe("widget1");
    expect(fake_container.children[0].getAttribute("data-plugin")).toBe("p1");
    expect(rendered.length).toBe(1);

    globalThis.XkinEngine = undefined;
    globalThis.document = orig;
  });
});
