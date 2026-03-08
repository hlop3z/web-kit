import { atom, computed } from "nanostores";

const get_editor = () => globalThis.XkinEditor;
const get_tools = () => globalThis.XkinTools;

/* ── Helpers ──────────────────────────────────────── */

const normalize_path = (p) => {
  let n = "/" + p.replace(/\\/g, "/").replace(/^\/+/, "");
  n = n.replace(/\/+/g, "/");
  if (n !== "/" && n.endsWith("/")) n = n.slice(0, -1);
  return n;
};

const LANG_MAP = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescriptreact",
  json: "json",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  md: "markdown",
  mdx: "markdown",
  xml: "xml",
  svg: "xml",
  yaml: "yaml",
  yml: "yaml",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  py: "python",
  sh: "shell",
  bash: "shell",
  txt: "plaintext",
};

const infer_language = (path) => {
  const ext = path.split(".").pop().toLowerCase();
  return LANG_MAP[ext] || "plaintext";
};

const to_ws_uri = (ws_id, path) =>
  `file:///ws/${ws_id}${normalize_path(path)}`;

/* ── Event Emitter ────────────────────────────────── */

const create_emitter = () => {
  const listeners = new Map();

  const on = (event, cb) => {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(cb);
    return () => listeners.get(event)?.delete(cb);
  };

  const emit = (event, data) => {
    listeners.get(event)?.forEach((cb) => cb(data));
    if (event !== "*") listeners.get("*")?.forEach((cb) => cb({ event, ...data }));
  };

  const clear = () => listeners.clear();

  return { on, emit, clear };
};

/* ── Stores ───────────────────────────────────────── */

const $workspace = atom(null);
const $files = atom([]);
const $active_file = atom(null);
const $open_files = atom([]);

const $file_tree = computed($files, (entries) => build_tree(entries));
const $is_dirty = computed($files, (entries) => entries.some((e) => e.dirty));
const $dirty_files = computed($files, (entries) => entries.filter((e) => e.dirty));
const $active_entry = computed([$files, $active_file], (entries, path) =>
  path ? entries.find((e) => e.path === path) || null : null
);

/* ── Tree Builder ─────────────────────────────────── */

const build_tree = (entries) => {
  const root = [];
  const dirs = new Map();

  const ensure_dir = (dir_path) => {
    if (dir_path === "/" || dirs.has(dir_path)) return dirs.get(dir_path);
    const parts = dir_path.split("/").filter(Boolean);
    const name = parts.pop();
    const parent_path = parts.length ? "/" + parts.join("/") : "/";
    const node = { name, path: dir_path, type: "directory", children: [] };
    dirs.set(dir_path, node);
    if (parent_path === "/") {
      root.push(node);
    } else {
      const parent = ensure_dir(parent_path);
      if (parent) parent.children.push(node);
    }
    return node;
  };

  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean);
    const name = parts.pop();
    const dir_path = parts.length ? "/" + parts.join("/") : "/";
    const file_node = { name, path: entry.path, type: "file", entry };

    if (dir_path === "/") {
      root.push(file_node);
    } else {
      const parent = ensure_dir(dir_path);
      if (parent) parent.children.push(file_node);
    }
  }

  return root;
};

/* ── File Registry ────────────────────────────────── */

const create_file_registry = () => {
  const emitter = create_emitter();
  const content_disposables = new Map();
  const clean_snapshots = new Map();
  const view_states = new Map();

  const get_ws_id = () => {
    const ws = $workspace.get();
    return ws ? ws.id : "__default__";
  };

  const view_key = (path) => `${get_ws_id()}:${path}`;

  const files = {
    /* ── CRUD ─────────────────────────────────────── */

    create(path, content = "", { main = false, language, meta = {} } = {}) {
      path = normalize_path(path);
      const monaco = get_editor();
      const lang = language || infer_language(path);
      const uri = monaco.Uri.parse(to_ws_uri(get_ws_id(), path));
      const existing = monaco.editor.getModel(uri);
      let model;

      if (existing) {
        existing.setValue(content);
        model = existing;
      } else {
        model = monaco.editor.createModel(content, lang, uri);
      }

      // Dirty tracking
      if (content_disposables.has(path)) content_disposables.get(path).dispose();
      clean_snapshots.set(path, content);
      const disposable = model.onDidChangeContent(() => {
        const current = model.getValue();
        const is_dirty = current !== clean_snapshots.get(path);
        const entries = $files.get();
        const idx = entries.findIndex((e) => e.path === path);
        if (idx >= 0 && entries[idx].dirty !== is_dirty) {
          const updated = [...entries];
          updated[idx] = { ...updated[idx], dirty: is_dirty, updated_at: Date.now() };
          $files.set(updated);
        }
      });
      content_disposables.set(path, disposable);

      const now = Date.now();
      const entries = $files.get().filter((f) => f.path !== path);
      const entry = {
        path,
        language: lang,
        main,
        dirty: false,
        created_at: now,
        updated_at: now,
        meta,
      };
      entries.push(entry);
      $files.set(entries);

      emitter.emit("create", { path, entry });
      return model;
    },

    read(path) {
      path = normalize_path(path);
      const monaco = get_editor();
      const uri = monaco.Uri.parse(to_ws_uri(get_ws_id(), path));
      const model = monaco.editor.getModel(uri);
      return model ? model.getValue() : null;
    },

    update(path, content) {
      path = normalize_path(path);
      const monaco = get_editor();
      const uri = monaco.Uri.parse(to_ws_uri(get_ws_id(), path));
      const model = monaco.editor.getModel(uri);
      if (!model) return null;

      // Undo-safe edit
      const full_range = model.getFullModelRange();
      model.pushEditOperations(
        [],
        [{ range: full_range, text: content }],
        () => null
      );

      emitter.emit("update", { path });
      return model;
    },

    delete(path) {
      path = normalize_path(path);
      const monaco = get_editor();
      const uri = monaco.Uri.parse(to_ws_uri(get_ws_id(), path));
      const model = monaco.editor.getModel(uri);
      if (model) model.dispose();

      if (content_disposables.has(path)) {
        content_disposables.get(path).dispose();
        content_disposables.delete(path);
      }
      clean_snapshots.delete(path);
      view_states.delete(view_key(path));

      const entries = $files.get().filter((f) => f.path !== path);
      $files.set(entries);

      // Clean up open files and active file
      const open = $open_files.get();
      if (open.includes(path)) {
        $open_files.set(open.filter((p) => p !== path));
      }
      if ($active_file.get() === path) {
        const remaining = $open_files.get();
        $active_file.set(remaining.length ? remaining[remaining.length - 1] : null);
      }

      emitter.emit("delete", { path });
    },

    get(path) {
      path = normalize_path(path);
      const monaco = get_editor();
      const uri = monaco.Uri.parse(to_ws_uri(get_ws_id(), path));
      return monaco.editor.getModel(uri);
    },

    entry(path) {
      path = normalize_path(path);
      return $files.get().find((e) => e.path === path) || null;
    },

    set_meta(path, meta) {
      path = normalize_path(path);
      const entries = $files.get();
      const idx = entries.findIndex((e) => e.path === path);
      if (idx < 0) return null;
      const updated = [...entries];
      updated[idx] = { ...updated[idx], meta: { ...updated[idx].meta, ...meta }, updated_at: Date.now() };
      $files.set(updated);
      return updated[idx];
    },

    /* ── Navigation ───────────────────────────────── */

    rename(old_path, new_path) {
      old_path = normalize_path(old_path);
      new_path = normalize_path(new_path);
      const content = files.read(old_path);
      if (content === null) return null;

      const entry = $files.get().find((f) => f.path === old_path);
      const opts = entry
        ? { main: entry.main, language: entry.language, meta: entry.meta }
        : {};

      // Capture state before delete clears it
      const vk = view_key(old_path);
      const vs = view_states.get(vk);
      const was_open = $open_files.get().includes(old_path);
      const was_active = $active_file.get() === old_path;
      const prev_open = [...$open_files.get()];

      files.delete(old_path);
      const model = files.create(new_path, content, opts);

      if (vs) view_states.set(view_key(new_path), vs);

      // Restore open files and active file with renamed path
      if (was_open) {
        $open_files.set(prev_open.map((p) => (p === old_path ? new_path : p)));
      }
      if (was_active) {
        $active_file.set(new_path);
      }

      emitter.emit("rename", { old_path, new_path });
      return model;
    },

    move(old_path, new_path) {
      return files.rename(old_path, new_path);
    },

    /* ── Directory Operations ─────────────────────── */

    list(dir_path, { depth } = {}) {
      const entries = $files.get();
      if (!dir_path) return entries.map((e) => ({ ...e }));

      dir_path = normalize_path(dir_path);
      const prefix = dir_path === "/" ? "/" : dir_path + "/";

      return entries
        .filter((e) => {
          if (!e.path.startsWith(prefix)) return false;
          if (depth != null) {
            const rel = e.path.slice(prefix.length);
            const level = rel.split("/").length;
            return level <= depth;
          }
          return true;
        })
        .map((e) => ({ ...e }));
    },

    dirs(dir_path) {
      const entries = $files.get();
      const dir_set = new Set();

      for (const e of entries) {
        const parts = e.path.split("/").filter(Boolean);
        parts.pop(); // remove filename
        for (let i = 1; i <= parts.length; i++) {
          dir_set.add("/" + parts.slice(0, i).join("/"));
        }
      }

      if (!dir_path) return [...dir_set].sort();

      dir_path = normalize_path(dir_path);
      const prefix = dir_path === "/" ? "/" : dir_path + "/";
      return [...dir_set].filter((d) => d.startsWith(prefix)).sort();
    },

    delete_dir(dir_path) {
      dir_path = normalize_path(dir_path);
      const prefix = dir_path === "/" ? "/" : dir_path + "/";
      const entries = $files.get().filter((e) => e.path.startsWith(prefix));
      for (const e of entries) {
        files.delete(e.path);
      }
    },

    rename_dir(old_dir, new_dir) {
      old_dir = normalize_path(old_dir);
      new_dir = normalize_path(new_dir);
      const prefix = old_dir + "/";
      const entries = $files.get().filter((e) => e.path.startsWith(prefix));
      for (const e of entries) {
        const new_path = new_dir + e.path.slice(old_dir.length);
        files.rename(e.path, new_path);
      }
    },

    /* ── Dirty Tracking ───────────────────────────── */

    mark_clean(path) {
      path = normalize_path(path);
      const model = files.get(path);
      if (model) clean_snapshots.set(path, model.getValue());
      const entries = $files.get();
      const idx = entries.findIndex((e) => e.path === path);
      if (idx >= 0 && entries[idx].dirty) {
        const updated = [...entries];
        updated[idx] = { ...updated[idx], dirty: false };
        $files.set(updated);
      }
    },

    mark_all_clean() {
      const entries = $files.get();
      let changed = false;
      const updated = entries.map((e) => {
        const model = files.get(e.path);
        if (model) clean_snapshots.set(e.path, model.getValue());
        if (e.dirty) {
          changed = true;
          return { ...e, dirty: false };
        }
        return e;
      });
      if (changed) $files.set(updated);
    },

    is_dirty(path) {
      path = normalize_path(path);
      const entry = $files.get().find((e) => e.path === path);
      return entry ? entry.dirty : false;
    },

    /* ── View State ───────────────────────────────── */

    save_view_state(path, editor_instance) {
      path = normalize_path(path);
      const state = editor_instance.saveViewState();
      if (state) view_states.set(view_key(path), state);
    },

    restore_view_state(path, editor_instance) {
      path = normalize_path(path);
      const state = view_states.get(view_key(path));
      if (state) {
        editor_instance.restoreViewState(state);
        return state;
      }
      return null;
    },

    /* ── Editor State (Tabs) ──────────────────────── */

    set_active(path, editor_instance) {
      path = normalize_path(path);
      const model = files.get(path);
      if (!model) return null;

      // Save current view state
      const current = $active_file.get();
      if (current && editor_instance) {
        files.save_view_state(current, editor_instance);
      }

      editor_instance.setModel(model);
      $active_file.set(path);

      // Restore view state for new file
      files.restore_view_state(path, editor_instance);

      // Ensure it's in open files
      const open = $open_files.get();
      if (!open.includes(path)) {
        $open_files.set([...open, path]);
      }

      return model;
    },

    open(path) {
      path = normalize_path(path);
      const open = $open_files.get();
      if (!open.includes(path)) {
        $open_files.set([...open, path]);
      }
    },

    close(path, editor_instance) {
      path = normalize_path(path);
      const open = $open_files.get().filter((p) => p !== path);
      $open_files.set(open);

      if ($active_file.get() === path) {
        if (open.length && editor_instance) {
          files.set_active(open[open.length - 1], editor_instance);
        } else {
          $active_file.set(null);
        }
      }
    },

    /* ── Build ────────────────────────────────────── */

    merge({ strip_imports = true, separator = "\n\n", filter } = {}) {
      let entries = $files.get();
      if (filter) entries = entries.filter(filter);
      const non_main = entries.filter((f) => !f.main);
      const main = entries.filter((f) => f.main);
      const ordered = [...non_main, ...main];

      const chunks = ordered.map((f) => {
        const content = files.read(f.path) || "";
        return `// -- ${f.path} --\n${content}`;
      });

      let merged = chunks.join(separator);
      if (strip_imports) {
        merged = merged.replace(/^import\s+.*;\s*$/gm, "");
      }
      return merged;
    },

    async format(path, opts = {}) {
      path = normalize_path(path);
      const content = files.read(path);
      if (content === null) return null;

      const tools = get_tools();
      if (!tools || !tools.format) return content;

      const entry = $files.get().find((f) => f.path === path);
      const parser =
        opts.parser || (entry && /\.tsx?$/.test(entry.path) ? "typescript" : "babel");

      const formatted = await tools.format({
        source: content,
        parser,
        ...opts,
      });

      // Undo-safe format
      const model = files.get(path);
      if (model) {
        const full_range = model.getFullModelRange();
        model.pushEditOperations(
          [],
          [{ range: full_range, text: formatted }],
          () => null
        );
      }

      emitter.emit("update", { path });
      return formatted;
    },

    async format_all(opts = {}, { filter } = {}) {
      let entries = $files.get();
      if (filter) entries = entries.filter(filter);
      const results = {};
      for (const f of entries) {
        results[f.path] = await files.format(f.path, opts);
      }
      return results;
    },

    clear() {
      const entries = $files.get();
      for (const f of entries) {
        files.delete(f.path);
      }
      emitter.clear();
    },

    /* ── Events ───────────────────────────────────── */

    on(event_type, callback) {
      return emitter.on(event_type, callback);
    },
  };

  // Expose internals needed by workspace
  files._view_states = view_states;
  files._clean_snapshots = clean_snapshots;
  files._content_disposables = content_disposables;
  files._emitter = emitter;

  return files;
};

export {
  create_file_registry,
  create_emitter,
  normalize_path,
  infer_language,
  to_ws_uri,
  build_tree,
  $workspace,
  $files,
  $active_file,
  $open_files,
  $file_tree,
  $is_dirty,
  $dirty_files,
  $active_entry,
};
