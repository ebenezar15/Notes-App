# Inkwell — Offline Blog Studio

Inkwell is a writing app for planning, drafting, polishing and keeping a record of blog posts. When a post is ready, you can move it to **Substack**.
Everything runs **on your device** and works with no internet connection. No account is needed. If you want, you can sign in to sync your projects across your Mac, PC and the browser (free, see [SYNC.md](SYNC.md)). Otherwise your words never leave the device unless you export or copy them.

It's modelled on the calm feel of Apple Notes and Notability, with more visuals added: project covers, an editorial board, writing-activity charts and readability graphs.

## Download

**[⬇ Download the latest release](https://github.com/ebenezar15/Notes-App/releases/latest)**

| Your computer | File |
| --- | --- |
| Mac (Intel **and** Apple Silicon) | `Inkwell-…-mac-universal.dmg` |
| Windows 10/11 | `Inkwell-…-Windows-Setup.exe` (or `…-Windows-Portable.exe`, no install) |
| Linux | `Inkwell-…-linux-x86_64.AppImage` |
| Any browser | **[Open the web version](https://ebenezar15.github.io/Notes-App/)**, or download `Inkwell.html` |

Everything is free. The apps aren't signed with paid Apple/Microsoft certificates, so the first launch needs one extra click:
- **Mac:** drag Inkwell to Applications, then **right-click → Open → Open**. If macOS says the app "is damaged", run `xattr -cr /Applications/Inkwell.app` once in Terminal.
- **Windows:** if SmartScreen appears, click **More info → Run anyway**.

New builds are made automatically by GitHub Actions on every push (`.github/workflows/release.yml`).

**Sync across devices (optional, free):** sign in with the same email on every device. It takes about 5 minutes to set up once with a free Supabase project you own. See **[SYNC.md](SYNC.md)**.

## Features

**Organise**
- **Projects** (one per publication or series), each with an emoji icon and a gradient colour
- **Posts** inside projects, each with a title, subtitle, cover image, tags and status
- A status pipeline: 💡 Idea → ✏️ Draft → 🔍 Editing → ✅ Ready → 🚀 Published
- **Editorial board**: a kanban view you can drag posts across
- **Dashboard**: word counts, a day streak, a 20-week writing heatmap, a pipeline donut chart and a daily goal ring
- Search across every post, pinning, duplicating, and moving posts by dragging them onto a project

**Write**
- A distraction-free editor with serif typography, a sticky toolbar and a floating toolbar that appears when you select text
- A `/` menu for blocks, plus Markdown shortcuts (`#`, `##`, `###`, `>`, `-`, `1.`)
- Images by upload, paste or drag-and-drop. Large photos are shrunk automatically.
- A **sketch pad** in the style of Notability: pen, highlighter and eraser, pressure support for stylus or finger, and lined, grid or dotted paper
- Focus mode, light, sepia and dark themes, and settings for font, text size and page width
- Automatic saving, plus **version history**: a snapshot every 10 minutes while you write, manual snapshots with `⌘/Ctrl+S`, and one-click restore

**Proofread (fully offline)**
- Live underlines for **spelling, grammar, punctuation, style and typography** issues
- Corrections for spacing and punctuation, capitalisation, ~250 common misspellings, missing apostrophes (`dont` → `don't`), `could of` → `could have`, `then`/`than`, `its`/`it's`, `a`/`an`, repeated words, subject–verb agreement, commas after introductory words, and missing full stops
- Style suggestions: wordy phrases, "very + weak adjective" swaps, filler words, clichés, passive voice and long sentences
- **Fix all** in one click, or accept and ignore suggestions one at a time. The ✨ **Fix** button in the selection toolbar repairs just the selected sentences.
- Insights: a writing score, a readability gauge (Flesch reading ease and grade level), a sentence-rhythm chart, most-used words, an outline and a word-count goal

**Social media**
- **Instagram carousel studio:** turns a post into designed slides automatically (cover, sections, quotes, lists, images, and a call to action). It has 7 designs, three sizes (4:5 feed, 1:1 square, 9:16 story) and up to 20 slides. You can edit, reorder, add or remove slides.
- Exports to a **.zip of PNGs** with the caption included, single slides, or a **PDF carousel for LinkedIn**
- Writes a ready-made **Instagram caption** with hashtags, an **X / Threads thread** split into posts under 280 characters, and a **LinkedIn post**

**Publish to Substack**
- A pre-flight checklist covering title, subtitle, cover, length, spelling and tags
- One-click copy of the title, the subtitle and the **rich-text body**, ready to paste into Substack's editor
- A preview that shows how the post will look on Substack
- Exports to `.md`, `.html` or `.zip` (Markdown, HTML and image files). You can also export a whole project or every post at once.
- A field to save the published Substack URL, and a "Mark as published" button (with confetti 🎉)

Substack has no public API for creating drafts, so Inkwell gets each post ready to paste. Once you're online, open Substack → **New post** and paste the title, subtitle and body.

## Running from source

It's a static web app with no build step and no dependencies.

```bash
npm start            # or: python3 -m http.server 8080
# then open http://localhost:8080
```

### Install it as an app (recommended)
Once it has loaded over `http://localhost` or any HTTPS host, you can install it:
- **Chrome / Edge (Mac, Windows, Linux):** click the install icon in the address bar, or go to ⋮ → *Install Inkwell*
- **Safari (Mac):** File → *Add to Dock*
- **iPad / iPhone:** Share → *Add to Home Screen*

After that, it opens in its own window and works with no network at all. A service worker caches the whole app.

You can also open `index.html` straight from disk. Writing and saving still work that way, but the "install as app" option won't be available.

### Desktop app from source
```bash
npm install
npm run desktop        # run it
npm run dist:mac       # build a universal .dmg (on a Mac)
npm run dist:win       # build the Windows installer + portable .exe
npm run build:web      # build dist/web (website) and dist/Inkwell.html (single file)
```

## Your data
- Everything is stored on this device first: in the browser's IndexedDB, or in the app's own storage for the desktop apps.
- With sync turned on, your projects and posts also go to *your* Supabase database and appear on every device where you sign in.
- **Settings → Backup → Export** saves everything (projects, posts, images, history) into one `.json` file. **Import** restores it, either merging or replacing what's there.
- **Settings → Storage → Protect** asks the browser not to clear Inkwell's data when disk space runs low. Installing the app helps with this too.

## Keyboard shortcuts
| Action | Shortcut |
| --- | --- |
| Search | `⌘/Ctrl + K` |
| New post | `⌘/Ctrl + Alt + N` |
| Save snapshot | `⌘/Ctrl + S` |
| Focus mode | `⌘/Ctrl + .` |
| Proofread panel | `⌘/Ctrl + Shift + P` |
| Link (in editor) | `⌘/Ctrl + K` |
| Block menu | `/` on an empty line |

## Project layout
```
index.html            App shell + inline icon sprite
css/styles.css        Design system, themes, responsive layout
js/app.js             UI, editor, panels, dashboard, board
js/proofreader.js     Offline grammar/spelling/style engine (also runs in Node)
js/exporter.js        Markdown/HTML/Substack export, clipboard, ZIP writer
js/sketch.js          Pressure-sensitive sketch pad
js/social.js          Instagram/LinkedIn carousels, captions, threads (canvas → PNG/PDF)
js/sync.js            Optional account sync (Supabase Auth + REST, offline-first)
electron/main.js      Desktop app shell (macOS, Windows, Linux)
scripts/build-web.js  Builds the website and the single-file app
js/db.js              IndexedDB storage
sw.js                 Service worker for offline use
tests/                Proofreader unit tests (npm test)
```
