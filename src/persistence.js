/* ── Persistence Adapters ─────────────────────────── */

const local_storage = ({ prefix = "xkin_ws" } = {}) => {
  const key = (id) => `${prefix}:${id}`;
  const index_key = `${prefix}:__index__`;

  const get_index = () => {
    try {
      return JSON.parse(localStorage.getItem(index_key) || "[]");
    } catch {
      return [];
    }
  };

  const set_index = (items) => {
    localStorage.setItem(index_key, JSON.stringify(items));
  };

  return {
    async save(id, snapshot) {
      localStorage.setItem(key(id), JSON.stringify(snapshot));
      const index = get_index();
      const existing = index.findIndex((w) => w.id === id);
      const ws_meta = { ...snapshot.workspace };
      if (existing >= 0) {
        index[existing] = ws_meta;
      } else {
        index.push(ws_meta);
      }
      set_index(index);
    },

    async load(id) {
      const raw = localStorage.getItem(key(id));
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },

    async delete(id) {
      localStorage.removeItem(key(id));
      const index = get_index().filter((w) => w.id !== id);
      set_index(index);
    },

    async list() {
      return get_index();
    },
  };
};

const indexed_db = ({ db_name = "xkin_workspaces" } = {}) => {
  const STORE = "snapshots";
  const INDEX_STORE = "workspaces";
  const DB_VERSION = 1;

  const open_db = () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(db_name, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(INDEX_STORE)) {
          db.createObjectStore(INDEX_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const tx = async (store_name, mode, fn) => {
    const db = await open_db();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store_name, mode);
      const store = transaction.objectStore(store_name);
      const result = fn(store);
      transaction.oncomplete = () => resolve(result.result ?? undefined);
      transaction.onerror = () => reject(transaction.error);
    });
  };

  const get = async (store_name, id) => {
    const db = await open_db();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store_name, "readonly");
      const store = transaction.objectStore(store_name);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  };

  const get_all = async (store_name) => {
    const db = await open_db();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store_name, "readonly");
      const store = transaction.objectStore(store_name);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  return {
    async save(id, snapshot) {
      const db = await open_db();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE, INDEX_STORE], "readwrite");
        transaction.objectStore(STORE).put({ id, ...snapshot });
        transaction.objectStore(INDEX_STORE).put({ ...snapshot.workspace });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    },

    async load(id) {
      const result = await get(STORE, id);
      if (!result) return null;
      const { id: _id, ...snapshot } = result;
      return snapshot;
    },

    async delete(id) {
      const db = await open_db();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE, INDEX_STORE], "readwrite");
        transaction.objectStore(STORE).delete(id);
        transaction.objectStore(INDEX_STORE).delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    },

    async list() {
      return get_all(INDEX_STORE);
    },
  };
};

const remote = ({ base_url, headers = {} } = {}) => {
  const url = (path) => `${base_url.replace(/\/+$/, "")}/${path}`;

  const request = async (method, path, body) => {
    const opts = {
      method,
      headers: { "Content-Type": "application/json", ...headers },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url(path), opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    if (res.status === 204) return null;
    return res.json();
  };

  return {
    async save(id, snapshot) {
      await request("PUT", `workspaces/${encodeURIComponent(id)}`, snapshot);
    },

    async load(id) {
      try {
        return await request("GET", `workspaces/${encodeURIComponent(id)}`);
      } catch {
        return null;
      }
    },

    async delete(id) {
      await request("DELETE", `workspaces/${encodeURIComponent(id)}`);
    },

    async list() {
      return request("GET", "workspaces");
    },
  };
};

const persistence = { local_storage, indexed_db, remote };

export default persistence;
