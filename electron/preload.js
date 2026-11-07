/* Bridge for the desktop app: lets the page talk to a local AI server (Ollama) through the main
 * process, avoiding browser CORS rules. Only localhost addresses are allowed (enforced in main.js). */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('inkwellNative', {
  localFetch: (req) => ipcRenderer.invoke('local-fetch', req),
  localPull: (req) => ipcRenderer.invoke('local-pull', req),
  onLocalPullProgress: (cb) => {
    const handler = (_e, evt) => cb(evt);
    ipcRenderer.on('local-pull-progress', handler);
    return () => ipcRenderer.removeListener('local-pull-progress', handler);
  },
});
