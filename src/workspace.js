import {
  create_emitter,
  normalize_path,
  $workspace,
  $files,
  $active_file,
  $open_files,
  $is_dirty,
} from "./files.js";

const get_editor = () => globalThis.XkinEditor;

/* ── Workspace Manager ────────────────────────────── */

const create_workspace_manager = (file_registry, hooks) => {
  const emitter = create_emitter();
  const workspaces = new Map();
  const snapshots = new Map();
  let persistence_adapter = null;
  let format_on_save = false;

  const run_format = async () => {
    const dirty = $files.get().filter((e) => e.dirty);
    for (const e of dirty) {
      await file_registry.format(e.path);
    }
  };

  const ws = {
    async create(id, { name = id, meta = {}, activate = true } = {}) {
      const now = Date.now();
      const workspace = {
        id,
        name,
        created_at: now,
        updated_at: now,
        meta,
      };
      workspaces.set(id, workspace);

      if (activate) {
        // Snapshot current if exists
        const current = $workspace.get();
        if (current) {
          snapshots.set(current.id, ws.snapshot());
          await file_registry.clear();
        }
        $workspace.set(workspace);
        $files.set([]);
        $active_file.set(null);
        $open_files.set([]);
        emitter.emit("create", { workspace });
        emitter.emit("switch", { workspace });
      } else {
        emitter.emit("create", { workspace });
      }

      return workspace;
    },

    async switch(id) {
      const target = workspaces.get(id);
      if (!target) return null;

      const current = $workspace.get();
      if (current && current.id === id) return target;

      // Hook: action before switch
      if (hooks) await hooks.fire("workspace.before_switch", { from_id: current?.id, to_id: id });

      // Snapshot current
      if (current) {
        snapshots.set(current.id, ws.snapshot());
        await file_registry.clear();
      }

      // Restore target
      const saved = snapshots.get(id);
      $workspace.set(target);

      if (saved) {
        await ws.mount(saved, { activate: false });
      } else {
        $files.set([]);
        $active_file.set(null);
        $open_files.set([]);
      }

      emitter.emit("switch", { workspace: target });
      if (hooks) hooks.fire("workspace.after_switch", { workspace: target });
      return target;
    },

    current() {
      return $workspace.get();
    },

    async list() {
      if (persistence_adapter) {
        const persisted = await persistence_adapter.list();
        // Merge with in-memory
        for (const pw of persisted) {
          if (!workspaces.has(pw.id)) workspaces.set(pw.id, pw);
        }
      }
      return [...workspaces.values()];
    },

    async delete(id) {
      const current = $workspace.get();
      if (current && current.id === id) {
        await file_registry.clear();
        $workspace.set(null);
        $files.set([]);
        $active_file.set(null);
        $open_files.set([]);
      }

      workspaces.delete(id);
      snapshots.delete(id);

      if (persistence_adapter) {
        await persistence_adapter.delete(id);
      }

      emitter.emit("delete", { id });
    },

    update(id, { name, meta } = {}) {
      const workspace = workspaces.get(id);
      if (!workspace) return null;

      if (name != null) workspace.name = name;
      if (meta != null) workspace.meta = { ...workspace.meta, ...meta };
      workspace.updated_at = Date.now();
      workspaces.set(id, workspace);

      // Update store if it's the current workspace
      if ($workspace.get()?.id === id) {
        $workspace.set({ ...workspace });
      }

      return workspace;
    },

    snapshot() {
      const current = $workspace.get();
      if (!current) return null;

      const entries = $files.get();
      const files_map = {};
      for (const e of entries) {
        files_map[e.path] = file_registry.read(e.path) || "";
      }

      // Gather view states
      const vs = {};
      for (const [key, state] of file_registry._view_states) {
        if (key.startsWith(current.id + ":")) {
          const path = key.slice(current.id.length + 1);
          vs[path] = state;
        }
      }

      return {
        workspace: { ...current },
        files: files_map,
        entries: entries.map((e) => ({ ...e })),
        view_states: vs,
        active_file: $active_file.get(),
        open_files: [...$open_files.get()],
      };
    },

    async mount(snap, { activate = true } = {}) {
      if (!snap) return null;

      if (activate) {
        const current = $workspace.get();
        if (current) {
          snapshots.set(current.id, ws.snapshot());
          await file_registry.clear();
        }
      }

      const workspace = snap.workspace;
      workspaces.set(workspace.id, workspace);

      if (activate) {
        $workspace.set(workspace);
      }

      // Recreate files
      for (const entry of snap.entries) {
        const content = snap.files[entry.path] || "";
        await file_registry.create(entry.path, content, {
          main: entry.main,
          language: entry.language,
          meta: entry.meta,
        });
      }

      // Restore view states
      if (snap.view_states) {
        for (const [path, state] of Object.entries(snap.view_states)) {
          file_registry._view_states.set(`${workspace.id}:${path}`, state);
        }
      }

      // Restore editor state
      if (activate) {
        $open_files.set(snap.open_files || []);
        $active_file.set(snap.active_file || null);
      }

      emitter.emit("mount", { workspace });
      return workspace;
    },

    to_json() {
      const entries = $files.get();
      const result = {};
      for (const e of entries) {
        result[e.path] = file_registry.read(e.path) || "";
      }
      return result;
    },

    async from_json(id, file_map, { name = id, meta = {} } = {}) {
      const workspace = await ws.create(id, { name, meta, activate: true });

      for (const [path, content] of Object.entries(file_map)) {
        await file_registry.create(path, content);
      }

      return workspace;
    },

    set_persistence(adapter) {
      persistence_adapter = adapter;
    },

    set_format_on_save(enabled) {
      format_on_save = !!enabled;
    },

    get_format_on_save() {
      return format_on_save;
    },

    async save() {
      if (format_on_save) await run_format();
      if (!persistence_adapter) return;
      let snap = ws.snapshot();
      if (!snap) return;

      // Hook: filter snapshot before save
      if (hooks) {
        snap = await hooks.fire("workspace.before_save", snap);
      }

      await persistence_adapter.save(snap.workspace.id, snap);

      if (hooks) hooks.fire("workspace.after_save", { workspace: snap.workspace });
    },

    auto_save({ interval = 30_000, on_save } = {}) {
      let timer = null;
      let saving = false;

      const tick = async () => {
        if (saving) return;
        if (!$is_dirty.get()) return;
        if (!persistence_adapter && !on_save) return;

        saving = true;
        try {
          if (format_on_save) await run_format();
          if (on_save) {
            await on_save(ws);
          } else if (persistence_adapter) {
            const snap = ws.snapshot();
            if (snap) await persistence_adapter.save(snap.workspace.id, snap);
          }
          file_registry.mark_all_clean();
          emitter.emit("auto_save", { workspace: $workspace.get() });
        } finally {
          saving = false;
        }
      };

      timer = setInterval(tick, interval);

      return () => {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },

    on(event_type, callback) {
      return emitter.on(event_type, callback);
    },
  };

  return ws;
};

export { create_workspace_manager };
