import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers } from './ipc/Handlers.js';
import { setupLinkOpen } from './window/SetupLinkOpen.js'
import { setupZoom } from './window/SetupZoom.js';
import { loadWindowState, setupWindowState } from './window/WindowState.js';
import { getLogoPath } from './Common.js';
import { setupAutoUpdater } from './SetupAutoUpdater.js';
import {
  registerMacOpenFileHandler,
  collectStartupFiles,
  handleSecondInstance,
} from './fs/FileOpenManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

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
      : { frame: isDev ? false : false /* hides top tool bar, NEEDS to be false in release builds */ }),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  setupWindowState(mainWindow);
  setupAutoUpdater();
  setupLinkOpen(mainWindow);
  setupZoom(mainWindow);

  registerIpcHandlers(mainWindow);

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const rendererPath = path.resolve(__dirname, '../renderer/dist/index.html');
    await mainWindow.loadFile(rendererPath);
  }
}

// Must be registered before whenReady, otherwise early mac open-file
// events on cold start (double-clicking a file) would be lost.
registerMacOpenFileHandler(() => mainWindow);
collectStartupFiles(); // Windows/Linux: file argument on the very first launch

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    handleSecondInstance(argv, mainWindow);
  });
}

app.whenReady().then(() => {
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