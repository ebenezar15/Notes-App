/* Inkwell Sync — optional account sync through the user's own free Supabase project.
 *
 * Offline-first: everything is saved locally first; when online and signed in, changes are
 * pushed and pulled in the background. Conflicts resolve per record, newest edit wins
 * (the server refuses to overwrite a newer row with an older one).
 *
 * Talks to Supabase over plain HTTPS (Auth + PostgREST), so there is no SDK to bundle.
 * The table and security policy it expects are in SYNC.md / SETUP_SQL below.
 */
(function () {
  'use strict';

  const TABLE = 'inkwell_records';
  const CFG_KEY = 'inkwell.sync.config';
  const SESSION_KEY = 'inkwell.sync.session';
  const STATE_KEY = 'sync.state';
  const KEYS = { projects: 'id', posts: 'id', activity: 'date' };

  const SETUP_SQL = `-- Inkwell sync: run once in Supabase → SQL Editor → New query → Run
create table if not exists public.${TABLE} (
  user_id    uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  store      text    not null,
  id         text    not null,
  data       jsonb,
  updated_at bigint  not null,
  deleted    boolean not null default false,
  synced_at  bigint  not null default 0,
  primary key (user_id, store, id)
);
create index if not exists ${TABLE}_cursor on public.${TABLE} (user_id, synced_at);
alter table public.${TABLE} enable row level security;
drop policy if exists "own rows" on public.${TABLE};
create policy "own rows" on public.${TABLE} for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create or replace function public.${TABLE}_touch() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old; -- never let an older edit overwrite a newer one
  end if;
  new.synced_at := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  return new;
end $$;
drop trigger if exists ${TABLE}_touch on public.${TABLE};
create trigger ${TABLE}_touch before insert or update on public.${TABLE}
  for each row execute function public.${TABLE}_touch();`;

  /** Accepts whatever the user copies from Supabase and returns the bare project URL,
   *  e.g. "https://abcd.supabase.co/rest/v1/" or a dashboard link -> "https://abcd.supabase.co". */
  function normalizeProjectUrl(input) {
    let raw = String(input || '').trim().replace(/^['"<]+|['">]+$/g, '');
    const dash = /supabase\.com\/dashboard\/project\/([a-z0-9]{15,})/i.exec(raw);
    if (dash) return `https://${dash[1].toLowerCase()}.supabase.co`;
    if (/^[a-z0-9]{15,}$/i.test(raw)) return `https://${raw.toLowerCase()}.supabase.co`;
    if (!/^https?:\/\//i.test(raw) && /\.supabase\.(co|in)\b/i.test(raw)) raw = 'https://' + raw;
    let u;
    try { u = new URL(raw); } catch (e) { return ''; }
    return u.origin; // drops /rest/v1, /auth/v1, query strings and trailing slashes
  }

  /** Refuse secret keys — they bypass row-level security and must never live in an app. */
  function checkPublicKey(key) {
    if (/^sb_secret_/i.test(key)) return 'That is the secret key. Use the anon / publishable key instead.';
    const parts = key.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.role === 'service_role') return 'That is the service_role (secret) key. Use the anon / public key instead.';
      } catch (e) { /* not a JWT we can read; let the server decide */ }
    }
    return '';
  }

  function friendlyError(msg) {
    if (/invalid path specified/i.test(msg)) return 'The project URL looks wrong. Use just https://xxxx.supabase.co (no /rest/v1 at the end).';
    if (/invalid api key|no api key/i.test(msg)) return 'Supabase rejected the key. Copy the anon / publishable key from Project Settings → API.';
    if (/email not confirmed/i.test(msg)) return 'Please confirm your email first — check your inbox for the link from Supabase, then sign in.';
    if (/invalid login credentials/i.test(msg)) return 'Wrong email or password. New here? Press “Create account” first.';
    return msg;
  }

  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };

  const Sync = {
    SETUP_SQL,
    normalizeProjectUrl,
    status: 'off', // off | signed-out | idle | syncing | offline | error
    error: '',
    lastSyncAt: 0,
    handlers: { onRemote: () => {}, onStatus: () => {}, onMarked: () => {} },
    _timer: null,
    _running: null,
    _again: false,

    get config() {
      const c = read(CFG_KEY);
      if (c && c.url) c.url = normalizeProjectUrl(c.url) || c.url; // repairs URLs saved by older versions
      return c;
    },
    get session() { return read(SESSION_KEY); },
    get user() { const s = read(SESSION_KEY); return s && s.user; },
    get enabled() { return !!(this.config && this.session); },

    init(handlers) {
      Object.assign(this.handlers, handlers);
      DB.onChange(() => this.schedule(3000));
      window.addEventListener('online', () => this.schedule(500));
      window.addEventListener('offline', () => this.setStatus('offline'));
      window.addEventListener('focus', () => this.schedule(800));
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.schedule(800); });
      setInterval(() => this.schedule(0), 60 * 1000);
      this.setStatus(!this.config ? 'off' : !this.session ? 'signed-out' : 'idle');
      if (this.enabled) this.schedule(300);
    },

    setStatus(status, error = '') {
      this.status = status;
      this.error = error;
      this.handlers.onStatus(this);
    },

    // ---------------------------------------------------------------- config
    configure(url, anonKey) {
      url = normalizeProjectUrl(url);
      if (!/^https:\/\/[\w.-]+$/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) throw new Error('The project URL should look like https://xxxx.supabase.co');
      anonKey = String(anonKey || '').trim();
      if (anonKey.length < 20) throw new Error('Paste the project’s anon / publishable key.');
      const bad = checkPublicKey(anonKey);
      if (bad) throw new Error(bad);
      write(CFG_KEY, { url, anonKey });
      this.setStatus(this.session ? 'idle' : 'signed-out');
    },
    setupCode() {
      const c = this.config;
      return c ? 'INKWELL-' + btoa(JSON.stringify([c.url, c.anonKey])) : '';
    },
    applySetupCode(code) {
      const m = /INKWELL-([A-Za-z0-9+/=]+)/.exec(String(code || '').trim());
      if (!m) throw new Error('That doesn’t look like an Inkwell setup code.');
      const [url, key] = JSON.parse(atob(m[1]));
      this.configure(url, key);
    },
    forget() {
      write(CFG_KEY, null);
      write(SESSION_KEY, null);
      this.setStatus('off');
    },

    // ---------------------------------------------------------------- auth
    async auth(path, body) {
      const c = this.config;
      if (!c) throw new Error('Sync is not set up yet.');
      let res;
      try {
        res = await fetch(`${c.url}/auth/v1/${path}`, {
          method: 'POST', headers: { apikey: c.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      } catch (e) { throw new Error('Can’t reach the sync server — are you online?'); }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(friendlyError(json.error_description || json.msg || json.message || `Sign-in failed (${res.status})`));
      return json;
    },
    saveSession(json) {
      const s = {
        access_token: json.access_token, refresh_token: json.refresh_token,
        expires_at: Date.now() + (json.expires_in || 3600) * 1000 - 60 * 1000,
        user: { id: json.user.id, email: json.user.email },
      };
      write(SESSION_KEY, s);
      return s;
    },
    async signUp(email, password) {
      const json = await this.auth('signup', { email, password });
      if (json.access_token) { this.saveSession(json); this.setStatus('idle'); return { signedIn: true }; }
      return { signedIn: false }; // email confirmation required
    },
    async signIn(email, password) {
      const json = await this.auth('token?grant_type=password', { email, password });
      this.saveSession(json);
      this.setStatus('idle');
      return json.user;
    },
    async signOut() {
      const s = this.session;
      const c = this.config;
      write(SESSION_KEY, null);
      await DB.putQuiet('meta', { key: STATE_KEY, value: { cursor: 0, userId: null } });
      this.setStatus(this.config ? 'signed-out' : 'off');
      if (s && c) fetch(`${c.url}/auth/v1/logout`, { method: 'POST', headers: { apikey: c.anonKey, Authorization: `Bearer ${s.access_token}` } }).catch(() => {});
    },
    async token() {
      let s = this.session;
      if (!s) throw new Error('signed-out');
      if (Date.now() > s.expires_at) {
        try {
          s = this.saveSession(await this.auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token }));
        } catch (e) {
          if (/invalid|expired|not found/i.test(e.message)) { write(SESSION_KEY, null); this.setStatus('signed-out', 'Please sign in again.'); throw new Error('signed-out'); }
          throw e;
        }
      }
      return s.access_token;
    },

    async rest(method, query, body, prefer) {
      const c = this.config;
      const headers = { apikey: c.anonKey, Authorization: `Bearer ${await this.token()}`, 'Content-Type': 'application/json' };
      if (prefer) headers.Prefer = prefer;
      const res = await fetch(`${c.url}/rest/v1/${TABLE}${query}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 404 || /relation .* does not exist|schema cache/i.test(j.message || '')) throw new Error('The sync table is missing — run the setup SQL in your Supabase project.');
        throw new Error(friendlyError(j.message || `Sync request failed (${res.status})`));
      }
      return res.status === 204 ? null : res.json().catch(() => null);
    },

    // ---------------------------------------------------------------- sync loop
    schedule(delay = 2000) {
      if (!this.enabled) return;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this.syncNow().catch(() => {}), delay);
    },

    async syncNow() {
      if (!this.enabled) return;
      if (this._running) { this._again = true; return this._running; }
      if (!navigator.onLine) { this.setStatus('offline'); return; }
      this._running = (async () => {
        this.setStatus('syncing');
        try {
          await this.pull();
          await this.push();
          this.lastSyncAt = Date.now();
          this.setStatus('idle');
        } catch (e) {
          if (e.message === 'signed-out') return;
          const offline = !navigator.onLine || /reach|fetch|network/i.test(e.message);
          this.setStatus(offline ? 'offline' : 'error', e.message);
        } finally {
          this._running = null;
          if (this._again) { this._again = false; this.schedule(500); }
        }
      })();
      return this._running;
    },

    async state() {
      const row = await DB.get('meta', STATE_KEY);
      const st = (row && row.value) || { cursor: 0 };
      if (st.userId && this.user && st.userId !== this.user.id) return { cursor: 0, userId: this.user.id };
      return st;
    },

    async pull() {
      const st = await this.state();
      let cursor = st.cursor || 0;
      const changes = [];
      // A small overlap guards against rows committed slightly out of order; re-applying is harmless.
      const since = Math.max(0, cursor - 5000);
      for (let offset = 0; ; offset += 200) {
        const rows = await this.rest('GET', `?select=store,id,data,updated_at,deleted,synced_at&synced_at=gt.${since}&order=synced_at.asc,store.asc,id.asc&limit=200&offset=${offset}`);
        for (const r of rows) {
          cursor = Math.max(cursor, r.synced_at);
          const change = await this.applyRemote(r);
          if (change) changes.push(change);
        }
        if (rows.length < 200) break;
      }
      await DB.putQuiet('meta', { key: STATE_KEY, value: { cursor, userId: this.user && this.user.id } });
      if (changes.length) this.handlers.onRemote(changes);
    },

    async applyRemote(r) {
      if (!KEYS[r.store]) return null;
      const local = await DB.get(r.store, r.id);
      const localAt = local ? local.updatedAt || 0 : 0;
      if (r.deleted) {
        if (!local || localAt > r.updated_at) return null;
        await DB.delQuiet(r.store, r.id);
        return { store: r.store, id: r.id, deleted: true };
      }
      if (r.store === 'activity' && local) {
        // Word counts from different devices on the same day: keep the larger one.
        const remoteWords = (r.data && r.data.words) || 0;
        if (remoteWords >= (local.words || 0)) {
          const rec = { ...local, words: remoteWords, updatedAt: r.updated_at, _synced: r.updated_at };
          await DB.putQuiet('activity', rec);
          return { store: 'activity', id: r.id, record: rec };
        }
        if ((local._synced || 0) >= localAt) await DB.putQuiet('activity', { ...local, updatedAt: Math.max(localAt, r.updated_at + 1) });
        return null;
      }
      if (local && localAt >= r.updated_at) return null; // ours is as new or newer
      const rec = { ...r.data, updatedAt: r.updated_at, _synced: r.updated_at };
      await DB.putQuiet(r.store, rec);
      return { store: r.store, id: r.id, record: rec };
    },

    async push() {
      const user = this.user;
      const rows = [];
      for (const store of Object.keys(KEYS)) {
        for (const rec of await DB.all(store)) {
          if (!rec.updatedAt) rec.updatedAt = Date.now();
          if ((rec._synced || 0) >= rec.updatedAt) continue;
          const data = { ...rec };
          delete data._synced;
          rows.push({ store, id: String(rec[KEYS[store]]), data, updated_at: rec.updatedAt, deleted: false, user_id: user.id });
        }
      }
      const tombs = await DB.all('tombstones');
      tombs.forEach((t) => { if (KEYS[t.store]) rows.push({ store: t.store, id: String(t.id), data: null, updated_at: t.deletedAt, deleted: true, user_id: user.id, _tomb: t.key }); });
      // Upload in batches of roughly 2 MB (posts can carry embedded images).
      let batch = [];
      let size = 0;
      const flush = async () => {
        if (!batch.length) return;
        await this.rest('POST', '?on_conflict=user_id,store,id', batch.map(({ _tomb, ...r }) => r), 'resolution=merge-duplicates,return=minimal');
        for (const r of batch) {
          if (r._tomb) await DB.clearTombstone(r._tomb);
          else { await DB.markSynced(r.store, r.id, r.updated_at); this.handlers.onMarked(r.store, r.id, r.updated_at); }
        }
        batch = [];
        size = 0;
      };
      for (const r of rows) {
        const n = JSON.stringify(r.data || '').length;
        if (batch.length && size + n > 2e6) await flush();
        batch.push(r);
        size += n;
      }
      await flush();
    },

    /** How many records does the account already hold? Used for the first sign-in on a device. */
    async remoteCount() {
      const rows = await this.rest('GET', '?select=id&deleted=eq.false&store=in.(projects,posts)&limit=1000');
      return rows.length;
    },

    /** Wipe this device's projects/posts so the account's copy replaces them. */
    async resetLocal() {
      for (const s of ['projects', 'posts', 'activity', 'tombstones', 'versions']) await DB.clear(s);
      await DB.putQuiet('meta', { key: STATE_KEY, value: { cursor: 0, userId: this.user && this.user.id } });
    },
    /** Mark everything local as needing upload (merge mode). */
    async markAllDirty() {
      for (const store of Object.keys(KEYS)) {
        const all = await DB.all(store);
        for (const r of all) { r._synced = 0; r.updatedAt = Math.max(r.updatedAt || 0, 1); await DB.putQuiet(store, r); }
      }
      await DB.putQuiet('meta', { key: STATE_KEY, value: { cursor: 0, userId: this.user && this.user.id } });
    },
  };

  window.Sync = Sync;
})();
