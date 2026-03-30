import { initWindowControls } from './ui/windowControls.js';
import { state } from '@core/State.js';
import { storage } from '@core/Storage.js';
import { eventBus } from '@core/EventBus.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { viewManager } from '@core/ViewManager.js'
import { applyStoredDocTheme } from '@common/DocThemeHelper.js';
import { createDefaultProject } from '@data/ProjectManager.js';

state.load();
document.documentElement.setAttribute(
  'data-theme',
  state.get('isDarkMode') ? 'dark' : 'light',
);

storage.initialize();
async function bootstrap() {
  viewManager.init(document.getElementById('app'));

  await componentLoader.load('Toast', document.getElementById('toast-slot'));

  const projects = state.get('projects');
  if (!Array.isArray(projects) || projects.length === 0) {
    const defaultProject = createDefaultProject();
    state.set('projects', [defaultProject]);
    state.set('activeProjectId', defaultProject.id);

    // Select the first node so the editor opens with content immediately
    const firstTab = defaultProject.tabs?.explanation;
    const firstNode = firstTab?.nodes?.[0];
    if (firstNode) {
      state.set('activeNodeId', firstNode.id);
    }

    // Persist the freshly seeded state
    eventBus.emit('save:request');
  }

  eventBus.on('state:change:activeProjectId', () => {
    const previewEl = document.querySelector('.preview-pane');
    if (previewEl) 
      previewEl.removeAttribute('style');
  
    applyStoredDocTheme();
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

  eventBus.emit('navigate:editor');
}

document.addEventListener('DOMContentLoaded', async () => {
  initWindowControls();
  bootstrap();
});

/**
 * Returns platform string (win, linux, macOS, web, unknown)
 */
export function getPlatform() {
  if (window.electronAPI)
    return window.electronAPI.getPlatform();

  return 'web';
}
