import { state } from '@core/State.js';
import { storage } from '@core/Storage.js';
import { eventBus } from '@core/EventBus.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { viewManager } from '@core/ViewManager.js'
import { applyStoredDocTheme } from '@common/DocThemeHelper.js';
import { createDefaultProject } from '@data/ProjectManager.js';
import { registerElectronListeners } from '@core/ElectronBridge.js'

async function bootstrap() {
  viewManager.init(document.getElementById('app'));

  await componentLoader.load('Toast', document.getElementById('toast-slot'));
  await componentLoader.load('Titlebar', document.getElementById('titlebar'));

  state.load();
  document.documentElement.setAttribute(
    'data-theme',
    state.get('isDarkMode') ? 'dark' : 'light',
  );

  storage.initialize();

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
