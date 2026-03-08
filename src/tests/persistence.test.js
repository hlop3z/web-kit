import { describe, it, expect, beforeEach } from "vitest";
import persistence from "../persistence.js";

// Mock localStorage
const store = new Map();
const mock_storage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
};

beforeEach(() => {
  store.clear();
  globalThis.localStorage = mock_storage;
});

describe("local_storage adapter", () => {
  const snap = (id) => ({
    workspace: { id, name: id, created_at: 1, updated_at: 1, meta: {} },
    files: { "/a.ts": "code" },
    entries: [{ path: "/a.ts", language: "typescript", main: false, dirty: false }],
    view_states: {},
    active_file: "/a.ts",
    open_files: ["/a.ts"],
  });

  it("save and load round-trip", async () => {
    const adapter = persistence.local_storage({ prefix: "test" });
    await adapter.save("w1", snap("w1"));
    const loaded = await adapter.load("w1");
    expect(loaded.workspace.id).toBe("w1");
    expect(loaded.files["/a.ts"]).toBe("code");
  });

  it("list returns saved workspaces", async () => {
    const adapter = persistence.local_storage({ prefix: "test" });
    await adapter.save("w1", snap("w1"));
    await adapter.save("w2", snap("w2"));
    const list = await adapter.list();
    expect(list).toHaveLength(2);
  });

  it("delete removes workspace", async () => {
    const adapter = persistence.local_storage({ prefix: "test" });
    await adapter.save("w1", snap("w1"));
    await adapter.delete("w1");
    expect(await adapter.load("w1")).toBeNull();
    expect(await adapter.list()).toHaveLength(0);
  });

  it("load returns null for missing workspace", async () => {
    const adapter = persistence.local_storage({ prefix: "test" });
    expect(await adapter.load("nope")).toBeNull();
  });

  it("save updates existing index entry", async () => {
    const adapter = persistence.local_storage({ prefix: "test" });
    await adapter.save("w1", snap("w1"));
    await adapter.save("w1", snap("w1"));
    expect(await adapter.list()).toHaveLength(1);
  });
});
