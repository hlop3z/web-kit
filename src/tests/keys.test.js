import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setup_mock, teardown_mock, KeyMod, KeyCode } from "./setup.js";
import { create_keys_manager, parse_keys } from "../keys.js";

beforeEach(() => setup_mock());
afterEach(() => teardown_mock());

describe("parse_keys", () => {
  it("parses ctrl+s", () => {
    expect(parse_keys("ctrl+s")).toBe(KeyMod.CtrlCmd | KeyCode.KeyS);
  });

  it("parses shift+alt+f", () => {
    expect(parse_keys("shift+alt+f")).toBe(KeyMod.Shift | KeyMod.Alt | KeyCode.KeyF);
  });

  it("parses escape", () => {
    expect(parse_keys("escape")).toBe(KeyCode.Escape);
  });

  it("parses f5", () => {
    expect(parse_keys("f5")).toBe(KeyCode.F5);
  });

  it("parses chord ctrl+k ctrl+c", () => {
    const first = KeyMod.CtrlCmd | KeyCode.KeyK;
    const second = KeyMod.CtrlCmd | KeyCode.KeyC;
    expect(parse_keys("ctrl+k ctrl+c")).toBe(KeyMod.chord(first, second));
  });

  it("is case-insensitive", () => {
    expect(parse_keys("Ctrl+S")).toBe(parse_keys("ctrl+s"));
  });

  it("returns 0 when no editor", () => {
    globalThis.XkinEditor = undefined;
    expect(parse_keys("ctrl+s")).toBe(0);
  });
});

describe("keys manager", () => {
  it("queues bindings before editor exists", () => {
    const keys = create_keys_manager();
    const dispose = keys.add({ id: "save", keys: "ctrl+s", run: () => {} });
    expect(keys.list()).toHaveLength(1);
    dispose();
    expect(keys.list()).toHaveLength(0);
  });

  it("applies queued bindings when editor is set", () => {
    const keys = create_keys_manager();
    let called = false;
    keys.add({ id: "save", keys: "ctrl+s", run: () => { called = true; } });

    const monaco = globalThis.XkinEditor;
    const editor = monaco.editor.create(null, {});
    keys._set_editor(editor);

    expect(editor._actions.has("save")).toBe(true);
  });

  it("add_all registers multiple and returns single dispose", () => {
    const keys = create_keys_manager();
    const monaco = globalThis.XkinEditor;
    const editor = monaco.editor.create(null, {});
    keys._set_editor(editor);

    const dispose = keys.add_all([
      { id: "a", keys: "ctrl+a", run: () => {} },
      { id: "b", keys: "ctrl+b", run: () => {} },
    ]);
    expect(keys.list()).toHaveLength(2);
    dispose();
    expect(keys.list()).toHaveLength(0);
  });

  it("remove cleans up binding", () => {
    const keys = create_keys_manager();
    const monaco = globalThis.XkinEditor;
    const editor = monaco.editor.create(null, {});
    keys._set_editor(editor);

    keys.add({ id: "x", keys: "ctrl+x", run: () => {} });
    keys.remove("x");
    expect(editor._actions.has("x")).toBe(false);
  });

  it("override replaces existing binding", () => {
    const keys = create_keys_manager();
    const monaco = globalThis.XkinEditor;
    const editor = monaco.editor.create(null, {});
    keys._set_editor(editor);

    keys.add({ id: "save", keys: "ctrl+s", run: () => "old" });
    keys.override("save", { keys: "ctrl+shift+s", run: () => "new" });
    expect(keys.list()).toHaveLength(1);
    expect(keys.list()[0].id).toBe("save");
  });

  it("context creates a context key", () => {
    const keys = create_keys_manager();
    const monaco = globalThis.XkinEditor;
    const editor = monaco.editor.create(null, {});
    keys._set_editor(editor);

    const ctx = keys.context("preview_mode", false);
    expect(ctx.get()).toBe(false);
    ctx.set(true);
    expect(ctx.get()).toBe(true);
    ctx.reset();
    expect(ctx.get()).toBe(false);
  });
});
