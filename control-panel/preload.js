const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('controlPanel', {
  getStatus: () => ipcRenderer.invoke('panel:get-status'),
  serviceAction: (action) => ipcRenderer.invoke('panel:service-action', action),
  openPlatform: () => ipcRenderer.invoke('panel:open-platform'),
  createBackup: () => ipcRenderer.invoke('panel:create-backup'),
  restoreBackup: () => ipcRenderer.invoke('panel:restore-backup'),
  exportDiagnostics: () => ipcRenderer.invoke('panel:export-diagnostics'),
  checkUpdate: () => ipcRenderer.invoke('panel:check-update'),
  openUpdatePage: () => ipcRenderer.invoke('panel:open-update-page'),
  getAutostart: () => ipcRenderer.invoke('panel:get-autostart'),
  setAutostart: (enabled) => ipcRenderer.invoke('panel:set-autostart', enabled),
  onLiveLog: (callback) => ipcRenderer.on('panel:live-log', (_event, entry) => callback(entry))
});
