const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPlatform,
  getVersions,
  ping: () => ipcRenderer.invoke('ping'), 
  
  // Generic IPC
  send: (channel, data) => ipcRenderer.send(channel, data),
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },  

  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  onZoomChanged: (func) => ipcRenderer.on('zoom:changed', (event, factor) => func(factor)),
});

function getPlatform() {
  const plat = process.platform;

  switch (plat) {
    case 'win32': return 'win';
    case 'darwin': return 'macOS';
    case 'linux': return 'linux';
    default: return 'unknown';
  }
}

function getVersions() {
  return {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  };
}