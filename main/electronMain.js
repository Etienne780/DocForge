import { app, BrowserWindow, webContents  } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerIpcHandlers } from './ipc/handlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

async function createWindow() {
  const isMac = process.platform === 'darwin';
  const isDev = process.env.NODE_ENV === 'development';
  const windowFrame = false;

  mainWindow = new BrowserWindow({
    width: 1371,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' }
      : { frame: (!isDev) ? true : windowFrame,/*hides top tool bar, NEEDS to be false in release builds */ }),
    webPreferences: {
        preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!input.control) 
      return;
  
    const minZoom = 0.7;
    const maxZoom = 1.4;
    const currentZoom = mainWindow.webContents.getZoomFactor();
    let newZoom = null;
  
    if (input.key === '-') {
      newZoom = Math.max(currentZoom - 0.1, minZoom);
      event.preventDefault();
    }
  
    if (input.key === '=' || input.key === '+') {
      newZoom = Math.min(currentZoom + 0.1, maxZoom);
      event.preventDefault();
    }
  
    if (input.key === '0') {
      newZoom = 1.0;
      event.preventDefault();
    }
  
    if (newZoom !== null) {
      mainWindow.webContents.setZoomFactor(newZoom);
      mainWindow.webContents.send('zoom:changed', newZoom);
    }
  });

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, '../renderer/dist/index.html')
    );
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