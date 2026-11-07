/* Inkwell motion — view transitions, staggered entrances, count-ups, ripples and the launch animation.
 * Everything checks Motion.ok() first, so "Reduced motion" (in Settings or the OS) turns it all off. */
(function () {
  'use strict';

  const reduceQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const Motion = {
    level: 'full', // 'full' | 'reduced'

    setLevel(level) {
      this.level = level === 'reduced' ? 'reduced' : 'full';
      document.documentElement.dataset.motion = this.ok() ? 'full' : 'reduced';
    },

    ok() { return this.level === 'full' && !reduceQuery.matches; },

    /** Run a DOM update as an animated view transition where the browser supports it. */
    transition(update, kind = 'fade') {
      if (!this.ok() || !document.startViewTransition) { update(); return; }
      document.documentElement.dataset.vt = kind;
      try {
        const t = document.startViewTransition(update);
        t.finished.finally(() => { delete document.documentElement.dataset.vt; });
      } catch (e) { update(); }
    },

    /** Give children of `root` matching `sel` an increasing --i so CSS can stagger their entrance. */
    stagger(root, sel, { max = 18 } = {}) {
      if (!root || !this.ok()) return;
      root.classList.add('stagger');
      root.querySelectorAll(sel).forEach((el, i) => { el.style.setProperty('--i', Math.min(i, max)); el.classList.add('rise'); });
      setTimeout(() => root.classList.remove('stagger'), 1400);
    },

    /** Animate numbers in [data-count] up from zero. `format` turns a number into display text. */
    countUp(root, format = (n) => Math.round(n).toLocaleString()) {
      if (!root) return;
      const els = root.querySelectorAll('[data-count]');
      els.forEach((el) => {
        const target = parseFloat(el.dataset.count) || 0;
        const suffix = el.dataset.suffix || '';
        if (!this.ok() || target === 0) { el.textContent = format(target) + suffix; return; }
        const dur = 900 + Math.min(600, Math.log10(target + 1) * 150);
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / dur);
          el.textContent = format(target * easeOut(t)) + suffix;
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    },

    /** FLIP: animate elements from where they were before `mutate()` to where they end up. */
    flip(container, sel, mutate) {
      // `container` may be a function, for views that replace their own DOM while mutating.
      const root = () => (typeof container === 'function' ? container() : container);
      if (!this.ok() || !root()) { mutate(); return; }
      const before = new Map();
      root().querySelectorAll(sel).forEach((el) => before.set(el.dataset.id, el.getBoundingClientRect()));
      mutate();
      const after = root();
      if (!after) return;
      after.querySelectorAll(sel).forEach((el) => {
        const a = before.get(el.dataset.id);
        const b = el.getBoundingClientRect();
        if (!a) { el.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' }); return; }
        const dx = a.left - b.left, dy = a.top - b.top;
        if (!dx && !dy) return;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
    },

    /** Material-style press ripple on buttons. */
    ripples() {
      document.addEventListener('pointerdown', (e) => {
        if (!this.ok() || e.button !== 0) return;
        const b = e.target.closest('.btn, .icon-btn, .nav-item, .project-item, .post-card, .filter, .cat-chip');
        if (!b || b.disabled) return;
        const r = b.getBoundingClientRect();
        const size = Math.max(r.width, r.height) * 2.2;
        const dot = document.createElement('span');
        dot.className = 'ripple';
        dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
        b.appendChild(dot);
        setTimeout(() => dot.remove(), 650);
      }, { passive: true });
    },

    /** The ink-drop launch animation. Resolves when it has finished (immediately with reduced motion). */
    splash() {
      return new Promise((resolve) => {
        if (!this.ok()) { resolve(); return; }
        const el = document.createElement('div');
        el.className = 'splash';
        el.innerHTML = `
          <svg class="splash-drop" viewBox="0 0 120 160" aria-hidden="true">
            <defs><linearGradient id="spg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6719"/><stop offset=".6" stop-color="#ff3d77"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>
            <path class="drop" d="M60 8c16 22 38 42 38 68a38 38 0 0 1-76 0c0-26 22-46 38-68z" fill="url(#spg)"/>
            <path class="nib" d="M60 62v52" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
            <circle class="nib-dot" cx="60" cy="58" r="8" fill="#fff"/>
          </svg>
          <div class="splash-rings"><i></i><i></i><i></i></div>
          <div class="splash-word">Inkwell</div>`;
        document.body.appendChild(el);
        const done = () => {
          if (!el.isConnected) return;
          el.classList.add('out');
          setTimeout(() => { el.remove(); resolve(); }, 420);
        };
        el.addEventListener('click', done);
        setTimeout(done, 1350);
      });
    },

    /** Little burst of sparkles at a point — used when a fix is applied or a goal is reached. */
    sparkle(x, y, colors = ['#ff6719', '#ff3d77', '#7c3aed', '#30a46c', '#f5a524']) {
      if (!this.ok()) return;
      for (let i = 0; i < 14; i++) {
        const s = document.createElement('i');
        s.className = 'spark';
        const a = (Math.PI * 2 * i) / 14, d = 30 + Math.random() * 34;
        s.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]}`;
        document.body.appendChild(s);
        s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity: 0 }],
        { duration: 600 + Math.random() * 250, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => s.remove();
      }
    },
  };

  if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', () => Motion.setLevel(Motion.level));
  window.Motion = Motion;
})();
