/* Inkwell AI — optional rewrite suggestions and translation.
 *
 * Two providers, chosen in Settings → AI:
 *   • "local"  — a free model running on this computer through Ollama (ollama.com). Free, offline, private.
 *   • "claude" — Claude, Anthropic's AI, with the writer's own API key (paid per use, best quality).
 *
 * Nothing is sent anywhere until the writer asks for a rewrite or translation. With Claude, only the
 * selected passage, its paragraph and the post title go to Anthropic. With a local model, nothing
 * leaves the computer. Settings live in this device's localStorage only — never synced or backed up.
 */
(function () {
  'use strict';

  const STORE_KEY = 'inkwell.ai';

  const MODELS = [
    { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', note: 'Best quality · $4 / $20 per million tokens' },
    { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', note: 'Fast and strong · $2 / $10 per million tokens' },
    { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', note: 'Fastest and cheapest · $0.10 / $0.50 per million tokens' },
  ];
  const DEFAULT_MODEL = 'claude-opus-5-5';

  // Free models suggested for Ollama. Sizes are the download size.
  const LOCAL_MODELS = [
    { id: 'gemma3:4b', name: 'Gemma 3 · 4B', size: '3.3 GB', note: 'Recommended — good writing, understands 140+ languages including Tamil. Needs 8 GB RAM.' },
    { id: 'qwen2.5:7b', name: 'Qwen 2.5 · 7B', size: '4.7 GB', note: 'Higher quality, multilingual. Needs 16 GB RAM.' },
    { id: 'llama3.2:3b', name: 'Llama 3.2 · 3B', size: '2.0 GB', note: 'Fast, English-focused. Needs 8 GB RAM.' },
    { id: 'gemma3:1b', name: 'Gemma 3 · 1B', size: '815 MB', note: 'Tiny and very fast; simpler suggestions.' },
  ];
  const DEFAULT_LOCAL_MODEL = 'gemma3:4b';
  const DEFAULT_HOST = 'http://localhost:11434';

  const MODES = {
    improve: { label: 'Improve', instruction: 'Make it clearer, smoother and more engaging, keeping the meaning and the writer’s voice.' },
    shorter: { label: 'Shorter', instruction: 'Make it noticeably more concise. Cut filler and redundancy without losing meaning.' },
    clearer: { label: 'Clearer', instruction: 'Make it easier to understand on a first read. Prefer plain words and, where it helps, split long sentences.' },
    vivid: { label: 'More vivid', instruction: 'Make it more vivid and specific, with stronger verbs and concrete images, without inventing facts.' },
    formal: { label: 'More formal', instruction: 'Make the tone more polished and professional.' },
    casual: { label: 'More casual', instruction: 'Make the tone warmer and more conversational, like talking to a friend.' },
    fix: { label: 'Fix grammar', instruction: 'Only correct grammar, spelling and punctuation. Change as little as possible.' },
    ta: { label: '→ தமிழ்', instruction: 'Translate the passage into natural, fluent Tamil (தமிழ்) written in Tamil script. Offer, in this order: a natural written-Tamil translation, a warmer conversational one, and a close literal one. Keep names, numbers and links unchanged. Labels must be in English.', translate: true },
    en: { label: '→ English', instruction: 'Translate the passage into natural, fluent English. Offer, in this order: a natural translation, a more conversational one, and a close literal one. Keep names, numbers and links unchanged.', translate: true },
  };

  const SYSTEM = `You are a skilled line editor helping a blogger improve passages from their own drafts.

When given a passage, return three alternative rewrites that each take a different approach, best first.
- Keep the writer's meaning, facts, point of view and voice. Never add claims, statistics, names or links that are not in the original.
- Keep names, numbers, quotes and links exactly as written.
- Write in the same language and spelling conventions (for example British or American) as the original, unless the goal asks for a translation.
- The passage is part of a longer post; the surrounding paragraph and title are given only as context. Rewrite only the passage itself.
- "text" is the rewritten passage alone, ready to paste in place of the original: no surrounding quotation marks, no commentary.
- "label" names the approach in one to three words (for example "Tighter", "Active voice", "Punchier opening").
- "why" is one short sentence telling the writer what changed and why it reads better.`;

  const SCHEMA = {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: { text: { type: 'string' }, label: { type: 'string' }, why: { type: 'string' } },
          required: ['text', 'label', 'why'],
          additionalProperties: false,
        },
      },
    },
    required: ['suggestions'],
    additionalProperties: false,
  };

  const TRANSLATE_SYSTEM = `You are a professional translator for a blogger. You translate their posts faithfully and naturally.
- Translate every item in the given JSON array, in order, and return exactly one translation per item.
- Keep the meaning, tone and voice. Keep names, numbers, URLs, @handles and #hashtags unchanged.
- Write Tamil in Tamil script (தமிழ்), using natural modern written Tamil.
- Each item is one paragraph, heading or list item: translate only what is in it, with no notes or explanations.`;

  const TRANSLATE_SCHEMA = {
    type: 'object',
    properties: { translations: { type: 'array', items: { type: 'string' } } },
    required: ['translations'],
    additionalProperties: false,
  };

  const LANGS = { ta: 'Tamil (தமிழ்)', en: 'English' };

  class AIError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }

  const read = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; } };
  const write = (v) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };

  function friendly(err) {
    const A = window.AnthropicSDK && window.AnthropicSDK.Anthropic;
    if (err instanceof AIError) return err;
    if (A) {
      if (err instanceof A.APIUserAbortError) return new AIError('aborted', 'Cancelled.');
      if (err instanceof A.AuthenticationError) return new AIError('auth', 'Anthropic didn’t accept that API key. Check it in Settings → AI.');
      if (err instanceof A.PermissionDeniedError) return new AIError('permission', 'This API key isn’t allowed to use that model. Try another model in Settings → AI.');
      if (err instanceof A.NotFoundError) return new AIError('model', 'That model isn’t available to your account. Pick another one in Settings → AI.');
      if (err instanceof A.RateLimitError) return new AIError('rate', 'Too many requests right now — wait a moment and try again.');
      if (err instanceof A.BadRequestError) {
        if (/credit|billing|balance/i.test(err.message)) return new AIError('billing', 'Your Anthropic account is out of credit. Add credit at console.anthropic.com, then try again.');
        return new AIError('bad-request', `Anthropic rejected the request: ${err.message}`);
      }
      if (err instanceof A.APIConnectionError) return new AIError('network', navigator.onLine ? 'Couldn’t reach Anthropic. Check your connection and try again.' : 'You’re offline. Switch to the free offline model in Settings → AI, or reconnect.');
      if (err instanceof A.InternalServerError) return new AIError('server', 'Anthropic is having trouble right now. Try again in a minute.');
      if (err instanceof A.APIError) return new AIError('api', `Anthropic error ${err.status || ''}: ${err.message}`);
    }
    if (err && err.name === 'AbortError') return new AIError('aborted', 'Cancelled.');
    return new AIError('unknown', err && err.message ? err.message : 'Something went wrong.');
  }

  // ---------------------------------------------------------------- local model transport (Ollama)
  // In the desktop app, requests go through the main process (no browser CORS rules, localhost only).
  // In a browser they go straight to Ollama, which must allow the page's origin (see the setup guide).
  const native = () => (typeof window !== 'undefined' && window.inkwellNative) || null;

  async function localCall(host, path, body, { signal, timeout = 5 * 60 * 1000 } = {}) {
    const url = host.replace(/\/+$/, '') + path;
    let status, text;
    try {
      if (native() && native().localFetch) {
        const res = await native().localFetch({ url, method: body ? 'POST' : 'GET', body, timeoutMs: timeout });
        status = res.status; text = res.text;
      } else {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeout);
        if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true });
        try {
          const res = await fetch(url, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
          status = res.status; text = await res.text();
        } finally { clearTimeout(timer); }
      }
    } catch (err) {
      if (signal && signal.aborted) throw new AIError('aborted', 'Cancelled.');
      throw new AIError('local-offline', 'Can’t reach the local AI. Make sure the Ollama app is installed and running, then try again.');
    }
    if (signal && signal.aborted) throw new AIError('aborted', 'Cancelled.');
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
    if (status === 403) throw new AIError('local-origin', 'Ollama refused this page. Use the Inkwell desktop app, or allow this site in Ollama (see Settings → AI → Free offline model).');
    if (status === 404 && json && /model/i.test(json.error || '')) throw new AIError('local-model', `The model isn’t downloaded yet. Download it in Settings → AI.`);
    if (status >= 400) throw new AIError('local-error', `Local AI error: ${(json && json.error) || text || status}`);
    return json;
  }

  function parseJSONLoose(text) {
    const t = String(text || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    try { return JSON.parse(t); } catch (e) {
      const m = /\{[\s\S]*\}/.exec(t);
      if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* fall through */ } }
      return null;
    }
  }

  const AI = {
    MODELS,
    LOCAL_MODELS,
    MODES,
    LANGS,
    AIError,
    get settings() {
      const s = read();
      return {
        provider: s.provider || (s.apiKey ? 'claude' : 'local'),
        apiKey: s.apiKey || '',
        model: s.model || DEFAULT_MODEL,
        localHost: s.localHost || DEFAULT_HOST,
        localModel: s.localModel || DEFAULT_LOCAL_MODEL,
        localReady: !!s.localReady,
      };
    },
    /** True when the chosen provider has what it needs (a key, or a local model that has worked). */
    get configured() {
      const s = this.settings;
      return s.provider === 'claude' ? !!s.apiKey : s.localReady;
    },
    get available() { return !!(window.AnthropicSDK && window.AnthropicSDK.Anthropic); },
    get isNative() { return !!native(); },
    modelName(id) {
      const m = MODELS.find((x) => x.id === id) || LOCAL_MODELS.find((x) => x.id === id);
      return m ? m.name : id;
    },
    /** Short description of what's in use, e.g. "Gemma 3 · 4B (offline)". */
    get activeName() {
      const s = this.settings;
      return s.provider === 'claude' ? this.modelName(s.model) : `${this.modelName(s.localModel)} (offline)`;
    },

    save(patch) {
      const cur = read();
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) cur[k] = typeof v === 'string' ? v.trim() : v;
      write(cur);
    },
    forget() { const cur = read(); delete cur.apiKey; if (cur.provider === 'claude') cur.provider = 'local'; write(cur); },

    // ---------------------------------------------------------------- local model management
    /** Is Ollama running? Returns the list of downloaded models, or throws. */
    async localModels(host = this.settings.localHost) {
      const res = await localCall(host, '/api/tags', null, { timeout: 4000 });
      return (res && res.models ? res.models : []).map((m) => ({ id: m.name || m.model, size: m.size || 0 }));
    },

    /** Download a model through Ollama, reporting progress (0–1). */
    async pullLocal(model, onProgress = () => {}, { host = this.settings.localHost, signal } = {}) {
      const url = host.replace(/\/+$/, '') + '/api/pull';
      const handle = (evt) => {
        if (evt.error) throw new AIError('local-error', evt.error);
        const pct = evt.total ? evt.completed / evt.total : null;
        onProgress({ status: evt.status || '', pct });
      };
      if (native() && native().localPull) {
        const off = native().onLocalPullProgress((evt) => { try { handle(evt); } catch (e) { /* surfaced by the final result */ } });
        try {
          const res = await native().localPull({ url, model });
          if (res && res.error) throw new AIError('local-error', res.error);
        } catch (err) {
          throw err instanceof AIError ? err : new AIError('local-offline', 'Can’t reach the local AI. Make sure the Ollama app is running.');
        } finally { off(); }
        return;
      }
      let res;
      try {
        res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, stream: true }), signal });
      } catch (err) {
        if (signal && signal.aborted) throw new AIError('aborted', 'Cancelled.');
        throw new AIError('local-offline', 'Can’t reach the local AI. Make sure the Ollama app is installed and running.');
      }
      if (res.status === 403) throw new AIError('local-origin', 'Ollama refused this page — use the desktop app or allow this site in Ollama.');
      if (!res.ok || !res.body) throw new AIError('local-error', `Download failed (${res.status}).`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) handle(JSON.parse(line));
        }
      }
    },

    // ---------------------------------------------------------------- one JSON request, either provider
    async _json({ system, prompt, schema, effort, signal, temperature = 0.6 }) {
      const s = this.settings;
      if (s.provider === 'local') {
        const res = await localCall(s.localHost, '/api/chat', {
          model: s.localModel,
          stream: false,
          format: schema, // Ollama structured outputs: the reply is constrained to this JSON schema
          options: { temperature },
          messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        }, { signal });
        const out = parseJSONLoose(res && res.message && res.message.content);
        if (!out) throw new AIError('format', 'The local model’s reply couldn’t be read. Try again, or try a larger model.');
        return { out, model: s.localModel };
      }
      if (!this.available) throw new AIError('sdk', 'The AI component didn’t load. Reload Inkwell and try again.');
      if (!s.apiKey) throw new AIError('setup', 'Add your Anthropic API key in Settings → AI, or switch to the free offline model.');
      if (!navigator.onLine) throw new AIError('network', 'You’re offline. Switch to the free offline model in Settings → AI, or reconnect.');
      const { Anthropic, jsonSchemaOutputFormat } = window.AnthropicSDK;
      const client = new Anthropic({ apiKey: s.apiKey, dangerouslyAllowBrowser: true, timeout: 120 * 1000, maxRetries: 2 });
      // Server-side refusal fallback: if a policy check declines the request, Anthropic retries it on a
      // recommended model inside the same call. Claude Haiku 5.5 has no server-side fallback.
      const fallback = s.model === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
      let response;
      try {
        response = await client.beta.messages.parse({
          model: s.model,
          max_tokens: 16000,
          ...fallback,
          output_config: { effort, format: jsonSchemaOutputFormat(schema) },
          system,
          messages: [{ role: 'user', content: prompt }],
        }, { signal });
      } catch (err) {
        throw friendly(err);
      }
      if (response.stop_reason === 'refusal') throw new AIError('refusal', 'Claude declined this request.');
      if (response.stop_reason === 'max_tokens') throw new AIError('truncated', 'The response was cut off — try a shorter selection.');
      if (!response.parsed_output) throw new AIError('format', 'Claude’s reply couldn’t be read. Try again.');
      return { out: response.parsed_output, model: response.model || s.model };
    },

    /**
     * Rewrite suggestions for `text`.
     * @returns {Promise<{suggestions: {text,label,why}[], model: string}>}
     */
    async rewrite({ text, paragraph = '', title = '', mode = 'improve', focus = '', signal } = {}) {
      const original = String(text || '').trim();
      if (!original) throw new AIError('empty', 'Select some text to rewrite first.');
      if (original.length > 4000) throw new AIError('too-long', 'That selection is long — rewrite a paragraph or two at a time.');
      const m = MODES[mode] || MODES.improve;
      const prompt = [
        title ? `<post_title>${title}</post_title>` : '',
        paragraph && paragraph.trim() !== original ? `<paragraph_context>${paragraph}</paragraph_context>` : '',
        `<passage>${original}</passage>`,
        `Goal: ${m.instruction}${focus ? ` In particular: ${focus}` : ''}`,
      ].filter(Boolean).join('\n\n');
      // Rewriting a passage is a short, well-defined task: low effort keeps it quick and inexpensive.
      const { out, model } = await this._json({ system: SYSTEM, prompt, schema: SCHEMA, effort: 'low', signal });
      if (!Array.isArray(out.suggestions)) throw new AIError('format', 'The AI’s reply couldn’t be read. Try again.');
      const seen = new Set([original.toLowerCase()]);
      const suggestions = out.suggestions
        .map((s) => ({ text: String(s.text || '').trim().replace(/^["“](.*)["”]$/s, '$1'), label: String(s.label || '').trim(), why: String(s.why || '').trim() }))
        .filter((s) => s.text && !seen.has(s.text.toLowerCase()) && seen.add(s.text.toLowerCase()))
        .slice(0, 4);
      if (!suggestions.length) throw new AIError('no-change', 'This passage already reads well — no changes suggested.');
      return { suggestions, model, translate: !!m.translate };
    },

    /**
     * Translate a list of texts (paragraphs, headings, list items) into `target` ('ta' or 'en').
     * Long posts are sent in batches; `onProgress(done, total)` reports progress.
     */
    async translate({ texts, target = 'ta', signal, onProgress = () => {} }) {
      const items = texts.map((t) => String(t || ''));
      const results = new Array(items.length).fill('');
      const batches = [];
      let cur = [];
      let size = 0;
      items.forEach((t, i) => {
        if (!t.trim()) return;
        if (cur.length && (cur.length >= 20 || size + t.length > 5000)) { batches.push(cur); cur = []; size = 0; }
        cur.push(i);
        size += t.length;
      });
      if (cur.length) batches.push(cur);
      let done = 0;
      let model = '';
      onProgress(0, items.length);
      for (const batch of batches) {
        const payload = batch.map((i) => items[i]);
        const prompt = `Translate each item into ${LANGS[target] || target}. Return a JSON object whose "translations" array has exactly ${payload.length} strings, in the same order.\n\n${JSON.stringify(payload, null, 1)}`;
        const r = await this._json({ system: TRANSLATE_SYSTEM, prompt, schema: TRANSLATE_SCHEMA, effort: 'medium', signal, temperature: 0.2 });
        model = r.model;
        let list = Array.isArray(r.out.translations) ? r.out.translations : [];
        if (list.length !== payload.length) {
          // Mismatched count: fall back to one request per item so nothing lands in the wrong place.
          list = [];
          for (const text of payload) {
            const one = await this._json({ system: TRANSLATE_SYSTEM, prompt: `Translate the single item into ${LANGS[target] || target}. Return {"translations": ["…"]}.\n\n${JSON.stringify([text])}`, schema: TRANSLATE_SCHEMA, effort: 'medium', signal, temperature: 0.2 });
            list.push((one.out.translations || [])[0] || text);
          }
        }
        batch.forEach((idx, j) => { results[idx] = String(list[j] || items[idx]); });
        done += batch.length;
        onProgress(done, items.length);
      }
      return { translations: results, model };
    },

    /** Cheap check that the chosen provider works. */
    async test() {
      try {
        const r = await this.rewrite({ text: 'This sentence are a test of the the rewrite feature.', mode: 'fix' });
        return r.model;
      } catch (err) {
        if (err.code === 'no-change') return this.settings.provider === 'claude' ? this.settings.model : this.settings.localModel;
        throw err;
      }
    },
  };

  window.AI = AI;
})();
