const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  exportPDF: (html, filename) => ipcRenderer.invoke('export-pdf', html, filename),
  onUpdateStatus: (cb) => {
    ipcRenderer.removeAllListeners('update-status');
    ipcRenderer.on('update-status', (_e, data) => cb(data));
  },
  onUpdateProgress: (cb) => {
    ipcRenderer.removeAllListeners('update-progress');
    ipcRenderer.on('update-progress', (_e, data) => cb(data));
  },
  onUpdateNotAvailable: (cb) => {
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.on('update-not-available', () => cb());
  },
  onUpdateCountdown: (cb) => {
    ipcRenderer.removeAllListeners('update-countdown');
    ipcRenderer.on('update-countdown', (_e, data) => cb(data));
  },
  cancelAutoUpdate: () => ipcRenderer.invoke('cancel-auto-update'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  startMacDownload: (url, version) => ipcRenderer.invoke('start-mac-download', url, version),
  openReleasesPage: () => ipcRenderer.invoke('open-releases-page'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
})
