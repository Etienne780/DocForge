const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ─── System Info ─────────────────────────────────────────────
  getPlatform,
  getVersions,
  ping: () => ipcRenderer.invoke('ping'),

  // ─── Generic IPC ─────────────────────────────────────────────
  send: (channel, data) => ipcRenderer.send(channel, data),
  receive: (channel, func) => {
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },

  // ─── File Open (cold start / already-running) ───────────────
  /** Fetch files queued before the renderer was ready (cold start via
   *  double-click / "open with"). Call once during bootstrap. */
  getPendingFiles: () => ipcRenderer.invoke('file:getPendingFiles'),

  /** Files opened while the app is already running (second instance
   *  launched, or mac open-file while running). cb receives an array
   *  of file paths, even for a single file. */
  onFileOpen: (cb) => ipcRenderer.on('file:open', (event, files) => cb(files)),

  // ─── App Lifecycle ───────────────────────────────────────────
  onBeforeClose: (cb) => ipcRenderer.on('app:before-close', () => cb()),
  /** Must be called when the app is closing, once saving is complete. */
  confirmSaveComplete: () => ipcRenderer.send('app:save-complete'),

  // ─── Auto Updater ────────────────────────────────────────────
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
    installNow: () => ipcRenderer.invoke('updater:installNow'),

    onChecking: (cb) => ipcRenderer.on('updater:checking', () => cb()),
    onAvailable: (cb) => ipcRenderer.on('updater:available', (_, info) => cb(info)),
    onNotAvailable: (cb) => ipcRenderer.on('updater:notAvailable', (_, info) => cb(info)),
    onProgress: (cb) => ipcRenderer.on('updater:progress', (_, prog) => cb(prog)),
    onDownloaded: (cb) => ipcRenderer.on('updater:downloaded', (_, info) => cb(info)),
    onError: (cb) => ipcRenderer.on('updater:error', (_, err) => cb(err)),
  },

  // ─── Window Controls ─────────────────────────────────────────
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  toggleDevTools: () => ipcRenderer.invoke('window:toggleDevTools'),
  onZoomChanged: (func) => ipcRenderer.on('zoom:changed', (event, factor) => func(factor)),

  // ─── Paths ───────────────────────────────────────────────────
  /** Platform user-data dir: %APPDATA%/DocForge (Win), ~/Library/Application/DocForge (macOS),
   *  ~/.config/DocForge (Linux). */
  getUserDataPath: () => ipcRenderer.invoke('path:userData'),

  /** Absolute path to the running executable. */
  getExePath: () => ipcRenderer.invoke('path:exe'),

  /** Joins path segments using the platform-specific separator. */
  joinPath: (...segments) => ipcRenderer.invoke('path:join', ...segments),

  // ─── File System ─────────────────────────────────────────────
  /** Writes data (string) to an absolute path. Returns { ok, error }. */
  writeFile: (absolutePath, data) => ipcRenderer.invoke('fs:write', absolutePath, data),

  /** Reads a file from an absolute path. Returns { ok, data, error }. */
  readFile: (absolutePath) => ipcRenderer.invoke('fs:read', absolutePath),

  /** Reads a folder from an absolute path. Returns { ok, entries: { name, isDirectory }, error }. */
  readDir: (absolutePath, options) => ipcRenderer.invoke('fs:readdir', absolutePath, options),

  /** Creates a folder at an absolute path. Returns { ok, error }. */
  mkdir: (absolutePath) => ipcRenderer.invoke('fs:mkdir', absolutePath),

  /** Removes a path (file or folder) at an absolute path. Returns { ok, error }. */
  removePath: (absolutePath, options) => ipcRenderer.invoke('fs:rm', absolutePath, options),

  /** Checks if an absolute path exists. Returns { ok, exists }. */
  pathExists: (absolutePath) => ipcRenderer.invoke('fs:exists', absolutePath),

  /** Deletes a file at an absolute path. Returns { ok, error }. */
  deleteFile: (absolutePath) => ipcRenderer.invoke('fs:delete', absolutePath),

  // ─── Dialogs ─────────────────────────────────────────────────
  /**
   * Opens a native file save dialog.
   *
   * @param {Object} options                              Dialog configuration.
   * @param {string}  [options.title]                      Custom window title.
   * @param {string|null} [options.defaultPath=null]       Initial path.
   * @param {Array<{name: string, extensions: string[]}>} [options.filters]
   *                                                        File filters (only used for file selection).
   *                                                        Example: [{ name: 'Images', extensions: ['png','jpg'] }]
   * @returns {Promise<{canceled: boolean, filePaths: string[]}>}
   */
  saveDialog: (options = {}) => ipcRenderer.invoke('dialog:save', options),

  /**
   * Opens a native file/folder selection dialog.
   *
   * @param {Object} options                              Dialog configuration.
   * @param {'file'|'folder'|'both'} [options.type=file]  Selection target.
   * @param {string}  [options.title]                      Custom window title.
   * @param {string}  [options.message]                    Message (macOS).
   * @param {string}  [options.buttonLabel]                Custom confirm button label.
   * @param {boolean} [options.multiselect=false]          Allow selecting multiple entries.
   * @param {string|null} [options.defaultPath=null]       Initial path.
   * @param {Array<{name: string, extensions: string[]}>} [options.filters]
   *                                                        File filters (only used for file selection).
   * @param {boolean} [options.showHiddenFiles=false]      Show hidden files.
   * @param {boolean} [options.createDirectory=false]      Allow creating directories (macOS).
   * @param {boolean} [options.promptToCreate=false]       Prompt to create missing directory (Windows).
   * @param {boolean} [options.noResolveAliases=false]     Disable alias resolving (macOS).
   * @param {boolean} [options.treatPackageAsDirectory=false] Treat bundles as directories (macOS).
   * @param {boolean} [options.dontAddToRecent=false]      Do not add selection to recent documents (Windows).
   * @returns {Promise<{canceled: boolean, filePaths: string[]}>}
   */
  openDialog: (options = {}) => ipcRenderer.invoke('dialog:open', options),

  // ─── Folder / Shell ──────────────────────────────────────────
  openFolder: (folderPath) => ipcRenderer.invoke('folder:open', folderPath),
  showInFolder: (targetPath) => ipcRenderer.invoke('folder:show', targetPath),
});

// ─── Project File Watching ──────────────────────────────────────
contextBridge.exposeInMainWorld('watcherAPI', {
  watchProject: (projectId, projectPath) => 
    ipcRenderer.invoke('watcher:watch-project', { projectId, projectPath }),

  unwatchProject: (projectId) =>
    ipcRenderer.invoke('watcher:unwatch-project', projectId),

  ignoreNextChange: (projectId, filePath) => {
    console.log(`projectId ${projectId}; filePath ${filePath};`);
    ipcRenderer.invoke('watcher:ignore-next-change', { projectId, filePath });
  },

  ignorePathTree: (projectId, directoryPath) =>
    ipcRenderer.invoke('watcher:ignore-path-tree', { projectId, directoryPath }),

  releasePathTree: (projectId, directoryPath) =>
    ipcRenderer.invoke('watcher:release-path-tree', { projectId, directoryPath }),

  isPathIgnored: (projectId, directoryPath) =>
    ipcRenderer.invoke('watcher:is-path-ignored', { projectId, directoryPath }),

  isWatching: (projectId) =>
    ipcRenderer.invoke('watcher:is-watching', projectId),

  onFileChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('watcher:file-changed', listener);
    return () => ipcRenderer.removeListener('watcher:file-changed', listener);
  },

  onError: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('watcher:error', listener);
    return () => ipcRenderer.removeListener('watcher:error', listener);
  },
});

function getPlatform() {
  switch (process.platform) {
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
    electron: process.versions.electron,
  };
}