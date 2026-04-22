import { BrowserWindow } from 'electron';
import updater from 'electron-updater';
const { autoUpdater } = updater;

function send(event, data = {}) {
 const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
 win?.webContents.send(event, data);
}

export function setupAutoUpdater() {
  // autoUpdater.autoDownload = true;
  // autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update',  ()       => send('updater:checking'));
  autoUpdater.on('update-available',     (info)   => send('updater:available', info));
  autoUpdater.on('update-not-available', (info)   => send('updater:notAvailable', info));
  autoUpdater.on('download-progress',    (prog)   => send('updater:progress', prog));
  autoUpdater.on('update-downloaded',    (info)   => send('updater:downloaded', info));
  autoUpdater.on('error',                (err)    => send('updater:error', { message: err.message }));

  autoUpdater.checkForUpdates();
}