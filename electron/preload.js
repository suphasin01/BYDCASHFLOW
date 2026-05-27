const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  exportPDF: (html, filename) => ipcRenderer.invoke('export-pdf', html, filename),
  onUpdateStatus: (cb) => {
    ipcRenderer.removeAllListeners('update-status');
    ipcRenderer.on('update-status', (_e, data) => cb(data));
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
})
