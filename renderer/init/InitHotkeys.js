import { shortcutManager } from '@core/ShortcutManager.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { closeModals } from '@core/ModalBuilder.js';
import { toggleDeveloperTools } from '@core/Platform.js';
import { getOpenProject } from '@data/ProjectManager.js';

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
  shortcutManager.register('ctrl+s', () => eventBus.emit('save:request:openProject'), {
    context: ['docEditor', 'appearanceManager', 'themeEditor', 'languageEditor'],
    name: 'SaveOpenProject',
    description: 'Save open project',
  });

  // Shift+alt+n - Create project
  shortcutManager.register('shift+alt+n', () => eventBus.emit('show:modal:createProject'), {
    context: 'docEditor',
    name: 'CreateNewProject',
    description: 'Creates a new project',
  });

  // Ctrl+shift+alt+s - Export project
  shortcutManager.register('ctrl+shift+alt+s', () => eventBus.emit('show:modal:exportProject', { project: getOpenProject() }), {
    context: 'docEditor',
    name: 'ExportProject',
    description: 'Export project',
  });

  // Ctrl+shift+p - Preview exported HTML
  shortcutManager.register('ctrl+shift+p', () => eventBus.emit('show:modal:exportPreview', { project: getOpenProject() }), {
    context: 'docEditor',
    name: 'PreviewExport',
    description: 'Preview exported HTML',
  });

  // Markdown formatting in the editor input. Names are 'Format:<toolbar action>'
  const formatShortcuts = [
    ['ctrl+b', 'bold', 'Bold'],
    ['ctrl+i', 'italic', 'Italic'],
    ['ctrl+e', 'inline-code', 'Inline code'],
    ['ctrl+shift+e', 'code-block', 'Code block'],
    ['ctrl+k', 'link', 'Insert link'],
    ['ctrl+1', 'h1', 'Heading 1'],
    ['ctrl+2', 'h2', 'Heading 2'],
    ['ctrl+3', 'h3', 'Heading 3'],
    ['ctrl+shift+u', 'unordered-list', 'Unordered list'],
    ['ctrl+shift+o', 'ordered-list', 'Ordered list'],
    ['ctrl+shift+q', 'blockquote', 'Blockquote'],
  ];

  for (const [combo, action, description] of formatShortcuts) {
    shortcutManager.register(combo, () => eventBus.emit('editor:format', { action }), {
      context: 'docEditor',
      name: `Format:${action}`,
      description,
    });
  }

  // ─── appearanceManager ──────────────────────────────────────────────────────────────

  // ─── themeEditor ──────────────────────────────────────────────────────────────

  // ─── langEditor ──────────────────────────────────────────────────────────────

}