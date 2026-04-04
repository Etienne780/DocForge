import { state } from '@core/State.js';
import { eventBus } from '@core/EventBus.js';
import { InitStorage } from '@core/storage/StorageManager.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { viewManager } from '@core/ViewManager.js'
import { applyStoredDocTheme } from '@common/DocThemeHelper.js';
import { registerElectronListeners } from '@core/ElectronBridge.js'

async function bootstrap() {
  await InitStorage();
  viewManager.init(document.getElementById('app'));

  await Promise.all([
    componentLoader.load('Toast', document.getElementById('toast-slot')),
    componentLoader.load('Titlebar', document.getElementById('titlebar'))
  ]);

  document.documentElement.setAttribute(
    'data-theme',
    state.get('isDarkMode') ? 'dark' : 'light',
  );

  eventBus.on('session:change:activeProjectId', () => {
    const previewEl = document.querySelector('.preview-pane');
    if (previewEl) 
      previewEl.removeAttribute('style');
  
    applyStoredDocTheme();
  });

  eventBus.on('zoom:changed', (factor) => {
    eventBus.emit('toast:show', { message: `Zoom: ${Math.round(factor * 100)}%`, type: 'info' });
  });

  document.addEventListener('keydown', event => {
    // Ctrl+S / Cmd+S - save
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      eventBus.emit('save:request');
      return;
    }

    // Escape - close any open modal overlays
    if (event.key === 'Escape') {
      document.querySelectorAll('.modal-overlay--open').forEach(overlay => {
        overlay.classList.remove('modal-overlay--open');
      });
    }
  });

  eventBus.emit('navigate:projectManager');
}

document.addEventListener('DOMContentLoaded', async () => {
  registerElectronListeners();
  bootstrap();
});
