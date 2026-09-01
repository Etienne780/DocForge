import { app, ipcMain, BrowserWindow, dialog, shell } from 'electron';
import updater from 'electron-updater';
import fs from 'fs';
import path from 'path';
import { registerWatcherHandlers } from './ProjectHandler.js';
import { registerFileOpenIpcHandlers } from '../fs/FileOpenManager.js';

const { autoUpdater } = updater;

export function registerIpcHandlers(mainWindow) {
  if (!mainWindow) {
    console.error('[Electron][Handlers] registerIpcHandlers: Failed to regiester ipc Handlers, main window was invalid!');
    return;
  }

  ipcMain.handle('ping', () => 'pong');

  ipcMain.on('app:save-complete', () => {
    // ipcMain.once in WindowState waiting
  });

  // ── Auto Updater ─────────────────────────────────────────────────────────────── 
  ipcMain.handle('updater:checkForUpdates', () => {
    autoUpdater.checkForUpdates();
  });
  
  ipcMain.handle('updater:installNow', () => {
    if (autoUpdater.quitAndInstall) {
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true);
      });
    }
  });

  // ── Window Handling ───────────────────────────────────────────────────────────────
  ipcMain.handle('window:minimize', () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) 
      return;

    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    const win = BrowserWindow.getFocusedWindow();
    if(win && win.isClosable)
      win.close();
  }); 

  ipcMain.handle('window:toggleDevTools', () => {
    const win = BrowserWindow.getFocusedWindow();
    win.webContents.toggleDevTools();
  }); 

  // ── File System ───────────────────────────────────────────────────────────────
  ipcMain.handle('path:userData', () => app.getPath('userData'));
  ipcMain.handle('path:exe',      () => app.getPath('exe'));

  ipcMain.handle('path:join', (event, ...segments) => path.join(...segments));

  ipcMain.handle('fs:write', async (event, absolutePath, data) => {
    try {
      await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });

      // Write to a temp file in the same directory, then rename() over the
      // real target instead of writing straight into it. rename() onto an
      // existing path is atomic on the same filesystem (guaranteed on
      // POSIX; effectively atomic on Windows too, via ReplaceFile under the
      // hood) - a reader can only ever see the fully-old or fully-new file,
      // never a half-written one.
      //
      // Without this, a write interrupted mid-flight (app killed during
      // quit, crash, forced termination, power loss) leaves a truncated/
      // corrupt file. On the next load, JSON.parse() throws, which
      // ElectronAdapter.load() silently catches and turns into `null` - from
      // StorageManager's point of view that's indistinguishable from "slot
      // is empty", so the affected module just silently resets to defaults
      // instead of surfacing an error. This is very likely what's behind
      // "data sometimes doesn't load correctly, only on desktop, only
      // sometimes on startup".
      const tempPath = path.join(
        path.dirname(absolutePath),
        `.${path.basename(absolutePath)}.${process.pid}.${Date.now()}.tmp`
      );
      await fs.promises.writeFile(tempPath, data, 'utf8');
      await fs.promises.rename(tempPath, absolutePath);

      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('fs:read', async (event, absolutePath) => {
    try {
      const data = await fs.promises.readFile(absolutePath, 'utf8');
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('fs:readdir', async (event, absolutePath, options = {}) => {
    try {
      const entries = await fs.promises.readdir(absolutePath, { withFileTypes: true });
      return {
        ok: true,
        entries: entries.map(e => ({
          name: e.name,
          isDirectory: e.isDirectory(),
        })),
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('fs:mkdir', async (event, absolutePath) => {
    try {
      await fs.promises.mkdir(absolutePath, { recursive: true });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('fs:rm', async (event, absolutePath, options = {}) => {
    const { recursive = false } = options;
    try {
      await fs.promises.rm(absolutePath, { recursive, force: true });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('fs:exists', async (event, absolutePath) => {
    try {
      await fs.promises.access(absolutePath);
      return { ok: true, exists: true };
    } catch {
      return { ok: true, exists: false };
    }
  });

  ipcMain.handle('fs:delete', async (event, absolutePath) => {
    try {
      await fs.promises.unlink(absolutePath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  ipcMain.handle('dialog:save', async (event, options = {}) => {
    const { defaultPath = undefined, filters = null, title = undefined } = options;

    const dialogOptions = { defaultPath, title };
    if (filters?.length) 
      dialogOptions.filters = filters;

    const result = await dialog.showSaveDialog(dialogOptions);
    return { canceled: result.canceled, filePath: result.canceled ? null : result.filePath };
  });

  ipcMain.handle('dialog:open', async (event, options = {}) => {
    // Default options
    const {
      type = 'file', // 'file' | 'folder' | 'both'
      multiselect = false,
      defaultPath = null,
      filters = null, // [{ name: string, extensions: string[] }]
      title = undefined,
      message = undefined,
      buttonLabel = undefined,
      showHiddenFiles = false,
      createDirectory = false,
      promptToCreate = false,
      noResolveAliases = false,
      treatPackageAsDirectory = false,
      dontAddToRecent = false
    } = options;

    const properties = [];

    // Type handling
    if (type === 'file') {
      properties.push('openFile');
    } else if (type === 'folder') {
      properties.push('openDirectory');
    } else if (type === 'both') {
      properties.push('openFile', 'openDirectory');
    }

    if (multiselect)
      properties.push('multiSelections');
    if (showHiddenFiles)
      properties.push('showHiddenFiles');
    if (createDirectory)
      properties.push('createDirectory');
    if (promptToCreate)
      properties.push('promptToCreate');
    if (noResolveAliases)
      properties.push('noResolveAliases');

    if (treatPackageAsDirectory)
      properties.push('treatPackageAsDirectory');
    if (dontAddToRecent)
      properties.push('dontAddToRecent');

    const dialogOptions = {
      properties
    };

    // Optional fields
    if (defaultPath)
      dialogOptions.defaultPath = defaultPath;
    if (title)
      dialogOptions.title = title;
    if (message)
      dialogOptions.message = message;
    if (buttonLabel)
      dialogOptions.buttonLabel = buttonLabel;
    // Filters (only for files)
    if (filters && Array.isArray(filters) && filters.length > 0) {
      dialogOptions.filters = filters;
    }

    const result = await dialog.showOpenDialog(dialogOptions);

    return {
      canceled: result.canceled,
      filePaths: result.canceled ? [] : result.filePaths
    };
  });

  ipcMain.handle('folder:open', async (event, folderPath) => {
    try {
      await shell.openPath(folderPath);
    
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  
  ipcMain.handle('folder:show', async (event, targetPath) => {
    try {
      shell.showItemInFolder(targetPath);
    
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  registerWatcherHandlers(mainWindow);
  registerFileOpenIpcHandlers();
}