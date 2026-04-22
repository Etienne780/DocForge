import { app, screen } from 'electron';
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
  win.on('close', () => saveWindowState(win));

  let saveTimer;
  const debouncedSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(win), 500);
  };

  win.on('resize', debouncedSave);
  win.on('move', debouncedSave);
}