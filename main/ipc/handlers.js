// Register all IPC handlers here
import { app, ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import path from 'path';

export function registerIpcHandlers() {
  ipcMain.handle('ping', () => 'pong');

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

  ipcMain.handle('dialog:pickFolder', async (event, multiselect = false, defaultPath = null) => {
    const properties = ['openDirectory'];
    if (multiselect)
      properties.push('multiSelections');
  
    const result = await dialog.showOpenDialog({
      properties,
      ...(defaultPath && { defaultPath }),
    });
    return result.canceled ? [] : result.filePaths;
  });
  
  ipcMain.handle('dialog:pickFile', async (event, multiselect = false, defaultPath = null) => {
    const properties = ['openFile'];
    if (multiselect)
      properties.push('multiSelections');
  
    const result = await dialog.showOpenDialog({
      properties,
      ...(defaultPath && { defaultPath }),
    });
    return result.canceled ? [] : result.filePaths;
  });
}