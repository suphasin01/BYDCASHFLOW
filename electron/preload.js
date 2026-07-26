const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  exportPDF: (html, filename) => ipcRenderer.invoke('export-pdf', html, filename),
  getVersion: () => ipcRenderer.invoke('get-version'),
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
})
