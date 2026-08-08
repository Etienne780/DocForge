import { shortcutManager } from '@core/ShortcutManager.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { closeModals } from '@core/ModalBuilder.js';
import { toggleDeveloperTools } from '@core/Platform.js';

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

  // ─── projectHub ──────────────────────────────────────────────────────────────
  // Ctrl+S - Save projects
  shortcutManager.register('ctrl+s', () => eventBus.emit('save:request:recentProjects'), {
  context: 'projectHub',
    name: 'SaveRecentProjects',
    description: 'Save recent projects',
  });

  // Shift+alt+n - Create project
  shortcutManager.register('shift+alt+n', () => eventBus.emit('show:modal:createProject'), {
    context: 'projectHub',
    name: 'CreateNewProject',
    description: 'Creates a new project',
  });

  // ─── docEditor ──────────────────────────────────────────────────────────────
  // Ctrl+S - Save projects
  shortcutManager.register('ctrl+s', () => {
    eventBus.emit('save:request:openProject')
  }, {
    context: 'docEditor',
    name: 'SaveOpenProject',
    description: 'Save open project',
  });

  // Shift+alt+n - Create project
  shortcutManager.register('shift+alt+n', () => eventBus.emit('show:modal:createProject'), {
    context: 'docEditor',
    name: 'CreateNewProject',
    description: 'Creates a new project',
  });

  // ─── appearanceManager ──────────────────────────────────────────────────────────────
  // Ctrl+S - Save themes
  shortcutManager.register('ctrl+s', () => { 
      eventBus.emit('save:request:docThemes'); 
      eventBus.emit('save:request:languages'); 
    }, {
    context: 'appearanceManager',
    name: 'SaveThemes',
    description: 'Save themes',
  });

  // ─── themeEditor ──────────────────────────────────────────────────────────────
  // Ctrl+S - Save themes
  shortcutManager.register('ctrl+s', () => {
      eventBus.emit('save:request:docThemes');
    }, {
    context: 'themeEditor',
    name: 'SaveTheme',
    description: 'Save theme',
  });

  // ─── langEditor ──────────────────────────────────────────────────────────────
  shortcutManager.register('ctrl+s', () => {
      eventBus.emit('save:request:languages');
    }, {
    context: 'languageEditor',
    name: 'SaveLanguage',
    description: 'Save language',
  });
}