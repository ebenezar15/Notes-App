/* Inkwell writing tools — templates, headline analysis, offline thesaurus, read-aloud and focus sounds.
 * Pure helpers with no UI; app.js wires them into the interface. Works in Node too (for tests). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Tools = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------------ templates
  const TEMPLATES = [
    {
      id: 'howto', emoji: '🛠️', name: 'How-to guide', hint: 'Teach one thing, step by step',
      subtitle: 'A step-by-step guide to [result] — without [common pain].',
      content: `<p>[Open with the problem your reader has. One or two sentences they will nod along to.]</p>
<p>By the end of this post you'll know how to [result], even if [objection].</p>
<h2>What you'll need</h2>
<ul><li>[Tool, skill or resource]</li><li>[Tool, skill or resource]</li></ul>
<h2>Step 1: [Do the first thing]</h2><p>[Explain the step. Why it matters, then how to do it.]</p>
<h2>Step 2: [Do the next thing]</h2><p>[Explain the step. Add an example or a screenshot.]</p>
<h2>Step 3: [Finish]</h2><p>[Explain the step and what "done" looks like.]</p>
<h2>Common mistakes</h2>
<ul><li>[Mistake and how to avoid it]</li><li>[Mistake and how to avoid it]</li></ul>
<h2>Wrap-up</h2><p>[Recap the result in one sentence, then give one next step.]</p>`,
    },
    {
      id: 'listicle', emoji: '🔢', name: 'List post', hint: 'Numbered ideas, tools or lessons',
      subtitle: '[Number] [things] that [benefit] — and one that surprised me.',
      content: `<p>[Why this list exists. What you tried, read or learned that earns you the right to write it.]</p>
<h2>1. [First item]</h2><p>[What it is, why it matters, one concrete example.]</p>
<h2>2. [Second item]</h2><p>[What it is, why it matters, one concrete example.]</p>
<h2>3. [Third item]</h2><p>[What it is, why it matters, one concrete example.]</p>
<h2>4. [Fourth item]</h2><p>[What it is, why it matters, one concrete example.]</p>
<h2>5. [The surprising one]</h2><p>[Save your most counter-intuitive point for last.]</p>
<hr><p>[Which one will you try first? Ask readers to reply.]</p>`,
    },
    {
      id: 'essay', emoji: '✍️', name: 'Personal essay', hint: 'A story with a point',
      subtitle: 'What [experience] taught me about [bigger idea].',
      content: `<p>[Start in a scene: a specific moment, place and feeling. Put the reader in it.]</p>
<p>[Raise the question or tension the essay will explore.]</p>
<h2>[What happened]</h2><p>[Tell the story. Concrete details beat adjectives.]</p>
<h2>[What I got wrong]</h2><p>[The turn: the mistake, surprise or realisation.]</p>
<blockquote>[The one line you want readers to remember.]</blockquote>
<h2>[What I believe now]</h2><p>[Zoom out from your story to what it means for the reader.]</p>`,
    },
    {
      id: 'review', emoji: '⭐', name: 'Review', hint: 'Book, product, course or tool',
      subtitle: 'An honest review of [name] — who it’s for and who should skip it.',
      content: `<p><strong>The short version:</strong> [one-sentence verdict].</p>
<ul><li><strong>Best for:</strong> [who]</li><li><strong>Skip it if:</strong> [who]</li><li><strong>Rating:</strong> [x/5]</li></ul>
<h2>What it is</h2><p>[Describe it in plain words.]</p>
<h2>What I liked</h2><ul><li>[Strength]</li><li>[Strength]</li></ul>
<h2>What could be better</h2><ul><li>[Weakness]</li><li>[Weakness]</li></ul>
<h2>Favourite takeaway</h2><blockquote>[A quote or highlight.]</blockquote>
<h2>Verdict</h2><p>[Would you recommend it? To whom?]</p>`,
    },
    {
      id: 'roundup', emoji: '🗞️', name: 'Weekly roundup', hint: 'Links and thoughts from the week',
      subtitle: 'This week: [theme] — plus [number] things worth your time.',
      content: `<p>Hi friends — [one-line personal note about your week].</p>
<h2>📌 The big idea</h2><p>[A short take on the most important thing you saw this week.]</p>
<h2>🔗 Worth reading</h2>
<ul><li><strong>[Title]</strong> — [why it's worth reading]</li><li><strong>[Title]</strong> — [why it's worth reading]</li><li><strong>[Title]</strong> — [why it's worth reading]</li></ul>
<h2>💬 Quote of the week</h2><blockquote>[Quote] — [Who said it]</blockquote>
<h2>👋 Until next week</h2><p>[Sign-off and a question for readers to reply to.]</p>`,
    },
    {
      id: 'interview', emoji: '🎙️', name: 'Interview / Q&A', hint: 'A conversation with someone',
      subtitle: 'A conversation with [name] on [topic].',
      content: `<p>[Introduce the guest: who they are and why readers should care, in two sentences.]</p>
<h3>[Your first question?]</h3><p>[Their answer.]</p>
<h3>[Your second question?]</h3><p>[Their answer.]</p>
<h3>[Your third question?]</h3><p>[Their answer.]</p>
<blockquote>[The most quotable line from the conversation.]</blockquote>
<h3>[Where can people find you?]</h3><p>[Links and handles.]</p>`,
    },
    {
      id: 'casestudy', emoji: '📈', name: 'Case study', hint: 'Before, what changed, after',
      subtitle: 'How [who] went from [before] to [after] in [time].',
      content: `<p><strong>The result:</strong> [the headline number or outcome].</p>
<h2>The situation</h2><p>[Where things stood before. Include a number if you can.]</p>
<h2>The challenge</h2><p>[What made it hard.]</p>
<h2>What we did</h2><ol><li>[Action]</li><li>[Action]</li><li>[Action]</li></ol>
<h2>The results</h2><ul><li>[Metric before → after]</li><li>[Metric before → after]</li></ul>
<h2>What you can steal</h2><p>[The lesson the reader can apply today.]</p>`,
    },
  ];

  // ------------------------------------------------------------------ headline analysis
  const POWER = ['secret', 'proven', 'simple', 'easy', 'mistake', 'mistakes', 'truth', 'lessons', 'ultimate', 'essential', 'surprising',
    'honest', 'hidden', 'quick', 'powerful', 'best', 'worst', 'never', 'always', 'stop', 'start', 'why', 'how', 'little', 'unexpected',
    'everything', 'nobody', 'free', 'new', 'guide', 'complete', 'real', 'brutal', 'hard', 'simple', 'actually', 'finally', 'instantly'];
  const EMOTION = ['love', 'hate', 'fear', 'afraid', 'happy', 'joy', 'lonely', 'grief', 'hope', 'angry', 'regret', 'proud', 'shame',
    'burnout', 'anxious', 'calm', 'brave', 'broke', 'lost', 'quit', 'failed', 'failure', 'won', 'dream', 'heart', 'tears', 'alone', 'enough'];
  const CLICKBAIT = /you won'?t believe|shocking|mind[- ]?blowing|this one trick|will blow your mind|doctors hate/i;

  function headline(title, subtitle = '') {
    const t = String(title || '').trim();
    const words = t ? t.split(/\s+/) : [];
    const lower = words.map((w) => w.toLowerCase().replace(/[^a-z0-9']/g, ''));
    const checks = [];
    let score = 30;
    const add = (ok, label, hint, pts) => { checks.push({ ok, label, hint }); if (ok) score += pts; };

    add(t.length >= 30 && t.length <= 70, 'Length', t.length < 30 ? `${t.length} characters — a little short; aim for 30–70` : t.length > 70 ? `${t.length} characters — inboxes may cut it off after ~60–70` : `${t.length} characters — fits in inboxes`, 18);
    add(words.length >= 5 && words.length <= 13, 'Word count', `${words.length} words${words.length < 5 ? ' — add specifics' : words.length > 13 ? ' — try trimming' : ''}`, 10);
    const power = lower.filter((w) => POWER.includes(w));
    add(power.length > 0, 'Power words', power.length ? power.map((w) => `“${w}”`).join(', ') : 'Try a word like “honest”, “simple”, “mistakes” or “why”', 12);
    const emo = lower.filter((w) => EMOTION.includes(w));
    add(emo.length > 0, 'Emotion', emo.length ? emo.map((w) => `“${w}”`).join(', ') : 'A feeling word helps readers care', 8);
    const hasNumber = /\d/.test(t) || /\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\b/i.test(t);
    add(hasNumber, 'Specific number', hasNumber ? 'Numbers make promises concrete' : 'Optional: a number (“7 lessons”, “in 30 days”)', 8);
    const form = /^(how|why|what|when|the \d|\d)/i.test(t) || /\?$/.test(t) || /\b(i|my|we)\b/i.test(t);
    add(form, 'Clear angle', form ? 'Reads as a promise, question or personal story' : 'Try starting with How / Why / What, or make it personal', 8);
    const clean = t && t !== t.toUpperCase() && !/[.!]$/.test(t) && !CLICKBAIT.test(t);
    add(clean, 'Clean style', !t ? 'Add a title' : t === t.toUpperCase() ? 'Avoid ALL CAPS' : /[.!]$/.test(t) ? 'Headlines usually drop the final period' : CLICKBAIT.test(t) ? 'Sounds like clickbait — readers and spam filters dislike it' : 'No caps-lock or clickbait', 8);
    if (subtitle && subtitle.trim()) score += 4;
    score = Math.max(0, Math.min(100, t ? score : 0));
    const grade = score >= 85 ? 'Excellent' : score >= 70 ? 'Strong' : score >= 50 ? 'Okay' : 'Needs work';
    return { score, grade, checks, chars: t.length, words: words.length };
  }

  // ------------------------------------------------------------------ offline thesaurus (common blog words)
  const THESAURUS = {
    good: ['excellent', 'great', 'solid', 'fine', 'worthwhile', 'valuable'], bad: ['poor', 'awful', 'flawed', 'harmful', 'unpleasant'],
    big: ['large', 'huge', 'major', 'vast', 'significant'], small: ['little', 'tiny', 'minor', 'modest', 'compact'],
    important: ['crucial', 'vital', 'key', 'essential', 'significant'], interesting: ['fascinating', 'intriguing', 'compelling', 'curious'],
    hard: ['difficult', 'tough', 'demanding', 'challenging'], easy: ['simple', 'effortless', 'straightforward', 'painless'],
    fast: ['quick', 'rapid', 'swift', 'speedy'], slow: ['gradual', 'unhurried', 'sluggish', 'leisurely'],
    happy: ['glad', 'delighted', 'cheerful', 'content', 'thrilled'], sad: ['unhappy', 'down', 'gloomy', 'heartbroken'],
    beautiful: ['lovely', 'stunning', 'gorgeous', 'striking'], ugly: ['unsightly', 'unattractive', 'hideous'],
    smart: ['clever', 'bright', 'sharp', 'wise', 'insightful'], new: ['fresh', 'novel', 'recent', 'modern'],
    old: ['aged', 'dated', 'vintage', 'longstanding'], many: ['numerous', 'countless', 'plenty of', 'a host of'],
    show: ['reveal', 'demonstrate', 'display', 'illustrate'], use: ['apply', 'employ', 'rely on', 'draw on'],
    get: ['obtain', 'gain', 'earn', 'receive'], make: ['create', 'build', 'craft', 'produce'], help: ['assist', 'support', 'aid', 'guide'],
    think: ['believe', 'reckon', 'suspect', 'consider'], say: ['state', 'mention', 'note', 'claim', 'remark'],
    said: ['noted', 'explained', 'remarked', 'admitted', 'replied'], look: ['glance', 'gaze', 'peer', 'examine'],
    see: ['notice', 'spot', 'observe', 'recognise'], want: ['wish', 'crave', 'desire', 'hope for'], need: ['require', 'must have', 'depend on'],
    start: ['begin', 'launch', 'kick off', 'open'], end: ['finish', 'close', 'wrap up', 'conclude'], change: ['shift', 'alter', 'transform', 'adjust'],
    try: ['attempt', 'test', 'experiment with', 'give it a go'], keep: ['retain', 'hold onto', 'maintain', 'preserve'],
    give: ['offer', 'provide', 'hand over', 'share'], find: ['discover', 'uncover', 'locate', 'come across'],
    learn: ['discover', 'pick up', 'master', 'grasp'], write: ['draft', 'compose', 'pen', 'jot down'],
    idea: ['concept', 'notion', 'thought', 'insight'], problem: ['issue', 'challenge', 'obstacle', 'snag'],
    thing: ['item', 'element', 'detail', 'aspect'], things: ['items', 'details', 'aspects', 'matters'], way: ['method', 'approach', 'path', 'route'],
    great: ['superb', 'outstanding', 'terrific', 'remarkable'], really: ['truly', 'genuinely', 'honestly'], very: ['extremely', 'deeply', 'highly'],
    lot: ['plenty', 'great deal', 'heaps'], often: ['frequently', 'regularly', 'commonly'], maybe: ['perhaps', 'possibly', 'conceivably'],
    clear: ['plain', 'obvious', 'evident', 'transparent'], simple: ['basic', 'plain', 'uncomplicated', 'clean'],
    strong: ['powerful', 'robust', 'sturdy', 'forceful'], weak: ['feeble', 'fragile', 'flimsy', 'frail'],
    angry: ['furious', 'irritated', 'annoyed', 'livid'], scared: ['afraid', 'frightened', 'nervous', 'anxious'],
    tired: ['exhausted', 'weary', 'drained', 'worn out'], funny: ['amusing', 'hilarious', 'witty', 'comical'],
    weird: ['odd', 'strange', 'peculiar', 'bizarre'], amazing: ['astonishing', 'incredible', 'remarkable', 'astounding'],
    awesome: ['impressive', 'excellent', 'stunning'], nice: ['pleasant', 'kind', 'lovely', 'agreeable'], huge: ['enormous', 'massive', 'immense', 'giant'],
    tiny: ['minute', 'miniature', 'microscopic', 'petite'], quickly: ['rapidly', 'swiftly', 'promptly', 'in no time'],
    slowly: ['gradually', 'steadily', 'leisurely'], begin: ['start', 'commence', 'set out'], create: ['make', 'build', 'design', 'craft'],
    improve: ['enhance', 'boost', 'refine', 'upgrade'], explain: ['clarify', 'describe', 'spell out', 'unpack'],
    understand: ['grasp', 'comprehend', 'follow', 'get'], believe: ['think', 'trust', 'feel', 'hold'], feel: ['sense', 'experience', 'notice'],
    work: ['job', 'effort', 'craft', 'labour'], money: ['cash', 'funds', 'income', 'budget'], time: ['moment', 'period', 'season', 'stretch'],
    people: ['folks', 'readers', 'humans', 'everyone'], friend: ['companion', 'pal', 'ally', 'confidant'], story: ['tale', 'account', 'narrative', 'anecdote'],
    goal: ['aim', 'target', 'objective', 'ambition'], result: ['outcome', 'effect', 'consequence', 'payoff'], reason: ['cause', 'motive', 'why'],
    example: ['instance', 'case', 'illustration', 'sample'], part: ['piece', 'portion', 'section', 'segment'], focus: ['concentrate', 'zero in', 'centre on'],
    effective: ['useful', 'productive', 'successful', 'potent'], difficult: ['hard', 'tricky', 'demanding', 'tough'],
    possible: ['feasible', 'doable', 'achievable', 'viable'], different: ['distinct', 'unlike', 'varied', 'alternative'],
    obvious: ['clear', 'evident', 'apparent', 'plain'], perfect: ['flawless', 'ideal', 'spotless', 'exact'], unique: ['distinctive', 'singular', 'one-of-a-kind'],
    honest: ['candid', 'frank', 'sincere', 'truthful'], quiet: ['calm', 'hushed', 'peaceful', 'still'], loud: ['noisy', 'booming', 'deafening'],
    walk: ['stroll', 'wander', 'stride', 'amble'], run: ['dash', 'sprint', 'race', 'jog'], eat: ['devour', 'consume', 'snack on'],
    love: ['adore', 'cherish', 'treasure', 'enjoy'], like: ['enjoy', 'appreciate', 'fancy'], hate: ['loathe', 'detest', 'despise', 'dislike'],
    lazy: ['idle', 'sluggish', 'unmotivated'], busy: ['occupied', 'swamped', 'hectic'], calm: ['serene', 'relaxed', 'composed', 'tranquil'],
    hope: ['wish', 'expect', 'trust', 'aspire'], fear: ['dread', 'worry', 'anxiety', 'unease'], growth: ['progress', 'expansion', 'development'],
    habit: ['routine', 'practice', 'ritual', 'custom'], lesson: ['takeaway', 'insight', 'moral', 'teaching'], mistake: ['error', 'slip', 'misstep', 'blunder'],
    success: ['win', 'achievement', 'triumph', 'breakthrough'], failure: ['setback', 'flop', 'defeat', 'misfire'], tool: ['instrument', 'device', 'utility', 'resource'],
    tip: ['hint', 'pointer', 'suggestion', 'trick'], basically: ['essentially', 'in short', 'fundamentally'], actually: ['in fact', 'really', 'indeed'],
    also: ['too', 'as well', 'additionally', 'plus'], but: ['yet', 'however', 'still', 'though'], because: ['since', 'as', 'given that'],
    so: ['therefore', 'thus', 'as a result'], however: ['yet', 'still', 'nevertheless', 'even so'],
  };

  function synonyms(word) {
    const w = String(word || '').toLowerCase().trim();
    let base = w;
    let list = THESAURUS[w];
    if (!list && w.endsWith('s')) { base = w.slice(0, -1); list = THESAURUS[base]; }
    if (!list && w.endsWith('ly')) { base = w.slice(0, -2); list = THESAURUS[base]; }
    if (!list) return [];
    const caps = /^[A-Z]/.test(word);
    return list.map((s) => (caps ? s[0].toUpperCase() + s.slice(1) : s));
  }

  // ------------------------------------------------------------------ fuzzy match (command palette)
  function fuzzy(query, text) {
    const q = String(query || '').toLowerCase().trim();
    const t = String(text || '').toLowerCase();
    if (!q) return 1;
    const idx = t.indexOf(q);
    if (idx >= 0) return 100 - Math.min(idx, 50) + (idx === 0 ? 30 : 0);
    let ti = 0, score = 0, run = 0;
    for (const ch of q) {
      if (ch === ' ') continue;
      const found = t.indexOf(ch, ti);
      if (found < 0) return 0;
      run = found === ti ? run + 1 : 0;
      score += 1 + run * 2;
      ti = found + 1;
    }
    return score;
  }

  // ------------------------------------------------------------------ read aloud (offline, uses OS voices)
  const Speech = {
    supported: typeof window !== 'undefined' && 'speechSynthesis' in window,
    playing: false,
    paused: false,
    _queue: [],
    _index: 0,
    rate: 1,
    voiceURI: '',
    onSentence: null,
    onEnd: null,
    onError: null,
    voices() { return this.supported ? speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang) || speechSynthesis.getVoices().length < 12) : []; },
    speak(sentences, { from = 0 } = {}) {
      if (!this.supported) return false;
      this.stop(true);
      this._queue = sentences;
      this._index = from;
      this._spoke = false;
      this.playing = true;
      this.paused = false;
      this._next();
      return true;
    },
    _next() {
      if (!this.playing) return;
      if (this._index >= this._queue.length) { this.stop(); return; }
      const s = this._queue[this._index];
      const u = new SpeechSynthesisUtterance(s.text);
      u.rate = this.rate;
      const v = speechSynthesis.getVoices().find((x) => x.voiceURI === this.voiceURI);
      if (v) u.voice = v;
      u.onend = () => { if (!this.playing) return; this._index++; this._next(); };
      u.onstart = () => { this._spoke = true; if (this.onSentence) this.onSentence(s, this._index); };
      u.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') return;
        // No working voice at all (common on minimal Linux installs): stop and say why instead of failing silently.
        if (!this._spoke && /synthesis-(failed|unavailable)|voice-unavailable|not-allowed/.test(e.error)) {
          const cb = this.onError;
          this.stop(true);
          if (cb) cb(e.error);
          if (this.onEnd) this.onEnd();
          return;
        }
        this._index++;
        this._next();
      };
      speechSynthesis.speak(u);
    },
    pause() { if (this.playing && !this.paused) { speechSynthesis.pause(); this.paused = true; } },
    resume() { if (this.paused) { speechSynthesis.resume(); this.paused = false; } },
    skip(delta) { if (!this.playing) return; this._index = Math.max(0, Math.min(this._queue.length - 1, this._index + delta)); speechSynthesis.cancel(); this.paused = false; setTimeout(() => this._next(), 30); },
    stop(silent) {
      const was = this.playing;
      this.playing = false;
      this.paused = false;
      if (this.supported) speechSynthesis.cancel();
      if (was && !silent && this.onEnd) this.onEnd();
    },
  };

  // ------------------------------------------------------------------ focus sounds (generated, no files)
  const Noise = {
    ctx: null, node: null, gain: null, kind: 'off',
    play(kind) {
      this.stop();
      if (kind === 'off' || typeof window === 'undefined') { this.kind = 'off'; return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = this.ctx || new AC();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(2, sr * 6, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < d.length; i++) {
          const white = Math.random() * 2 - 1;
          if (kind === 'brown') { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; }
          else if (kind === 'pink') {
            b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759; b2 = 0.969 * b2 + white * 0.153852;
            b3 = 0.8665 * b3 + white * 0.3104856; b4 = 0.55 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.016898;
            d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11; b6 = white * 0.115926;
          } else d[i] = white * 0.25; // white
        }
        // Cross-fade the loop point so it doesn't click.
        const fade = Math.floor(sr * 0.05);
        for (let i = 0; i < fade; i++) { const k = i / fade; d[i] = d[i] * k + d[d.length - fade + i] * (1 - k); }
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      this.gain = this.ctx.createGain();
      this.gain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.gain.gain.linearRampToValueAtTime(kind === 'white' ? 0.18 : 0.35, this.ctx.currentTime + 1.2);
      src.connect(this.gain).connect(this.ctx.destination);
      src.start();
      this.node = src;
      this.kind = kind;
    },
    stop() {
      if (this.node) {
        const n = this.node, g = this.gain;
        try { g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4); setTimeout(() => { try { n.stop(); } catch (e) { /* already stopped */ } }, 450); } catch (e) { /* ignore */ }
      }
      this.node = null;
      this.kind = 'off';
    },
  };

  return { TEMPLATES, headline, synonyms, fuzzy, Speech, Noise, THESAURUS };
});
