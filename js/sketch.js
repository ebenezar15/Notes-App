/* Inkwell Sketchpad — a pressure-aware drawing canvas (pen, highlighter, eraser) that exports a PNG. */
(function () {
  'use strict';

  const COLORS = ['#1d1d1f', '#ff6719', '#e5484d', '#f5a524', '#30a46c', '#0091ff', '#8e4ec6', '#ffffff'];
  const SIZES = [2, 4, 8, 14];

  function Sketchpad(container, { onDone, onCancel, background = 'paper' } = {}) {
    container.innerHTML = `
      <div class="sk-toolbar">
        <div class="sk-group" data-group="tool">
          <button class="sk-tool active" data-tool="pen" title="Pen (P)"><svg><use href="#i-pen"/></svg></button>
          <button class="sk-tool" data-tool="marker" title="Highlighter (H)"><svg><use href="#i-marker"/></svg></button>
          <button class="sk-tool" data-tool="eraser" title="Eraser (E)"><svg><use href="#i-eraser"/></svg></button>
        </div>
        <div class="sk-group sk-colors">${COLORS.map((c, i) => `<button class="sk-color${i === 0 ? ' active' : ''}" data-color="${c}" style="--c:${c}" title="${c}"></button>`).join('')}</div>
        <div class="sk-group">${SIZES.map((s, i) => `<button class="sk-size${i === 1 ? ' active' : ''}" data-size="${s}" title="${s}px"><i style="width:${s + 2}px;height:${s + 2}px"></i></button>`).join('')}</div>
        <div class="sk-group">
          <select class="sk-bg" title="Paper">
            <option value="plain">Plain</option><option value="paper">Lined</option><option value="grid">Grid</option><option value="dots">Dots</option>
          </select>
          <button class="sk-btn" data-act="undo" title="Undo (Ctrl+Z)"><svg><use href="#i-undo"/></svg></button>
          <button class="sk-btn" data-act="clear" title="Clear"><svg><use href="#i-trash"/></svg></button>
        </div>
      </div>
      <div class="sk-stage"><canvas class="sk-bg-canvas"></canvas><canvas class="sk-canvas"></canvas></div>
      <div class="sk-footer">
        <span class="sk-hint">Draw with a mouse, finger, or stylus — pressure is supported.</span>
        <div><button class="btn ghost" data-act="cancel">Cancel</button>
        <button class="btn primary" data-act="done">Insert sketch</button></div>
      </div>`;

    const stage = container.querySelector('.sk-stage');
    const canvas = container.querySelector('.sk-canvas');
    const bgCanvas = container.querySelector('.sk-bg-canvas');
    const ctx = canvas.getContext('2d');
    const bgCtx = bgCanvas.getContext('2d');
    const bgSelect = container.querySelector('.sk-bg');
    bgSelect.value = background;

    const state = { tool: 'pen', color: COLORS[0], size: 4, strokes: [], current: null, dpr: Math.max(1, window.devicePixelRatio || 1) };

    function resize() {
      // clientWidth ignores CSS transforms (the modal scales in while opening).
      const r = { width: stage.clientWidth, height: stage.clientHeight };
      [canvas, bgCanvas].forEach((c) => {
        c.width = Math.round(r.width * state.dpr);
        c.height = Math.round(r.height * state.dpr);
        c.style.width = r.width + 'px';
        c.style.height = r.height + 'px';
      });
      drawBackground();
      redraw();
    }

    function drawBackground() {
      const w = bgCanvas.width, h = bgCanvas.height, d = state.dpr;
      bgCtx.fillStyle = '#fffdf8';
      bgCtx.fillRect(0, 0, w, h);
      const kind = bgSelect.value;
      bgCtx.strokeStyle = 'rgba(80,110,160,.18)';
      bgCtx.fillStyle = 'rgba(80,110,160,.28)';
      bgCtx.lineWidth = d;
      const step = 28 * d;
      if (kind === 'paper') {
        for (let y = step * 2; y < h; y += step) { bgCtx.beginPath(); bgCtx.moveTo(0, y); bgCtx.lineTo(w, y); bgCtx.stroke(); }
        bgCtx.strokeStyle = 'rgba(229,72,77,.25)';
        bgCtx.beginPath(); bgCtx.moveTo(56 * d, 0); bgCtx.lineTo(56 * d, h); bgCtx.stroke();
      } else if (kind === 'grid') {
        for (let x = step; x < w; x += step) { bgCtx.beginPath(); bgCtx.moveTo(x, 0); bgCtx.lineTo(x, h); bgCtx.stroke(); }
        for (let y = step; y < h; y += step) { bgCtx.beginPath(); bgCtx.moveTo(0, y); bgCtx.lineTo(w, y); bgCtx.stroke(); }
      } else if (kind === 'dots') {
        for (let x = step; x < w; x += step) for (let y = step; y < h; y += step) { bgCtx.beginPath(); bgCtx.arc(x, y, 1.3 * d, 0, Math.PI * 2); bgCtx.fill(); }
      }
    }

    function drawStroke(s) {
      if (!s.points.length) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
      if (s.tool === 'marker') { ctx.globalAlpha = 0.35; ctx.globalCompositeOperation = 'multiply'; }
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      const d = state.dpr;
      const pts = s.points;
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x * d, pts[0].y * d, (s.size * widthFor(s, pts[0].p) * d) / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.tool === 'marker') {
        ctx.lineWidth = s.size * 3 * d;
        ctx.lineCap = 'square';
        ctx.beginPath();
        ctx.moveTo(pts[0].x * d, pts[0].y * d);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * d, pts[i].y * d);
        ctx.stroke();
      } else {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i];
          ctx.lineWidth = s.size * widthFor(s, (a.p + b.p) / 2) * d;
          ctx.beginPath();
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          if (i === 1) ctx.moveTo(a.x * d, a.y * d); else ctx.moveTo(((pts[i - 2].x + a.x) / 2) * d, ((pts[i - 2].y + a.y) / 2) * d);
          ctx.quadraticCurveTo(a.x * d, a.y * d, mx * d, my * d);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    const widthFor = (s, p) => (s.tool === 'eraser' ? 4 : 0.45 + (p || 0.5) * 1.1);

    function redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      state.strokes.forEach(drawStroke);
      if (state.current) drawStroke(state.current);
    }

    function point(e) {
      const r = canvas.getBoundingClientRect();
      const k = canvas.clientWidth / (r.width || 1);
      const p = e.pointerType === 'mouse' || !e.pressure ? 0.5 : e.pressure;
      return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, p };
    }

    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      state.current = { tool: state.tool, color: state.color, size: state.size, points: [point(e)] };
      redraw();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!state.current) return;
      const evts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      evts.forEach((ev) => state.current.points.push(point(ev)));
      redraw();
    });
    const end = () => {
      if (!state.current) return;
      state.strokes.push(state.current);
      state.current = null;
      redraw();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    container.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.tool) {
        state.tool = t.dataset.tool;
        container.querySelectorAll('.sk-tool').forEach((b) => b.classList.toggle('active', b === t));
      } else if (t.dataset.color) {
        state.color = t.dataset.color;
        if (state.tool === 'eraser') container.querySelector('[data-tool="pen"]').click();
        container.querySelectorAll('.sk-color').forEach((b) => b.classList.toggle('active', b === t));
      } else if (t.dataset.size) {
        state.size = +t.dataset.size;
        container.querySelectorAll('.sk-size').forEach((b) => b.classList.toggle('active', b === t));
      } else if (t.dataset.act === 'undo') {
        state.strokes.pop(); redraw();
      } else if (t.dataset.act === 'clear') {
        state.strokes = []; redraw();
      } else if (t.dataset.act === 'cancel') {
        cleanup(); onCancel && onCancel();
      } else if (t.dataset.act === 'done') {
        const url = exportPNG();
        cleanup(); onDone && onDone(url);
      }
    });
    bgSelect.addEventListener('change', drawBackground);

    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); state.strokes.pop(); redraw(); return; }
      const map = { p: 'pen', h: 'marker', e: 'eraser' };
      if (map[e.key] && !e.metaKey && !e.ctrlKey && e.target.tagName !== 'SELECT') container.querySelector(`[data-tool="${map[e.key]}"]`).click();
    }
    document.addEventListener('keydown', onKey);

    function exportPNG() {
      // Crop to the drawn area (plus padding) and composite onto the chosen paper.
      const out = document.createElement('canvas');
      out.width = canvas.width;
      out.height = canvas.height;
      const o = out.getContext('2d');
      if (bgSelect.value !== 'plain') o.drawImage(bgCanvas, 0, 0);
      else { o.fillStyle = '#ffffff'; o.fillRect(0, 0, out.width, out.height); }
      o.drawImage(canvas, 0, 0);
      const box = bounds();
      if (!box) return out.toDataURL('image/png');
      const pad = 24 * state.dpr;
      const x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
      const w = Math.min(out.width - x, box.w + pad * 2), h = Math.min(out.height - y, box.h + pad * 2);
      const crop = document.createElement('canvas');
      const scale = Math.min(1, 1600 / w);
      crop.width = Math.round(w * scale);
      crop.height = Math.round(h * scale);
      crop.getContext('2d').drawImage(out, x, y, w, h, 0, 0, crop.width, crop.height);
      return crop.toDataURL('image/png');
    }

    function bounds() {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      state.strokes.filter((s) => s.tool !== 'eraser').forEach((s) => s.points.forEach((p) => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }));
      if (minX === Infinity) return null;
      const d = state.dpr;
      return { x: minX * d, y: minY * d, w: (maxX - minX) * d, h: (maxY - minY) * d };
    }

    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    function cleanup() {
      ro.disconnect();
      document.removeEventListener('keydown', onKey);
    }
    requestAnimationFrame(resize);
    return { cleanup };
  }

  window.Sketchpad = Sketchpad;
})();
