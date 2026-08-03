import { app, ipcMain } from 'electron';
import { getFilesFromArgv, isOpenableFile } from './ProgrammArgs.js';

// Files collected on cold start (argv or early mac 'open-file' events),
// picked up by the renderer via a pull-based IPC call instead of relying
// on event ordering between main and renderer.
let pendingFiles = [];

/**
 * Must be called BEFORE app.whenReady() so that early mac 'open-file' events
 * (cold start) are not missed.
 */
export function registerMacOpenFileHandler(getMainWindow) {
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (!isOpenableFile(filePath)) return;

    const win = getMainWindow();
    if (win) {
      // App already running with a window -> push directly, renderer is listening
      win.webContents.send('file:open', [filePath]);
    } else {
      // App still starting -> renderer will pull this later
      pendingFiles.push(filePath);
    }
  });
}

/**
 * For Windows/Linux: collect files from argv on the very first launch.
 */
export function collectStartupFiles() {
  pendingFiles.push(...getFilesFromArgv(process.argv));
}

/**
 * For an already running instance: evaluate the argv of the newly started
 * (second) instance and push the files straight to the existing window.
 */
export function handleSecondInstance(argv, mainWindow) {
  const files = getFilesFromArgv(argv);
  if (files.length === 0 || !mainWindow) return;

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
  mainWindow.webContents.send('file:open', files);
}

/**
 * Registers the pull-based IPC handler. The renderer calls this once during
 * its own startup to fetch any files collected before it was ready to listen.
 * Returns and clears the queue -> safe to call only once per app start.
 */
export function registerFileOpenIpcHandlers() {
  ipcMain.handle('file:getPendingFiles', () => {
    const files = pendingFiles;
    pendingFiles = [];
    return files;
  });
}