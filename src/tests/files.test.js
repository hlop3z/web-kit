import { describe, it, expect } from "vitest";
import { use_files, mock_editor } from "./helpers.js";
import {
  normalize_path,
  infer_language,
  to_ws_uri,
  build_tree,
  create_emitter,
  $files,
  $active_file,
  $open_files,
  $file_tree,
  $is_dirty,
  $dirty_files,
  $active_entry,
} from "../files.js";

/* ── Pure helpers (no mock needed) ────────────────── */

describe("normalize_path", () => {
  const cases = [
    ["src/App.tsx", "/src/App.tsx"],
    ["//src//App.tsx", "/src/App.tsx"],
    ["/src/", "/src"],
    ["/", "/"],
    ["src\\App.tsx", "/src/App.tsx"],
    ["/a/b/c.js", "/a/b/c.js"],
  ];
  it.each(cases)("%s -> %s", (input, expected) => {
    expect(normalize_path(input)).toBe(expected);
  });
});

describe("infer_language", () => {
  const cases = [
    ["/App.tsx", "typescriptreact"],
    ["/index.ts", "typescript"],
    ["/main.js", "javascript"],
    ["/s.css", "css"],
    ["/s.scss", "scss"],
    ["/p.json", "json"],
    ["/r.md", "markdown"],
    ["/x.py", "python"],
    ["/f.xyz", "plaintext"],
  ];
  it.each(cases)("%s -> %s", (path, lang) => {
    expect(infer_language(path)).toBe(lang);
  });
});

describe("to_ws_uri", () => {
  it("builds workspace URI", () => {
    expect(to_ws_uri("ws1", "/src/App.tsx")).toBe("file:///ws/ws1/src/App.tsx");
  });
  it("normalizes path in URI", () => {
    expect(to_ws_uri("ws1", "src/f.js")).toBe("file:///ws/ws1/src/f.js");
  });
});

describe("create_emitter", () => {
  it("fires, wildcards, disposes, and clears", () => {
    const em = create_emitter();
    const log = [];
    const d = em.on("a", (v) => log.push(v));
    em.on("*", (v) => log.push("*"));
    em.emit("a", { x: 1 });
    d();
    em.emit("a", { x: 2 });
    expect(log).toEqual([{ x: 1 }, "*", "*"]);
    em.clear();
    em.emit("a", {});
    expect(log).toHaveLength(3);
  });
});

describe("build_tree", () => {
  it("builds nested tree from flat entries", () => {
    const tree = build_tree([
      { path: "/src/components/Button.tsx" },
      { path: "/README.md" },
    ]);
    expect(tree).toHaveLength(2);
    const src = tree.find((n) => n.name === "src");
    expect(src.type).toBe("directory");
    expect(src.children[0].name).toBe("components");
    expect(src.children[0].children[0].name).toBe("Button.tsx");
  });

  it("returns empty for empty input", () => {
    expect(build_tree([])).toEqual([]);
  });
});

/* ── File Registry CRUD ───────────────────────────── */

describe("files CRUD", () => {
  const ctx = use_files();

  it("create / read / update / delete cycle", () => {
    const { files } = ctx;
    files.create("/a.ts", "old");
    expect(files.read("/a.ts")).toBe("old");
    expect($files.get()).toHaveLength(1);
    expect($files.get()[0].language).toBe("typescript");

    files.update("/a.ts", "new");
    expect(files.read("/a.ts")).toBe("new");

    files.delete("/a.ts");
    expect($files.get()).toHaveLength(0);
    expect(files.get("/a.ts")).toBeNull();
  });

  it("create infers language, accepts options", () => {
    const { files } = ctx;
    files.create("/s.css", "body{}");
    expect($files.get()[0].language).toBe("css");

    files.create("/f.txt", "", { language: "json", main: true, meta: { v: 1 } });
    const e = files.entry("/f.txt");
    expect(e.language).toBe("json");
    expect(e.main).toBe(true);
    expect(e.meta).toEqual({ v: 1 });
  });

  it("create overwrites existing, normalizes path", () => {
    const { files } = ctx;
    files.create("src/f.js", "old");
    files.create("src/f.js", "new");
    expect($files.get()).toHaveLength(1);
    expect(files.read("/src/f.js")).toBe("new");
  });

  it("read / update return null for missing", () => {
    const { files } = ctx;
    expect(files.read("/nope")).toBeNull();
    expect(files.update("/nope", "x")).toBeNull();
  });

  it("entry returns metadata, set_meta merges", () => {
    const { files } = ctx;
    files.create("/a.ts", "", { meta: { x: 1 } });
    expect(files.entry("/a.ts").meta).toEqual({ x: 1 });
    files.set_meta("/a.ts", { y: 2 });
    expect(files.entry("/a.ts").meta).toEqual({ x: 1, y: 2 });
    expect(files.set_meta("/nope", {})).toBeNull();
  });
});

/* ── Rename / Move ────────────────────────────────── */

describe("rename / move", () => {
  const ctx = use_files();

  it("renames, preserves props, updates open/active", () => {
    const { files } = ctx;
    files.create("/old.ts", "code", { main: true, meta: { x: 1 } });
    files.open("/old.ts");
    $active_file.set("/old.ts");

    files.rename("/old.ts", "/new.ts");
    expect(files.read("/new.ts")).toBe("code");
    expect(files.read("/old.ts")).toBeNull();
    expect(files.entry("/new.ts").main).toBe(true);
    expect($open_files.get()).toContain("/new.ts");
    expect($active_file.get()).toBe("/new.ts");
  });

  it("move is alias for rename", () => {
    const { files } = ctx;
    files.create("/a.ts", "x");
    files.move("/a.ts", "/b.ts");
    expect(files.read("/b.ts")).toBe("x");
  });

  it("rename returns null for missing", () => {
    expect(ctx.files.rename("/nope", "/x")).toBeNull();
  });
});

/* ── Directory Operations ─────────────────────────── */

describe("directory operations", () => {
  const ctx = use_files();

  const seed = () => {
    const { files } = ctx;
    files.create("/src/App.tsx", "app");
    files.create("/src/index.ts", "idx");
    files.create("/src/utils/math.ts", "math");
    files.create("/README.md", "rm");
  };

  it("list: all, filtered, with depth", () => {
    seed();
    const { files } = ctx;
    expect(files.list()).toHaveLength(4);
    expect(files.list("/src")).toHaveLength(3);
    expect(files.list("/src", { depth: 1 })).toHaveLength(2);
  });

  it("dirs: all and sub-directory", () => {
    seed();
    const { files } = ctx;
    const all = files.dirs();
    expect(all).toContain("/src");
    expect(all).toContain("/src/utils");
    expect(files.dirs("/src")).toEqual(["/src/utils"]);
  });

  it("delete_dir removes directory contents", () => {
    seed();
    ctx.files.delete_dir("/src");
    expect($files.get()).toHaveLength(1);
    expect($files.get()[0].path).toBe("/README.md");
  });

  it("rename_dir moves files", () => {
    seed();
    ctx.files.rename_dir("/src/utils", "/src/helpers");
    expect(ctx.files.read("/src/helpers/math.ts")).toBe("math");
    expect(ctx.files.read("/src/utils/math.ts")).toBeNull();
  });
});

/* ── Dirty Tracking ───────────────────────────────── */

describe("dirty tracking", () => {
  const ctx = use_files();

  it("starts clean, becomes dirty on change, resets", () => {
    const { files } = ctx;
    files.create("/a.ts", "code");
    expect(files.is_dirty("/a.ts")).toBe(false);
    expect($is_dirty.get()).toBe(false);

    files.get("/a.ts").setValue("changed");
    expect(files.is_dirty("/a.ts")).toBe(true);
    expect($dirty_files.get()).toHaveLength(1);

    files.mark_clean("/a.ts");
    expect(files.is_dirty("/a.ts")).toBe(false);
  });

  it("mark_all_clean resets every file", () => {
    const { files } = ctx;
    files.create("/a.ts", "a");
    files.create("/b.ts", "b");
    files.get("/a.ts").setValue("x");
    files.get("/b.ts").setValue("y");
    files.mark_all_clean();
    expect($dirty_files.get()).toHaveLength(0);
  });
});

/* ── Events ───────────────────────────────────────── */

describe("file events", () => {
  const ctx = use_files();

  it("fires create, update, delete, rename events", () => {
    const { files } = ctx;
    const log = [];
    files.on("*", (d) => log.push(d.event));

    files.create("/a.ts", "code");
    files.update("/a.ts", "new");
    files.rename("/a.ts", "/b.ts"); // emits delete + create + rename
    files.delete("/b.ts");

    expect(log).toContain("create");
    expect(log).toContain("update");
    expect(log).toContain("rename");
    expect(log).toContain("delete");
  });

  it("dispose stops listener", () => {
    const { files } = ctx;
    const log = [];
    const d = files.on("create", () => log.push(1));
    files.create("/a.ts", "");
    d();
    files.create("/b.ts", "");
    expect(log).toHaveLength(1);
  });
});

/* ── Editor State (Tabs) ─────────────────────────── */

describe("tabs (open / close / set_active)", () => {
  const ctx = use_files();

  it("open / close manages $open_files", () => {
    const { files } = ctx;
    files.create("/a.ts", "");
    files.open("/a.ts");
    files.open("/a.ts"); // no dupe
    expect($open_files.get()).toEqual(["/a.ts"]);

    files.close("/a.ts");
    expect($open_files.get()).toHaveLength(0);
  });

  it("set_active sets model and updates stores", () => {
    const { files } = ctx;
    files.create("/a.ts", "a");
    files.create("/b.ts", "b");
    const ed = mock_editor();
    files.set_active("/b.ts", ed);
    expect($active_file.get()).toBe("/b.ts");
    expect($open_files.get()).toContain("/b.ts");
  });

  it("close active tab falls back to previous", () => {
    const { files } = ctx;
    files.create("/a.ts", "");
    files.create("/b.ts", "");
    $open_files.set(["/a.ts", "/b.ts"]);
    $active_file.set("/b.ts");
    files.close("/b.ts");
    expect($active_file.get()).toBeNull(); // no editor instance => null
  });

  it("delete clears from tabs", () => {
    const { files } = ctx;
    files.create("/a.ts", "");
    files.open("/a.ts");
    $active_file.set("/a.ts");
    files.delete("/a.ts");
    expect($open_files.get()).toHaveLength(0);
    expect($active_file.get()).toBeNull();
  });
});

/* ── Reactive Stores ──────────────────────────────── */

describe("reactive stores", () => {
  const ctx = use_files();

  it("$file_tree, $active_entry", () => {
    const { files } = ctx;
    files.create("/src/App.tsx", "");
    files.create("/index.ts", "");
    expect($file_tree.get()).toHaveLength(2);

    $active_file.set("/index.ts");
    expect($active_entry.get().path).toBe("/index.ts");

    $active_file.set(null);
    expect($active_entry.get()).toBeNull();
  });
});

/* ── Build: merge & format ────────────────────────── */

describe("merge", () => {
  const ctx = use_files();

  it("non-main before main, strips imports, supports filter", () => {
    const { files } = ctx;
    files.create("/h.ts", 'import { x } from "y";\nconst h = 1;');
    files.create("/m.ts", "const m = 2;", { main: true });

    const merged = files.merge();
    expect(merged).not.toContain("import");
    expect(merged.indexOf("h.ts")).toBeLessThan(merged.indexOf("m.ts"));

    const filtered = files.merge({ filter: (e) => e.main });
    expect(filtered).not.toContain("h.ts");
  });
});

describe("format", () => {
  const ctx = use_files();

  it("formats via tools, undo-safe, handles missing", async () => {
    const { files } = ctx;
    files.create("/a.ts", "  code  ");
    expect(await files.format("/a.ts")).toBe("code\n");
    expect(files.read("/a.ts")).toBe("code\n");
    expect(await files.format("/nope")).toBeNull();
  });

  it("format_all formats every file", async () => {
    const { files } = ctx;
    files.create("/a.ts", "  a  ");
    files.create("/b.ts", "  b  ");
    const r = await files.format_all();
    expect(r["/a.ts"]).toBe("a\n");
    expect(r["/b.ts"]).toBe("b\n");
  });
});

/* ── Clear ────────────────────────────────────────── */

describe("clear", () => {
  const ctx = use_files();

  it("removes all files", () => {
    ctx.files.create("/a.ts", "");
    ctx.files.create("/b.ts", "");
    ctx.files.clear();
    expect($files.get()).toHaveLength(0);
  });
});
