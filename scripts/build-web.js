#!/usr/bin/env node
/* Builds the web version:
 *   dist/web/        — the site for GitHub Pages (or any static host), works offline once loaded
 *   dist/Inkwell.html — the whole app in one file you can double-click
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'dist');
const web = path.join(out, 'web');
const SCRIPTS = ['proofreader', 'db', 'exporter', 'sketch', 'social', 'sync', 'app'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(web, { recursive: true });

// 1. Static site.
const copy = (rel) => {
  const src = path.join(root, rel);
  const dst = path.join(web, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
};
['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'].forEach(copy);
fs.writeFileSync(path.join(web, '.nojekyll'), '');

// 2. Single-file app.
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let html = read('index.html');
const swap = (needle, replacement) => {
  if (!html.includes(needle)) throw new Error(`build-web: could not find ${needle}`);
  html = html.replace(needle, () => replacement);
};
swap('<link rel="stylesheet" href="css/styles.css">', `<style>\n${read('css/styles.css')}\n</style>`);
SCRIPTS.forEach((name) => swap(`<script src="js/${name}.js"></script>`, `<script>\n${read(`js/${name}.js`).replace(/<\/script>/g, '<\\/script>')}\n</script>`));
swap('<link rel="manifest" href="manifest.webmanifest">\n', '');
const b64 = (rel) => fs.readFileSync(path.join(root, rel)).toString('base64');
swap('href="icons/icon.svg"', `href="data:image/svg+xml;base64,${b64('icons/icon.svg')}"`);
swap('href="icons/icon-192.png"', `href="data:image/png;base64,${b64('icons/icon-192.png')}"`);
if (/src="js\//.test(html)) throw new Error('build-web: a script was not inlined');
fs.writeFileSync(path.join(out, 'Inkwell.html'), html);

console.log(`Built dist/web (${fs.readdirSync(web).length} entries) and dist/Inkwell.html (${Math.round(html.length / 1024)} KB)`);
