import { ipcMain } from 'electron';
import projectWatcherManager from '../fs/ProjectWatcherManager.js';

export function registerWatcherHandlers(mainWindow) {
  ipcMain.handle('watcher:watch-project', (event, { projectId, projectPath }) => {
    projectWatcherManager.watchProject({
      projectId: projectId,
      projectPath: projectPath,
      onChangeCallback: (payload) => {
        mainWindow.webContents.send('watcher:file-changed', payload);
      },
      onErrorCallback: (payload) => {
        mainWindow.webContents.send('watcher:error', payload);
      }
    });
  });

  ipcMain.handle('watcher:unwatch-project', (event, projectId) => {
    return projectWatcherManager.unwatchProject(projectId);
  });

  ipcMain.handle('watcher:ignore-next-change', (event, { projectId, filePath }) => {
    projectWatcherManager.ignoreNextChange(projectId, filePath);
  });

  ipcMain.handle('watcher:ignore-path-tree', (event, { projectId, directoryPath }) => {
    projectWatcherManager.ignorePathTree(projectId, directoryPath);
  });

  ipcMain.handle('watcher:release-path-tree', (event, { projectId, directoryPath }) => {
    projectWatcherManager.releasePathTree(projectId, directoryPath);
  });

  ipcMain.handle('watcher:is-path-ignored', (event, { projectId, directoryPath }) => {
    return projectWatcherManager.isPathIgnored(projectId, directoryPath);
  });

  ipcMain.handle('watcher:is-watching', (event, projectId) => {
    return projectWatcherManager.isWatching(projectId);
  });
}