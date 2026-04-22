import { app, BrowserWindow, webContents  } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers } from './ipc/Handlers.js';
import { setupZoom } from './SetupZoom.js';
import { getLogoPath } from './Common.js';
import { loadWindowState, setupWindowState } from './WindowState.js';
import { setupAutoUpdater } from './SetupAutoUpdater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

async function createWindow() {
  const isMac = process.platform === 'darwin';
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  const savedState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: savedState.width,
    height: savedState.height,
    x: savedState.x,
    y: savedState.y,
    minWidth: 700,
    minHeight: 400,
    icon: getLogoPath(), // Linux/Windows
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' }
      : { frame: isDev ? false : false,/*hides top tool bar, NEEDS to be false in release builds */ }),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  setupWindowState(mainWindow);
  setupAutoUpdater();
  setupZoom(mainWindow);

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const rendererPath = path.resolve(__dirname, '../renderer/dist/index.html');
    await mainWindow.loadFile(rendererPath);
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