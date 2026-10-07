/* Inkwell storage — a small promise wrapper over IndexedDB. Everything stays on this device. */
(function () {
  'use strict';

  const DB_NAME = 'inkwell';
  const DB_VERSION = 1;
  const STORES = {
    projects: { keyPath: 'id' },
    posts: { keyPath: 'id', indexes: [['projectId', 'projectId']] },
    versions: { keyPath: 'id', indexes: [['postId', 'postId']] },
    activity: { keyPath: 'date' },
    meta: { keyPath: 'key' },
  };

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [name, def] of Object.entries(STORES)) {
          if (db.objectStoreNames.contains(name)) continue;
          const store = db.createObjectStore(name, { keyPath: def.keyPath });
          (def.indexes || []).forEach(([idx, key]) => store.createIndex(idx, key));
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(store, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let result;
      Promise.resolve(fn(s)).then((r) => { result = r; });
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  const reqP = (req) => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const DB = {
    open,
    all: (store) => tx(store, 'readonly', (s) => reqP(s.getAll())),
    get: (store, key) => tx(store, 'readonly', (s) => reqP(s.get(key))),
    put: (store, value) => tx(store, 'readwrite', (s) => { s.put(value); return value; }),
    del: (store, key) => tx(store, 'readwrite', (s) => { s.delete(key); }),
    byIndex: (store, index, value) => tx(store, 'readonly', (s) => reqP(s.index(index).getAll(value))),
    clear: (store) => tx(store, 'readwrite', (s) => { s.clear(); }),
    putMany: (store, values) => tx(store, 'readwrite', (s) => { values.forEach((v) => s.put(v)); }),
    delMany: (store, keys) => tx(store, 'readwrite', (s) => { keys.forEach((k) => s.delete(k)); }),

    async exportAll() {
      const out = { app: 'inkwell', version: DB_VERSION, exportedAt: new Date().toISOString() };
      for (const name of Object.keys(STORES)) out[name] = await DB.all(name);
      return out;
    },

    async importAll(data, { replace = false } = {}) {
      if (!data || data.app !== 'inkwell') throw new Error('This is not an Inkwell backup file.');
      for (const name of Object.keys(STORES)) {
        if (replace) await DB.clear(name);
        if (Array.isArray(data[name])) await DB.putMany(name, data[name]);
      }
    },

    async estimate() {
      if (!navigator.storage || !navigator.storage.estimate) return null;
      const e = await navigator.storage.estimate();
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      return { usage: e.usage || 0, quota: e.quota || 0, persisted };
    },

    async persist() {
      if (navigator.storage && navigator.storage.persist) return navigator.storage.persist();
      return false;
    },
  };

  window.DB = DB;
})();
