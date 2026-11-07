/* Inkwell AI — optional sentence rewrites powered by Claude, using the user's own Anthropic API key.
 *
 * Nothing is sent anywhere until the writer presses "Rewrite". Then only the selected passage,
 * its surrounding paragraph and the post title go to Anthropic's API, directly from this device.
 * The key lives in this device's localStorage only — it is never synced, exported or backed up.
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

  const MODES = {
    improve: { label: 'Improve', instruction: 'Make it clearer, smoother and more engaging, keeping the meaning and the writer’s voice.' },
    shorter: { label: 'Shorter', instruction: 'Make it noticeably more concise. Cut filler and redundancy without losing meaning.' },
    clearer: { label: 'Clearer', instruction: 'Make it easier to understand on a first read. Prefer plain words and, where it helps, split long sentences.' },
    vivid: { label: 'More vivid', instruction: 'Make it more vivid and specific, with stronger verbs and concrete images, without inventing facts.' },
    formal: { label: 'More formal', instruction: 'Make the tone more polished and professional.' },
    casual: { label: 'More casual', instruction: 'Make the tone warmer and more conversational, like talking to a friend.' },
    fix: { label: 'Fix grammar', instruction: 'Only correct grammar, spelling and punctuation. Change as little as possible.' },
  };

  const SYSTEM = `You are a skilled line editor helping a blogger improve passages from their own drafts.

When given a passage, return three alternative rewrites that each take a different approach, best first.
- Keep the writer's meaning, facts, point of view and voice. Never add claims, statistics, names or links that are not in the original.
- Keep names, numbers, quotes and links exactly as written.
- Write in the same language and spelling conventions (for example British or American) as the original.
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
          properties: {
            text: { type: 'string' },
            label: { type: 'string' },
            why: { type: 'string' },
          },
          required: ['text', 'label', 'why'],
          additionalProperties: false,
        },
      },
    },
    required: ['suggestions'],
    additionalProperties: false,
  };

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
      if (err instanceof A.AuthenticationError) return new AIError('auth', 'Anthropic didn’t accept that API key. Check it in Settings → AI rewrite.');
      if (err instanceof A.PermissionDeniedError) return new AIError('permission', 'This API key isn’t allowed to use that model. Try another model in Settings → AI rewrite.');
      if (err instanceof A.NotFoundError) return new AIError('model', 'That model isn’t available to your account. Pick another one in Settings → AI rewrite.');
      if (err instanceof A.RateLimitError) return new AIError('rate', 'Too many requests right now — wait a moment and try again.');
      if (err instanceof A.BadRequestError) {
        if (/credit|billing|balance/i.test(err.message)) return new AIError('billing', 'Your Anthropic account is out of credit. Add credit at console.anthropic.com, then try again.');
        return new AIError('bad-request', `Anthropic rejected the request: ${err.message}`);
      }
      if (err instanceof A.APIConnectionError) return new AIError('network', navigator.onLine ? 'Couldn’t reach Anthropic. Check your connection and try again.' : 'You’re offline. AI rewrite needs the internet — offline proofreading still works.');
      if (err instanceof A.InternalServerError) return new AIError('server', 'Anthropic is having trouble right now. Try again in a minute.');
      if (err instanceof A.APIError) return new AIError('api', `Anthropic error ${err.status || ''}: ${err.message}`);
    }
    return new AIError('unknown', err && err.message ? err.message : 'Something went wrong.');
  }

  const AI = {
    MODELS,
    MODES,
    AIError,
    get settings() { const s = read(); return { apiKey: s.apiKey || '', model: s.model || DEFAULT_MODEL }; },
    get configured() { return !!read().apiKey; },
    get available() { return !!(window.AnthropicSDK && window.AnthropicSDK.Anthropic); },
    modelName(id) { const m = MODELS.find((x) => x.id === id); return m ? m.name : id; },

    save({ apiKey, model }) {
      const cur = read();
      if (apiKey !== undefined) cur.apiKey = String(apiKey).trim();
      if (model !== undefined) cur.model = model;
      write(cur);
    },
    forget() { const cur = read(); delete cur.apiKey; write(cur); },

    /**
     * Ask Claude for rewrites of `text`.
     * @returns {Promise<{suggestions: {text,label,why}[], model: string}>}
     */
    async rewrite({ text, paragraph = '', title = '', mode = 'improve', focus = '', signal } = {}) {
      if (!this.available) throw new AIError('sdk', 'The AI component didn’t load. Reload Inkwell and try again.');
      const { apiKey, model } = this.settings;
      if (!apiKey) throw new AIError('setup', 'Add your Anthropic API key in Settings → AI rewrite to use this.');
      if (!navigator.onLine) throw new AIError('network', 'You’re offline. AI rewrite needs the internet — offline proofreading still works.');
      const original = String(text || '').trim();
      if (!original) throw new AIError('empty', 'Select some text to rewrite first.');
      if (original.length > 4000) throw new AIError('too-long', 'That selection is long — rewrite a paragraph or two at a time.');

      const { Anthropic, jsonSchemaOutputFormat } = window.AnthropicSDK;
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, timeout: 90 * 1000, maxRetries: 2 });
      const instruction = (MODES[mode] || MODES.improve).instruction;
      const prompt = [
        title ? `<post_title>${title}</post_title>` : '',
        paragraph && paragraph.trim() !== original ? `<paragraph_context>${paragraph}</paragraph_context>` : '',
        `<passage>${original}</passage>`,
        `Goal: ${instruction}${focus ? ` In particular: ${focus}` : ''}`,
      ].filter(Boolean).join('\n\n');

      // Server-side refusal fallback: if a policy check declines the request, Anthropic retries it on a
      // recommended model inside the same call. Claude Haiku 5.5 has no server-side fallback.
      const fallback = model === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
      let response;
      try {
        response = await client.beta.messages.parse({
          model,
          max_tokens: 16000,
          ...fallback,
          // Rewriting a passage is a short, well-defined task: low effort keeps it quick and inexpensive.
          output_config: { effort: 'low', format: jsonSchemaOutputFormat(SCHEMA) },
          system: SYSTEM,
          messages: [{ role: 'user', content: prompt }],
        }, { signal });
      } catch (err) {
        throw friendly(err);
      }

      if (response.stop_reason === 'refusal') throw new AIError('refusal', 'Claude declined to rewrite this passage.');
      if (response.stop_reason === 'max_tokens') throw new AIError('truncated', 'The response was cut off — try a shorter selection.');
      const out = response.parsed_output;
      if (!out || !Array.isArray(out.suggestions)) throw new AIError('format', 'Claude’s reply couldn’t be read. Try again.');

      const seen = new Set([original.toLowerCase()]);
      const suggestions = out.suggestions
        .map((s) => ({ text: String(s.text || '').trim().replace(/^["“](.*)["”]$/s, '$1'), label: String(s.label || '').trim(), why: String(s.why || '').trim() }))
        .filter((s) => s.text && !seen.has(s.text.toLowerCase()) && seen.add(s.text.toLowerCase()))
        .slice(0, 4);
      if (!suggestions.length) throw new AIError('no-change', 'Claude thinks this passage already reads well — no changes suggested.');
      return { suggestions, model: response.model || model };
    },

    /** Cheap check that the key and model work. */
    async test() {
      const r = await this.rewrite({ text: 'This sentence are a test of the the rewrite feature.', mode: 'fix' });
      return r.model;
    },
  };

  window.AI = AI;
})();
