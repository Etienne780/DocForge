import { eventBus } from '@core/EventBus.js';

/**
 * Registers all incoming events from the Electron main process.
 * Only runs when on the Electron platform.
 */
export function registerElectronListeners() {
  if (!window.electronAPI) 
    return;

  window.electronAPI.onZoomChanged((factor) => {
    eventBus.emit('zoom:changed', factor);
  });
}