const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPlatform,
  getVersions,
  ping: () => ipcRenderer.invoke('ping'), 
  
  // Generic IPC
  send: (channel, data) => ipcRenderer.send(channel, data),
  receive: (channel, func) => {
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },

  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  onZoomChanged: (func) => ipcRenderer.on('zoom:changed', (event, factor) => func(factor)),

  // Paths
  /** Returns the platform user-data dir: %APPDATA%/DocForge on Windows,
   *  ~/Library/Application/DocForge on macOS, ~/.config/DocForge on Linux. */
  getUserDataPath: () => ipcRenderer.invoke('path:userData'),

  /** Returns the absolute path to the running executable. */
  getExePath: () => ipcRenderer.invoke('path:exe'),

  /** Joins path segments into a single path using the platform-specific separator */
  joinPath: (...segments) => ipcRenderer.invoke('path:join', ...segments),

  // File system
  /** Writes data (string) to an absolute path. Returns { ok, error }. */
  writeFile: (absolutePath, data) => ipcRenderer.invoke('fs:write', absolutePath, data),

  /** Reads a file from an absolute path. Returns { ok, data, error }. */
  readFile: (absolutePath) => ipcRenderer.invoke('fs:read', absolutePath),

  /** Deletes a file at an absolute path. Returns { ok, error }. */
  deleteFile: (absolutePath) => ipcRenderer.invoke('fs:delete', absolutePath),

  /** 
   * Opens a native folder-picker dialog.
   * @param {boolean}     multiselect  Allow selecting multiple folders.
   * @param {string|null} defaultPath  Directory the dialog opens in, or null for OS default.
   * @returns {string[]}               Selected paths, empty array if canceled.
   */
  pickFolder: (multiselect = false, defaultPath = null) =>
    ipcRenderer.invoke('dialog:pickFolder', multiselect, defaultPath),
  
  /** 
   * Opens a native file-picker dialog.
   * @param {boolean}     multiselect  Allow selecting multiple files.
   * @param {string|null} defaultPath  Directory the dialog opens in, or null for OS default.
   * @returns {string[]}               Selected paths, empty array if canceled.
   */
  pickFile: (multiselect = false, defaultPath = null) =>
    ipcRenderer.invoke('dialog:pickFile', multiselect, defaultPath),
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