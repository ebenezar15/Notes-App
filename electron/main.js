/* Inkwell desktop app (macOS + Windows + Linux) — a thin Electron shell around the web app. */
const { app, BrowserWindow, Menu, shell, nativeTheme } = require('electron');
const path = require('path');

const isMac = process.platform === 'darwin';
let win = null;

// One window per app; a second launch focuses the existing one.
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 760,
    minHeight: 560,
    title: 'Inkwell',
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#131316' : '#f6f4ef',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    autoHideMenuBar: !isMac,
    icon: path.join(__dirname, '..', 'icons', 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true },
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });

  // Let the page finish saving before the window goes away.
  let flushed = false;
  win.on('close', (e) => {
    if (flushed) return;
    e.preventDefault();
    const done = () => { flushed = true; if (win) win.close(); };
    Promise.race([
      win.webContents.executeJavaScript('window.__inkwellFlush ? window.__inkwellFlush() : null').catch(() => null),
      new Promise((r) => setTimeout(r, 1500)),
    ]).then(done);
  });

  // Links open in the user's normal browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) { e.preventDefault(); shell.openExternal(url); }
  });

  // Right-click menu with spelling suggestions, like a native text editor.
  win.webContents.on('context-menu', (_e, params) => {
    const items = [];
    if (params.misspelledWord) {
      params.dictionarySuggestions.slice(0, 5).forEach((s) => items.push({ label: s, click: () => win.webContents.replaceMisspelling(s) }));
      if (!params.dictionarySuggestions.length) items.push({ label: 'No suggestions', enabled: false });
      items.push({ label: 'Add to dictionary', click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord) });
      items.push({ type: 'separator' });
    }
    if (params.isEditable) items.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' });
    else if (params.selectionText) items.push({ role: 'copy' });
    if (params.linkURL && /^https?:/.test(params.linkURL)) items.push({ type: 'separator' }, { label: 'Open link in browser', click: () => shell.openExternal(params.linkURL) });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });
}

function buildMenu() {
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }]),
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [{ label: 'Inkwell on GitHub', click: () => shell.openExternal('https://github.com/ebenezar15/Notes-App') }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (!isMac) app.quit(); });
