const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Discovery and connection
  manualConnect: (ip) => ipcRenderer.send('manual-connect', ip),
  onDiscoveryStatus: (callback) => ipcRenderer.on('discovery-status', (_event, text) => callback(text)),
  onShowManual: (callback) => ipcRenderer.on('show-manual', () => callback()),

  // Anti-cheat mechanisms
  enableAntiCheat: () => ipcRenderer.send('enable-anti-cheat'),
  disableAntiCheat: () => ipcRenderer.send('disable-anti-cheat'),
  onAntiCheatBlurDetected: (callback) => ipcRenderer.on('anti-cheat-blur-detected', () => callback()),
  removeAntiCheatBlurListener: () => ipcRenderer.removeAllListeners('anti-cheat-blur-detected'),

  // Desktop update UI
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
  installUpdate: () => ipcRenderer.invoke('install-update')
});
