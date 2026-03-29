import { state }            from '../core/State.js';
import { storage }          from '../core/Storage.js';
import { eventBus }         from '../core/EventBus.js';
import { componentLoader }  from '../core/ComponentLoader.js';
import { applyStoredDocTheme } from '../components/editorArea/helpers/DocThemeHelper.js';
import { createDefaultProject } from '../data/ProjectManager.js';

state.load();
document.documentElement.setAttribute(
  'data-theme',
  state.get('isDarkMode') ? 'dark' : 'light',
);

storage.initialize();
async function bootstrap() {
  const topbarSlot      = document.getElementById('topbar-slot');
  const sidebarLeftSlot = document.getElementById('sidebar-left-slot');
  const editorSlot      = document.getElementById('editor-area-slot');
  const sidebarRightSlot= document.getElementById('sidebar-right-slot');
  const toastSlot       = document.getElementById('toast-slot');

  if (!topbarSlot || !sidebarLeftSlot || !editorSlot || !sidebarRightSlot || !toastSlot) {
    console.error('[main] Required slot elements not found in the DOM.');
    return;
  }

  try {
    await Promise.all([
      componentLoader.load('TopBar',       topbarSlot),
      componentLoader.load('SidebarLeft',  sidebarLeftSlot),
      componentLoader.load('EditorArea',   editorSlot),
      componentLoader.load('SidebarRight', sidebarRightSlot),
      componentLoader.load('Toast',        toastSlot),
    ]);
  } catch (error) {
    console.error('[main] Failed to load one or more components:', error);
  }

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
    // Ctrl+S / Cmd+S — save
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      eventBus.emit('save:request');
      return;
    }

    // Escape — close any open modal overlays
    if (event.key === 'Escape') {
      document.querySelectorAll('.modal-overlay--open').forEach(overlay => {
        overlay.classList.remove('modal-overlay--open');
      });
    }
  });
}

bootstrap();