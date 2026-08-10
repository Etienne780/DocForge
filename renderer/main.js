import { registerElectronListeners } from '@core/ElectronBridge.js';
import { bootstrap } from './init/Bootstrap';
import { eventBus } from '@core/EventBus.js';
import { updateManager } from '@core/UpdateManager';

document.addEventListener('DOMContentLoaded', async () => {
  registerElectronListeners();
  await bootstrap();
  updateManager.checkForUpdates();

  // process argv files 
  // const pendingFiles = await window.electronAPI.getPendingFiles();
  // pendingFiles.forEach(f => console.log('file:open path: ' + f));

  eventBus.emit('navigate:appLoader');
});