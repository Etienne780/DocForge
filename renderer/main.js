import { registerElectronListeners } from '@core/ElectronBridge.js';
import { bootstrap } from './init/Bootstrap';
import { eventBus } from '@core/EventBus.js';
import { updateManager } from '@core/UpdateManager';

document.addEventListener('DOMContentLoaded', async () => {
  registerElectronListeners();
  await bootstrap();
  updateManager.checkForUpdates();

  eventBus.emit('navigate:projectManager');

  console.log('new version 0.0.2');
});