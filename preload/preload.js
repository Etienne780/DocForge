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

  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
    installNow:      () => ipcRenderer.invoke('updater:installNow'),
  
    onChecking:      (cb) => ipcRenderer.on('updater:checking',      ()         => cb()),
    onAvailable:     (cb) => ipcRenderer.on('updater:available',     (_, info)  => cb(info)),
    onNotAvailable:  (cb) => ipcRenderer.on('updater:notAvailable',  (_, info)  => cb(info)),
    onProgress:      (cb) => ipcRenderer.on('updater:progress',      (_, prog)  => cb(prog)),
    onDownloaded:    (cb) => ipcRenderer.on('updater:downloaded',    (_, info)  => cb(info)),
    onError:         (cb) => ipcRenderer.on('updater:error',         (_, err)   => cb(err)),
  },

  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  toggleDevTools: () => ipcRenderer.invoke('window:toggleDevTools'),

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
   * @brief Opens a native file/folder selection dialog.
   *
   * Wrapper around the Electron dialog API. Allows selecting files, folders, or both,
   * with full control over filters and dialog behavior.
   *
   * @param {Object} options                              Dialog configuration.
   * @param {'file'|'folder'|'both'} [options.type=file]  selection target
   *                                                      'file'   = files only
   *                                                      'folder' = directories only
   *                                                      'both'   = files and directories
   * @param {string}  [options.title]                      Custom window title.
   * @param {string}  [options.message]                    Message (macOS).
   * @param {string}  [options.buttonLabel]                Custom confirm button label.
   * @param {boolean} [options.multiselect=false]          Allow selecting multiple entries.
   * @param {string|null} [options.defaultPath=null]       Initial path.
   * @param {Array<{name: string, extensions: string[]}>} [options.filters]
   *                                                      File filters (only used for file selection).
   *                                                      Example: [{ name: 'Images', extensions: ['png','jpg'] }]
   * @param {boolean} [options.showHiddenFiles=false]      Show hidden files.
   * @param {boolean} [options.createDirectory=false]      Allow creating directories (macOS).
   * @param {boolean} [options.promptToCreate=false]       Prompt to create missing directory (Windows).
   * @param {boolean} [options.noResolveAliases=false]     Disable alias resolving (macOS).
   * @param {boolean} [options.treatPackageAsDirectory=false]
   *                                                      Treat bundles as directories (macOS).
   * @param {boolean} [options.dontAddToRecent=false]      Do not add selection to recent documents (Windows).
   *
   * @returns {Promise<{canceled: boolean, filePaths: string[]}>}
   *          Returns an object containing:
   *          - canceled: true if dialog was dismissed
   *          - filePaths: array of selected paths (empty if canceled)
   */
  openDialog: (options = {}) =>
    ipcRenderer.invoke('dialog:open', options),
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