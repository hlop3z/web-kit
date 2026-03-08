import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setup_mock, teardown_mock } from "./setup.js";
import { create_file_registry, $workspace, $files, $active_file, $open_files, $is_dirty } from "../files.js";
import { create_workspace_manager } from "../workspace.js";

let files, ws;

beforeEach(() => {
  setup_mock();
  $files.set([]);
  $active_file.set(null);
  $open_files.set([]);
  $workspace.set(null);
  files = create_file_registry();
  ws = create_workspace_manager(files);
});

afterEach(async () => {
  await files.clear();
  teardown_mock();
});

describe("create / switch", () => {
  it("creates and activates workspace", async () => {
    const w = await ws.create("w1", { name: "P1" });
    expect(w.id).toBe("w1");
    expect($workspace.get()).toEqual(w);
  });

  it("creates without activating", async () => {
    await ws.create("w1");
    await ws.create("w2", { activate: false });
    expect($workspace.get().id).toBe("w1");
  });

  it("snapshots current on create, restores on switch", async () => {
    await ws.create("w1");
    await files.create("/a.ts", "from_w1");

    await ws.create("w2");
    await files.create("/b.ts", "from_w2");
    expect(files.read("/a.ts")).toBeNull();

    await ws.switch("w1");
    expect($workspace.get().id).toBe("w1");
    expect(files.read("/a.ts")).toBe("from_w1");
    expect(files.read("/b.ts")).toBeNull();
  });

  it("switch returns null for unknown, no-op for current", async () => {
    expect(await ws.switch("nope")).toBeNull();
    await ws.create("w1");
    await files.create("/a.ts", "code");
    const r = await ws.switch("w1");
    expect(r.id).toBe("w1");
    expect(files.read("/a.ts")).toBe("code");
  });
});

describe("current / list / update / delete", () => {
  it("current, list, update", async () => {
    expect(ws.current()).toBeNull();
    await ws.create("w1", { name: "Old" });
    await ws.create("w2", { activate: false });
    expect(ws.current().id).toBe("w1");
    expect(await ws.list()).toHaveLength(2);

    ws.update("w1", { name: "New", meta: { v: 2 } });
    expect(ws.current().name).toBe("New");
    expect(ws.current().meta.v).toBe(2);
    expect(ws.update("nope", {})).toBeNull();
  });

  it("delete clears active workspace", async () => {
    await ws.create("w1");
    await files.create("/a.ts", "code");
    await ws.delete("w1");
    expect($workspace.get()).toBeNull();
    expect($files.get()).toHaveLength(0);
  });
});

describe("snapshot / mount", () => {
  it("captures and restores full state", async () => {
    await ws.create("w1");
    await files.create("/a.ts", "code");
    $active_file.set("/a.ts");
    $open_files.set(["/a.ts"]);

    const snap = ws.snapshot();
    expect(snap.workspace.id).toBe("w1");
    expect(snap.files["/a.ts"]).toBe("code");
    expect(snap.active_file).toBe("/a.ts");

    await ws.create("w2");
    await ws.mount(snap);
    expect(files.read("/a.ts")).toBe("code");
  });

  it("snapshot returns null with no workspace", () => {
    expect(ws.snapshot()).toBeNull();
  });
});

describe("to_json / from_json", () => {
  it("round-trips", async () => {
    await ws.create("w1");
    await files.create("/a.ts", "aaa");
    await files.create("/b.ts", "bbb");
    const json = ws.to_json();

    await ws.from_json("w2", json, { name: "Imported" });
    expect($workspace.get().id).toBe("w2");
    expect(files.read("/a.ts")).toBe("aaa");
    expect(files.read("/b.ts")).toBe("bbb");
  });
});

describe("events", () => {
  it("fires create, switch, delete", async () => {
    const log = [];
    ws.on("*", (d) => log.push(d.event));
    await ws.create("w1");
    await ws.create("w2");
    await ws.switch("w1");
    await ws.delete("w1");
    expect(log).toContain("create");
    expect(log).toContain("switch");
    expect(log).toContain("delete");
  });
});

describe("auto_save", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves and marks clean when dirty", async () => {
    await ws.create("w1");
    await files.create("/a.ts", "code");

    const saved = [];
    const stop = ws.auto_save({
      interval: 1000,
      on_save: async () => { saved.push(Date.now()); },
    });

    // Not dirty yet — tick should be a no-op
    await vi.advanceTimersByTimeAsync(1000);
    expect(saved).toHaveLength(0);

    // Make dirty
    files.get("/a.ts").setValue("changed");
    expect($is_dirty.get()).toBe(true);

    // Tick — should save and mark clean
    await vi.advanceTimersByTimeAsync(1000);
    expect(saved).toHaveLength(1);
    expect($is_dirty.get()).toBe(false);

    // Already clean — next tick should not save
    await vi.advanceTimersByTimeAsync(1000);
    expect(saved).toHaveLength(1);

    stop();
  });

  it("returns dispose that stops the timer", async () => {
    await ws.create("w1");
    await files.create("/a.ts", "code");

    const saved = [];
    const stop = ws.auto_save({
      interval: 500,
      on_save: async () => { saved.push(1); },
    });

    files.get("/a.ts").setValue("changed");
    stop();

    await vi.advanceTimersByTimeAsync(1000);
    expect(saved).toHaveLength(0);
  });

  it("emits auto_save event", async () => {
    await ws.create("w1");
    await files.create("/a.ts", "code");

    const events = [];
    ws.on("auto_save", (d) => events.push(d));

    const stop = ws.auto_save({
      interval: 1000,
      on_save: async () => {},
    });

    files.get("/a.ts").setValue("changed");
    await vi.advanceTimersByTimeAsync(1000);
    expect(events).toHaveLength(1);
    expect(events[0].workspace.id).toBe("w1");

    stop();
  });

  it("does not double-save on rapid ticks", async () => {
    await ws.create("w1");
    await files.create("/a.ts", "code");

    let count = 0;
    const stop = ws.auto_save({
      interval: 1000,
      on_save: async () => { count++; },
    });

    files.get("/a.ts").setValue("changed");

    // First tick saves and marks clean
    await vi.advanceTimersByTimeAsync(1000);
    expect(count).toBe(1);
    expect($is_dirty.get()).toBe(false);

    // Second tick — already clean, should not save again
    await vi.advanceTimersByTimeAsync(1000);
    expect(count).toBe(1);

    stop();
  });
});

describe("format_on_save", () => {
  it("defaults to false", () => {
    expect(ws.get_format_on_save()).toBe(false);
  });

  it("set / get round-trips", () => {
    ws.set_format_on_save(true);
    expect(ws.get_format_on_save()).toBe(true);
    ws.set_format_on_save(false);
    expect(ws.get_format_on_save()).toBe(false);
  });

  it("formats dirty files on manual save", async () => {
    await ws.create("w1");
    await files.create("/a.ts", "  code  ");
    files.get("/a.ts").setValue("  dirty  ");
    expect($is_dirty.get()).toBe(true);

    ws.set_format_on_save(true);
    await ws.save(); // no persistence adapter, but format still runs

    // Mock format trims + adds newline
    expect(files.read("/a.ts")).toBe("dirty\n");
  });

  it("formats dirty files on auto_save tick", async () => {
    vi.useFakeTimers();
    await ws.create("w1");
    await files.create("/a.ts", "code");

    ws.set_format_on_save(true);
    const stop = ws.auto_save({
      interval: 1000,
      on_save: async () => {},
    });

    files.get("/a.ts").setValue("  messy  ");
    await vi.advanceTimersByTimeAsync(1000);

    expect(files.read("/a.ts")).toBe("messy\n");
    stop();
    vi.useRealTimers();
  });

  it("skips format when disabled", async () => {
    await ws.create("w1");
    await files.create("/a.ts", "  code  ");
    files.get("/a.ts").setValue("  dirty  ");

    ws.set_format_on_save(false);
    await ws.save();

    expect(files.read("/a.ts")).toBe("  dirty  ");
  });
});
