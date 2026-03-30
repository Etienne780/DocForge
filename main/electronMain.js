import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers } from './ipc/handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

async function createWindow() {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1371,
    height: 800,
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' }
      : { frame: false, }),
    webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  if (process.env.NODE_ENV === 'development') {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, '../renderer/dist/index.html')
    );
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});