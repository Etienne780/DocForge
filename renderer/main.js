import { registerElectronListeners } from '@core/ElectronBridge.js';
import { bootstrap } from './init/bootstrap';

document.addEventListener('DOMContentLoaded', async () => {
  registerElectronListeners();
  await bootstrap();
});
