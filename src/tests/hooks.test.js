import { describe, it, expect, beforeEach } from "vitest";
import { create_hook_system } from "../hooks.js";

let hooks;

beforeEach(() => {
  hooks = create_hook_system();
});

describe("add / has / list / clear", () => {
  it("registers hooks and reports them", () => {
    hooks.add("file.before_save", () => {});
    hooks.add("file.after_create", () => {});
    expect(hooks.has("file.before_save")).toBe(true);
    expect(hooks.has("file.after_create")).toBe(true);
    expect(hooks.has("nope")).toBe(false);
    expect(hooks.list()).toContain("file.before_save");
    expect(hooks.list()).toHaveLength(2);
  });

  it("clear removes all hooks", () => {
    hooks.add("a", () => {});
    hooks.add("b", () => {});
    hooks.clear();
    expect(hooks.list()).toHaveLength(0);
    expect(hooks.has("a")).toBe(false);
  });
});

describe("dispose", () => {
  it("removes individual hook on dispose", () => {
    const dispose = hooks.add("file.before_save", () => {});
    expect(hooks.has("file.before_save")).toBe(true);
    dispose();
    expect(hooks.has("file.before_save")).toBe(false);
  });

  it("removes only disposed hook, not others on same name", async () => {
    const log = [];
    const d1 = hooks.add("file.after_create", () => log.push("a"));
    hooks.add("file.after_create", () => log.push("b"));
    d1();
    await hooks.fire("file.after_create", {});
    expect(log).toEqual(["b"]);
  });
});

describe("filter hooks (before_*)", () => {
  it("pipes value through callbacks in priority order", async () => {
    hooks.add("file.before_save", (content) => content + " [A]", 10);
    hooks.add("file.before_save", (content) => content + " [B]", 5);
    const result = await hooks.fire("file.before_save", "start");
    expect(result).toBe("start [B] [A]"); // priority 5 runs first
  });

  it("returns original value when no hooks registered", async () => {
    const result = await hooks.fire("file.before_save", "unchanged");
    expect(result).toBe("unchanged");
  });

  it("skips undefined returns (preserves value)", async () => {
    hooks.add("file.before_save", () => {}); // returns undefined
    hooks.add("file.before_save", (v) => v + "!");
    const result = await hooks.fire("file.before_save", "ok");
    expect(result).toBe("ok!");
  });

  it("handles async callbacks", async () => {
    hooks.add("file.before_save", async (v) => {
      return v + " async";
    });
    const result = await hooks.fire("file.before_save", "start");
    expect(result).toBe("start async");
  });
});

describe("action hooks (after_*)", () => {
  it("fires all callbacks, ignores return values", async () => {
    const log = [];
    hooks.add("file.after_create", (data) => log.push(data.path));
    hooks.add("file.after_create", (data) => log.push("done"));
    const result = await hooks.fire("file.after_create", { path: "/a.ts" });
    expect(result).toBeUndefined();
    expect(log).toEqual(["/a.ts", "done"]);
  });

  it("returns undefined when no hooks registered", async () => {
    const result = await hooks.fire("file.after_create", { path: "/a.ts" });
    expect(result).toBeUndefined();
  });
});

describe("priority ordering", () => {
  it("lower priority runs first", async () => {
    const log = [];
    hooks.add("file.after_update", () => log.push("default"), 10);
    hooks.add("file.after_update", () => log.push("first"), 1);
    hooks.add("file.after_update", () => log.push("last"), 99);
    await hooks.fire("file.after_update", {});
    expect(log).toEqual(["first", "default", "last"]);
  });

  it("same priority maintains insertion order", async () => {
    const log = [];
    hooks.add("file.after_update", () => log.push("a"));
    hooks.add("file.after_update", () => log.push("b"));
    hooks.add("file.after_update", () => log.push("c"));
    await hooks.fire("file.after_update", {});
    expect(log).toEqual(["a", "b", "c"]);
  });
});

describe("error isolation", () => {
  it("continues after callback error in filter", async () => {
    hooks.add("file.before_save", () => { throw new Error("boom"); }, 1);
    hooks.add("file.before_save", (v) => v + "!", 2);
    const result = await hooks.fire("file.before_save", "ok");
    expect(result).toBe("ok!");
  });

  it("continues after callback error in action", async () => {
    const log = [];
    hooks.add("file.after_create", () => { throw new Error("boom"); }, 1);
    hooks.add("file.after_create", () => log.push("ok"), 2);
    await hooks.fire("file.after_create", {});
    expect(log).toEqual(["ok"]);
  });
});

describe("context argument", () => {
  it("passes context to filter callbacks", async () => {
    hooks.add("file.before_save", (content, ctx) => {
      return content + ` (${ctx.path})`;
    });
    const result = await hooks.fire("file.before_save", "data", { path: "/a.ts" });
    expect(result).toBe("data (/a.ts)");
  });

  it("passes value as first arg and context as second for actions", async () => {
    const log = [];
    hooks.add("file.after_create", (data, ctx) => {
      log.push(data.path);
      log.push(ctx?.extra);
    });
    await hooks.fire("file.after_create", { path: "/a.ts" }, { extra: "yes" });
    expect(log).toEqual(["/a.ts", "yes"]);
  });
});

describe("namespaced hook names", () => {
  it("detects filter/action from last segment", async () => {
    // "build.before_tsx" should be a filter
    hooks.add("build.before_tsx", (src) => src + "!");
    const r1 = await hooks.fire("build.before_tsx", "code");
    expect(r1).toBe("code!");

    // "build.after_tsx" should be an action
    const log = [];
    hooks.add("build.after_tsx", (data) => log.push(data));
    const r2 = await hooks.fire("build.after_tsx", "result");
    expect(r2).toBeUndefined();
    expect(log).toEqual(["result"]);
  });
});
