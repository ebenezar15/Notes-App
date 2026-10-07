/* Inkwell export helpers: Substack-ready HTML, Markdown, clipboard and a tiny ZIP writer. */
(function () {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function slugify(s) {
    return (s || 'untitled').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled';
  }

  // ------------------------------------------------------------ sanitizer
  const ALLOWED = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'DEL', 'A', 'BLOCKQUOTE',
    'UL', 'OL', 'LI', 'PRE', 'CODE', 'HR', 'IMG', 'BR', 'FIGURE', 'FIGCAPTION', 'SUB', 'SUP', 'MARK']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'META', 'LINK', 'TITLE', 'HEAD', 'NOSCRIPT', 'SVG', 'FORM', 'INPUT', 'BUTTON']);
  const RENAME = { B: 'strong', I: 'em', STRIKE: 's', DEL: 's', H4: 'h3', H5: 'h3', H6: 'h3' };

  function sanitizeNode(node, doc) {
    if (node.nodeType === 3) return doc.createTextNode(node.nodeValue);
    if (node.nodeType !== 1) return null;
    const tag = node.tagName;
    if (DROP.has(tag)) return null;
    const frag = doc.createDocumentFragment();
    const kids = () => Array.from(node.childNodes).forEach((c) => { const n = sanitizeNode(c, doc); if (n) frag.appendChild(n); });
    if (!ALLOWED.has(tag) && !RENAME[tag]) {
      kids();
      // Block-level containers (div, section…) become paragraphs-ish breaks.
      if (/^(DIV|SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|TR)$/.test(tag) && frag.childNodes.length) {
        const p = doc.createElement('p');
        p.appendChild(frag);
        return p;
      }
      return frag;
    }
    const el = doc.createElement((RENAME[tag] || tag).toLowerCase());
    if (tag === 'A') {
      const href = node.getAttribute('href') || '';
      if (/^(https?:|mailto:|#)/i.test(href)) el.setAttribute('href', href);
    }
    if (tag === 'IMG') {
      const src = node.getAttribute('src') || '';
      if (!/^(data:image\/|https?:|blob:)/i.test(src)) return null;
      el.setAttribute('src', src);
      if (node.getAttribute('alt')) el.setAttribute('alt', node.getAttribute('alt'));
      return el;
    }
    kids();
    el.appendChild(frag);
    return el;
  }

  function sanitizeHTML(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const out = document.createElement('div');
    Array.from(doc.body.childNodes).forEach((c) => { const n = sanitizeNode(c, document); if (n) out.appendChild(n); });
    // Wrap stray inline content at the top level into paragraphs.
    const blocks = /^(P|H1|H2|H3|BLOCKQUOTE|UL|OL|PRE|HR|FIGURE|IMG)$/;
    let para = null;
    Array.from(out.childNodes).forEach((n) => {
      if (n.nodeType === 1 && blocks.test(n.tagName)) { para = null; return; }
      if (n.nodeType === 3 && !n.nodeValue.trim()) { n.remove(); return; }
      if (!para) { para = document.createElement('p'); out.insertBefore(para, n); }
      para.appendChild(n);
    });
    return out.innerHTML;
  }

  // ------------------------------------------------------------ HTML → Markdown
  function inlineMd(node) {
    let out = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { out += n.nodeValue.replace(/([*_`\\])/g, '\\$1'); return; }
      if (n.nodeType !== 1) return;
      const inner = () => inlineMd(n);
      switch (n.tagName) {
        case 'STRONG': case 'B': out += wrap(inner(), '**'); break;
        case 'EM': case 'I': out += wrap(inner(), '*'); break;
        case 'S': case 'DEL': case 'STRIKE': out += wrap(inner(), '~~'); break;
        case 'CODE': out += '`' + n.textContent + '`'; break;
        case 'A': out += `[${inner()}](${n.getAttribute('href') || ''})`; break;
        case 'BR': out += '  \n'; break;
        case 'IMG': out += `![${n.getAttribute('alt') || ''}](${n.getAttribute('data-export-src') || n.getAttribute('src')})`; break;
        default: out += inner();
      }
    });
    return out;
  }
  const wrap = (s, m) => (s.trim() ? s.replace(/^(\s*)(.*?)(\s*)$/s, `$1${m}$2${m}$3`) : s);

  function blockMd(node, depth = 0) {
    const parts = [];
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) parts.push(n.nodeValue.trim()); return; }
      if (n.nodeType !== 1) return;
      switch (n.tagName) {
        case 'H1': parts.push('# ' + inlineMd(n).trim()); break;
        case 'H2': parts.push('## ' + inlineMd(n).trim()); break;
        case 'H3': case 'H4': parts.push('### ' + inlineMd(n).trim()); break;
        case 'HR': parts.push('---'); break;
        case 'PRE': parts.push('```\n' + n.textContent.replace(/\n$/, '') + '\n```'); break;
        case 'BLOCKQUOTE': {
          const inner = n.querySelector('p,h1,h2,h3,ul,ol') ? blockMd(n) : inlineMd(n).trim();
          parts.push(inner.split('\n').map((l) => '> ' + l).join('\n'));
          break;
        }
        case 'UL': case 'OL': {
          let i = 1;
          const lines = [];
          n.childNodes.forEach((li) => {
            if (li.nodeType !== 1 || li.tagName !== 'LI') return;
            const nested = Array.from(li.children).filter((c) => c.tagName === 'UL' || c.tagName === 'OL');
            const clone = li.cloneNode(true);
            clone.querySelectorAll('ul,ol').forEach((x) => x.remove());
            const bullet = n.tagName === 'OL' ? `${i++}.` : '-';
            lines.push('  '.repeat(depth) + bullet + ' ' + inlineMd(clone).trim());
            nested.forEach((sub) => {
              const wrapDiv = document.createElement('div');
              wrapDiv.appendChild(sub.cloneNode(true));
              lines.push(blockMd(wrapDiv, depth + 1));
            });
          });
          parts.push(lines.join('\n'));
          break;
        }
        case 'FIGURE': {
          const img = n.querySelector('img');
          const cap = n.querySelector('figcaption');
          if (img) parts.push(inlineMd({ childNodes: [img] }));
          if (cap && cap.textContent.trim()) parts.push('*' + cap.textContent.trim() + '*');
          break;
        }
        case 'IMG': parts.push(inlineMd({ childNodes: [n] })); break;
        case 'DIV': parts.push(blockMd(n, depth)); break;
        default: {
          const t = inlineMd(n).trim();
          if (t) parts.push(t);
        }
      }
    });
    return parts.join(depth ? '\n' : '\n\n');
  }

  function htmlToMarkdown(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return blockMd(div).replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // ------------------------------------------------------------ post documents
  function postMarkdown(post, opts = {}) {
    const lines = [];
    if (opts.frontMatter !== false) {
      lines.push('---');
      lines.push(`title: ${JSON.stringify(post.title || 'Untitled')}`);
      if (post.subtitle) lines.push(`subtitle: ${JSON.stringify(post.subtitle)}`);
      if (post.tags && post.tags.length) lines.push(`tags: [${post.tags.map((t) => JSON.stringify(t)).join(', ')}]`);
      lines.push(`status: ${post.status}`);
      lines.push(`updated: ${new Date(post.updatedAt).toISOString()}`);
      lines.push('---', '');
    }
    lines.push('# ' + (post.title || 'Untitled'));
    if (post.subtitle) lines.push('', '*' + post.subtitle + '*');
    lines.push('', htmlToMarkdown(opts.html || post.content || ''));
    return lines.join('\n');
  }

  /** Clean body HTML in the shape Substack's editor accepts on paste. */
  function substackBody(post) {
    const div = document.createElement('div');
    div.innerHTML = sanitizeHTML(post.content || '');
    div.querySelectorAll('mark').forEach((m) => m.replaceWith(...m.childNodes));
    div.querySelectorAll('p').forEach((p) => { if (!p.textContent.trim() && !p.querySelector('img')) p.remove(); });
    return div.innerHTML;
  }

  function postHTMLDocument(post, opts = {}) {
    const body = opts.html || substackBody(post);
    const cover = post.cover && post.cover.type === 'image' ? `<img class="cover" src="${opts.coverSrc || post.cover.value}" alt="">` : '';
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(post.title || 'Untitled')}</title>
<style>
body{font:20px/1.65 Charter,'Iowan Old Style',Georgia,serif;color:#1d1d1f;max-width:680px;margin:48px auto;padding:0 20px}
h1{font-size:2.1em;line-height:1.2;margin:.2em 0}h2{font-size:1.5em}h3{font-size:1.2em}
.subtitle{color:#6e6e73;font-size:1.15em;margin-top:0}img{max-width:100%;border-radius:6px}.cover{margin-bottom:24px}
blockquote{border-left:3px solid #ff6719;margin:1em 0;padding-left:1em;color:#444}pre{background:#f5f5f7;padding:12px;overflow:auto;border-radius:6px}
hr{border:0;border-top:1px solid #ddd;margin:2em 0}a{color:#ff6719}
</style></head><body>
${cover}<h1>${esc(post.title || 'Untitled')}</h1>
${post.subtitle ? `<p class="subtitle">${esc(post.subtitle)}</p>` : ''}
${body}
</body></html>`;
  }

  // ------------------------------------------------------------ images inside posts → files
  function dataUrlToBytes(dataUrl) {
    const [head, b64] = dataUrl.split(',');
    const mime = (/data:([^;]+)/.exec(head) || [])[1] || 'application/octet-stream';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime, bytes };
  }
  const extFor = (mime) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' }[mime] || 'bin');

  /** Returns { html, images:[{name, bytes}] } with data: images swapped for relative file paths. */
  function extractImages(html, prefix = 'images/') {
    const div = document.createElement('div');
    div.innerHTML = html;
    const images = [];
    div.querySelectorAll('img').forEach((img, i) => {
      const src = img.getAttribute('src') || '';
      if (!src.startsWith('data:')) return;
      const { mime, bytes } = dataUrlToBytes(src);
      const name = `image-${i + 1}.${extFor(mime)}`;
      images.push({ name: prefix + name, bytes });
      img.setAttribute('src', prefix + name);
    });
    return { html: div.innerHTML, images };
  }

  // ------------------------------------------------------------ ZIP (store, no compression)
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeZip(files) {
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
      local.setUint16(8, 0, true); local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
      chunks.push(new Uint8Array(local.buffer), name, data);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, 0, true); cen.setUint16(12, dosTime, true); cen.setUint16(14, dosDate, true);
      cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true);
      cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cenSize = central.reduce((n, c) => n + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  function postPackageFiles(post, folder = '') {
    const { html, images } = extractImages(substackBody(post), 'images/');
    const files = [];
    let coverSrc;
    if (post.cover && post.cover.type === 'image' && post.cover.value.startsWith('data:')) {
      const { mime, bytes } = dataUrlToBytes(post.cover.value);
      coverSrc = `images/cover.${extFor(mime)}`;
      files.push({ name: folder + coverSrc, data: bytes });
    }
    files.push({ name: folder + 'post.md', data: postMarkdown(post, { html }) });
    files.push({ name: folder + 'post.html', data: postHTMLDocument(post, { html, coverSrc }) });
    images.forEach((img) => files.push({ name: folder + img.name, data: img.bytes }));
    return files;
  }

  // ------------------------------------------------------------ download & clipboard
  function download(filename, data, type = 'text/plain') {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function copyRich(html, plain) {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        })]);
        return true;
      }
    } catch (e) { /* fall through to the selection-based copy */ }
    const holder = document.createElement('div');
    holder.contentEditable = 'true';
    holder.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    holder.innerHTML = html;
    document.body.appendChild(holder);
    const range = document.createRange();
    range.selectNodeContents(holder);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    sel.removeAllRanges();
    holder.remove();
    return ok;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  window.Exporter = {
    esc, slugify, sanitizeHTML, htmlToMarkdown, postMarkdown, postHTMLDocument, substackBody,
    makeZip, postPackageFiles, download, copyRich, copyText,
  };
})();
