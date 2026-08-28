import { app, ipcMain, screen } from 'electron';
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

export function setupWindowState(win) {
  let saveTimer;
  const debouncedSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(win), 500);
  };

  win.on('resize', debouncedSave);
  win.on('move', debouncedSave);

  // delay closing requests
  win.on('close', async (e) => {
    saveWindowState(win)
    
    if (!app.isQuitting) {
      e.preventDefault();

      win.webContents.send('app:before-close');
      const SAVE_TIMEOUT_MS = 10_000;

      const saveCompleted = await Promise.race([
        new Promise(resolve => ipcMain.once('app:save-complete', () => resolve(true))),
        new Promise(resolve => setTimeout(() => resolve(false), SAVE_TIMEOUT_MS)),
      ]);

      if (!saveCompleted) {
        console.warn(
          `[WindowState] Renderer did not confirm save within ${SAVE_TIMEOUT_MS}ms - closing anyway. Data may not have been fully saved.`
        );
      }

      app.isQuitting = true;
      win.close();
    }
  });
}