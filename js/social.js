/* Inkwell Social Studio — turns a blog post into Instagram / LinkedIn carousels, captions and threads. Offline. */
(function () {
  'use strict';

  const SIZES = {
    portrait: { w: 1080, h: 1350, label: 'Instagram 4:5', budget: 330 },
    square: { w: 1080, h: 1080, label: 'Square 1:1', budget: 230 },
    story: { w: 1080, h: 1920, label: 'Story / Reel 9:16', budget: 520 },
  };
  const MAX_SLIDES = 20; // Instagram allows up to 20 images per carousel.

  const SERIF = 'Charter, "Iowan Old Style", Georgia, "Times New Roman", serif';
  const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif';

  const THEMES = {
    ember: { label: 'Ember', bg: ['#ff6719', '#ff3d77', '#7c3aed'], fg: '#ffffff', sub: 'rgba(255,255,255,.82)', accent: '#ffe3cf', font: SERIF, glow: true },
    paper: { label: 'Paper', bg: ['#f7f1e5'], fg: '#1f1a14', sub: '#6d5b47', accent: '#ff6719', font: SERIF, lines: true },
    midnight: { label: 'Midnight', bg: ['#0d0f1f', '#1b1840'], fg: '#f3f3f8', sub: 'rgba(243,243,248,.72)', accent: '#a78bfa', font: SANS, glow: true },
    mono: { label: 'Minimal', bg: ['#ffffff'], fg: '#111111', sub: '#555555', accent: '#111111', font: SANS, frame: true },
    bold: { label: 'Bold', bg: ['#ffd60a'], fg: '#111111', sub: '#3a3a3a', accent: '#111111', font: SANS, heavy: true },
    forest: { label: 'Forest', bg: ['#0b3d2e', '#14532d'], fg: '#f1f7ee', sub: 'rgba(241,247,238,.75)', accent: '#bef264', font: SERIF },
    project: { label: 'Project colours', bg: null, fg: '#ffffff', sub: 'rgba(255,255,255,.85)', accent: '#ffffff', font: SANS, glow: true },
  };

  // ------------------------------------------------------------------ text helpers
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  function sentences(text) {
    return (text.match(/[^.!?…]+(?:[.!?…]+["'”’)]*|$)/g) || [text]).map((s) => s.trim()).filter(Boolean);
  }
  function chunkText(text, budget) {
    const out = [];
    let cur = '';
    for (const s of sentences(text)) {
      if (cur && (cur + ' ' + s).length > budget) { out.push(cur); cur = s; } else cur = cur ? cur + ' ' + s : s;
    }
    if (cur) out.push(cur);
    return out;
  }

  /** Build an editable slide list from a post. */
  function buildSlides(post, sizeKey) {
    const budget = SIZES[sizeKey].budget;
    const doc = new DOMParser().parseFromString(post.content || '', 'text/html');
    const slides = [{ kind: 'cover', heading: clean(post.title) || 'Untitled', body: clean(post.subtitle) }];
    let heading = '';
    let buf = '';
    const flush = () => {
      if (!buf.trim()) return;
      chunkText(buf.trim(), budget).forEach((c, i) => slides.push({ kind: 'text', heading: i === 0 ? heading : '', body: c }));
      heading = '';
      buf = '';
    };
    Array.from(doc.body.children).forEach((el) => {
      const tag = el.tagName;
      const text = clean(el.textContent);
      if (/^H[1-4]$/.test(tag)) { flush(); heading = text; }
      else if (tag === 'P') {
        if (!text) return;
        if (buf && (buf + '\n\n' + text).length > budget) flush();
        buf = buf ? buf + '\n\n' + text : text;
      } else if (tag === 'BLOCKQUOTE') { flush(); if (text) slides.push({ kind: 'quote', heading: '', body: text.slice(0, budget) }); }
      else if (tag === 'UL' || tag === 'OL') {
        flush();
        const items = Array.from(el.querySelectorAll(':scope > li')).map((li) => clean(li.textContent)).filter(Boolean);
        for (let i = 0; i < items.length; i += 5) {
          slides.push({ kind: 'list', heading: i === 0 ? heading : '', body: items.slice(i, i + 5).join('\n'), ordered: tag === 'OL', start: i + 1 });
        }
        heading = '';
      } else if (tag === 'FIGURE' || tag === 'IMG') {
        flush();
        const img = tag === 'IMG' ? el : el.querySelector('img');
        const cap = el.querySelector && el.querySelector('figcaption');
        if (img && img.getAttribute('src')) slides.push({ kind: 'image', heading: '', body: cap ? clean(cap.textContent) : '', src: img.getAttribute('src') });
      } else if (tag === 'HR') flush();
    });
    flush();
    let trimmed = false;
    if (slides.length > MAX_SLIDES - 1) { slides.length = MAX_SLIDES - 1; trimmed = true; }
    slides.push({ kind: 'cta', heading: 'Enjoyed this?', body: 'Read the full post on Substack — link in bio.\nSave this & share it with a friend.' });
    return { slides, trimmed };
  }

  // ------------------------------------------------------------------ canvas drawing
  function wrapLines(ctx, text, maxW) {
    const lines = [];
    String(text).split('\n').forEach((para, pi) => {
      if (pi > 0) lines.push('');
      const words = para.split(/\s+/).filter(Boolean);
      let line = '';
      words.forEach((w) => {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
        else line = test;
      });
      lines.push(line);
    });
    return lines;
  }

  /** Largest font size (<= max) at which text fits in the box. */
  function fit(ctx, text, family, weight, maxW, maxH, max, min, lh = 1.3, style = '') {
    let size = max;
    let lines;
    for (; size >= min; size -= 2) {
      ctx.font = `${style} ${weight} ${size}px ${family}`;
      lines = wrapLines(ctx, text, maxW);
      if (lines.length * size * lh <= maxH) break;
    }
    size = Math.max(size, min);
    ctx.font = `${style} ${weight} ${size}px ${family}`;
    lines = wrapLines(ctx, text, maxW);
    return { size, lines, height: lines.length * size * lh, lh };
  }

  function drawLines(ctx, f, x, y, align = 'left') {
    ctx.textAlign = align;
    f.lines.forEach((l, i) => ctx.fillText(l, x, y + f.size * 0.92 + i * f.size * f.lh));
    ctx.textAlign = 'left';
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function isLight(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return true;
    const n = parseInt(m[1], 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150;
  }

  const imageCache = new Map();
  function loadImage(src) {
    if (imageCache.has(src)) return imageCache.get(src);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    imageCache.set(src, p);
    return p;
  }

  function themeFor(opts) {
    const t = { ...THEMES[opts.theme] || THEMES.ember };
    if (opts.theme === 'project') t.bg = opts.projectColors || ['#ff6719', '#ffb36b'];
    return t;
  }

  function paintBackground(ctx, W, H, t) {
    if (t.bg.length === 1) { ctx.fillStyle = t.bg[0]; ctx.fillRect(0, 0, W, H); }
    else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      t.bg.forEach((c, i) => g.addColorStop(i / (t.bg.length - 1), c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (t.glow) {
      const r = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, W * 0.8);
      r.addColorStop(0, 'rgba(255,255,255,.22)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = r;
      ctx.fillRect(0, 0, W, H);
    }
    if (t.lines) {
      ctx.strokeStyle = 'rgba(80,110,160,.10)';
      ctx.lineWidth = 2;
      for (let y = 160; y < H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    }
    if (t.frame) { ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.strokeRect(40, 40, W - 80, H - 80); }
  }

  async function drawSlide(canvas, slide, index, total, opts) {
    const { w: W, h: H } = SIZES[opts.size];
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const t = themeFor(opts);
    const family = opts.font === 'serif' ? SERIF : opts.font === 'sans' ? SANS : t.font;
    const pad = 96;
    const top = opts.size === 'story' ? 220 : 150;
    const bottom = opts.size === 'story' ? H - 260 : H - 150;
    paintBackground(ctx, W, H, t);

    // Header: brand + counter.
    ctx.fillStyle = t.sub;
    ctx.font = `600 30px ${SANS}`;
    ctx.fillText(opts.brand || '', pad, top - 60);
    if (opts.numbers && total > 1) {
      ctx.textAlign = 'right';
      ctx.fillText(`${index + 1}/${total}`, W - pad, top - 60);
      ctx.textAlign = 'left';
    }

    const maxW = W - pad * 2;
    const areaH = bottom - top;
    const heavy = t.heavy ? 800 : 700;

    if (slide.kind === 'cover') {
      ctx.fillStyle = t.accent;
      ctx.fillRect(pad, top + 10, 120, 10);
      const sub = slide.body ? fit(ctx, slide.body, family, 400, maxW, areaH * 0.3, 46, 28, 1.35) : null;
      const title = fit(ctx, slide.heading, family, heavy, maxW, areaH * 0.6 - 40, 120, 48, 1.08);
      const block = title.height + (sub ? sub.height + 40 : 0);
      let y = top + Math.max(70, (areaH - block) / 2);
      ctx.fillStyle = t.fg;
      ctx.font = `${heavy} ${title.size}px ${family}`;
      drawLines(ctx, title, pad, y);
      y += title.height + 40;
      if (sub) { ctx.fillStyle = t.sub; ctx.font = `400 ${sub.size}px ${family}`; drawLines(ctx, sub, pad, y); }
      if (total > 1) {
        ctx.fillStyle = t.fg;
        ctx.font = `700 34px ${SANS}`;
        ctx.textAlign = 'right';
        ctx.fillText('Swipe  →', W - pad, bottom + 40);
        ctx.textAlign = 'left';
      }
    } else if (slide.kind === 'quote') {
      ctx.fillStyle = t.accent;
      ctx.font = `700 260px ${SERIF}`;
      ctx.fillText('“', pad - 14, top + 210);
      const q = fit(ctx, slide.body, family, 500, maxW, areaH - 260, 74, 34, 1.3, 'italic');
      ctx.fillStyle = t.fg;
      ctx.font = `italic 500 ${q.size}px ${family}`;
      drawLines(ctx, q, pad, top + 240 + Math.max(0, (areaH - 260 - q.height) / 2));
    } else if (slide.kind === 'image') {
      const img = slide.src ? await loadImage(slide.src) : null;
      const capH = slide.body ? 150 : 0;
      const boxH = areaH - capH;
      if (img) {
        const s = Math.min(maxW / img.width, boxH / img.height);
        const iw = img.width * s, ih = img.height * s;
        const ix = (W - iw) / 2, iy = top + (boxH - ih) / 2;
        ctx.save();
        roundRect(ctx, ix, iy, iw, ih, 28);
        ctx.clip();
        ctx.drawImage(img, ix, iy, iw, ih);
        ctx.restore();
      }
      if (slide.body) {
        const c = fit(ctx, slide.body, family, 400, maxW, capH - 30, 38, 24, 1.3);
        ctx.fillStyle = t.sub;
        ctx.font = `400 ${c.size}px ${family}`;
        drawLines(ctx, c, W / 2, top + boxH + 30, 'center');
      }
    } else if (slide.kind === 'list') {
      let y = top + 20;
      if (slide.heading) {
        const h = fit(ctx, slide.heading, family, heavy, maxW, 220, 70, 40, 1.12);
        ctx.fillStyle = t.fg;
        ctx.font = `${heavy} ${h.size}px ${family}`;
        drawLines(ctx, h, pad, y);
        y += h.height + 50;
      }
      const items = slide.body.split('\n').filter(Boolean);
      const each = (bottom - y) / Math.max(items.length, 1);
      items.forEach((item, i) => {
        const f = fit(ctx, item, family, 500, maxW - 110, each - 30, 50, 26, 1.28);
        const cy = y + i * each;
        ctx.fillStyle = t.accent;
        roundRect(ctx, pad, cy + 4, 72, 72, 20);
        ctx.fill();
        ctx.fillStyle = isLight(t.accent) ? '#111' : '#fff';
        ctx.font = `800 34px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText(slide.ordered ? String((slide.start || 1) + i) : '✓', pad + 36, cy + 53);
        ctx.textAlign = 'left';
        ctx.fillStyle = t.fg;
        ctx.font = `500 ${f.size}px ${family}`;
        drawLines(ctx, f, pad + 110, cy + 4);
      });
    } else {
      // text / cta
      let y = top + 20;
      const isCta = slide.kind === 'cta';
      if (slide.heading) {
        const h = fit(ctx, slide.heading, family, heavy, maxW, isCta ? 300 : 240, isCta ? 96 : 72, 40, 1.1);
        ctx.fillStyle = isCta ? t.fg : t.accent === t.fg ? t.fg : t.accent;
        ctx.font = `${heavy} ${h.size}px ${family}`;
        if (isCta) y = top + Math.max(40, areaH / 2 - h.height - 60);
        drawLines(ctx, h, pad, y);
        y += h.height + 44;
      }
      const b = fit(ctx, slide.body, family, 400, maxW, bottom - y, isCta ? 52 : 56, 28, 1.42);
      ctx.fillStyle = isCta ? t.sub : t.fg;
      ctx.font = `400 ${b.size}px ${family}`;
      drawLines(ctx, b, pad, y);
      if (isCta && opts.handle) {
        ctx.fillStyle = t.fg;
        ctx.font = `800 48px ${SANS}`;
        ctx.fillText(opts.handle, pad, Math.min(bottom - 20, y + b.height + 110));
      }
    }

    // Footer: handle + progress.
    ctx.fillStyle = t.sub;
    ctx.font = `600 28px ${SANS}`;
    if (opts.handle && slide.kind !== 'cta') ctx.fillText(opts.handle, pad, H - (opts.size === 'story' ? 170 : 70));
    if (total > 1) {
      const dotsW = Math.min(total, 20) * 22;
      let x = W - pad - dotsW;
      for (let i = 0; i < total; i++) {
        ctx.fillStyle = i === index ? t.fg : t.sub;
        ctx.globalAlpha = i === index ? 1 : 0.35;
        ctx.beginPath();
        ctx.arc(x + 8, H - (opts.size === 'story' ? 180 : 80), i === index ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
        x += 22;
      }
      ctx.globalAlpha = 1;
    }
    return canvas;
  }

  // ------------------------------------------------------------------ PDF (LinkedIn document carousels)
  function makePDF(pages) {
    // pages: [{ jpeg: Uint8Array, w, h }]
    const enc = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let len = 0;
    const push = (d) => { const b = typeof d === 'string' ? enc.encode(d) : d; chunks.push(b); len += b.length; };
    const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const n = pages.length;
    const pageIds = pages.map((_, i) => 3 + i * 3);
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${n} >>`));
    pages.forEach((p, i) => {
      const pid = 3 + i * 3, cid = pid + 1, iid = pid + 2;
      const content = `q ${p.w} 0 0 ${p.h} 0 0 cm /Im${i} Do Q`;
      obj(pid, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.w} ${p.h}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`));
      obj(cid, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
      obj(iid, () => {
        push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
        push(p.jpeg);
        push('\nendstream');
      });
    });
    const total = 3 + n * 3;
    const xref = len;
    push(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let i = 1; i < total; i++) push(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  const dataUrlBytes = (url) => {
    const bin = atob(url.split(',')[1]);
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  };

  // ------------------------------------------------------------------ captions & threads
  function caption(post, opts) {
    const text = new DOMParser().parseFromString(post.content || '', 'text/html').body.textContent || '';
    const first = sentences(clean(text)).slice(0, 2).join(' ');
    const tags = (post.tags || []).map((t) => '#' + t.replace(/[^\w]/g, '')).filter((t) => t.length > 1);
    const extra = ['#writing', '#newsletter', '#substack'].filter((t) => !tags.includes(t));
    return [
      clean(post.title),
      post.subtitle ? '\n' + clean(post.subtitle) : '',
      first ? '\n' + first : '',
      '\n👉 Read the full post — link in bio.',
      opts.handle ? `Follow ${opts.handle} for more.` : '',
      '\n' + tags.concat(extra).slice(0, 12).join(' '),
    ].filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function thread(post, limit = 280) {
    const doc = new DOMParser().parseFromString(post.content || '', 'text/html');
    const paras = Array.from(doc.body.children).map((el) => clean(el.textContent)).filter(Boolean);
    const room = limit - 8; // leave space for " (12/12)"
    const parts = [clean(post.title) + (post.subtitle ? '\n\n' + clean(post.subtitle) : '') + '\n\n🧵👇'];
    paras.forEach((p) => {
      let cur = '';
      sentences(p).forEach((s) => {
        while (s.length > room) { if (cur) { parts.push(cur); cur = ''; } parts.push(s.slice(0, room)); s = s.slice(room); }
        if ((cur + ' ' + s).trim().length > room) { parts.push(cur); cur = s; } else cur = (cur + ' ' + s).trim();
      });
      if (cur) parts.push(cur);
    });
    parts.push('That\'s the gist. The full post (with everything I left out) is on my Substack — link in bio. ✍️');
    return parts.map((p, i) => `${p} (${i + 1}/${parts.length})`);
  }

  function linkedin(post) {
    const doc = new DOMParser().parseFromString(post.content || '', 'text/html');
    const paras = Array.from(doc.body.children).map((el) => (el.tagName === 'LI' ? '• ' : '') + clean(el.textContent)).filter(Boolean);
    let body = '';
    for (const p of paras) { if ((body + '\n\n' + p).length > 2400) break; body += (body ? '\n\n' : '') + p; }
    const tags = (post.tags || []).map((t) => '#' + t.replace(/[^\w]/g, '')).slice(0, 5).join(' ');
    return `${clean(post.title)}\n\n${body}\n\n♻️ Repost if this was useful.\n${tags}`.trim();
  }

  // ------------------------------------------------------------------ studio UI
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function openStudio({ post, project, author, modal, toast, Exporter }) {
    const prefs = (() => { try { return JSON.parse(localStorage.getItem('inkwell.social') || '{}'); } catch (e) { return {}; } })();
    const opts = {
      size: prefs.size || 'portrait', theme: prefs.theme || 'ember', font: prefs.font || 'theme', numbers: prefs.numbers !== false,
      handle: prefs.handle || '', brand: project ? `${project.emoji} ${project.name}` : '', projectColors: project && project._colors,
    };
    let { slides, trimmed } = buildSlides(post, opts.size);
    let current = 0;
    let tab = 'carousel';
    const savePrefs = () => { try { localStorage.setItem('inkwell.social', JSON.stringify({ size: opts.size, theme: opts.theme, font: opts.font, numbers: opts.numbers, handle: opts.handle })); } catch (e) { /* ignore */ } };

    const m = modal(`
      <div class="modal-head"><h2>Social studio</h2><span class="muted" style="font-size:12px">Turn “${esc(post.title || 'Untitled')}” into posts</span><button class="icon-btn" data-close><svg><use href="#i-x"/></svg></button></div>
      <div class="ss-tabs segmented" style="margin:0 20px 10px">
        <button data-tab="carousel" class="active">🖼️ Carousel</button><button data-tab="caption">✍️ Caption</button><button data-tab="thread">🧵 X / Threads</button><button data-tab="linkedin">💼 LinkedIn</button>
      </div>
      <div class="ss-body" id="ssBody"></div>`, { cls: 'xl social' });
    const el = m.el;
    const body = el.querySelector('#ssBody');

    el.querySelector('.ss-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      tab = b.dataset.tab;
      el.querySelectorAll('.ss-tabs button').forEach((x) => x.classList.toggle('active', x === b));
      render();
    });

    function render() {
      if (tab === 'carousel') renderCarousel();
      else renderText();
    }

    function renderText() {
      let text, hint, limit;
      if (tab === 'caption') { text = caption(post, opts); hint = 'Instagram caption — paste it under your carousel.'; limit = 2200; }
      else if (tab === 'linkedin') { text = linkedin(post); hint = 'LinkedIn post text. Pair it with the carousel exported as a PDF (LinkedIn shows PDFs as swipeable documents).'; limit = 3000; }
      else { text = thread(post).join('\n\n———\n\n'); hint = 'A ready-made thread. Each part is under 280 characters for X (Threads allows 500).'; limit = 0; }
      body.innerHTML = `<div class="ss-text">
        <p class="muted" style="margin:0 0 10px;font-size:12.5px">${esc(hint)}</p>
        <textarea class="textarea" id="ssText" spellcheck="true">${esc(text)}</textarea>
        <div class="ss-text-foot"><span class="muted" id="ssCount"></span><span class="spacer"></span>
        ${tab === 'thread' ? '<button class="btn" data-ss="download-thread"><svg><use href="#i-download"/></svg>.txt</button>' : ''}
        <button class="btn primary" data-ss="copy-text"><svg><use href="#i-copy"/></svg>Copy</button></div></div>`;
      const ta = body.querySelector('#ssText');
      const count = () => {
        const n = ta.value.length;
        const tags = (ta.value.match(/#\w+/g) || []).length;
        body.querySelector('#ssCount').textContent = limit
          ? `${n.toLocaleString()} / ${limit.toLocaleString()} characters${tab === 'caption' ? ` · ${tags} hashtags (max 30)` : ''}${n > limit ? ' — too long!' : ''}`
          : `${ta.value.split('———').length} posts`;
      };
      ta.addEventListener('input', count);
      count();
    }

    function renderCarousel() {
      body.innerHTML = `
        <div class="ss-grid">
          <div class="ss-rail" id="ssRail"></div>
          <div class="ss-stage"><div class="ss-canvas-wrap"><canvas id="ssCanvas"></canvas></div>
            <div class="ss-nav"><button class="icon-btn" data-ss="prev"><svg><use href="#i-back"/></svg></button><span id="ssPos"></span><button class="icon-btn" data-ss="next" style="transform:scaleX(-1)"><svg><use href="#i-back"/></svg></button></div>
          </div>
          <div class="ss-side">
            <div class="field"><span>Format</span><div class="segmented ss-wrap" data-opt="size">${Object.entries(SIZES).map(([k, s]) => `<button data-v="${k}" class="${opts.size === k ? 'active' : ''}">${s.label}</button>`).join('')}</div></div>
            <div class="field"><span>Design</span><div class="ss-themes">${Object.entries(THEMES).map(([k, t]) => `<button data-theme="${k}" class="${opts.theme === k ? 'active' : ''}" title="${t.label}" style="background:${k === 'project' ? `linear-gradient(135deg,${(opts.projectColors || ['#ff6719', '#ffb36b']).join(',')})` : t.bg.length > 1 ? `linear-gradient(135deg,${t.bg.join(',')})` : t.bg[0]};color:${t.fg}">Aa</button>`).join('')}</div></div>
            <div class="field"><span>Font</span><div class="segmented" data-opt="font">${[['theme', 'Auto'], ['serif', 'Serif'], ['sans', 'Sans']].map(([v, l]) => `<button data-v="${v}" class="${opts.font === v ? 'active' : ''}">${l}</button>`).join('')}</div></div>
            <label class="field"><span>Your handle</span><input class="input" id="ssHandle" placeholder="@yourname" value="${esc(opts.handle)}"></label>
            <label class="ss-check"><input type="checkbox" id="ssNumbers" ${opts.numbers ? 'checked' : ''}> Slide numbers</label>
            <hr class="ss-hr">
            <div class="field"><span><b id="ssSlideNo">Slide ${current + 1}</b> · <select id="ssKind" class="ss-kind">${['cover', 'text', 'quote', 'list', 'image', 'cta'].map((k) => `<option value="${k}" ${slides[current] && slides[current].kind === k ? 'selected' : ''}>${k === 'cta' ? 'Call to action' : k[0].toUpperCase() + k.slice(1)}</option>`).join('')}</select></span></div>
            <label class="field"><span>Heading</span><input class="input" id="ssHeading"></label>
            <label class="field"><span id="ssBodyLabel">Text</span><textarea class="textarea" id="ssSlideBody" rows="5"></textarea></label>
            <div class="ss-slide-acts">
              <button class="btn sm" data-ss="add">+ Slide</button><button class="btn sm" data-ss="dup">Duplicate</button>
              <button class="btn sm" data-ss="up">↑</button><button class="btn sm" data-ss="down">↓</button><button class="btn sm danger" data-ss="del">Delete</button>
            </div>
            <button class="btn sm ghost" data-ss="regen" style="margin-top:8px">↺ Rebuild slides from the post</button>
          </div>
        </div>
        <div class="ss-foot">
          <span class="muted" id="ssInfo"></span><span class="spacer"></span>
          <button class="btn" data-ss="png-current"><svg><use href="#i-image"/></svg>This slide</button>
          <button class="btn" data-ss="pdf"><svg><use href="#i-download"/></svg>PDF (LinkedIn)</button>
          <button class="btn primary" data-ss="zip"><svg><use href="#i-download"/></svg>Download all (.zip)</button>
        </div>`;
      bindCarousel();
      refresh();
    }

    function refreshInfo() {
      const s = SIZES[opts.size];
      const info = body.querySelector('#ssInfo');
      if (info) info.textContent = `${slides.length} slide${slides.length === 1 ? '' : 's'} · ${s.w}×${s.h}px${slides.length > MAX_SLIDES ? ' · Instagram allows up to 20 — remove some' : trimmed ? ' · long post trimmed to fit 20 slides' : ''}`;
    }

    let refreshToken = 0;
    async function refresh() {
      const token = ++refreshToken;
      current = Math.max(0, Math.min(current, slides.length - 1));
      const s = slides[current];
      const rail = body.querySelector('#ssRail');
      if (!rail) return;
      const thumbH = Math.round(108 * SIZES[opts.size].h / SIZES[opts.size].w);
      rail.innerHTML = slides.map((sl, i) => `<button class="ss-thumb ${i === current ? 'active' : ''}" data-slide="${i}"><canvas width="108" height="${thumbH}"></canvas><span>${i + 1}</span></button>`).join('');
      body.querySelector('#ssPos').textContent = `${current + 1} / ${slides.length}`;
      body.querySelector('#ssHeading').value = s ? s.heading || '' : '';
      body.querySelector('#ssSlideBody').value = s ? s.body || '' : '';
      body.querySelector('#ssKind').value = s ? s.kind : 'text';
      body.querySelector('#ssBodyLabel').textContent = s && s.kind === 'list' ? 'Items (one per line)' : s && s.kind === 'image' ? 'Caption' : 'Text';
      body.querySelector('#ssSlideNo').textContent = `Slide ${current + 1}`;
      refreshInfo();
      await drawCurrent();
      const thumbs = rail.querySelectorAll('canvas');
      for (let i = 0; i < slides.length; i++) {
        const tmp = document.createElement('canvas');
        await drawSlide(tmp, slides[i], i, slides.length, opts);
        if (token !== refreshToken) return; // a newer refresh has started
        const th = thumbs[i];
        if (!th) break;
        th.getContext('2d').drawImage(tmp, 0, 0, th.width, th.height);
      }
    }

    async function drawCurrent() {
      const c = body.querySelector('#ssCanvas');
      if (c && slides[current]) await drawSlide(c, slides[current], current, slides.length, opts);
    }

    let redrawT;
    const redrawSoon = () => { clearTimeout(redrawT); redrawT = setTimeout(async () => { await drawCurrent(); const th = body.querySelector(`.ss-thumb[data-slide="${current}"] canvas`); const c = body.querySelector('#ssCanvas'); if (th && c) { th.getContext('2d').drawImage(c, 0, 0, th.width, th.height); } }, 120); };

    function bindCarousel() {
      body.querySelector('#ssHeading').addEventListener('input', (e) => { slides[current].heading = e.target.value; redrawSoon(); });
      body.querySelector('#ssSlideBody').addEventListener('input', (e) => { slides[current].body = e.target.value; redrawSoon(); });
      body.querySelector('#ssKind').addEventListener('change', (e) => { slides[current].kind = e.target.value; refresh(); });
      body.querySelector('#ssHandle').addEventListener('input', (e) => { opts.handle = e.target.value.trim(); if (opts.handle && !opts.handle.startsWith('@')) opts.handle = '@' + opts.handle; savePrefs(); redrawSoon(); });
      body.querySelector('#ssHandle').addEventListener('change', () => refresh());
      body.querySelector('#ssNumbers').addEventListener('change', (e) => { opts.numbers = e.target.checked; savePrefs(); refresh(); });
      body.querySelectorAll('[data-opt]').forEach((g) => g.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        opts[g.dataset.opt] = b.dataset.v;
        g.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
        savePrefs();
        refresh();
      }));
      body.querySelector('.ss-themes').addEventListener('click', (e) => {
        const b = e.target.closest('[data-theme]'); if (!b) return;
        opts.theme = b.dataset.theme;
        body.querySelectorAll('.ss-themes button').forEach((x) => x.classList.toggle('active', x === b));
        savePrefs();
        refresh();
      });
    }

    async function renderAll(type, quality) {
      const out = [];
      for (let i = 0; i < slides.length; i++) {
        const c = document.createElement('canvas');
        await drawSlide(c, slides[i], i, slides.length, opts);
        out.push({ c, url: c.toDataURL(type, quality) });
      }
      return out;
    }

    el.addEventListener('click', async (e) => {
      const thumb = e.target.closest('[data-slide]');
      if (thumb) { current = +thumb.dataset.slide; refresh(); return; }
      const b = e.target.closest('[data-ss]');
      if (!b) return;
      const slug = Exporter.slugify(post.title);
      switch (b.dataset.ss) {
        case 'prev': current = (current - 1 + slides.length) % slides.length; refresh(); break;
        case 'next': current = (current + 1) % slides.length; refresh(); break;
        case 'add': slides.splice(current + 1, 0, { kind: 'text', heading: 'New slide', body: 'Write something worth swiping for.' }); current++; refresh(); break;
        case 'dup': slides.splice(current + 1, 0, { ...slides[current] }); current++; refresh(); break;
        case 'del': if (slides.length > 1) { slides.splice(current, 1); refresh(); } break;
        case 'up': if (current > 0) { [slides[current - 1], slides[current]] = [slides[current], slides[current - 1]]; current--; refresh(); } break;
        case 'down': if (current < slides.length - 1) { [slides[current + 1], slides[current]] = [slides[current], slides[current + 1]]; current++; refresh(); } break;
        case 'regen': ({ slides, trimmed } = buildSlides(post, opts.size)); current = 0; refresh(); break;
        case 'png-current': {
          const c = document.createElement('canvas');
          await drawSlide(c, slides[current], current, slides.length, opts);
          Exporter.download(`${slug}-${String(current + 1).padStart(2, '0')}.png`, await new Promise((r) => c.toBlob(r, 'image/png')));
          break;
        }
        case 'zip': {
          b.disabled = true;
          const pages = await renderAll('image/png');
          const files = pages.map((p, i) => ({ name: `${slug}-carousel/${String(i + 1).padStart(2, '0')}.png`, data: dataUrlBytes(p.url) }));
          files.push({ name: `${slug}-carousel/caption.txt`, data: caption(post, opts) });
          Exporter.download(`${slug}-carousel.zip`, Exporter.makeZip(files));
          b.disabled = false;
          toast(`Exported ${pages.length} slides + caption`);
          break;
        }
        case 'pdf': {
          b.disabled = true;
          const pages = await renderAll('image/jpeg', 0.92);
          Exporter.download(`${slug}-carousel.pdf`, makePDF(pages.map((p) => ({ jpeg: dataUrlBytes(p.url), w: p.c.width, h: p.c.height }))));
          b.disabled = false;
          toast('PDF ready — upload it to LinkedIn as a document');
          break;
        }
        case 'copy-text': {
          const ok = await Exporter.copyText(body.querySelector('#ssText').value);
          toast(ok ? 'Copied' : 'Copy failed');
          break;
        }
        case 'download-thread': Exporter.download(`${slug}-thread.txt`, body.querySelector('#ssText').value); break;
        default: break;
      }
    });

    render();
  }

  window.Social = { openStudio, buildSlides, drawSlide, makePDF, caption, thread, SIZES, THEMES };
})();
