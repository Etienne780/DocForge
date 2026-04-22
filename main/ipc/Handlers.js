// Register all IPC handlers here
import { app, ipcMain, BrowserWindow, dialog } from 'electron';
import updater from 'electron-updater';
const { autoUpdater } = updater;
import fs from 'fs';
import path from 'path';

export function registerIpcHandlers() {
  ipcMain.handle('ping', () => 'pong');

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
      await fs.promises.writeFile(absolutePath, data, 'utf8');
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

  ipcMain.handle('fs:delete', async (event, absolutePath) => {
    try {
      await fs.promises.unlink(absolutePath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
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
}