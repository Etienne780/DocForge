import { shortcutManager } from '@core/ShortcutManager.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { toggleDeveloperTools } from '@core/Platform.js';
import { closeModals } from '@common/UIUtils.js';

export function registerKeyboardShortcuts() {
    // ─── global ──────────────────────────────────────────────────────────────
  // Ctrl+shift+S - Save everything
  shortcutManager.register('ctrl+shift+s', () => eventBus.emit('save:request'), {
    context: 'global',
    name: 'Save',
    description: 'Save current state',
  });

  // Escape - Close modal
  shortcutManager.register('escape', () => closeModals(), {
    context: 'global',
    name: 'closemodal',
    description: 'Close any open modal',
  });

  // Toggle Dev tools
  shortcutManager.register('ctrl+shift+i', () => toggleDeveloperTools(), {
    context: 'global',
    name: 'toggleDeveloperTools',
    description: 'Toggle developer tools',
  });

  // ─── projectManager ──────────────────────────────────────────────────────────────
  // Ctrl+S - Save projects
  shortcutManager.register('ctrl+s', () => eventBus.emit('save:request:projects'), {
    context: 'projectManager',
    name: 'SaveProjects',
    description: 'Save projects',
  });

  // ─── docEditor ──────────────────────────────────────────────────────────────
  // Ctrl+S - Save projects
  shortcutManager.register('ctrl+s', () => eventBus.emit('save:request:projects'), {
    context: 'docEditor',
    name: 'SaveProjects',
    description: 'Save projects',
  });

  // ─── themeManager ──────────────────────────────────────────────────────────────
  // Ctrl+S - Save themes
  shortcutManager.register('ctrl+s', () => { 
      eventBus.emit('save:request:docThemes'); 
      eventBus.emit('save:request:languages'); 
    }, {
    context: 'themeManager',
    name: 'SaveThemes',
    description: 'Save themes',
  });

  // ─── themeEditor ──────────────────────────────────────────────────────────────
  // Ctrl+S - Save themes
  shortcutManager.register('ctrl+s', () => {
      const activeEditor = session.get('openThemeEditor');
      if(activeEditor === 'doc')
        eventBus.emit('save:request:docThemes');
      else if(activeEditor === 'languages')
        eventBus.emit('save:request:languages');
    }, {
    context: 'themeEditor',
    name: 'SaveThemes',
    description: 'Save themes',
  });
}