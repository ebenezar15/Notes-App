/* Inkwell storage — a small promise wrapper over IndexedDB. Everything stays on this device
 * unless the user turns on sync (see sync.js), which reads changes through the hooks below. */
(function () {
  'use strict';

  const DB_NAME = 'inkwell';
  const DB_VERSION = 2;
  const STORES = {
    projects: { keyPath: 'id' },
    posts: { keyPath: 'id', indexes: [['projectId', 'projectId']] },
    versions: { keyPath: 'id', indexes: [['postId', 'postId']] },
    activity: { keyPath: 'date' },
    meta: { keyPath: 'key' },
    tombstones: { keyPath: 'key' }, // deletions waiting to be synced
  };
  /** Stores that sync across devices (version history stays local). */
  const SYNCED = ['projects', 'posts', 'activity'];

  let dbPromise = null;
  const listeners = [];

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

  function tx(stores, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      let result;
      Promise.resolve(fn(Array.isArray(stores) ? stores.map((n) => t.objectStore(n)) : t.objectStore(stores))).then((r) => { result = r; });
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  const reqP = (req) => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const notify = (store) => { if (SYNCED.includes(store)) listeners.forEach((fn) => fn(store)); };
  const tombstone = (store, id) => ({ key: `${store}:${id}`, store, id, deletedAt: Date.now() });

  async function deleteKeys(store, keys, { track = true } = {}) {
    if (!keys.length) return;
    const synced = track && SYNCED.includes(store);
    await tx(synced ? [store, 'tombstones'] : store, 'readwrite', (s) => {
      const [main, tomb] = Array.isArray(s) ? s : [s];
      keys.forEach((k) => { main.delete(k); if (tomb) tomb.put(tombstone(store, k)); });
    });
    if (synced) notify(store);
  }

  const DB = {
    open,
    SYNCED,
    all: (store) => tx(store, 'readonly', (s) => reqP(s.getAll())),
    get: (store, key) => tx(store, 'readonly', (s) => reqP(s.get(key))),
    put: async (store, value) => { await tx(store, 'readwrite', (s) => { s.put(value); }); notify(store); return value; },
    putMany: async (store, values) => { await tx(store, 'readwrite', (s) => { values.forEach((v) => s.put(v)); }); notify(store); },
    del: (store, key) => deleteKeys(store, [key]),
    delMany: (store, keys) => deleteKeys(store, keys),
    byIndex: (store, index, value) => tx(store, 'readonly', (s) => reqP(s.index(index).getAll(value))),
    clear: (store) => tx(store, 'readwrite', (s) => { s.clear(); }),

    /** Subscribe to local writes on synced stores. */
    onChange(fn) { listeners.push(fn); },

    // ---- used by the sync engine; these never create tombstones or fire onChange ----
    putQuiet: (store, value) => tx(store, 'readwrite', (s) => { s.put(value); }),
    delQuiet: (store, key) => deleteKeys(store, [key], { track: false }),
    clearTombstone: (key) => tx('tombstones', 'readwrite', (s) => { s.delete(key); }),
    /** Mark a record as uploaded — only if nobody edited it while the upload was in flight. */
    markSynced: (store, key, updatedAt) => tx(store, 'readwrite', async (s) => {
      const rec = await reqP(s.get(key));
      if (rec && rec.updatedAt === updatedAt) { rec._synced = updatedAt; s.put(rec); }
    }),

    async exportAll() {
      const out = { app: 'inkwell', version: DB_VERSION, exportedAt: new Date().toISOString() };
      for (const name of Object.keys(STORES)) if (name !== 'tombstones') out[name] = await DB.all(name);
      return out;
    },

    async importAll(data, { replace = false } = {}) {
      if (!data || data.app !== 'inkwell') throw new Error('This is not an Inkwell backup file.');
      for (const name of Object.keys(STORES)) {
        if (name === 'tombstones') continue;
        if (replace) await DB.clear(name);
        if (Array.isArray(data[name])) {
          // Imported records count as new local edits so sync uploads them.
          const now = Date.now();
          const rows = SYNCED.includes(name) ? data[name].map((r) => ({ ...r, updatedAt: Math.max(r.updatedAt || 0, now), _synced: 0 })) : data[name];
          await DB.putMany(name, rows);
        }
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
