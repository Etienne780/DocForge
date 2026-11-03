import { bootstrap } from './init/Bootstrap';
import { registerElectronListeners } from '@core/ElectronBridge.js';
import { eventBus } from '@core/EventBus.js';
import { updateManager } from '@core/UpdateManager';

document.addEventListener('DOMContentLoaded', async () => {
  registerElectronListeners();
  await bootstrap();
  updateManager.checkForUpdates();

  eventBus.emit('navigate:appLoader');
});