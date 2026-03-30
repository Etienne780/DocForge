// Register all IPC handlers here
import { ipcMain, BrowserWindow } from 'electron';

export function registerIpcHandlers() {
  ipcMain.handle('ping', () => 'pong');

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
}