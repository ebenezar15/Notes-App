# Inkwell — Offline Blog Studio

Inkwell is a writing app for planning, drafting, polishing and keeping a record of blog posts. When a post is ready, you can move it to **Substack**.
Everything runs **on your device**. There is no account, no server and no internet connection needed, and your words never leave the device unless you export or copy them.

It's modelled on the calm feel of Apple Notes and Notability, with more visuals added: project covers, an editorial board, writing-activity charts and readability graphs.

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

**Publish to Substack**
- A pre-flight checklist covering title, subtitle, cover, length, spelling and tags
- One-click copy of the title, the subtitle and the **rich-text body**, ready to paste into Substack's editor
- A preview that shows how the post will look on Substack
- Exports to `.md`, `.html` or `.zip` (Markdown, HTML and image files). You can also export a whole project or every post at once.
- A field to save the published Substack URL, and a "Mark as published" button (with confetti 🎉)

Substack has no public API for creating drafts, so Inkwell gets each post ready to paste. Once you're online, open Substack → **New post** and paste the title, subtitle and body.

## Running it

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

## Your data
- Everything is stored in your browser's IndexedDB on this device.
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
js/db.js              IndexedDB storage
sw.js                 Service worker for offline use
tests/                Proofreader unit tests (npm test)
```
