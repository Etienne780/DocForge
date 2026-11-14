import { app, ipcMain, screen } from 'electron';
import projectWatcherManager from'../fs/ProjectWatcherManager.js';
import { tempFileManager } from '../fs/TempFileManager.js';
import path from 'path';
import fs from 'fs';

const STATE_DIR = path.join(app.getPath('userData'), 'data');
const STATE_FILE = path.join(STATE_DIR, 'window-state.json');

const DEFAULT_STATE = {
  width: 1200,
  height: 720,
  x: undefined,
  y: undefined,
};

export function loadWindowState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));

      const displays = screen.getAllDisplays();
      const isOnValidDisplay = displays.some((d) => {
        return (
          data.x >= d.bounds.x &&
          data.y >= d.bounds.y &&
          data.x < d.bounds.x + d.bounds.width &&
          data.y < d.bounds.y + d.bounds.height
        );
      });

      if (isOnValidDisplay) 
        return data;
    }
  } catch (_) {}

  return { ...DEFAULT_STATE };
}

function saveWindowState(win) {
  try {
    if (win.isMinimized() || win.isMaximized()) 
        return;
    fs.mkdirSync(STATE_DIR, { recursive: true });

    const bounds = win.getBounds();
    fs.writeFileSync(STATE_FILE, JSON.stringify(bounds), 'utf-8');
  } catch (_) {}
}

const CLOSE_ACK_TIMEOUT_MS = 500;

/**
 * Asks the renderer to prepare for closing. It acks right away and answers later
 * with 'app:save-complete' or 'app:close-cancel', possibly after a dialog, so only
 * the ack has a timeout (renderer hung or not loaded yet).
 * @returns {Promise<'done'|'cancel'|'timeout'>}
 */
function requestRendererClose(win) {
  return new Promise(resolve => {
    const onAck = () => clearTimeout(timer);
    const onDone = () => finish('done');
    const onCancel = () => finish('cancel');
    const timer = setTimeout(() => finish('timeout'), CLOSE_ACK_TIMEOUT_MS);

    function finish(result) {
      clearTimeout(timer);
      ipcMain.removeListener('app:close-ack', onAck);
      ipcMain.removeListener('app:save-complete', onDone);
      ipcMain.removeListener('app:close-cancel', onCancel);
      resolve(result);
    }

    ipcMain.on('app:close-ack', onAck);
    ipcMain.on('app:save-complete', onDone);
    ipcMain.on('app:close-cancel', onCancel);
    win.webContents.send('app:before-close');
  });
}

export function setupWindowState(win) {
  let saveTimer;
  const debouncedSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(win), 500);
  };

  win.on('resize', debouncedSave);
  win.on('move', debouncedSave);

  // delay closing requests until the renderer has saved (or the user canceled)
  let closePending = false;
  win.on('close', async (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      if (closePending)
        return;

      closePending = true;
      const result = await requestRendererClose(win);
      closePending = false;

      if (result === 'cancel')
        return;

      if (result === 'timeout') {
        console.warn(
          `[WindowState] Renderer did not answer the close request within ${CLOSE_ACK_TIMEOUT_MS}ms - closing anyway. Data may not have been fully saved.`
        );
      }

      saveWindowState(win);
      tempFileManager.stop();
      await projectWatcherManager.unwatchAll();
      app.isQuitting = true;
      win.close();
    }
  });
}