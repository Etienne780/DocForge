import { registerElectronListeners } from '@core/ElectronBridge.js';
import { bootstrap } from './init/Bootstrap';
import { eventBus } from '@core/EventBus.js';

document.addEventListener('DOMContentLoaded', async () => {
  registerElectronListeners();
  await bootstrap();

  eventBus.emit('navigate:projectManager');
});
