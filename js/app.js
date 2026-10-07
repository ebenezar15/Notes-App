/* Inkwell — offline blog studio. Main application. */
(function () {
  'use strict';

  // ======================================================================
  // Constants & helpers
  // ======================================================================
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = Exporter.esc;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const MOD = isMac ? '⌘' : 'Ctrl+';

  const STATUSES = [
    { id: 'idea', label: 'Idea', color: 'var(--s-idea)', emoji: '💡' },
    { id: 'draft', label: 'Draft', color: 'var(--s-draft)', emoji: '✏️' },
    { id: 'editing', label: 'Editing', color: 'var(--s-editing)', emoji: '🔍' },
    { id: 'ready', label: 'Ready', color: 'var(--s-ready)', emoji: '✅' },
    { id: 'published', label: 'Published', color: 'var(--s-published)', emoji: '🚀' },
  ];
  const statusOf = (id) => STATUSES.find((s) => s.id === id) || STATUSES[1];

  const PALETTE = [
    ['#ff6719', '#ffb36b'], ['#7c3aed', '#c084fc'], ['#0ea5e9', '#6366f1'], ['#059669', '#a3e635'],
    ['#e11d48', '#fb7185'], ['#f59e0b', '#fde047'], ['#334155', '#94a3b8'], ['#0d9488', '#5eead4'],
    ['#9333ea', '#ec4899'], ['#2563eb', '#38bdf8'], ['#b45309', '#f97316'], ['#be185d', '#a78bfa'],
  ];
  const EMOJIS = ['📝', '✍️', '📚', '💡', '🚀', '🌱', '🎨', '🎧', '📷', '🍳', '✈️', '🏔️', '💻', '🧠', '💰', '❤️',
    '🌍', '⚡', '🔥', '🌙', '☕', '🎬', '🏃', '🧘', '🎮', '🔬', '📈', '🗞️', '🎯', '🌸', '🐾', '🎵', '🛠️', '📖', '🪴', '🧭'];

  const COVERS = [
    'linear-gradient(135deg,#ff6719 0%,#ff3d77 50%,#7c3aed 100%)',
    'linear-gradient(135deg,#0ea5e9,#6366f1 60%,#a855f7)',
    'radial-gradient(circle at 20% 20%,#fde68a,transparent 50%),linear-gradient(135deg,#f97316,#db2777)',
    'linear-gradient(160deg,#064e3b,#059669 50%,#a3e635)',
    'radial-gradient(circle at 80% 10%,#c4b5fd,transparent 45%),linear-gradient(135deg,#1e1b4b,#4338ca)',
    'linear-gradient(135deg,#fef3c7,#fca5a5 50%,#f472b6)',
    'linear-gradient(135deg,#0f172a,#334155 60%,#64748b)',
    'radial-gradient(circle at 30% 70%,#5eead4,transparent 50%),linear-gradient(135deg,#0d9488,#2563eb)',
    'linear-gradient(120deg,#f5f0e6,#e7d8bf 50%,#c7a77a)',
    'radial-gradient(circle at 70% 30%,#fbcfe8,transparent 50%),linear-gradient(135deg,#9333ea,#ec4899)',
    'linear-gradient(135deg,#111827 0%,#ff6719 140%)',
    'conic-gradient(from 200deg at 30% 60%,#fde047,#f97316,#ef4444,#a855f7,#3b82f6,#fde047)',
  ];

  const CAT_META = {
    spelling: { label: 'Spelling', color: 'var(--c-spelling)' },
    grammar: { label: 'Grammar', color: 'var(--c-grammar)' },
    punctuation: { label: 'Punctuation', color: 'var(--c-punctuation)' },
    style: { label: 'Style', color: 'var(--c-style)' },
    typography: { label: 'Typography', color: 'var(--c-typography)' },
  };
  const GROUP_BY_RULE = new Set(['smart-quotes', 'em-dash', 'multiple-spaces', 'space-after-punct', 'space-before-punct', 'capitalize-i']);
  const STOPWORDS = new Set(('a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those i me my we our you your he she they them their his her not no so do does did have has had will would can could should just than then there here what which who whom when where why how all any some more most very also into about over after before up out one two like get got really much many such only own same too s t don isn didn wasn i\'m it\'s that\'s').split(' '));

  const DEFAULT_SETTINGS = {
    theme: 'system', font: 'serif', fontSize: 20, width: 'normal', author: '', liveCheck: true, dailyGoal: 500,
    categories: { spelling: true, grammar: true, punctuation: true, style: true, typography: false },
    listMode: 'list',
  };

  const today = () => dayKey(new Date());
  function dayKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  const fmtNum = (n) => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : n.toLocaleString());

  function relTime(ts) {
    const s = (Date.now() - ts) / 1000;
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(ts).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }

  function htmlToText(html) {
    const doc = new DOMParser().parseFromString(
      (html || '').replace(/<\/(p|h\d|li|blockquote|pre|figcaption)>/gi, '$&\n').replace(/<br\s*\/?>/gi, '\n'), 'text/html');
    return doc.body.textContent || '';
  }
  const snippet = (post) => htmlToText(post.content).replace(/\s+/g, ' ').trim().slice(0, 160);

  function debounce(fn, ms) {
    let t;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.flush = (...a) => { clearTimeout(t); fn(...a); };
    d.cancel = () => clearTimeout(t);
    return d;
  }

  const coverCSS = (cover) => {
    if (!cover) return '';
    if (cover.type === 'image') return `background-image:url("${cover.value}")`;
    return `background-image:${cover.value}`;
  };
  const projectVars = (p) => {
    const [a, b] = PALETTE[(p && p.color) || 0] || PALETTE[0];
    return `--pa:${a};--pb:${b}`;
  };

  // ======================================================================
  // State
  // ======================================================================
  const state = {
    projects: [],
    posts: [],
    activity: {},
    view: 'home',
    projectId: null,
    postId: null,
    query: '',
    statusFilter: 'all',
    panel: null,
    issues: [],
    settings: loadSettings(),
    sidebarOpen: false,
  };

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('inkwell.settings') || '{}');
      return { ...DEFAULT_SETTINGS, ...s, categories: { ...DEFAULT_SETTINGS.categories, ...(s.categories || {}) } };
    } catch (e) { return { ...DEFAULT_SETTINGS }; }
  }
  function saveSettings() {
    try { localStorage.setItem('inkwell.settings', JSON.stringify(state.settings)); } catch (e) { /* storage full or blocked */ }
  }
  function saveLocation() {
    try {
      localStorage.setItem('inkwell.location', JSON.stringify({ view: state.view, projectId: state.projectId, postId: state.postId, panel: state.panel }));
    } catch (e) { /* ignore */ }
  }

  const getPost = (id) => state.posts.find((p) => p.id === id);
  const getProject = (id) => state.projects.find((p) => p.id === id);
  const currentPost = () => getPost(state.postId);
  const postsIn = (projectId) => state.posts.filter((p) => p.projectId === projectId);

  // ======================================================================
  // Persistence
  // ======================================================================
  async function persistProject(p) {
    p.updatedAt = Date.now();
    await DB.put('projects', p);
  }

  async function persistPost(post, { snapshot = 'auto' } = {}) {
    post.updatedAt = Date.now();
    await DB.put('posts', post);
    if (snapshot === 'auto' && (!post.lastSnapshotAt || Date.now() - post.lastSnapshotAt > 10 * 60 * 1000)) {
      await createVersion(post, 'Autosave');
    }
  }

  async function createVersion(post, label) {
    post.lastSnapshotAt = Date.now();
    await DB.put('posts', post);
    const v = {
      id: uid(), postId: post.id, createdAt: Date.now(), label, title: post.title, subtitle: post.subtitle,
      content: post.content, wordCount: post.wordCount,
    };
    await DB.put('versions', v);
    const all = (await DB.byIndex('versions', 'postId', post.id)).sort((a, b) => b.createdAt - a.createdAt);
    if (all.length > 60) await DB.delMany('versions', all.slice(60).map((x) => x.id));
    return v;
  }

  async function recordWords(delta) {
    if (delta <= 0) return;
    const key = today();
    state.activity[key] = (state.activity[key] || 0) + delta;
    await DB.put('activity', { date: key, words: state.activity[key] });
  }

  function newProject(data = {}) {
    return {
      id: uid(), name: data.name || 'Untitled project', description: data.description || '', emoji: data.emoji || '📝',
      color: data.color ?? Math.floor(Math.random() * PALETTE.length), createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  function newPost(projectId, data = {}) {
    return {
      id: uid(), projectId, title: data.title || '', subtitle: data.subtitle || '', content: data.content || '<p><br></p>',
      status: data.status || 'draft', tags: data.tags || [], cover: data.cover || null, pinned: false, goal: data.goal || 0,
      wordCount: 0, ignored: [], publishedUrl: '', publishedAt: null, createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  // ======================================================================
  // Theme & preferences
  // ======================================================================
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const s = state.settings;
    const theme = s.theme === 'system' ? (mql.matches ? 'dark' : 'light') : s.theme;
    document.documentElement.dataset.theme = theme;
    const root = document.documentElement.style;
    root.setProperty('--font-editor', s.font === 'sans' ? 'var(--font-sans)' : s.font === 'mono' ? 'var(--font-mono)' : 'var(--font-serif)');
    root.setProperty('--editor-size', s.fontSize + 'px');
    root.setProperty('--editor-width', { narrow: '600px', normal: '700px', wide: '860px' }[s.width] || '700px');
    const meta = $$('meta[name="theme-color"]');
    const c = getComputedStyle(document.body).getPropertyValue('--bg').trim();
    meta.forEach((m) => m.setAttribute('content', c));
    const icon = $('[data-action="cycle-theme"] use');
    if (icon) icon.setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon');
  }
  mql.addEventListener && mql.addEventListener('change', applyTheme);

  // ======================================================================
  // Navigation
  // ======================================================================
  function go(view, opts = {}) {
    flushSave();
    state.view = view;
    if ('projectId' in opts) state.projectId = opts.projectId;
    if ('postId' in opts) state.postId = opts.postId;
    if (view === 'home' || view === 'board') state.postId = opts.postId || null;
    if (view !== 'search') state.query = '';
    if (opts.keepFilter !== true) state.statusFilter = 'all';
    state.sidebarOpen = false;
    $('#app').classList.remove('sidebar-open');
    if (view !== 'search') $('#search').value = '';
    render();
    saveLocation();
  }

  function openPost(id) {
    const post = getPost(id);
    if (!post) return;
    const view = state.view === 'all' || state.view === 'search' ? state.view : 'project';
    flushSave();
    state.view = view;
    if (view === 'project') state.projectId = post.projectId;
    state.postId = id;
    render();
    saveLocation();
  }

  // ======================================================================
  // Rendering — shell
  // ======================================================================
  function render() {
    renderSidebar();
    const main = $('#main');
    if (state.view === 'home') renderHome(main);
    else if (state.view === 'board') renderBoard(main);
    else renderWorkspace(main);
  }

  function renderSidebar() {
    const counts = { all: state.posts.length };
    $('#nav').innerHTML = `
      ${navItem('home', 'i-home', 'Home')}
      ${navItem('all', 'i-docs', 'All posts', counts.all)}
      ${navItem('board', 'i-board', 'Board')}
    `;
    const list = $('#projectList');
    if (!state.projects.length) {
      list.innerHTML = `<div class="muted" style="padding:6px 10px;font-size:12.5px">No projects yet.</div>`;
    } else {
      list.innerHTML = state.projects.slice().sort((a, b) => a.createdAt - b.createdAt).map((p) => `
        <button class="project-item ${state.view === 'project' && state.projectId === p.id ? 'active' : ''}" data-project="${p.id}" style="${projectVars(p)}">
          <span class="emoji">${esc(p.emoji)}</span><span class="name">${esc(p.name)}</span><span class="count">${postsIn(p.id).length}</span>
        </button>`).join('');
    }
    function navItem(view, icon, label, count) {
      const active = state.view === view || (view === 'all' && state.view === 'search');
      return `<button class="nav-item ${active ? 'active' : ''}" data-nav="${view}"><svg><use href="#${icon}"/></svg>${label}${count != null ? `<span class="count">${count}</span>` : ''}</button>`;
    }
  }

  const menuButton = () => `<button class="icon-btn mobile-menu" data-action="toggle-sidebar" title="Menu"><svg><use href="#i-menu"/></svg></button>`;

  // ======================================================================
  // Home dashboard
  // ======================================================================
  function renderHome(main) {
    const s = state.settings;
    const hour = new Date().getHours();
    const greet = hour < 5 ? 'Writing late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const totalWords = state.posts.reduce((n, p) => n + (p.wordCount || 0), 0);
    const published = state.posts.filter((p) => p.status === 'published').length;
    const inProgress = state.posts.filter((p) => p.status === 'draft' || p.status === 'editing').length;
    const streak = computeStreak();
    const todayWords = state.activity[today()] || 0;
    const weekWords = lastNDays(7).reduce((n, d) => n + (state.activity[d] || 0), 0);
    const recent = state.posts.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);

    main.innerHTML = `
      <div class="page"><div class="page-inner">
        <div class="page-head">
          ${menuButton()}
          <div>
            <h1>${greet}${s.author ? ', ' + esc(s.author.split(' ')[0]) : ''}.</h1>
            <p>${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · ${todayWords ? `${fmtNum(todayWords)} words written today` : 'A blank page is an invitation.'}</p>
          </div>
          <div class="actions">
            <button class="btn" data-action="new-project"><svg><use href="#i-plus"/></svg>New project</button>
            <button class="btn primary" data-action="quick-post"><svg><use href="#i-pen"/></svg>New post</button>
          </div>
        </div>

        <div class="stats">
          ${statTile('i-docs', 'Words written', fmtNum(totalWords), `${fmtNum(weekWords)} this week`, 'var(--accent)')}
          ${statTile('i-pen', 'Posts', state.posts.length, `${inProgress} in progress`, 'var(--s-draft)')}
          ${statTile('i-send', 'Published', published, `${state.posts.filter((p) => p.status === 'ready').length} ready to go`, 'var(--s-ready)')}
          ${statTile('i-flame', 'Day streak', streak, streak ? 'Keep it going!' : 'Write today to start one', 'var(--s-editing)')}
        </div>

        <div class="cards-row">
          <div class="card"><h3>Writing activity <small>last 20 weeks</small></h3>${heatmap()}</div>
          <div class="card"><h3>Pipeline</h3>${pipelineDonut()}</div>
          <div class="card goal"><h3 style="margin:0">Today's goal</h3>${ring(todayWords, s.dailyGoal, 'words')}<small class="muted">${todayWords >= s.dailyGoal ? '🎉 Goal reached' : `${fmtNum(Math.max(0, s.dailyGoal - todayWords))} to go`}</small></div>
        </div>

        <div class="section-head"><h2>Projects</h2><span class="spacer"></span><button class="btn sm ghost" data-nav="board"><svg><use href="#i-board"/></svg>Open board</button></div>
        <div class="project-grid">
          ${state.projects.map(projectCard).join('')}
          <button class="project-card new" data-action="new-project"><svg><use href="#i-plus"/></svg>New project</button>
        </div>

        ${recent.length ? `<div class="section-head"><h2>Continue writing</h2></div>
        <div class="recent-grid">${recent.map(postTile).join('')}</div>` : ''}
      </div></div>`;
  }

  function statTile(icon, label, value, sub, color) {
    return `<div class="stat" style="--tc:${color}"><div class="label"><svg><use href="#${icon}"/></svg>${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;
  }

  function projectCard(p) {
    const posts = postsIn(p.id);
    const words = posts.reduce((n, x) => n + (x.wordCount || 0), 0);
    const segs = STATUSES.map((s) => [s, posts.filter((x) => x.status === s.id).length]).filter(([, n]) => n);
    return `<button class="project-card" data-project="${p.id}" style="${projectVars(p)}">
      <div class="banner"><span class="emoji">${esc(p.emoji)}</span></div>
      <div class="pc-body"><b>${esc(p.name)}</b><p>${esc(p.description || 'No description yet.')}</p>
        <div class="meta"><span>${posts.length} post${posts.length === 1 ? '' : 's'}</span><span>${fmtNum(words)} words</span><span>${relTime(p.updatedAt)}</span></div>
        <div class="progress">${segs.map(([s, n]) => `<i style="width:${(n / posts.length) * 100}%;background:${s.color}" title="${s.label}: ${n}"></i>`).join('')}</div>
      </div></button>`;
  }

  function postTile(post) {
    const st = statusOf(post.status);
    const proj = getProject(post.projectId);
    const cover = post.cover ? coverCSS(post.cover) : `background-image:${COVERS[hash(post.id) % COVERS.length]}`;
    return `<button class="post-tile" data-open="${post.id}">
      <div class="cover-sm" style='${cover}'><span class="status-chip" style="--sc:${st.color}"><span class="status-dot"></span>${st.label}</span></div>
      <div class="tbody"><b>${esc(post.title || 'Untitled')}</b><p>${esc(post.subtitle || snippet(post) || 'Empty post')}</p>
      <small>${proj ? esc(proj.emoji + ' ' + proj.name) + ' · ' : ''}${relTime(post.updatedAt)} · ${fmtNum(post.wordCount || 0)} words</small></div>
    </button>`;
  }

  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

  function lastNDays(n) {
    const out = [];
    const d = new Date();
    for (let i = 0; i < n; i++) { out.push(dayKey(d)); d.setDate(d.getDate() - 1); }
    return out;
  }

  function computeStreak() {
    let streak = 0;
    const d = new Date();
    if (!state.activity[dayKey(d)]) d.setDate(d.getDate() - 1);
    while (state.activity[dayKey(d)]) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }

  function heatmap() {
    const weeks = 20;
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - (weeks * 7 - 1) - end.getDay());
    const vals = Object.values(state.activity);
    const max = Math.max(1, ...vals);
    const cells = [];
    const d = new Date(start);
    const t = today();
    while (d <= end) {
      const k = dayKey(d);
      const v = state.activity[k] || 0;
      const lvl = v === 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4));
      cells.push(`<i data-l="${lvl}" class="${k === t ? 'today' : ''}" title="${d.toLocaleDateString()} — ${v} words"></i>`);
      d.setDate(d.getDate() + 1);
    }
    return `<div class="heatmap">${cells.join('')}</div>
      <div class="heat-legend">Less ${[0, 1, 2, 3, 4].map((l) => `<i class="" style="background:${l ? `color-mix(in srgb, var(--accent) ${[0, 28, 50, 75, 100][l]}%, transparent)` : 'color-mix(in srgb, var(--text) 7%, transparent)'}"></i>`).join('')} More</div>`;
  }

  function pipelineDonut() {
    const total = state.posts.length;
    const r = 46, c = 2 * Math.PI * r;
    let off = 0;
    const arcs = STATUSES.map((s) => {
      const n = state.posts.filter((p) => p.status === s.id).length;
      if (!n) return '';
      const len = (n / total) * c;
      const arc = `<circle r="${r}" cx="60" cy="60" fill="none" stroke="${s.color}" stroke-width="16" stroke-dasharray="${Math.max(0, len - 2)} ${c}" stroke-dashoffset="${-off}"/>`;
      off += len;
      return arc;
    }).join('');
    return `<div class="donut-wrap">
      <div class="donut"><svg viewBox="0 0 120 120"><circle r="${r}" cx="60" cy="60" fill="none" stroke="var(--bg-2)" stroke-width="16"/>${arcs}
        <text x="60" y="60" class="donut-center" text-anchor="middle" dominant-baseline="central" transform="rotate(90 60 60)">${total}</text></svg></div>
      <div class="legend">${STATUSES.map((s) => `<div><span class="status-dot" style="--sc:${s.color}"></span>${s.label}<b>${state.posts.filter((p) => p.status === s.id).length}</b></div>`).join('')}</div>
    </div>`;
  }

  function ring(value, goal, label, size = 120, stroke = 10) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const pct = goal ? Math.min(1, value / goal) : 0;
    return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}">
      <circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="var(--bg-2)" stroke-width="${stroke}"/>
      ${pct > 0 ? `<circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="url(#ringGrad)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${pct * c} ${c}"/>` : ''}
      <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="#ff3d77"/></linearGradient></defs>
    </svg><div class="ring-label"><b>${size < 90 ? Math.round(pct * 100) + '%' : fmtNum(value)}</b>${size < 90 ? '' : `<small>of ${fmtNum(goal)} ${label}</small>`}</div></div>`;
  }

  // ======================================================================
  // Board (kanban)
  // ======================================================================
  function renderBoard(main) {
    const scope = state.projectId && getProject(state.projectId) ? state.projectId : 'all';
    const posts = scope === 'all' ? state.posts : postsIn(scope);
    main.innerHTML = `<div class="board-page">
      <div class="board-head">
        ${menuButton()}
        <h1>Editorial board</h1>
        <div class="actions">
          <select class="select" id="boardScope" style="width:auto">
            <option value="all">All projects</option>
            ${state.projects.map((p) => `<option value="${p.id}" ${scope === p.id ? 'selected' : ''}>${esc(p.emoji + ' ' + p.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="board">${STATUSES.map((s) => {
        const items = posts.filter((p) => p.status === s.id).sort((a, b) => b.updatedAt - a.updatedAt);
        return `<div class="column" data-status="${s.id}" style="--sc:${s.color}">
          <div class="column-head"><span class="status-dot"></span>${s.label}<span class="n">${items.length}</span>
            <button class="icon-btn sm" data-action="board-add" data-status="${s.id}" title="Add ${s.label.toLowerCase()}"><svg><use href="#i-plus"/></svg></button></div>
          <div class="column-body">${items.map(kanbanCard).join('') || `<div class="column-empty">Drop posts here</div>`}</div>
        </div>`;
      }).join('')}</div>
    </div>`;
    $('#boardScope').addEventListener('change', (e) => { state.projectId = e.target.value === 'all' ? null : e.target.value; renderBoard(main); });
    bindBoardDnD($('.board-page', main));
  }

  function kanbanCard(post) {
    const proj = getProject(post.projectId);
    return `<div class="kcard" draggable="true" data-open="${post.id}" data-id="${post.id}" role="button" tabindex="0">
      ${post.cover ? `<div class="strip" style='${coverCSS(post.cover)}'></div>` : ''}
      <div class="kb"><b>${esc(post.title || 'Untitled')}</b>${snippet(post) ? `<p>${esc(snippet(post))}</p>` : ''}
      <div class="km">${proj ? `<span>${esc(proj.emoji)} ${esc(proj.name)}</span>` : ''}<span class="spacer"></span><span>${fmtNum(post.wordCount || 0)} w</span></div></div>
    </div>`;
  }

  function bindBoardDnD(root) {
    let dragId = null;
    root.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.kcard');
      if (!card) return;
      dragId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    });
    root.addEventListener('dragend', (e) => {
      const card = e.target.closest('.kcard');
      if (card) card.classList.remove('dragging');
      $$('.column.drag-over', root).forEach((c) => c.classList.remove('drag-over'));
    });
    root.addEventListener('dragover', (e) => {
      const col = e.target.closest('.column');
      if (!col || !dragId) return;
      e.preventDefault();
      $$('.column.drag-over', root).forEach((c) => c !== col && c.classList.remove('drag-over'));
      col.classList.add('drag-over');
    });
    root.addEventListener('drop', async (e) => {
      const col = e.target.closest('.column');
      if (!col || !dragId) return;
      e.preventDefault();
      const post = getPost(dragId);
      dragId = null;
      if (!post || post.status === col.dataset.status) { renderBoard($('#main')); return; }
      await setStatus(post, col.dataset.status);
      renderBoard($('#main'));
    });
  }

  async function setStatus(post, status) {
    const was = post.status;
    post.status = status;
    if (status === 'published' && !post.publishedAt) post.publishedAt = Date.now();
    await persistPost(post, { snapshot: 'none' });
    if (status === 'published' && was !== 'published') celebrate();
    toast(`Moved “${post.title || 'Untitled'}” to ${statusOf(status).label}`);
  }

  // ======================================================================
  // Workspace: collection + editor + assistant
  // ======================================================================
  function collectionPosts() {
    let posts;
    if (state.view === 'project') posts = postsIn(state.projectId);
    else if (state.view === 'search') {
      const q = state.query.toLowerCase();
      posts = state.posts.filter((p) => (p.title + ' ' + p.subtitle + ' ' + (p.tags || []).join(' ') + ' ' + htmlToText(p.content)).toLowerCase().includes(q));
    } else posts = state.posts.slice();
    if (state.statusFilter !== 'all') posts = posts.filter((p) => p.status === state.statusFilter);
    return posts.sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
  }

  function renderWorkspace(main) {
    if (state.view === 'project' && !getProject(state.projectId)) { go('home'); return; }
    const post = currentPost();
    const gridMode = state.settings.listMode === 'grid' && !post;
    main.innerHTML = `<div class="workspace ${post ? 'has-post' : ''} ${state.panel && post ? 'panel-open' : ''} ${gridMode ? 'grid-open' : ''}">
      <section class="collection ${gridMode ? 'grid-mode' : ''}" id="collection"></section>
      <section class="editor-area" id="editorArea"></section>
      ${post && state.panel ? `<aside class="assistant" id="assistant"></aside>` : ''}
    </div>`;
    renderCollection();
    renderEditor();
    if (post && state.panel) renderAssistant();
  }

  function renderCollection() {
    const el = $('#collection');
    if (!el) return;
    const proj = state.view === 'project' ? getProject(state.projectId) : null;
    const posts = collectionPosts();
    const grid = state.settings.listMode === 'grid' && !state.postId;
    let title, subtitle, emoji, vars = '';
    if (proj) { title = proj.name; subtitle = proj.description || `${postsIn(proj.id).length} posts`; emoji = proj.emoji; vars = projectVars(proj); }
    else if (state.view === 'search') { title = `“${state.query}”`; subtitle = `${posts.length} result${posts.length === 1 ? '' : 's'}`; emoji = '🔎'; }
    else { title = 'All posts'; subtitle = `${state.posts.length} posts across ${state.projects.length} projects`; emoji = '🗂️'; }

    const scopeAll = state.view === 'project' ? postsIn(state.projectId) : state.posts;
    el.style.cssText = vars;
    el.innerHTML = `
      <div class="hero">
        <div class="hero-top">
          ${menuButton()}
          <span class="emoji">${esc(emoji)}</span>
          <div class="hero-titles"><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div>
          ${proj ? `<button class="icon-btn" data-action="project-menu" title="Project options"><svg><use href="#i-more"/></svg></button>` : ''}
        </div>
        <div class="hero-actions">
          <button class="btn primary" data-action="new-post"><svg><use href="#i-plus"/></svg>New post</button>
          <div class="segmented">
            <button class="${!grid ? 'active' : ''}" data-action="list-mode" data-mode="list" title="List"><svg style="width:14px;height:14px"><use href="#i-list"/></svg></button>
            <button class="${grid ? 'active' : ''}" data-action="list-mode" data-mode="grid" title="Gallery"><svg style="width:14px;height:14px"><use href="#i-grid"/></svg></button>
          </div>
          <button class="icon-btn" data-nav="board" title="Board view"><svg><use href="#i-board"/></svg></button>
        </div>
      </div>
      <div class="filters">
        <button class="filter ${state.statusFilter === 'all' ? 'active' : ''}" data-filter="all">All ${scopeAll.length}</button>
        ${STATUSES.map((s) => {
          const n = scopeAll.filter((p) => p.status === s.id).length;
          return n ? `<button class="filter ${state.statusFilter === s.id ? 'active' : ''}" data-filter="${s.id}"><span class="status-dot" style="--sc:${s.color}"></span>${s.label} ${n}</button>` : '';
        }).join('')}
      </div>
      <div class="post-list ${grid ? 'grid' : ''}" id="postList">
        ${posts.length ? (grid ? posts.map(postTile).join('') : groupedList(posts)) : emptyList()}
      </div>`;
  }

  function groupedList(posts) {
    const groups = [];
    const pinned = posts.filter((p) => p.pinned);
    if (pinned.length) groups.push(['Pinned', pinned]);
    const rest = posts.filter((p) => !p.pinned);
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const buckets = [['Today', (t) => t >= startToday], ['Previous 7 days', (t) => t >= startToday - 6 * 864e5], ['Previous 30 days', (t) => t >= startToday - 29 * 864e5], ['Earlier', () => true]];
    const used = new Set();
    for (const [label, test] of buckets) {
      const items = rest.filter((p) => !used.has(p.id) && test(p.updatedAt));
      items.forEach((p) => used.add(p.id));
      if (items.length) groups.push([label, items]);
    }
    return groups.map(([label, items]) => `<div class="list-group">${label}</div>${items.map(postCard).join('')}`).join('');
  }

  function postCard(post) {
    const st = statusOf(post.status);
    const proj = state.view !== 'project' ? getProject(post.projectId) : null;
    const thumb = post.cover ? `<div class="thumb" style='${coverCSS(post.cover)}'></div>` : '';
    return `<button class="post-card ${post.id === state.postId ? 'active' : ''}" data-open="${post.id}" data-id="${post.id}" draggable="true">
      <div class="row"><div class="txt">
        <div class="title">${post.pinned ? '<svg><use href="#i-pin"/></svg>' : ''}${esc(post.title || 'Untitled')}</div>
        <div class="snippet">${esc(post.subtitle || snippet(post) || 'No content yet')}</div>
      </div>${thumb}</div>
      <div class="meta"><span class="status-chip" style="--sc:${st.color}"><span class="status-dot"></span>${st.label}</span>
        <span>${relTime(post.updatedAt)}</span><span>${fmtNum(post.wordCount || 0)} words</span>
        ${proj ? `<span class="project-tag">${esc(proj.emoji)} ${esc(proj.name)}</span>` : ''}</div>
    </button>`;
  }

  function emptyList() {
    if (state.view === 'search') return `<div class="empty"><div class="art">🔎</div><h3>Nothing found</h3><p>Try another word, a tag, or part of a sentence.</p></div>`;
    if (state.statusFilter !== 'all') return `<div class="empty"><p>No ${statusOf(state.statusFilter).label.toLowerCase()} posts here.</p></div>`;
    return `<div class="empty"><div class="art">✍️</div><h3>No posts yet</h3><p>Every great newsletter starts with a single draft.</p><button class="btn primary" data-action="new-post"><svg><use href="#i-plus"/></svg>Write the first one</button></div>`;
  }

  function refreshCard(post) {
    const card = $(`#postList [data-id="${post.id}"]`);
    if (!card || card.classList.contains('post-tile')) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = postCard(post);
    card.replaceWith(tmp.firstElementChild);
  }

  // ======================================================================
  // Editor
  // ======================================================================
  let editor = null; // { post, body, title, subtitle }

  function renderEditor() {
    const area = $('#editorArea');
    if (!area) return;
    const post = currentPost();
    editor = null;
    if (!post) {
      const proj = getProject(state.projectId);
      area.innerHTML = `<div class="empty" style="flex:1">
        <div class="art">${proj ? esc(proj.emoji) : '📝'}</div>
        <h3>Pick a post, or start a new one</h3>
        <p>Your words are saved on this device as you type — no internet needed.</p>
        <button class="btn primary" data-action="new-post"><svg><use href="#i-plus"/></svg>New post</button>
        <p class="muted" style="font-size:12px;margin-top:6px">Tip: ${MOD}K to search · ${MOD}${isMac ? '⌥' : 'Alt+'}N for a new post</p>
      </div>`;
      return;
    }
    const proj = getProject(post.projectId);
    const st = statusOf(post.status);
    area.innerHTML = `
      <div class="editor-top">
        <button class="icon-btn editor-back" data-action="close-post" title="Back"><svg><use href="#i-back"/></svg></button>
        <div class="crumbs">${proj ? `<span>${esc(proj.emoji)}</span><b><span>${esc(proj.name)}</span></b><span>›</span>` : ''}<span id="crumbTitle">${esc(post.title || 'Untitled')}</span></div>
        <select class="status-select" id="statusSelect" style="--sc:${st.color}" title="Status">
          ${STATUSES.map((s) => `<option value="${s.id}" ${s.id === post.status ? 'selected' : ''}>${s.emoji} ${s.label}</option>`).join('')}
        </select>
        <span class="save-state" id="saveState">Saved</span>
        <span class="spacer"></span>
        <span class="wc-chip" id="wcChip">${fmtNum(post.wordCount || 0)} words</span>
        <div class="editor-tools">
          <button class="icon-btn hide-sm" data-action="focus" title="Focus mode (${MOD}.)"><svg><use href="#i-focus"/></svg></button>
          <span class="sep hide-sm"></span>
          <button class="icon-btn ${state.panel === 'proofread' ? 'active' : ''}" data-panel="proofread" title="Proofread (${MOD}⇧P)"><svg><use href="#i-sparkle"/></svg><span class="badge" id="issueBadge" hidden></span></button>
          <button class="icon-btn ${state.panel === 'insights' ? 'active' : ''}" data-panel="insights" title="Insights"><svg><use href="#i-chart"/></svg></button>
          <button class="icon-btn ${state.panel === 'publish' ? 'active' : ''}" data-panel="publish" title="Publish to Substack"><svg><use href="#i-send"/></svg></button>
          <button class="icon-btn hide-sm ${state.panel === 'history' ? 'active' : ''}" data-panel="history" title="Version history"><svg><use href="#i-history"/></svg></button>
          <button class="icon-btn" data-action="post-menu" title="More"><svg><use href="#i-more"/></svg></button>
        </div>
      </div>
      <div class="editor-scroll" id="editorScroll">
        ${post.cover ? `<div class="cover" style='${coverCSS(post.cover)}'><div class="cover-actions">
          <button class="btn sm" data-action="cover"><svg><use href="#i-image"/></svg>Change cover</button>
          <button class="btn sm" data-action="remove-cover"><svg><use href="#i-trash"/></svg></button></div></div>` : ''}
        <article class="doc">
          <div class="doc-chips ${post.title ? '' : 'show'}">
            ${post.cover ? '' : `<button class="btn ghost sm" data-action="cover"><svg><use href="#i-image"/></svg>Add cover</button>`}
            <button class="btn ghost sm" data-action="sketch"><svg><use href="#i-pen"/></svg>Sketch</button>
            <button class="btn ghost sm" data-action="preview"><svg><use href="#i-eye"/></svg>Preview</button>
          </div>
          <textarea class="title-input" id="titleInput" rows="1" placeholder="Title" spellcheck="true">${esc(post.title)}</textarea>
          <textarea class="subtitle-input" id="subtitleInput" rows="1" placeholder="Add a subtitle…" spellcheck="true">${esc(post.subtitle)}</textarea>
          <div class="tags" id="tags"></div>
          <div class="toolbar" id="toolbar">
            <select id="blockSelect" title="Text style">
              <option value="p">Body</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
            </select>
            <span class="sep"></span>
            <button class="icon-btn" data-cmd="bold" title="Bold (${MOD}B)"><svg><use href="#i-bold"/></svg></button>
            <button class="icon-btn" data-cmd="italic" title="Italic (${MOD}I)"><svg><use href="#i-italic"/></svg></button>
            <button class="icon-btn" data-cmd="underline" title="Underline (${MOD}U)"><svg><use href="#i-underline"/></svg></button>
            <button class="icon-btn" data-cmd="strikeThrough" title="Strikethrough"><svg><use href="#i-strike"/></svg></button>
            <button class="icon-btn" data-cmd="link" title="Link (${MOD}K in editor)"><svg><use href="#i-link"/></svg></button>
            <span class="sep"></span>
            <button class="icon-btn" data-cmd="quote" title="Quote"><svg><use href="#i-quote"/></svg></button>
            <button class="icon-btn" data-cmd="insertUnorderedList" title="Bulleted list"><svg><use href="#i-ul"/></svg></button>
            <button class="icon-btn" data-cmd="insertOrderedList" title="Numbered list"><svg><use href="#i-ol"/></svg></button>
            <button class="icon-btn" data-cmd="code" title="Code block"><svg><use href="#i-code"/></svg></button>
            <button class="icon-btn" data-cmd="hr" title="Divider"><svg><use href="#i-hr"/></svg></button>
            <span class="sep"></span>
            <button class="icon-btn" data-cmd="image" title="Insert image"><svg><use href="#i-image"/></svg></button>
            <button class="icon-btn" data-cmd="sketch" title="Insert sketch"><svg><use href="#i-pen"/></svg></button>
            <span class="spacer"></span>
            <button class="icon-btn" data-cmd="fix-all" title="Fix all corrections"><svg><use href="#i-sparkle"/></svg></button>
          </div>
          <div class="body" id="body" contenteditable="true" spellcheck="true"></div>
        </article>
      </div>`;

    const body = $('#body');
    body.innerHTML = Exporter.sanitizeHTML(post.content || '') || '<p><br></p>';
    editor = { post, body, title: $('#titleInput'), subtitle: $('#subtitleInput') };
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* older engines */ }
    renderTags();
    autoGrow(editor.title);
    autoGrow(editor.subtitle);
    updateEmptyState();
    bindEditor();
    new ResizeObserver(() => { if (editor) { autoGrow(editor.title); autoGrow(editor.subtitle); } }).observe($('#editorScroll'));
    scheduleCheck(50);
    if (!post.title && !htmlToText(post.content).trim()) setTimeout(() => editor && editor.title.focus(), 30);
  }

  function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }

  function updateEmptyState() {
    if (!editor) return;
    const b = editor.body;
    const empty = !b.textContent.trim() && !b.querySelector('img,hr,li,pre,blockquote,h1,h2,h3');
    b.classList.toggle('is-empty', empty);
  }

  function renderTags() {
    const post = currentPost();
    const el = $('#tags');
    if (!el || !post) return;
    el.innerHTML = post.tags.map((t, i) => `<span class="tag">#${esc(t)}<button data-action="remove-tag" data-i="${i}" title="Remove"><svg><use href="#i-x"/></svg></button></span>`).join('') +
      `<input class="tag-input" id="tagInput" placeholder="${post.tags.length ? '+ tag' : '+ Add tags'}" maxlength="30">`;
    $('#tagInput').addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const v = e.target.value.trim().replace(/^#/, '');
        if (v && !post.tags.includes(v)) { post.tags.push(v); await persistPost(post, { snapshot: 'none' }); }
        renderTags();
        $('#tagInput').focus();
      } else if (e.key === 'Backspace' && !e.target.value && post.tags.length) {
        post.tags.pop();
        await persistPost(post, { snapshot: 'none' });
        renderTags();
        $('#tagInput').focus();
      }
    });
  }

  // ---- saving ----
  const save = debounce(async () => {
    if (!editor) return;
    const { post, body, title, subtitle } = editor;
    const content = body.innerHTML;
    const text = blockTextAll(body);
    const wc = Proofreader.countWords(text);
    const delta = wc - (post.wordCount || 0);
    const changed = post.content !== content || post.title !== title.value || post.subtitle !== subtitle.value;
    post.title = title.value;
    post.subtitle = subtitle.value;
    post.content = content;
    post.wordCount = wc;
    if (changed) {
      await persistPost(post);
      await recordWords(delta);
    }
    const ss = $('#saveState');
    if (ss) { ss.textContent = 'Saved'; ss.classList.remove('saving'); }
    refreshCard(post);
  }, 450);

  function flushSave() { if (editor) save.flush(); }

  function markDirty() {
    const ss = $('#saveState');
    if (ss) { ss.textContent = 'Saving…'; ss.classList.add('saving'); }
    save();
  }

  function onBodyChanged() {
    updateEmptyState();
    markDirty();
    const wc = Proofreader.countWords(blockTextAll(editor.body));
    const chip = $('#wcChip');
    if (chip) chip.textContent = `${fmtNum(wc)} words`;
    scheduleCheck();
    if (state.panel === 'insights') renderInsightsSoon();
  }

  // ---- editor events ----
  function bindEditor() {
    const { body, title, subtitle, post } = editor;

    const syncPublish = () => {
      if (state.panel !== 'publish') return;
      const st = $('#stepTitle'), ss = $('#stepSubtitle'), cs = $('[data-action="copy-subtitle"]');
      if (st) st.textContent = title.value || 'Untitled';
      if (ss) ss.textContent = subtitle.value || '—';
      if (cs) cs.disabled = !subtitle.value;
      renderPublishChecklistOnly();
    };
    title.addEventListener('input', () => {
      autoGrow(title);
      $('#crumbTitle').textContent = title.value || 'Untitled';
      markDirty();
      syncPublish();
    });
    subtitle.addEventListener('input', () => { autoGrow(subtitle); markDirty(); syncPublish(); });
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); subtitle.focus(); } });
    subtitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || (e.key === 'ArrowDown' && subtitle.selectionStart === subtitle.value.length)) { e.preventDefault(); placeCaretStart(body); }
      if (e.key === 'Backspace' && !subtitle.value) { e.preventDefault(); title.focus(); }
    });

    body.addEventListener('input', (e) => {
      if (!body.firstElementChild) body.innerHTML = '<p><br></p>';
      if (e.inputType === 'insertText' && e.data === ' ') markdownShortcut();
      onBodyChanged();
      updateSlashMenu();
    });
    body.addEventListener('keydown', onBodyKeydown);
    body.addEventListener('paste', onPaste);
    body.addEventListener('drop', onDrop);
    body.addEventListener('click', (e) => {
      $$('img.selected', body).forEach((i) => i.classList.remove('selected'));
      if (e.target.tagName === 'IMG') e.target.classList.add('selected');
      if (e.target.closest('a') && (e.metaKey || e.ctrlKey)) window.open(e.target.closest('a').href, '_blank', 'noopener');
    });
    body.addEventListener('keyup', updateToolbarState);
    body.addEventListener('mouseup', updateToolbarState);

    $('#statusSelect').addEventListener('change', async (e) => {
      await setStatus(post, e.target.value);
      e.target.style.setProperty('--sc', statusOf(post.status).color);
      refreshCard(post);
      if (state.panel === 'publish') renderAssistant();
    });

    $('#blockSelect').addEventListener('mousedown', saveSelection);
    $('#blockSelect').addEventListener('change', (e) => {
      body.focus();
      restoreSelection();
      document.execCommand('formatBlock', false, e.target.value);
      onBodyChanged();
    });

    $('#toolbar').addEventListener('mousedown', (e) => { if (e.target.closest('button')) { e.preventDefault(); saveSelection(); } });
    $('#toolbar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd]');
      if (b) runCommand(b.dataset.cmd);
    });
    $('#editorScroll').addEventListener('scroll', hideBubble, { passive: true });
  }

  function placeCaretStart(el) {
    el.focus();
    const r = document.createRange();
    const first = el.firstElementChild || el;
    r.setStart(first, 0);
    r.collapse(true);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  let savedRange = null;
  function saveSelection() {
    const s = window.getSelection();
    if (s.rangeCount && editor && editor.body.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange();
  }
  function restoreSelection() {
    if (!savedRange) return;
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(savedRange);
  }

  function currentBlock() {
    const s = window.getSelection();
    if (!s.rangeCount || !editor) return null;
    let n = s.anchorNode;
    if (!editor.body.contains(n)) return null;
    while (n && n.parentNode !== editor.body) n = n.parentNode;
    return n && n.nodeType === 1 ? n : null;
  }

  function updateToolbarState() {
    if (!editor) return;
    saveSelection();
    const blk = currentBlock();
    const sel = $('#blockSelect');
    if (sel && blk) sel.value = /^H[1-3]$/.test(blk.tagName) ? blk.tagName.toLowerCase() : 'p';
    ['bold', 'italic', 'underline', 'strikeThrough'].forEach((c) => {
      const b = $(`#toolbar [data-cmd="${c}"]`);
      if (b) b.classList.toggle('active', document.queryCommandState(c));
    });
    const qb = $('#toolbar [data-cmd="quote"]');
    if (qb) qb.classList.toggle('active', !!(blk && blk.tagName === 'BLOCKQUOTE'));
  }

  function runCommand(cmd) {
    if (!editor) return;
    const { body } = editor;
    if (cmd === 'fix-all') { fixAllCorrections(); return; }
    if (cmd === 'image') { pickImage(); return; }
    if (cmd === 'sketch') { openSketch(); return; }
    body.focus();
    restoreSelection();
    const blk = currentBlock();
    switch (cmd) {
      case 'quote':
        document.execCommand('formatBlock', false, blk && blk.tagName === 'BLOCKQUOTE' ? 'p' : 'blockquote');
        break;
      case 'code':
        document.execCommand('formatBlock', false, blk && blk.tagName === 'PRE' ? 'p' : 'pre');
        break;
      case 'hr':
        document.execCommand('insertHTML', false, '<hr><p><br></p>');
        break;
      case 'link':
        promptLink();
        return;
      case 'h1': case 'h2': case 'h3': case 'p':
        document.execCommand('formatBlock', false, blk && blk.tagName.toLowerCase() === cmd && cmd !== 'p' ? 'p' : cmd);
        break;
      default:
        document.execCommand(cmd, false, null);
    }
    onBodyChanged();
    updateToolbarState();
  }

  async function promptLink() {
    saveSelection();
    const range = savedRange;
    const existing = range && (range.startContainer.parentElement || {}).closest ? range.startContainer.parentElement.closest('a') : null;
    const url = await promptDialog({ title: existing ? 'Edit link' : 'Add link', label: 'URL', value: existing ? existing.getAttribute('href') : 'https://', placeholder: 'https://example.com', allowEmpty: !!existing, confirm: existing ? 'Update' : 'Add link' });
    if (url === null) return;
    editor.body.focus();
    restoreSelection();
    if (!url.trim() || url.trim() === 'https://') {
      document.execCommand('unlink');
    } else {
      const href = /^(https?:|mailto:|#)/i.test(url.trim()) ? url.trim() : 'https://' + url.trim();
      if (window.getSelection().isCollapsed) document.execCommand('insertHTML', false, `<a href="${esc(href)}">${esc(href)}</a>`);
      else document.execCommand('createLink', false, href);
    }
    onBodyChanged();
  }

  // ---- markdown-style shortcuts ----
  function markdownShortcut() {
    const blk = currentBlock();
    if (!blk || blk.tagName !== 'P') return;
    const text = blk.textContent.replace(/ /g, ' ');
    const map = { '# ': 'h1', '## ': 'h2', '### ': 'h3', '> ': 'blockquote', '- ': 'ul', '* ': 'ul', '1. ': 'ol', '``` ': 'pre' };
    const kind = map[text];
    if (!kind) return;
    blk.innerHTML = '<br>';
    placeCaretStart(blk);
    const r = document.createRange(); r.setStart(blk, 0); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    if (kind === 'ul') document.execCommand('insertUnorderedList');
    else if (kind === 'ol') document.execCommand('insertOrderedList');
    else document.execCommand('formatBlock', false, kind);
  }

  function onBodyKeydown(e) {
    const mod = e.metaKey || e.ctrlKey;
    if (slash.open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); moveSlash(e.key === 'ArrowDown' ? 1 : -1); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); chooseSlash(); return; }
      if (e.key === 'Escape') { e.preventDefault(); closeSlash(); return; }
    }
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); promptLink(); return; }
    if (e.key === 'Tab') {
      const blk = currentBlock();
      if (blk && (blk.tagName === 'UL' || blk.tagName === 'OL')) { e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'indent'); return; }
    }
    if ((e.key === 'Backspace' || e.key === 'Delete')) {
      const img = $('img.selected', editor.body);
      if (img) { e.preventDefault(); (img.closest('figure') || img).remove(); onBodyChanged(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const blk = currentBlock();
      // Leave a heading/quote/code block on Enter at the end -> new paragraph.
      if (blk && /^(H1|H2|H3)$/.test(blk.tagName)) {
        const s = window.getSelection();
        const r = document.createRange(); r.selectNodeContents(blk); r.setStart(s.anchorNode, s.anchorOffset);
        if (!r.toString().length) {
          e.preventDefault();
          const p = document.createElement('p'); p.innerHTML = '<br>';
          blk.after(p); placeCaretStart(p);
          const rr = document.createRange(); rr.setStart(p, 0); rr.collapse(true); s.removeAllRanges(); s.addRange(rr);
          onBodyChanged();
        }
      } else if (blk && blk.tagName === 'BLOCKQUOTE' && !blk.textContent.trim()) {
        e.preventDefault();
        document.execCommand('formatBlock', false, 'p');
      }
    }
  }

  // ---- paste / drop ----
  function onPaste(e) {
    const dt = e.clipboardData;
    if (!dt) return;
    const files = Array.from(dt.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); files.forEach(insertImageFile); return; }
    const html = dt.getData('text/html');
    if (html) {
      e.preventDefault();
      const clean = Exporter.sanitizeHTML(html.replace(/<!--[\s\S]*?-->/g, ''));
      document.execCommand('insertHTML', false, clean);
      onBodyChanged();
    }
  }

  function onDrop(e) {
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (r) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
    }
    files.forEach(insertImageFile);
  }

  // ---- images ----
  function pickImage(cb) {
    const input = $('#filePicker');
    input.accept = 'image/*';
    input.value = '';
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return;
      if (cb) cb(f); else insertImageFile(f);
    };
    input.click();
  }

  function fileToDataURL(file, maxW = 1600) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const src = reader.result;
        if (/image\/(gif|svg)/.test(file.type) || file.size < 180 * 1024) { resolve(src); return; }
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxW / img.width);
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff';
          if (file.type !== 'image/png') ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86));
        };
        img.onerror = () => resolve(src);
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  }

  async function insertImageFile(file) {
    const url = await fileToDataURL(file);
    insertImageURL(url, file.name.replace(/\.[^.]+$/, ''));
  }

  function insertImageURL(url, alt = '') {
    if (!editor) return;
    editor.body.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, `<figure><img src="${url}" alt="${esc(alt)}"><figcaption></figcaption></figure><p><br></p>`);
    onBodyChanged();
    toast('Image added');
  }

  // ======================================================================
  // Slash menu
  // ======================================================================
  const SLASH_ITEMS = [
    { id: 'h1', label: 'Heading 1', hint: 'Big section heading', icon: 'i-h' },
    { id: 'h2', label: 'Heading 2', hint: 'Medium heading', icon: 'i-h' },
    { id: 'h3', label: 'Heading 3', hint: 'Small heading', icon: 'i-h' },
    { id: 'quote', label: 'Quote', hint: 'Call out a quotation', icon: 'i-quote' },
    { id: 'insertUnorderedList', label: 'Bulleted list', hint: 'Simple list', icon: 'i-ul' },
    { id: 'insertOrderedList', label: 'Numbered list', hint: 'Ordered steps', icon: 'i-ol' },
    { id: 'code', label: 'Code block', hint: 'Monospaced snippet', icon: 'i-code' },
    { id: 'hr', label: 'Divider', hint: 'Section break', icon: 'i-hr' },
    { id: 'image', label: 'Image', hint: 'Upload from device', icon: 'i-image' },
    { id: 'sketch', label: 'Sketch', hint: 'Draw with pen or finger', icon: 'i-pen' },
  ];
  const slash = { open: false, items: [], index: 0, block: null };

  function updateSlashMenu() {
    const blk = currentBlock();
    const text = blk ? blk.textContent : '';
    if (!blk || blk.tagName !== 'P' || !/^\/[a-z0-9 ]*$/i.test(text) || text.length > 16) { closeSlash(); return; }
    const q = text.slice(1).toLowerCase().trim();
    slash.items = SLASH_ITEMS.filter((i) => !q || i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    if (!slash.items.length) { closeSlash(); return; }
    slash.block = blk;
    slash.index = Math.min(slash.index, slash.items.length - 1);
    slash.open = true;
    const menu = $('#slashMenu');
    menu.innerHTML = `<div class="hd">Insert block</div>` + slash.items.map((i, n) => `
      <button class="slash-item ${n === slash.index ? 'active' : ''}" data-slash="${n}"><span class="ic"><svg><use href="#${i.icon}"/></svg></span><span><b>${i.label}</b><small>${i.hint}</small></span></button>`).join('');
    menu.hidden = false;
    const rect = blk.getBoundingClientRect();
    const top = rect.bottom + 6 + 330 > window.innerHeight ? Math.max(8, rect.top - 336) : rect.bottom + 6;
    menu.style.left = Math.min(rect.left, window.innerWidth - 270) + 'px';
    menu.style.top = top + 'px';
  }
  function moveSlash(d) {
    slash.index = (slash.index + d + slash.items.length) % slash.items.length;
    $$('.slash-item').forEach((b, i) => b.classList.toggle('active', i === slash.index));
    const a = $('.slash-item.active'); if (a) a.scrollIntoView({ block: 'nearest' });
  }
  function chooseSlash(i = slash.index) {
    const item = slash.items[i];
    const blk = slash.block;
    closeSlash();
    if (!item || !blk) return;
    blk.innerHTML = '<br>';
    const r = document.createRange(); r.setStart(blk, 0); r.collapse(true);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    savedRange = r.cloneRange();
    runCommand(item.id);
  }
  function closeSlash() { slash.open = false; slash.index = 0; $('#slashMenu').hidden = true; }

  // ======================================================================
  // Selection bubble
  // ======================================================================
  function updateBubble() {
    const bubble = $('#bubble');
    const s = window.getSelection();
    if (!editor || !s.rangeCount || s.isCollapsed || !editor.body.contains(s.anchorNode) || !editor.body.contains(s.focusNode)) { hideBubble(); return; }
    const r = s.getRangeAt(0).getBoundingClientRect();
    if (!r.width) { hideBubble(); return; }
    const on = (c) => (document.queryCommandState(c) ? 'on' : '');
    bubble.innerHTML = `
      <button data-bcmd="bold" class="${on('bold')}" title="Bold"><svg><use href="#i-bold"/></svg></button>
      <button data-bcmd="italic" class="${on('italic')}" title="Italic"><svg><use href="#i-italic"/></svg></button>
      <button data-bcmd="strikeThrough" class="${on('strikeThrough')}" title="Strike"><svg><use href="#i-strike"/></svg></button>
      <button data-bcmd="link" title="Link"><svg><use href="#i-link"/></svg></button>
      <span class="sep"></span>
      <button data-bcmd="h2" title="Heading">H2</button>
      <button data-bcmd="quote" title="Quote"><svg><use href="#i-quote"/></svg></button>
      <button data-bcmd="highlight" title="Highlight">🖍</button>
      <span class="sep"></span>
      <button data-bcmd="fix" title="Fix spelling, grammar & punctuation in the selection"><svg><use href="#i-sparkle"/></svg>Fix</button>`;
    bubble.hidden = false;
    bubble.style.left = Math.max(150, Math.min(window.innerWidth - 150, r.left + r.width / 2)) + 'px';
    bubble.style.top = Math.max(56, r.top - 10) + 'px';
  }
  const updateBubbleSoon = debounce(updateBubble, 120);
  function hideBubble() { const b = $('#bubble'); if (b) b.hidden = true; }

  $('#bubble').addEventListener('mousedown', (e) => e.preventDefault());
  $('#slashMenu').addEventListener('mousedown', (e) => e.preventDefault());
  $('#bubble').addEventListener('click', (e) => {
    const b = e.target.closest('[data-bcmd]');
    if (!b || !editor) return;
    const cmd = b.dataset.bcmd;
    saveSelection();
    if (cmd === 'fix') {
      const blocks = blocksInSelection();
      hideBubble();
      const n = fixBlocks(blocks);
      toast(n ? `Fixed ${n} issue${n === 1 ? '' : 's'} ✨` : 'Looks good — nothing to fix');
      return;
    }
    if (cmd === 'highlight') {
      const s = window.getSelection();
      const inMark = s.anchorNode && s.anchorNode.parentElement && s.anchorNode.parentElement.closest('mark');
      if (inMark) { inMark.replaceWith(...inMark.childNodes); }
      else {
        const r = s.getRangeAt(0);
        const m = document.createElement('mark');
        try { r.surroundContents(m); } catch (err) { document.execCommand('hiliteColor', false, '#ffe066'); }
      }
      onBodyChanged();
      hideBubble();
      return;
    }
    runCommand(cmd);
    setTimeout(updateBubble, 10);
  });

  // ======================================================================
  // Proofreading engine ↔ DOM
  // ======================================================================
  function proofBlocks(root) {
    return $$('p, h1, h2, h3, h4, li, blockquote, figcaption', root).filter((b) => !b.querySelector('p, h1, h2, h3, h4, li, blockquote, ul, ol, pre') && !b.closest('pre'));
  }

  /** Text of a block plus a map from text offsets back to DOM positions. */
  function blockText(block) {
    const segs = [];
    let text = '';
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (n.nodeType === 3 || n.tagName === 'BR' || n.tagName === 'IMG' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) { segs.push({ node: n, start: text.length, end: text.length + n.nodeValue.length }); text += n.nodeValue; }
      else { segs.push({ el: n, start: text.length, end: text.length + 1 }); text += '\n'; }
    }
    return { text, segs };
  }

  function blockTextAll(root) { return proofBlocks(root).map((b) => blockText(b).text).join('\n'); }

  function domPoint(segs, offset, preferEnd) {
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const inside = preferEnd ? offset > s.start && offset <= s.end : offset >= s.start && offset < s.end;
      if (inside || (i === segs.length - 1 && offset === s.end)) {
        if (s.node) return [s.node, offset - s.start];
        return offset > s.start ? [s.el.parentNode, Array.prototype.indexOf.call(s.el.parentNode.childNodes, s.el) + 1]
          : [s.el.parentNode, Array.prototype.indexOf.call(s.el.parentNode.childNodes, s.el)];
      }
    }
    return null;
  }

  function rangeFor(block, start, end) {
    const { segs } = blockText(block);
    if (!segs.length) return null;
    const a = domPoint(segs, start, false);
    const b = domPoint(segs, end, true) || a;
    if (!a) return null;
    const r = document.createRange();
    try { r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); } catch (e) { return null; }
    return r;
  }

  function blockCtx(block) {
    return { heading: /^H\d$/.test(block.tagName), listItem: block.tagName === 'LI', code: false };
  }

  const ignoreKey = (i) => `${i.rule}|${i.original}`;

  function runCheck() {
    if (!editor) return;
    const post = editor.post;
    const ignored = new Set(post.ignored || []);
    const issues = [];
    proofBlocks(editor.body).forEach((block, bi) => {
      const { text } = blockText(block);
      Proofreader.check(text, blockCtx(block)).forEach((i) => {
        if (ignored.has(ignoreKey(i))) return;
        issues.push({ ...i, block, bi, text });
      });
    });
    state.issues = issues;
    paintHighlights();
    const visible = visibleIssues();
    const badge = $('#issueBadge');
    const serious = visible.filter((i) => i.category !== 'style' && i.category !== 'typography').length;
    if (badge) { badge.hidden = !serious; badge.textContent = serious > 99 ? '99+' : serious; }
    if (state.panel === 'proofread') renderProofread();
    if (state.panel === 'publish') renderPublishChecklistOnly();
  }

  const scheduleCheck = debounce(() => runCheck(), 650);

  function visibleIssues() { return state.issues.filter((i) => state.settings.categories[i.category]); }

  function paintHighlights() {
    if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    Object.keys(CAT_META).forEach((c) => CSS.highlights.delete('pr-' + c));
    if (!state.settings.liveCheck && state.panel !== 'proofread') return;
    const groups = {};
    visibleIssues().forEach((i) => {
      const r = rangeFor(i.block, i.start, i.end);
      if (!r) return;
      (groups[i.category] = groups[i.category] || []).push(r);
    });
    Object.entries(groups).forEach(([c, ranges]) => CSS.highlights.set('pr-' + c, new Highlight(...ranges)));
  }

  function setActiveHighlight(issues) {
    if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    CSS.highlights.delete('pr-active');
    const ranges = (issues || []).map((i) => rangeFor(i.block, i.start, i.end)).filter(Boolean);
    if (ranges.length) CSS.highlights.set('pr-active', new Highlight(...ranges));
  }

  /** Replace [start,end) in a block, keeping native undo where possible. */
  function replaceInBlock(block, start, end, replacement) {
    const r = rangeFor(block, start, end);
    if (!r) return false;
    editor.body.focus({ preventScroll: true });
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
    let ok = false;
    try {
      ok = replacement ? document.execCommand('insertText', false, replacement) : (r.collapsed ? true : document.execCommand('delete'));
    } catch (e) { ok = false; }
    if (!ok) {
      r.deleteContents();
      if (replacement) r.insertNode(document.createTextNode(replacement));
      block.normalize();
    }
    return true;
  }

  function applyIssue(issue) {
    if (!editor || issue.replacement === null) return false;
    const { text } = blockText(issue.block);
    if (!issue.block.isConnected || text.slice(issue.start, issue.end) !== issue.original) return false;
    return replaceInBlock(issue.block, issue.start, issue.end, issue.replacement);
  }

  function applyGroup(group) {
    // Apply from the end of each block backwards so earlier offsets stay valid.
    const sorted = group.slice().sort((a, b) => b.bi - a.bi || b.start - a.start);
    let n = 0;
    sorted.forEach((i) => { if (applyIssue(i)) n++; });
    onBodyChanged();
    runCheck();
    return n;
  }

  /** Apply every auto-fix (spelling, grammar, punctuation, typography if enabled) to the given blocks. */
  function fixBlocks(blocks) {
    if (!editor) return 0;
    const cats = new Set(['spelling', 'grammar', 'punctuation', 'typography'].filter((c) => state.settings.categories[c]));
    const ignored = new Set(editor.post.ignored || []);
    let total = 0;
    blocks.forEach((block) => {
      for (let pass = 0; pass < 6; pass++) {
        const { text } = blockText(block);
        const fixes = Proofreader.check(text, blockCtx(block))
          .filter((i) => i.replacement !== null && cats.has(i.category) && !ignored.has(ignoreKey(i)))
          .sort((a, b) => b.start - a.start);
        if (!fixes.length) break;
        let floor = Infinity;
        fixes.forEach((i) => {
          if (i.end > floor) return;
          if (replaceInBlock(block, i.start, i.end, i.replacement)) total++;
          floor = i.start;
        });
      }
    });
    window.getSelection().removeAllRanges();
    onBodyChanged();
    runCheck();
    return total;
  }

  function fixAllCorrections() {
    if (!editor) return;
    const n = fixBlocks(proofBlocks(editor.body));
    toast(n ? `Fixed ${n} correction${n === 1 ? '' : 's'} ✨` : 'No corrections needed — nice writing!');
  }

  function blocksInSelection() {
    const s = window.getSelection();
    if (!s.rangeCount) return [];
    const r = s.getRangeAt(0);
    return proofBlocks(editor.body).filter((b) => r.intersectsNode(b));
  }

  // ======================================================================
  // Assistant panel
  // ======================================================================
  function togglePanel(name) {
    state.panel = state.panel === name ? null : name;
    saveLocation();
    const ws = $('.workspace');
    if (!ws) return;
    ws.classList.toggle('panel-open', !!state.panel);
    let aside = $('#assistant');
    if (state.panel && !aside) {
      aside = document.createElement('aside');
      aside.className = 'assistant';
      aside.id = 'assistant';
      ws.appendChild(aside);
    } else if (!state.panel && aside) {
      aside.remove();
    }
    $$('.editor-tools [data-panel]').forEach((b) => b.classList.toggle('active', b.dataset.panel === state.panel));
    if (state.panel) renderAssistant();
    paintHighlights();
  }

  function renderAssistant() {
    const aside = $('#assistant');
    if (!aside || !currentPost()) return;
    const tabs = [['proofread', 'i-sparkle', 'Proofread'], ['insights', 'i-chart', 'Insights'], ['publish', 'i-send', 'Publish'], ['history', 'i-history', 'History']];
    aside.innerHTML = `<div class="assistant-tabs">
      ${tabs.map(([id, icon, label]) => `<button class="${state.panel === id ? 'active' : ''}" data-panel="${id}" title="${label}"><svg><use href="#${icon}"/></svg>${state.panel === id ? label : ''}</button>`).join('')}
      <button class="close-panel" data-action="close-panel" title="Close"><svg><use href="#i-x"/></svg></button>
    </div><div class="assistant-body" id="assistantBody"></div>`;
    if (state.panel === 'proofread') { runCheck(); renderProofread(); }
    else if (state.panel === 'insights') renderInsights();
    else if (state.panel === 'publish') renderPublish();
    else if (state.panel === 'history') renderHistory();
  }

  // ---- proofread ----
  let issueCursor = {};
  function groupIssues(issues) {
    const map = new Map();
    issues.forEach((i) => {
      const key = GROUP_BY_RULE.has(i.rule) ? i.rule : `${i.rule}|${i.original.toLowerCase()}|${i.replacement}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(i);
    });
    const order = { spelling: 0, grammar: 1, punctuation: 2, typography: 3, style: 4 };
    return Array.from(map.entries()).map(([key, items]) => ({ key, items })).sort((a, b) =>
      order[a.items[0].category] - order[b.items[0].category] || a.items[0].bi - b.items[0].bi || a.items[0].start - b.items[0].start);
  }

  function contextHTML(i) {
    const before = i.text.slice(Math.max(0, i.start - 28), i.start);
    const after = i.text.slice(i.end, i.end + 28);
    const pre = (i.start > 28 ? '…' : '') + esc(before.replace(/^\S*\s/, i.start > 28 ? '' : '$&'));
    const post = esc(after) + (i.end + 28 < i.text.length ? '…' : '');
    const shown = (s) => esc(s).replace(/ /g, '·').replace(/\n/g, '↵') || '∅';
    if (i.replacement === null) return `${pre}<mark>${esc(i.original)}</mark>${post}`;
    const showDel = i.original.trim() ? esc(i.original) : shown(i.original);
    const showIns = i.replacement.trim() ? esc(i.replacement) : (i.replacement ? shown(i.replacement) : '');
    return `${pre}<del>${showDel}</del>${showIns ? `<ins>${showIns}</ins>` : ''}${post}`;
  }

  function renderProofread() {
    const body = $('#assistantBody');
    if (!body || state.panel !== 'proofread' || !editor) return;
    const words = Proofreader.countWords(blockTextAll(editor.body));
    const visible = visibleIssues();
    const score = Proofreader.score(visible, words);
    const scoreColor = score >= 90 ? 'var(--s-ready)' : score >= 70 ? 'var(--s-editing)' : 'var(--c-spelling)';
    const label = score >= 95 ? 'Polished' : score >= 85 ? 'Looking good' : score >= 70 ? 'Needs a pass' : 'Needs work';
    const counts = {};
    state.issues.forEach((i) => { counts[i.category] = (counts[i.category] || 0) + 1; });
    const fixable = visible.filter((i) => i.replacement !== null && i.category !== 'style').length;
    const groups = groupIssues(visible);
    const r = 27, c = 2 * Math.PI * r;

    body.innerHTML = `
      <div class="score-card" style="--score-c:${scoreColor}">
        <div class="score-ring"><svg viewBox="0 0 64 64"><circle r="${r}" cx="32" cy="32" fill="none" stroke="var(--bg-2)" stroke-width="6"/>
          <circle r="${r}" cx="32" cy="32" fill="none" stroke="${scoreColor}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(score / 100) * c} ${c}"/></svg><b>${words ? score : '—'}</b></div>
        <div class="txt"><b>${words ? label : 'Start writing'}</b><span>${visible.length ? `${visible.length} suggestion${visible.length === 1 ? '' : 's'} · ${fixable} auto-fixable` : 'Checked offline, as you type.'}</span></div>
      </div>
      <div class="cat-chips">
        ${Object.entries(CAT_META).map(([id, m]) => `<button class="cat-chip ${state.settings.categories[id] ? '' : 'off'}" data-cat="${id}" style="--cc:${m.color}" title="Show/hide ${m.label.toLowerCase()}"><i></i>${m.label} <b>${counts[id] || 0}</b></button>`).join('')}
      </div>
      ${fixable ? `<button class="btn primary block" data-action="fix-all" style="margin-bottom:14px"><svg><use href="#i-sparkle"/></svg>Fix all ${fixable} correction${fixable === 1 ? '' : 's'}</button>` : ''}
      <div id="issueList">${groups.length ? groups.map((g, gi) => issueCard(g, gi)).join('') : `
        <div class="all-clear"><div class="art">🌿</div><b>All clear</b>No ${Object.entries(state.settings.categories).filter(([, v]) => v).map(([k]) => k).join(', ')} issues found.</div>`}
      </div>
      ${(editor.post.ignored || []).length ? `<button class="btn ghost sm" data-action="reset-ignored" style="margin-top:6px">Restore ${editor.post.ignored.length} ignored suggestion${editor.post.ignored.length === 1 ? '' : 's'}</button>` : ''}`;
    body._groups = groups;
  }

  function issueCard(g, gi) {
    const i = g.items[0];
    const m = CAT_META[i.category];
    const fixable = i.replacement !== null;
    return `<div class="issue" data-group="${gi}" style="--cc:${m.color}">
      <div class="head">${m.label}${g.items.length > 1 ? `<span class="count">×${g.items.length}</span>` : ''}</div>
      <div class="msg">${esc(i.message)}</div>
      <div class="diff">${contextHTML(i)}</div>
      <div class="acts">
        ${fixable ? `<button class="btn sm primary" data-issue-act="accept"><svg><use href="#i-check"/></svg>${g.items.length > 1 ? `Accept all ${g.items.length}` : i.replacement === '' ? 'Remove' : 'Accept'}</button>` : ''}
        <button class="btn sm ghost" data-issue-act="ignore">${fixable ? 'Ignore' : 'Dismiss'}</button>
      </div>
    </div>`;
  }

  function issueGroupFromEvent(e) {
    const card = e.target.closest('.issue');
    const body = $('#assistantBody');
    if (!card || !body || !body._groups) return null;
    return { card, group: body._groups[+card.dataset.group] };
  }

  async function onIssueClick(e) {
    const hit = issueGroupFromEvent(e);
    if (!hit) return;
    const { card, group } = hit;
    const act = e.target.closest('[data-issue-act]');
    if (act && act.dataset.issueAct === 'accept') {
      card.classList.add('leaving');
      const n = applyGroup(group.items);
      if (!n) toast('That text changed — rechecked.');
      return;
    }
    if (act && act.dataset.issueAct === 'ignore') {
      const post = editor.post;
      post.ignored = Array.from(new Set([...(post.ignored || []), ...group.items.map(ignoreKey)]));
      await persistPost(post, { snapshot: 'none' });
      card.classList.add('leaving');
      setTimeout(runCheck, 180);
      return;
    }
    // Jump to the occurrence (cycling through a group).
    const k = group.key;
    issueCursor[k] = ((issueCursor[k] ?? -1) + 1) % group.items.length;
    const i = group.items[issueCursor[k]];
    const r = rangeFor(i.block, i.start, i.end);
    if (r) {
      const rect = r.getBoundingClientRect();
      const sc = $('#editorScroll');
      const srect = sc.getBoundingClientRect();
      sc.scrollTo({ top: sc.scrollTop + rect.top - srect.top - srect.height / 3, behavior: 'smooth' });
      setActiveHighlight([i]);
      setTimeout(() => setActiveHighlight(null), 1600);
    }
  }

  // ---- insights ----
  const renderInsightsSoon = debounce(() => { if (state.panel === 'insights') renderInsights(); }, 600);

  function renderInsights() {
    const body = $('#assistantBody');
    if (!body || !editor) return;
    const post = editor.post;
    const text = proofBlocks(editor.body).map((b) => blockText(b).text).join('\n');
    const s = Proofreader.stats(text);
    const paragraphs = $$('p', editor.body).filter((p) => p.textContent.trim()).length;
    const goal = post.goal || 0;

    // Sentence rhythm chart.
    const lens = s.sentenceLengths.slice(0, 120);
    const maxLen = Math.max(30, ...lens);
    const bw = lens.length ? 300 / lens.length : 0;
    const colorFor = (n) => (n < 8 ? 'var(--c-typography)' : n <= 20 ? 'var(--accent)' : n <= 32 ? 'var(--s-editing)' : 'var(--c-spelling)');
    const bars = lens.map((n, i) => {
      const h = Math.max(2, (n / maxLen) * 84);
      return `<rect x="${(i * bw + bw * 0.15).toFixed(2)}" y="${(88 - h).toFixed(2)}" width="${Math.max(1, bw * 0.7).toFixed(2)}" height="${h.toFixed(2)}" rx="${Math.min(2, bw / 4).toFixed(2)}" fill="${colorFor(n)}"><title>${n} words</title></rect>`;
    }).join('');

    // Word frequency.
    const freq = {};
    (text.toLowerCase().match(/[a-z][a-z'’-]{2,}/g) || []).forEach((w) => { if (!STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1; });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const topMax = top.length ? top[0][1] : 1;

    // Readability gauge (semicircle).
    const ang = Math.PI * (1 - s.flesch / 100);
    const nx = 100 + 70 * Math.cos(ang), ny = 100 - 70 * Math.sin(ang);
    const headings = $$('h1, h2, h3', editor.body).filter((h) => h.textContent.trim());

    body.innerHTML = `
      <div class="panel-section"><h4><svg style="width:13px;height:13px"><use href="#i-target"/></svg>Word goal</h4>
        <div class="goal-row">${ring(s.words, goal || Math.max(500, Math.ceil(s.words / 500) * 500), 'words', 64, 7)}
          <div style="flex:1"><b style="font-size:13px">${goal ? (s.words >= goal ? 'Goal reached 🎉' : `${fmtNum(goal - s.words)} words to go`) : 'Set a target length'}</b>
          <div style="display:flex;gap:6px;align-items:center;margin-top:6px"><input class="input" id="goalInput" type="number" min="0" step="100" value="${goal || ''}" placeholder="e.g. 1200"><small class="muted">words</small></div></div>
        </div></div>
      <div class="panel-section"><h4>At a glance</h4><div class="mini-stats">
        <div class="mini-stat"><b>${fmtNum(s.words)}</b><span>words</span></div>
        <div class="mini-stat"><b>${s.readingMinutes}m</b><span>read time</span></div>
        <div class="mini-stat"><b>${s.sentences}</b><span>sentences</span></div>
        <div class="mini-stat"><b>${paragraphs}</b><span>paragraphs</span></div>
        <div class="mini-stat"><b>${s.avgSentence}</b><span>avg sentence</span></div>
        <div class="mini-stat"><b>${fmtNum(s.characters)}</b><span>characters</span></div>
      </div></div>
      <div class="panel-section"><h4>Readability</h4><div class="gauge">
        <svg viewBox="0 0 200 110">
          <defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#e5484d"/><stop offset=".5" stop-color="#f5a524"/><stop offset="1" stop-color="#30a46c"/></linearGradient></defs>
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#gg)" stroke-width="14" stroke-linecap="round"/>
          ${s.words ? `<line x1="100" y1="100" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--text)" stroke-width="3" stroke-linecap="round"/><circle cx="100" cy="100" r="6" fill="var(--text)"/>` : ''}
        </svg>
        <div class="g-label"><b>${s.words ? `${s.flesch} · ${s.readability}` : '—'}</b><span>${s.words ? `Reading grade ${s.grade} · Flesch reading ease` : 'Write a few sentences to see this'}</span></div>
      </div></div>
      <div class="panel-section"><h4>Sentence rhythm <small>${lens.length} sentences</small></h4><div class="rhythm">
        <svg viewBox="0 0 300 90" preserveAspectRatio="none">${bars || '<text x="150" y="50" text-anchor="middle" fill="var(--text-3)" font-size="12">No sentences yet</text>'}</svg>
        <div class="rhythm-legend"><span><i style="background:var(--c-typography)"></i>Short</span><span><i style="background:var(--accent)"></i>Medium</span><span><i style="background:var(--s-editing)"></i>Long</span><span><i style="background:var(--c-spelling)"></i>Very long</span></div>
      </div><small class="muted" style="display:block;margin-top:6px;font-size:11.5px">Great prose varies its rhythm. Mix short punchy sentences with longer flowing ones.</small></div>
      ${top.length ? `<div class="panel-section"><h4>Most-used words</h4><div class="bars">${top.map(([w, n]) => `<div class="bar-row"><span>${esc(w)}</span><div class="track"><i style="width:${(n / topMax) * 100}%"></i></div><b>${n}</b></div>`).join('')}</div></div>` : ''}
      ${headings.length ? `<div class="panel-section"><h4>Outline</h4><div class="outline">${headings.map((h, i) => `<button class="${h.tagName.toLowerCase()}" data-outline="${i}">${esc(h.textContent)}</button>`).join('')}</div></div>` : ''}`;

    $('#goalInput').addEventListener('change', async (e) => {
      post.goal = Math.max(0, parseInt(e.target.value, 10) || 0);
      await persistPost(post, { snapshot: 'none' });
      renderInsights();
    });
    $$('[data-outline]', body).forEach((b) => b.addEventListener('click', () => headings[+b.dataset.outline].scrollIntoView({ behavior: 'smooth', block: 'center' })));
  }

  // ---- publish ----
  function publishChecks() {
    const post = { ...editor.post, title: editor.title.value, subtitle: editor.subtitle.value };
    const words = Proofreader.countWords(blockTextAll(editor.body));
    const serious = state.issues.filter((i) => i.category === 'spelling' || i.category === 'grammar').length;
    return [
      { ok: !!post.title.trim(), label: 'Title', hint: post.title.trim() ? `${post.title.trim().length} chars` : 'Missing' },
      { ok: !!post.subtitle.trim(), label: 'Subtitle', hint: post.subtitle.trim() ? 'Shown in email previews' : 'Recommended', warn: true },
      { ok: !!post.cover, label: 'Cover image', hint: post.cover ? (post.cover.type === 'image' ? 'Photo' : 'Gradient') : 'Optional', warn: true },
      { ok: words >= 300, label: 'Length', hint: `${fmtNum(words)} words`, warn: words > 0 },
      { ok: serious === 0, label: 'Spelling & grammar', hint: serious ? `${serious} to review` : 'Clean' },
      { ok: post.tags.length > 0, label: 'Tags', hint: post.tags.length ? post.tags.map((t) => '#' + t).join(' ') : 'Optional', warn: true },
    ];
  }

  function checklistHTML() {
    return publishChecks().map((c) => `<div class="check-item ${c.ok ? 'ok' : c.warn ? 'warn' : 'bad'}"><span class="tick"><svg><use href="#i-check"/></svg></span>${c.label}<small>${esc(c.hint)}</small></div>`).join('');
  }

  function renderPublishChecklistOnly() {
    const el = $('#checklist');
    if (el) el.innerHTML = checklistHTML();
  }

  function renderPublish() {
    const body = $('#assistantBody');
    if (!body || !editor) return;
    flushSave();
    const post = editor.post;
    body.innerHTML = `
      <div class="substack-banner"><b>Ready for Substack</b><p>Inkwell prepares your post offline. When you're online, open Substack → <i>New post</i> and paste each part.</p></div>
      <div class="panel-section"><h4>Pre-flight checklist</h4><div class="checklist" id="checklist">${checklistHTML()}</div></div>
      <div class="panel-section"><h4>Paste into Substack</h4><div class="steps">
        <div class="step"><div><b>Title</b><small id="stepTitle">${esc(post.title || 'Untitled')}</small></div><button class="btn sm" data-action="copy-title"><svg><use href="#i-copy"/></svg>Copy</button></div>
        <div class="step"><div><b>Subtitle</b><small id="stepSubtitle">${esc(post.subtitle || '—')}</small></div><button class="btn sm" data-action="copy-subtitle" ${post.subtitle ? '' : 'disabled'}><svg><use href="#i-copy"/></svg>Copy</button></div>
        <div class="step"><div><b>Post body</b><small>Rich text — headings, links, quotes, lists, images</small></div><button class="btn sm primary" data-action="copy-body"><svg><use href="#i-copy"/></svg>Copy</button></div>
      </div></div>
      <div class="panel-section"><h4>Preview & export</h4>
        <button class="btn block" data-action="preview" style="margin-bottom:8px"><svg><use href="#i-eye"/></svg>Preview as a Substack post</button>
        <div class="btn-grid">
          <button class="btn sm" data-action="export-md"><svg><use href="#i-download"/></svg>.md</button>
          <button class="btn sm" data-action="export-html"><svg><use href="#i-download"/></svg>.html</button>
          <button class="btn sm" data-action="export-zip"><svg><use href="#i-download"/></svg>.zip</button>
        </div>
        <small class="muted" style="display:block;margin-top:6px;font-size:11.5px">The .zip bundles Markdown, HTML and all images as files — handy if Substack doesn't pick up an image on paste.</small>
      </div>
      <div class="panel-section"><h4>After publishing</h4>
        <label class="field"><span>Substack URL</span><input class="input" id="pubUrl" placeholder="https://you.substack.com/p/…" value="${esc(post.publishedUrl || '')}"></label>
        ${post.status === 'published'
    ? `<div class="check-item ok"><span class="tick"><svg><use href="#i-check"/></svg></span>Published${post.publishedAt ? ` ${new Date(post.publishedAt).toLocaleDateString()}` : ''}<small>${post.publishedUrl ? `<a href="${esc(post.publishedUrl)}" target="_blank" rel="noopener">Open ↗</a>` : ''}</small></div>`
    : `<button class="btn primary block" data-action="mark-published"><svg><use href="#i-send"/></svg>Mark as published</button>`}
      </div>`;
    $('#pubUrl').addEventListener('change', async (e) => {
      post.publishedUrl = e.target.value.trim();
      await persistPost(post, { snapshot: 'none' });
    });
  }

  async function copyBody() {
    flushSave();
    const post = currentPost();
    const html = Exporter.substackBody(post);
    const ok = await Exporter.copyRich(html, htmlToText(post.content));
    toast(ok ? 'Post body copied — paste it into the Substack editor' : 'Copy failed — try the .html export instead');
  }

  // ---- history ----
  async function renderHistory() {
    const body = $('#assistantBody');
    if (!body || !editor) return;
    const post = editor.post;
    const versions = (await DB.byIndex('versions', 'postId', post.id)).sort((a, b) => b.createdAt - a.createdAt);
    if (state.panel !== 'history' || !$('#assistantBody')) return;
    body.innerHTML = `
      <button class="btn primary block" data-action="snapshot" style="margin-bottom:14px"><svg><use href="#i-history"/></svg>Save a snapshot now</button>
      <div class="panel-section"><h4>Timeline <small>${versions.length} version${versions.length === 1 ? '' : 's'}</small></h4>
      ${versions.length ? `<div class="timeline">${versions.map((v) => `
        <div class="version"><span class="dot"></span><div><b>${esc(v.label || 'Snapshot')}</b>
        <small>${new Date(v.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${fmtNum(v.wordCount || 0)} words</small></div>
        <button class="btn sm ghost" data-version-preview="${v.id}" title="Preview"><svg><use href="#i-eye"/></svg></button>
        <button class="btn sm" data-version-restore="${v.id}">Restore</button></div>`).join('')}</div>`
    : '<div class="all-clear"><div class="art">🕰️</div><b>No versions yet</b>Inkwell auto-saves a version every 10 minutes while you write.</div>'}
      </div>`;
    body._versions = versions;
  }

  async function restoreVersion(id) {
    const v = ($('#assistantBody')._versions || []).find((x) => x.id === id);
    if (!v || !editor) return;
    const ok = await confirmDialog({ title: 'Restore this version?', message: 'Your current text will be saved as a snapshot first, so you can always come back.', confirm: 'Restore' });
    if (!ok) return;
    flushSave();
    const post = editor.post;
    await createVersion(post, 'Before restore');
    post.title = v.title; post.subtitle = v.subtitle; post.content = v.content; post.wordCount = v.wordCount;
    await persistPost(post, { snapshot: 'none' });
    renderEditor();
    renderAssistant();
    refreshCard(post);
    toast('Version restored');
  }

  // ======================================================================
  // Modals
  // ======================================================================
  function modal(html, { cls = '', onClose } = {}) {
    const root = $('#modalRoot');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
    root.appendChild(wrap);
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey, true); onClose && onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
    wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    return { el: wrap.firstElementChild, close };
  }

  function confirmDialog({ title, message, confirm = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      let result = false;
      const m = modal(`
        <div class="modal-head"><h2>${esc(title)}</h2></div>
        <div class="modal-body"><p style="margin:0;color:var(--text-2)">${esc(message)}</p></div>
        <div class="modal-foot"><button class="btn ghost" data-close>Cancel</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-ok>${esc(confirm)}</button></div>`,
      { onClose: () => resolve(result) });
      $('[data-ok]', m.el).addEventListener('click', () => { result = true; m.close(); });
      setTimeout(() => $('[data-ok]', m.el).focus(), 20);
    });
  }

  function promptDialog({ title, label, value = '', placeholder = '', confirm = 'Save', allowEmpty = false }) {
    return new Promise((resolve) => {
      let result = null;
      const m = modal(`
        <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close><svg><use href="#i-x"/></svg></button></div>
        <div class="modal-body"><label class="field"><span>${esc(label)}</span><input class="input" id="promptInput" value="${esc(value)}" placeholder="${esc(placeholder)}"></label></div>
        <div class="modal-foot"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-ok>${esc(confirm)}</button></div>`,
      { onClose: () => resolve(result) });
      const input = $('#promptInput', m.el);
      const ok = () => { if (!allowEmpty && !input.value.trim()) { input.focus(); return; } result = input.value; m.close(); };
      $('[data-ok]', m.el).addEventListener('click', ok);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
      setTimeout(() => { input.focus(); input.select(); }, 20);
    });
  }

  function projectDialog(project) {
    const editing = !!project;
    const draft = project ? { ...project } : newProject({ emoji: EMOJIS[Math.floor(Math.random() * 8)] });
    const m = modal(`
      <div class="modal-head"><h2>${editing ? 'Edit project' : 'New project'}</h2><button class="icon-btn" data-close><svg><use href="#i-x"/></svg></button></div>
      <div class="modal-body">
        <div class="project-preview" id="ppv"><span class="emoji"></span><div><b></b><div style="font-size:12.5px;opacity:.9" class="pdesc"></div></div></div>
        <label class="field"><span>Name</span><input class="input" id="pName" maxlength="60" placeholder="e.g. Weekly Essays" value="${esc(editing ? draft.name : '')}"></label>
        <label class="field"><span>Description</span><input class="input" id="pDesc" maxlength="140" placeholder="What is this publication or series about?" value="${esc(draft.description)}"></label>
        <div class="field"><span>Icon</span><div class="emoji-grid" id="pEmoji">${EMOJIS.map((e) => `<button type="button" data-emoji="${e}" class="${e === draft.emoji ? 'active' : ''}">${e}</button>`).join('')}</div></div>
        <div class="field"><span>Color</span><div class="swatches" id="pColor">${PALETTE.map((p, i) => `<button type="button" data-color="${i}" class="${i === draft.color ? 'active' : ''}" style="--pa:${p[0]};--pb:${p[1]}"></button>`).join('')}</div></div>
      </div>
      <div class="modal-foot">
        ${editing ? '<button class="btn danger left" data-del><svg><use href="#i-trash"/></svg>Delete</button>' : ''}
        <button class="btn ghost" data-close>Cancel</button><button class="btn primary" data-ok>${editing ? 'Save' : 'Create project'}</button>
      </div>`);
    const el = m.el;
    const sync = () => {
      const ppv = $('#ppv', el);
      ppv.setAttribute('style', projectVars(draft));
      $('.emoji', ppv).textContent = draft.emoji;
      $('b', ppv).textContent = $('#pName', el).value || 'Untitled project';
      $('.pdesc', ppv).textContent = $('#pDesc', el).value || 'A home for related posts';
    };
    sync();
    $('#pName', el).addEventListener('input', sync);
    $('#pDesc', el).addEventListener('input', sync);
    $('#pEmoji', el).addEventListener('click', (e) => {
      const b = e.target.closest('[data-emoji]'); if (!b) return;
      draft.emoji = b.dataset.emoji; $$('#pEmoji button', el).forEach((x) => x.classList.toggle('active', x === b)); sync();
    });
    $('#pColor', el).addEventListener('click', (e) => {
      const b = e.target.closest('[data-color]'); if (!b) return;
      draft.color = +b.dataset.color; $$('#pColor button', el).forEach((x) => x.classList.toggle('active', x === b)); sync();
    });
    const submit = async () => {
      const name = $('#pName', el).value.trim();
      if (!name) { $('#pName', el).focus(); return; }
      draft.name = name;
      draft.description = $('#pDesc', el).value.trim();
      if (editing) Object.assign(project, draft); else state.projects.push(draft);
      await persistProject(editing ? project : draft);
      m.close();
      if (editing) { render(); toast('Project updated'); } else { go('project', { projectId: draft.id, postId: null }); toast(`Created ${draft.emoji} ${draft.name}`); }
    };
    $('[data-ok]', el).addEventListener('click', submit);
    $('#pName', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    if (editing) $('[data-del]', el).addEventListener('click', async () => { m.close(); deleteProject(project); });
    setTimeout(() => $('#pName', el).focus(), 30);
  }

  function coverDialog() {
    const post = currentPost();
    if (!post) return;
    const m = modal(`
      <div class="modal-head"><h2>Cover</h2><button class="icon-btn" data-close><svg><use href="#i-x"/></svg></button></div>
      <div class="modal-body">
        <button class="btn block" data-upload style="margin-bottom:14px;height:44px"><svg><use href="#i-upload"/></svg>Upload a photo</button>
        <div class="field"><span>Or choose a gradient</span><div class="cover-grid">${COVERS.map((c, i) => `<button data-cover="${i}" style="background-image:${c}"></button>`).join('')}</div></div>
      </div>
      ${post.cover ? '<div class="modal-foot"><button class="btn danger left" data-remove>Remove cover</button></div>' : ''}`, { cls: 'wide' });
    const setCover = async (cover) => {
      flushSave();
      post.cover = cover;
      await persistPost(post, { snapshot: 'none' });
      m.close();
      renderEditor();
      refreshCard(post);
    };
    $('[data-upload]', m.el).addEventListener('click', () => pickImage(async (f) => setCover({ type: 'image', value: await fileToDataURL(f, 2000) })));
    $('.cover-grid', m.el).addEventListener('click', (e) => { const b = e.target.closest('[data-cover]'); if (b) setCover({ type: 'gradient', value: COVERS[+b.dataset.cover] }); });
    const rm = $('[data-remove]', m.el);
    if (rm) rm.addEventListener('click', () => setCover(null));
  }

  function openSketch() {
    if (!editor) return;
    saveSelection();
    let pad;
    const m = modal(`<div class="modal-head"><h2>Sketch</h2><button class="icon-btn" data-close><svg><use href="#i-x"/></svg></button></div><div class="sketch" id="sketchHost"></div>`,
      { cls: 'xl', onClose: () => pad && pad.cleanup() });
    pad = Sketchpad($('#sketchHost', m.el), {
      onDone: (url) => { m.close(); insertImageURL(url, 'Sketch'); },
      onCancel: () => m.close(),
    });
  }

  function previewDialog() {
    flushSave();
    const post = currentPost();
    if (!post) return;
    const proj = getProject(post.projectId);
    const author = state.settings.author || 'You';
    const words = post.wordCount || 0;
    modal(`
      <div class="modal-head"><h2>Preview</h2><span class="muted" style="font-size:12px">How your post will look on Substack</span><button class="icon-btn" data-close><svg><use href="#i-x"/></svg></button></div>
      <div class="preview-frame" style="${projectVars(proj)}"><div class="preview-device">
        <div class="pv-pub"><i>${esc(proj ? proj.emoji : '📝')}</i>${esc(proj ? proj.name : 'My Publication')}</div>
        ${post.cover ? `<div class="preview-cover" style='${coverCSS(post.cover)}'></div>` : ''}
        <h1 class="pv-title">${esc(post.title || 'Untitled')}</h1>
        ${post.subtitle ? `<p class="pv-sub">${esc(post.subtitle)}</p>` : ''}
        <div class="pv-author"><span class="av">${esc(author[0].toUpperCase())}</span><div><b style="color:#1d1d1f">${esc(author)}</b><br>${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${Math.max(1, Math.round(words / 238))} min read</div></div>
        <div class="pv-body">${Exporter.substackBody(post)}</div>
        <div class="pv-sub-btn"><b>Thanks for reading! Subscribe for free to receive new posts.</b><span>Subscribe</span></div>
      </div></div>`, { cls: 'xl' });
  }

  async function settingsDialog() {
    const s = state.settings;
    const est = await DB.estimate();
    const seg = (key, opts) => `<div class="segmented" data-seg="${key}">${opts.map(([v, l]) => `<button class="${String(s[key]) === String(v) ? 'active' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
    const m = modal(`
      <div class="modal-head"><h2>Settings</h2><button class="icon-btn" data-close><svg><use href="#i-x"/></svg></button></div>
      <div class="modal-body">
        <div class="settings-group">Appearance</div>
        <div class="settings-row"><div><b>Theme</b></div>${seg('theme', [['system', 'Auto'], ['light', 'Light'], ['sepia', 'Sepia'], ['dark', 'Dark']])}</div>
        <div class="settings-row"><div><b>Editor font</b></div>${seg('font', [['serif', 'Serif'], ['sans', 'Sans'], ['mono', 'Mono']])}</div>
        <div class="settings-row"><div><b>Text size</b><small id="fsLabel">${s.fontSize}px</small></div><input type="range" min="15" max="26" value="${s.fontSize}" id="fsRange" style="width:160px;accent-color:var(--accent)"></div>
        <div class="settings-row"><div><b>Page width</b></div>${seg('width', [['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']])}</div>
        <div class="settings-group">Writing</div>
        <div class="settings-row"><div><b>Your name</b><small>Used in greetings and the Substack preview</small></div><input class="input" id="setAuthor" style="width:180px" value="${esc(s.author)}" placeholder="Jane Writer"></div>
        <div class="settings-row"><div><b>Daily word goal</b></div><input class="input" id="setGoal" type="number" min="50" step="50" style="width:110px" value="${s.dailyGoal}"></div>
        <div class="settings-row"><div><b>Live proofreading</b><small>Underline issues while you type</small></div><label class="switch"><input type="checkbox" id="setLive" ${s.liveCheck ? 'checked' : ''}><i></i></label></div>
        <div class="settings-row"><div><b>Smart typography</b><small>Suggest curly quotes and em dashes</small></div><label class="switch"><input type="checkbox" id="setTypo" ${s.categories.typography ? 'checked' : ''}><i></i></label></div>
        <div class="settings-group">Your data</div>
        <div class="settings-row"><div><b>Storage</b><small>${est ? `${(est.usage / 1048576).toFixed(1)} MB used${est.quota ? ` of ${(est.quota / 1073741824).toFixed(1)} GB available` : ''} · ${est.persisted ? 'Protected from automatic cleanup' : 'Not yet protected from browser cleanup'}` : 'Stored in this browser on this device'}</small>
          ${est && est.quota ? `<div class="meter"><i style="width:${Math.max(1, Math.min(100, (est.usage / est.quota) * 100))}%"></i></div>` : ''}</div>
          ${est && !est.persisted ? '<button class="btn sm" data-persist>Protect</button>' : ''}</div>
        <div class="settings-row"><div><b>Backup</b><small>Everything — projects, posts, images, history — in one file</small></div>
          <button class="btn sm" data-backup><svg><use href="#i-download"/></svg>Export</button><button class="btn sm" data-restore><svg><use href="#i-upload"/></svg>Import</button></div>
        <div class="settings-row"><div><b>Export all posts</b><small>A .zip of Markdown + HTML, one folder per project</small></div><button class="btn sm" data-export-all><svg><use href="#i-download"/></svg>Export .zip</button></div>
        <p class="muted" style="font-size:12px;margin:14px 0 4px">Inkwell runs entirely offline. Nothing you write leaves this device unless you export or copy it.</p>
      </div>`, { cls: 'wide', onClose: () => { flushSave(); render(); } });
    const el = m.el;
    $$('[data-seg]', el).forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      s[g.dataset.seg] = b.dataset.v;
      $$('button', g).forEach((x) => x.classList.toggle('active', x === b));
      saveSettings(); applyTheme();
    }));
    $('#fsRange', el).addEventListener('input', (e) => { s.fontSize = +e.target.value; $('#fsLabel', el).textContent = s.fontSize + 'px'; saveSettings(); applyTheme(); });
    $('#setAuthor', el).addEventListener('change', (e) => { s.author = e.target.value.trim(); saveSettings(); });
    $('#setGoal', el).addEventListener('change', (e) => { s.dailyGoal = Math.max(50, parseInt(e.target.value, 10) || 500); saveSettings(); });
    $('#setLive', el).addEventListener('change', (e) => { s.liveCheck = e.target.checked; saveSettings(); paintHighlights(); });
    $('#setTypo', el).addEventListener('change', (e) => { s.categories.typography = e.target.checked; saveSettings(); runCheck(); });
    const persistBtn = $('[data-persist]', el);
    if (persistBtn) persistBtn.addEventListener('click', async () => { const ok = await DB.persist(); toast(ok ? 'Storage is now protected' : 'Your browser declined — install the app to improve this'); m.close(); });
    $('[data-backup]', el).addEventListener('click', exportBackup);
    $('[data-restore]', el).addEventListener('click', () => { m.close(); importBackup(); });
    $('[data-export-all]', el).addEventListener('click', exportAllZip);
  }

  // ---- menus ----
  function menu(anchor, items) {
    closeMenus();
    const el = document.createElement('div');
    el.className = 'menu';
    el.innerHTML = items.map((it) => {
      if (it === '-') return '<hr>';
      if (it.label && !it.run) return `<div class="menu-label">${esc(it.label)}</div>`;
      return `<button class="${it.danger ? 'danger' : ''}" data-i="${items.indexOf(it)}">${it.icon ? `<svg><use href="#${it.icon}"/></svg>` : ''}${esc(it.text)}</button>`;
    }).join('');
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
    el.style.top = (r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      closeMenus();
      items[+b.dataset.i].run();
    });
    setTimeout(() => document.addEventListener('mousedown', outside), 0);
    function outside(e) { if (!el.contains(e.target)) { closeMenus(); } }
    el._outside = outside;
  }
  function closeMenus() { $$('.menu').forEach((m) => { document.removeEventListener('mousedown', m._outside); m.remove(); }); }

  function postMenu(anchor) {
    const post = currentPost();
    if (!post) return;
    const others = state.projects.filter((p) => p.id !== post.projectId);
    menu(anchor, [
      { text: post.pinned ? 'Unpin' : 'Pin to top', icon: 'i-pin', run: async () => { post.pinned = !post.pinned; await persistPost(post, { snapshot: 'none' }); renderCollection(); } },
      { text: 'Duplicate', icon: 'i-copy', run: duplicatePost },
      { text: 'Preview', icon: 'i-eye', run: previewDialog },
      { text: 'Cover…', icon: 'i-image', run: coverDialog },
      '-',
      ...(others.length ? [{ label: 'Move to' }, ...others.map((p) => ({ text: `${p.emoji} ${p.name}`, run: () => movePost(post, p.id) }))] : []),
      '-',
      { text: 'Export Markdown', icon: 'i-download', run: () => exportPost('md') },
      { text: 'Export HTML', icon: 'i-download', run: () => exportPost('html') },
      { text: 'Print / Save as PDF', icon: 'i-docs', run: () => window.print() },
      '-',
      { text: 'Delete post', icon: 'i-trash', danger: true, run: () => deletePost(post) },
    ]);
  }

  function projectMenu(anchor) {
    const proj = getProject(state.projectId);
    if (!proj) return;
    menu(anchor, [
      { text: 'Edit project', icon: 'i-settings', run: () => projectDialog(proj) },
      { text: 'Open board', icon: 'i-board', run: () => go('board', { projectId: proj.id }) },
      { text: 'Export project (.zip)', icon: 'i-download', run: () => exportProjectZip(proj) },
      '-',
      { text: 'Delete project', icon: 'i-trash', danger: true, run: () => deleteProject(proj) },
    ]);
  }

  // ======================================================================
  // Actions
  // ======================================================================
  async function createPost(projectId, data = {}) {
    if (!projectId) {
      if (!state.projects.length) {
        const p = newProject({ name: 'My Blog', emoji: '📝', color: 0 });
        state.projects.push(p);
        await persistProject(p);
      }
      projectId = state.projects.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
    }
    flushSave();
    const post = newPost(projectId, data);
    state.posts.push(post);
    await DB.put('posts', post);
    const proj = getProject(projectId);
    if (proj) await persistProject(proj);
    state.view = 'project';
    state.projectId = projectId;
    state.postId = post.id;
    state.statusFilter = 'all';
    render();
    saveLocation();
    return post;
  }

  async function duplicatePost() {
    flushSave();
    const src = currentPost();
    if (!src) return;
    const copy = { ...newPost(src.projectId), title: src.title ? src.title + ' (copy)' : '', subtitle: src.subtitle, content: src.content, tags: [...src.tags], cover: src.cover, wordCount: src.wordCount, status: 'draft' };
    state.posts.push(copy);
    await DB.put('posts', copy);
    state.postId = copy.id;
    render();
    toast('Post duplicated');
  }

  async function movePost(post, projectId) {
    flushSave();
    post.projectId = projectId;
    await persistPost(post, { snapshot: 'none' });
    const p = getProject(projectId);
    if (state.view === 'project') state.projectId = projectId;
    render();
    toast(`Moved to ${p.emoji} ${p.name}`);
  }

  async function deletePost(post) {
    const ok = await confirmDialog({ title: 'Delete this post?', message: `“${post.title || 'Untitled'}” and its version history will be permanently removed from this device.`, confirm: 'Delete', danger: true });
    if (!ok) return;
    save.cancel();
    state.posts = state.posts.filter((p) => p.id !== post.id);
    await DB.del('posts', post.id);
    const versions = await DB.byIndex('versions', 'postId', post.id);
    await DB.delMany('versions', versions.map((v) => v.id));
    if (state.postId === post.id) { state.postId = null; editor = null; }
    render();
    toast('Post deleted');
  }

  async function deleteProject(proj) {
    const posts = postsIn(proj.id);
    const ok = await confirmDialog({ title: `Delete “${proj.name}”?`, message: posts.length ? `This also deletes its ${posts.length} post${posts.length === 1 ? '' : 's'}. Consider exporting a backup first.` : 'This project is empty.', confirm: 'Delete project', danger: true });
    if (!ok) return;
    save.cancel();
    for (const p of posts) {
      const versions = await DB.byIndex('versions', 'postId', p.id);
      await DB.delMany('versions', versions.map((v) => v.id));
    }
    await DB.delMany('posts', posts.map((p) => p.id));
    await DB.del('projects', proj.id);
    state.posts = state.posts.filter((p) => p.projectId !== proj.id);
    state.projects = state.projects.filter((p) => p.id !== proj.id);
    editor = null;
    go('home', { projectId: null, postId: null });
    toast('Project deleted');
  }

  function exportPost(kind) {
    flushSave();
    const post = currentPost();
    const name = Exporter.slugify(post.title);
    if (kind === 'md') Exporter.download(`${name}.md`, Exporter.postMarkdown(post), 'text/markdown');
    else if (kind === 'html') Exporter.download(`${name}.html`, Exporter.postHTMLDocument(post), 'text/html');
    else if (kind === 'zip') Exporter.download(`${name}.zip`, Exporter.makeZip(Exporter.postPackageFiles(post, `${name}/`)));
    toast('Exported');
  }

  function exportProjectZip(proj) {
    flushSave();
    const files = [];
    const used = new Set();
    postsIn(proj.id).forEach((p) => {
      let slug = Exporter.slugify(p.title);
      while (used.has(slug)) slug += '-' + p.id.slice(-3);
      used.add(slug);
      files.push(...Exporter.postPackageFiles(p, `${Exporter.slugify(proj.name)}/${slug}/`));
    });
    if (!files.length) { toast('This project has no posts yet'); return; }
    Exporter.download(`${Exporter.slugify(proj.name)}.zip`, Exporter.makeZip(files));
    toast(`Exported ${postsIn(proj.id).length} posts`);
  }

  function exportAllZip() {
    flushSave();
    const files = [];
    state.projects.forEach((proj) => {
      const used = new Set();
      postsIn(proj.id).forEach((p) => {
        let slug = Exporter.slugify(p.title);
        while (used.has(slug)) slug += '-' + p.id.slice(-3);
        used.add(slug);
        files.push(...Exporter.postPackageFiles(p, `inkwell/${Exporter.slugify(proj.name)}/${slug}/`));
      });
    });
    if (!files.length) { toast('Nothing to export yet'); return; }
    Exporter.download(`inkwell-posts-${today()}.zip`, Exporter.makeZip(files));
  }

  async function exportBackup() {
    flushSave();
    const data = await DB.exportAll();
    Exporter.download(`inkwell-backup-${today()}.json`, JSON.stringify(data), 'application/json');
    toast('Backup downloaded — keep it somewhere safe');
  }

  function importBackup() {
    const input = $('#filePicker');
    input.accept = '.json,application/json';
    input.value = '';
    input.onchange = async () => {
      const f = input.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        const replace = await confirmDialog({ title: 'Import backup', message: `This backup has ${(data.projects || []).length} projects and ${(data.posts || []).length} posts. Replace everything currently in Inkwell? (Cancel merges instead.)`, confirm: 'Replace all', danger: true });
        await DB.importAll(data, { replace });
        await loadAll();
        go('home', { projectId: null, postId: null });
        toast(replace ? 'Backup restored' : 'Backup merged');
      } catch (e) {
        toast('Import failed: ' + e.message);
      }
    };
    input.click();
  }

  function toggleFocus(force) {
    const app = $('#app');
    const on = force ?? !app.classList.contains('focus');
    app.classList.toggle('focus', on);
    if (on) { toast(`Focus mode — press Esc or ${MOD}. to exit`); if (editor) editor.body.focus(); }
  }

  function celebrate() {
    const colors = ['#ff6719', '#ff3d77', '#7c3aed', '#30a46c', '#f5a524', '#0091ff'];
    const layer = document.createElement('div');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:200;overflow:hidden';
    for (let i = 0; i < 80; i++) {
      const s = document.createElement('i');
      const x = 50 + (Math.random() - 0.5) * 30;
      s.style.cssText = `position:absolute;left:${x}%;top:40%;width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px;background:${colors[i % colors.length]};border-radius:2px;`;
      layer.appendChild(s);
      const dx = (Math.random() - 0.5) * 900, dy = -300 - Math.random() * 300;
      s.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 720}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx * 1.3}px,${dy + 900}px) rotate(${Math.random() * 1440}deg)`, opacity: 0 }], { duration: 1800 + Math.random() * 900, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 3000);
  }

  function toast(msg, action) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<svg><use href="#i-check"/></svg><span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
    if (action) $('button', el).addEventListener('click', () => { action.run(); el.remove(); });
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2800);
  }

  // ======================================================================
  // Global event delegation
  // ======================================================================
  document.addEventListener('click', async (e) => {
    const t = e.target;
    const nav = t.closest('[data-nav]');
    if (nav) { go(nav.dataset.nav, nav.dataset.nav === 'board' ? { projectId: state.view === 'project' ? state.projectId : null } : { postId: null }); return; }
    const proj = t.closest('[data-project]');
    if (proj) { go('project', { projectId: proj.dataset.project, postId: null }); return; }
    const open = t.closest('[data-open]');
    if (open) {
      if (state.view === 'home' || state.view === 'board') { const p = getPost(open.dataset.open); state.view = 'project'; state.projectId = p.projectId; }
      openPost(open.dataset.open);
      return;
    }
    const filter = t.closest('[data-filter]');
    if (filter) { state.statusFilter = filter.dataset.filter; renderCollection(); return; }
    const panel = t.closest('[data-panel]');
    if (panel) {
      if (!(panel.closest('.assistant-tabs') && state.panel === panel.dataset.panel)) togglePanel(panel.dataset.panel);
      return;
    }
    const cat = t.closest('[data-cat]');
    if (cat) {
      const c = cat.dataset.cat;
      state.settings.categories[c] = !state.settings.categories[c];
      saveSettings();
      runCheck();
      return;
    }
    if (t.closest('.issue')) { onIssueClick(e); return; }
    const slashBtn = t.closest('[data-slash]');
    if (slashBtn) { chooseSlash(+slashBtn.dataset.slash); return; }
    const vp = t.closest('[data-version-preview]');
    if (vp) {
      const v = ($('#assistantBody')._versions || []).find((x) => x.id === vp.dataset.versionPreview);
      if (v) modal(`<div class="modal-head"><h2>${esc(v.title || 'Untitled')}</h2><button class="icon-btn" data-close><svg><use href="#i-x"/></svg></button></div>
        <div class="modal-body"><p class="muted" style="margin-top:0">${new Date(v.createdAt).toLocaleString()} · ${fmtNum(v.wordCount || 0)} words</p><div class="body" style="font-size:17px">${Exporter.sanitizeHTML(v.content)}</div></div>`, { cls: 'wide' });
      return;
    }
    const vr = t.closest('[data-version-restore]');
    if (vr) { restoreVersion(vr.dataset.versionRestore); return; }

    const a = t.closest('[data-action]');
    if (!a) return;
    switch (a.dataset.action) {
      case 'toggle-sidebar': state.sidebarOpen = !state.sidebarOpen; $('#app').classList.toggle('sidebar-open', state.sidebarOpen); break;
      case 'new-project': projectDialog(); break;
      case 'quick-post': createPost(null); break;
      case 'new-post': createPost(state.view === 'project' ? state.projectId : null); break;
      case 'board-add': createPost(state.projectId || null, { status: a.dataset.status }); break;
      case 'project-menu': projectMenu(a); break;
      case 'post-menu': postMenu(a); break;
      case 'list-mode': state.settings.listMode = a.dataset.mode; saveSettings(); if (a.dataset.mode === 'grid') { flushSave(); state.postId = null; } renderWorkspace($('#main')); break;
      case 'close-post': flushSave(); state.postId = null; render(); saveLocation(); break;
      case 'close-panel': togglePanel(state.panel); break;
      case 'cycle-theme': {
        const order = ['light', 'sepia', 'dark'];
        const cur = document.documentElement.dataset.theme;
        state.settings.theme = order[(order.indexOf(cur) + 1) % order.length];
        saveSettings(); applyTheme(); toast(`${state.settings.theme[0].toUpperCase() + state.settings.theme.slice(1)} theme`);
        break;
      }
      case 'settings': settingsDialog(); break;
      case 'focus': toggleFocus(); break;
      case 'cover': coverDialog(); break;
      case 'remove-cover': { const p = currentPost(); flushSave(); p.cover = null; await persistPost(p, { snapshot: 'none' }); renderEditor(); refreshCard(p); break; }
      case 'sketch': openSketch(); break;
      case 'preview': previewDialog(); break;
      case 'remove-tag': { const p = currentPost(); p.tags.splice(+a.dataset.i, 1); await persistPost(p, { snapshot: 'none' }); renderTags(); break; }
      case 'fix-all': fixAllCorrections(); break;
      case 'reset-ignored': { const p = currentPost(); p.ignored = []; await persistPost(p, { snapshot: 'none' }); runCheck(); break; }
      case 'copy-title': { flushSave(); const ok = await Exporter.copyText(currentPost().title); toast(ok ? 'Title copied' : 'Copy failed'); break; }
      case 'copy-subtitle': { flushSave(); const ok = await Exporter.copyText(currentPost().subtitle); toast(ok ? 'Subtitle copied' : 'Copy failed'); break; }
      case 'copy-body': copyBody(); break;
      case 'export-md': exportPost('md'); break;
      case 'export-html': exportPost('html'); break;
      case 'export-zip': exportPost('zip'); break;
      case 'mark-published': {
        const p = currentPost();
        const url = $('#pubUrl') ? $('#pubUrl').value.trim() : '';
        if (url) p.publishedUrl = url;
        await setStatus(p, 'published');
        const sel = $('#statusSelect');
        if (sel) { sel.value = 'published'; sel.style.setProperty('--sc', statusOf('published').color); }
        refreshCard(p);
        renderAssistant();
        break;
      }
      case 'snapshot': await snapshotNow(); break;
      default: break;
    }
  });

  document.addEventListener('mouseover', (e) => {
    const card = e.target.closest('.issue');
    if (!card) return;
    const body = $('#assistantBody');
    if (body && body._groups) setActiveHighlight(body._groups[+card.dataset.group].items);
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('.issue') && !e.relatedTarget?.closest?.('.issue')) setActiveHighlight(null);
  });

  async function snapshotNow() {
    if (!editor) return;
    save.flush();
    await createVersion(editor.post, 'Manual snapshot');
    toast('Snapshot saved');
    if (state.panel === 'history') renderHistory();
  }

  // Drag posts from the list onto a project in the sidebar to move them.
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest && e.target.closest('.post-card');
    if (card) { e.dataTransfer.setData('application/x-inkwell-post', card.dataset.id); e.dataTransfer.effectAllowed = 'move'; }
  });
  $('#projectList').addEventListener('dragover', (e) => {
    const item = e.target.closest('.project-item');
    if (!item || !e.dataTransfer.types.includes('application/x-inkwell-post')) return;
    e.preventDefault();
    $$('.project-item.drop-target').forEach((x) => x.classList.remove('drop-target'));
    item.classList.add('drop-target');
  });
  $('#projectList').addEventListener('dragleave', (e) => { const item = e.target.closest('.project-item'); if (item) item.classList.remove('drop-target'); });
  $('#projectList').addEventListener('drop', (e) => {
    const item = e.target.closest('.project-item');
    const id = e.dataTransfer.getData('application/x-inkwell-post');
    $$('.project-item.drop-target').forEach((x) => x.classList.remove('drop-target'));
    if (!item || !id) return;
    e.preventDefault();
    const post = getPost(id);
    if (post && post.projectId !== item.dataset.project) movePost(post, item.dataset.project);
  });

  // Search
  const runSearch = debounce((q) => {
    q = q.trim();
    if (!q) { if (state.view === 'search') go('all', { postId: state.postId }); return; }
    flushSave();
    state.query = q;
    state.view = 'search';
    renderSidebar();
    if ($('#collection') && state.view === 'search' && $('.workspace')) renderCollection();
    else renderWorkspace($('#main'));
  }, 180);
  $('#search').addEventListener('input', (e) => runSearch(e.target.value));
  $('#search').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.target.value = ''; runSearch(''); e.target.blur(); }
    if (e.key === 'Enter') { const first = $('#postList [data-open]'); if (first) openPost(first.dataset.open); }
  });

  document.addEventListener('selectionchange', () => {
    if (!editor) return;
    updateBubbleSoon();
  });
  window.addEventListener('resize', hideBubble);

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'k' && !(editor && editor.body.contains(document.activeElement))) { e.preventDefault(); $('#search').focus(); $('#search').select(); }
    else if (mod && e.altKey && (k === 'n' || e.code === 'KeyN')) { e.preventDefault(); createPost(state.view === 'project' ? state.projectId : null); }
    else if (mod && k === 's') { e.preventDefault(); snapshotNow(); }
    else if (mod && k === '.') { e.preventDefault(); toggleFocus(); }
    else if (mod && e.shiftKey && k === 'p') { e.preventDefault(); if (editor) togglePanel('proofread'); }
    else if (e.key === 'Escape') {
      if ($('.menu')) closeMenus();
      else if (slash.open) closeSlash();
      else if ($('#app').classList.contains('focus')) toggleFocus(false);
      else if (state.sidebarOpen) { state.sidebarOpen = false; $('#app').classList.remove('sidebar-open'); }
      hideBubble();
    }
  });

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
  window.addEventListener('pagehide', flushSave);

  // ======================================================================
  // Boot
  // ======================================================================
  async function loadAll() {
    state.projects = await DB.all('projects');
    state.posts = await DB.all('posts');
    state.posts.forEach((p) => { p.tags = p.tags || []; p.ignored = p.ignored || []; });
    state.activity = {};
    (await DB.all('activity')).forEach((a) => { state.activity[a.date] = a.words; });
  }

  async function seed() {
    const blog = newProject({ name: 'My Newsletter', emoji: '✍️', color: 0, description: 'Weekly essays on craft, focus and creative work.' });
    const notes = newProject({ name: 'Book Notes', emoji: '📚', color: 2, description: 'Short reviews and highlights from what I read.' });
    blog.createdAt -= 2000; notes.createdAt -= 1000;
    const welcome = newPost(blog.id, {
      title: 'Welcome to Inkwell',
      subtitle: 'Your offline studio for writing, polishing and shipping posts to Substack.',
      status: 'ready',
      tags: ['guide'],
      cover: { type: 'gradient', value: COVERS[0] },
      content: `<p>Inkwell keeps every word on <strong>this device</strong>. There is no account, no sync and no internet required — just you and the page.</p>
<h2>How it's organised</h2>
<ul><li><strong>Projects</strong> are your publications or series. Give each one an icon and colour.</li><li><strong>Posts</strong> live inside projects and move through <em>Idea → Draft → Editing → Ready → Published</em>.</li><li>The <strong>Board</strong> shows your whole editorial pipeline. Drag cards between columns.</li></ul>
<h2>Writing tools</h2>
<p>Type <code>/</code> on an empty line for blocks, or use Markdown shortcuts like <code>#</code>, <code>##</code>, <code>&gt;</code> and <code>-</code>. Select text to get a floating toolbar with a ✨ <strong>Fix</strong> button.</p>
<blockquote>Proofreading happens offline as you type: spelling, grammar, punctuation and style suggestions appear as underlines and in the ✨ panel.</blockquote>
<h2>Publishing to Substack</h2>
<p>Open the <strong>Publish</strong> panel (the paper-plane icon). Copy your title, subtitle and body, then paste them into a new Substack post. Formatting, links and images come along.</p>
<hr><p>Have fun — and open <em>“A draft with a few mistakes”</em> to see the proofreader in action.</p>`,
    });
    const messy = newPost(blog.id, {
      title: 'A draft with a few mistakes',
      subtitle: 'Open the ✨ Proofread panel and try “Fix all”.',
      status: 'editing',
      tags: ['demo'],
      content: `<p>i started writting this newsletter becuase i wanted a place to think out loud .Its a very good habit,and honestly it has changed how i work</p>
<p>However the hardest part isnt the writing. Its the the editing. I could of published more posts, but i kept second-guessing every sentence!!</p>
<p>In order to stay consistent i now write a hour every morning on monday through friday. The result is is that i have alot more drafts then i ever expected</p>`,
    });
    const idea = newPost(notes.id, { title: 'Deep Work — five ideas worth stealing', status: 'idea', content: '<p>Notes to expand: shallow vs. deep work, rituals, embracing boredom…</p>' });
    const book = newPost(notes.id, { title: 'What I learned from “Bird by Bird”', subtitle: 'Shitty first drafts, short assignments and the art of starting.', status: 'draft', cover: { type: 'gradient', value: COVERS[5] },
      content: '<p>Anne Lamott’s classic is the most honest book about writing I have read. Here are the three ideas that stuck with me.</p><h2>1. Short assignments</h2><p>Write only what you can see through a one-inch picture frame.</p>' });
    [welcome, messy, idea, book].forEach((p, i) => {
      p.wordCount = Proofreader.countWords(htmlToText(p.content));
      p.updatedAt = Date.now() - i * 3600 * 1000;
    });
    welcome.pinned = true;
    await DB.putMany('projects', [blog, notes]);
    await DB.putMany('posts', [welcome, messy, idea, book]);
    await DB.put('meta', { key: 'seeded', value: true });
  }

  async function boot() {
    applyTheme();
    try {
      await DB.open();
      const seeded = await DB.get('meta', 'seeded');
      if (!seeded) await seed();
      await loadAll();
    } catch (e) {
      $('#main').innerHTML = `<div class="empty" style="flex:1"><div class="art">⚠️</div><h3>Storage unavailable</h3><p>Inkwell needs IndexedDB to save your work. Private browsing modes sometimes block it.<br><small>${esc(e.message || e)}</small></p></div>`;
      return;
    }
    try {
      const loc = JSON.parse(localStorage.getItem('inkwell.location') || 'null');
      if (loc && (loc.view !== 'project' || getProject(loc.projectId))) {
        state.view = loc.view === 'search' ? 'all' : loc.view;
        state.projectId = loc.projectId;
        state.postId = getPost(loc.postId) ? loc.postId : null;
        state.panel = window.innerWidth > 820 ? loc.panel || null : null;
      }
    } catch (e) { /* ignore */ }
    render();
    DB.estimate().then((est) => {
      if (est && est.persisted) $('#storageLabel').textContent = 'Saved & protected on this device';
    });
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then((p) => { if (!p && state.posts.length > 4) DB.persist(); });
    }
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache optional */ });
    }
  }

  boot();
})();
