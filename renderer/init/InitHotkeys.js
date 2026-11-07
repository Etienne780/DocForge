import { shortcutManager } from '@core/ShortcutManager.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { closeModals } from '@core/ModalBuilder.js';
import { toggleDeveloperTools } from '@core/Platform.js';
import { getOpenProject } from '@data/ProjectManager.js';

export function registerKeyboardShortcuts() {
    // ─── global ──────────────────────────────────────────────────────────────
  // Ctrl+shift+S - Save everything (app state and the open project)
  shortcutManager.register('ctrl+shift+s', () => {
    eventBus.emit('save:request');
    eventBus.emit('save:request:openProject');
  }, {
    context: 'global',
    name: 'Save',
    description: 'Save everything',
  });

  // Escape - Close modal. An open select picker closes first (on its own)
  shortcutManager.register('escape', () => {
    if (document.querySelector('select:open'))
      return false;
    closeModals();
  }, {
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
    ['ctrl+shift+x', 'check-mark', 'Check mark (add / toggle)'],
    ['ctrl+shift+q', 'blockquote', 'Blockquote'],
    ['ctrl+#', 'comment', 'Toggle comment'],
  ];

  for (const [combo, action, description] of formatShortcuts) {
    shortcutManager.register(combo, () => eventBus.emit('editor:format', { action }), {
      context: 'docEditor',
      name: `Format:${action}`,
      description,
    });
  }

  // Alt+Left / Alt+Right - Back / forward between the opened entries (not while a modal is open)
  const entryHistoryShortcuts = [
    ['alt+arrowleft',  'Navigate:back',    'Back to the previously opened entry', -1],
    ['alt+arrowright', 'Navigate:forward', 'Forward to the next opened entry',     1],
  ];
  for (const [combo, name, description, direction] of entryHistoryShortcuts) {
    shortcutManager.register(combo, () => {
      if (document.querySelector('.modal-overlay--open'))
        return false;
      eventBus.emit('editor:history', { direction });
    }, { context: 'docEditor', name, description });
  }

  // Alt+Up / Alt+Down - Entry above / below in the tree (visible entries),
  // Ctrl+Alt+Up / Down also steps into collapsed entries
  const treeShortcuts = [
    ['alt+arrowup',        'Navigate:treeUp',      'Entry above in the tree',                          -1, false],
    ['alt+arrowdown',      'Navigate:treeDown',    'Entry below in the tree',                           1, false],
    ['ctrl+alt+arrowup',   'Navigate:treeUpAll',   'Entry above in the tree, also in collapsed entries', -1, true],
    ['ctrl+alt+arrowdown', 'Navigate:treeDownAll', 'Entry below in the tree, also in collapsed entries',  1, true],
  ];
  for (const [combo, name, description, direction, all] of treeShortcuts) {
    shortcutManager.register(combo, () => {
      if (document.querySelector('.modal-overlay--open'))
        return false;
      eventBus.emit('editor:tree-step', { direction, all });
    }, { context: 'docEditor', name, description });
  }

  // Ctrl+. - Edit the properties of the table / code block at the cursor
  shortcutManager.register('ctrl+.', () => eventBus.emit('editor:edit-structure'), {
    context: 'docEditor',
    name: 'Edit:structure',
    description: 'Edit the properties of the table or code block at the cursor',
  });

  // Find / replace in the editor (FindWidget). One shortcut per scope, so each can get its own combo.
  const findShortcuts = [
    ['ctrl+f',           'Find:entry',        'Find in this entry',        { scope: 'entry' }],
    ['ctrl+alt+shift+f', 'Find:selection',    'Find in the selection',     { scope: 'selection' }],
    ['ctrl+alt+f',       'Find:tab',          'Find in this tab',          { scope: 'tab' }],
    ['ctrl+shift+f',     'Find:all',          'Find in all tabs',          { scope: 'all' }],
    ['ctrl+h',           'Replace:entry',     'Replace in this entry',     { scope: 'entry', replace: true }],
    ['ctrl+alt+shift+h', 'Replace:selection', 'Replace in the selection',  { scope: 'selection', replace: true }],
    ['ctrl+alt+h',       'Replace:tab',       'Replace in this tab',       { scope: 'tab', replace: true }],
    ['ctrl+shift+h',     'Replace:all',       'Replace in all tabs',       { scope: 'all', replace: true }],
  ];

  for (const [combo, name, description, options] of findShortcuts) {
    shortcutManager.register(combo, () => eventBus.emit('editor:find:open', options), {
      context: 'docEditor',
      name,
      description,
    });
  }

  shortcutManager.register('f3', () => eventBus.emit('editor:find:next', { direction: 1 }), {
    context: 'docEditor',
    name: 'FindNext',
    description: 'Next search match',
  });

  shortcutManager.register('shift+f3', () => eventBus.emit('editor:find:next', { direction: -1 }), {
    context: 'docEditor',
    name: 'FindPrevious',
    description: 'Previous search match',
  });

  // only while the find box is open, otherwise the keys stay free
  const findToggles = [
    ['alt+c', 'matchCase', 'Find:matchCase', 'Search: match case'],
    ['alt+w', 'wholeWord', 'Find:wholeWord', 'Search: match whole word'],
    ['alt+r', 'useRegex', 'Find:regex', 'Search: use regular expression'],
    ['alt+p', 'preserveCase', 'Find:preserveCase', 'Replace: preserve case'],
  ];

  for (const [combo, option, name, description] of findToggles) {
    shortcutManager.register(combo, () => {
      if (!session.get('isEditorSearchOpen'))
        return false;
      eventBus.emit('editor:find:toggle', { option });
    }, {
      context: 'docEditor',
      name,
      description,
    });
  }

  shortcutManager.register('ctrl+alt+enter', () => {
    if (!session.get('isEditorSearchOpen'))
      return false;
    eventBus.emit('editor:find:replace-all');
  }, {
    context: 'docEditor',
    name: 'Find:replaceAll',
    description: 'Replace all search matches (with preview)',
  });

  // ─── appearanceManager ──────────────────────────────────────────────────────────────

  // ─── themeEditor ──────────────────────────────────────────────────────────────

  // ─── langEditor ──────────────────────────────────────────────────────────────

}