import { shortcutManager } from '@core/ShortcutManager.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { closeModals } from '@core/ModalBuilder.js';
import { toggleDeveloperTools } from '@core/Platform.js';
import { getOpenProject } from '@data/ProjectManager.js';
import { undoProjectChange, redoProjectChange } from '@data/ProjectHistory.js';
import { state } from '@core/State.js';
import { openPreferences } from '@common/PreferencesNav.js';
import { viewManager } from '@core/ViewManager.js';
import { t } from '@core/i18n/I18n.js';

/** Description of a shortcut, read when shown (current UI language): hotkeys.shortcuts.<name> */
const desc = name => () => t(`hotkeys.shortcuts.${name}`);

const TEXT_INPUT_TYPES = ['text', 'search', 'email', 'url', 'number', 'password', 'tel'];

/** A focused field with its own (browser) undo. */
function _isTextFieldFocused() {
  const element = document.activeElement;
  if (!element)
    return false;
  if (element.isContentEditable || element.tagName === 'TEXTAREA')
    return true;
  return element.tagName === 'INPUT' && TEXT_INPUT_TYPES.includes((element.type || 'text').toLowerCase());
}

export function registerKeyboardShortcuts() {
  // user keys from the preferences, applied by register(); changes are saved right away
  shortcutManager.setOverrides(state.get('shortcutOverrides'));
  shortcutManager.onChange(overrides => state.set('shortcutOverrides', overrides));

    // ─── global ──────────────────────────────────────────────────────────────
  // Ctrl+shift+S - Save everything (app state and the open project)
  shortcutManager.register('ctrl+shift+s', () => {
    eventBus.emit('save:request');
    eventBus.emit('save:request:openProject');
  }, {
    context: 'global',
    name: 'Save',
    description: desc('Save'),
  });

  // Escape - Close modal. An open select picker closes first (on its own)
  shortcutManager.register('escape', () => {
    if (document.querySelector('select:open'))
      return false;
    closeModals();
  }, {
    context: 'global',
    name: 'closemodal',
    description: desc('closemodal'),
  });

  // Toggle Dev tools
  shortcutManager.register('ctrl+shift+i', () => toggleDeveloperTools(), {
    context: 'global',
    name: 'toggleDeveloperTools',
    description: desc('toggleDeveloperTools'),
  });

  // Ctrl+, - Preferences
  shortcutManager.register('ctrl+,', () => {
    if (document.querySelector('.modal-overlay--open'))
      return false;
    openPreferences();
  }, {
    context: 'global',
    name: 'OpenPreferences',
    description: desc('OpenPreferences'),
  });

  // Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z - Undo / redo project changes (@data/ProjectHistory.js).
  // Text fields keep their own undo (the doc editor input has a text history per entry and
  // stops these keys itself), and nothing happens behind an open modal.
  const projectHistoryShortcuts = [
    ['ctrl+z',       'Edit:undo',    undoProjectChange],
    ['ctrl+y',       'Edit:redo',    redoProjectChange],
    ['ctrl+shift+z', 'Edit:redoAlt', redoProjectChange],
  ];
  for (const [combo, name, run] of projectHistoryShortcuts) {
    shortcutManager.register(combo, event => {
      if (event && (_isTextFieldFocused() || document.querySelector('.modal-overlay--open')))
        return false;
      run();
    }, { context: 'global', name, description: desc(name) });
  }

  // ─── projectHub ──────────────────────────────────────────────────────────────
  // Ctrl+S - Save projects
  shortcutManager.register('ctrl+s', () => eventBus.emit('save:request:recentProjects'), {
  context: 'projectHub',
    name: 'SaveRecentProjects',
    description: desc('SaveRecentProjects'),
  });

  // Shift+alt+n - Create project
  shortcutManager.register('shift+alt+n', () => eventBus.emit('show:modal:createProject'), {
    context: 'projectHub',
    name: 'CreateNewProject',
    description: desc('CreateNewProject'),
  });

  // ─── docEditor ──────────────────────────────────────────────────────────────
  // Ctrl+S - Save projects
  shortcutManager.register('ctrl+s', () => eventBus.emit('save:request:openProject'), {
    context: ['docEditor', 'appearanceManager', 'themeEditor', 'languageEditor'],
    name: 'SaveOpenProject',
    description: desc('SaveOpenProject'),
  });

  // Shift+alt+n - Create project
  shortcutManager.register('shift+alt+n', () => eventBus.emit('show:modal:createProject'), {
    context: 'docEditor',
    name: 'CreateNewProject',
    description: desc('CreateNewProject'),
  });

  // Ctrl+shift+alt+s - Export project
  shortcutManager.register('ctrl+shift+alt+s', () => eventBus.emit('show:modal:exportProject', { project: getOpenProject() }), {
    context: 'docEditor',
    name: 'ExportProject',
    description: desc('ExportProject'),
  });

  // Ctrl+shift+p - Preview exported HTML
  shortcutManager.register('ctrl+shift+p', () => eventBus.emit('show:modal:exportPreview', { project: getOpenProject() }), {
    context: 'docEditor',
    name: 'PreviewExport',
    description: desc('PreviewExport'),
  });

  // Markdown formatting in the editor input. Names are 'Format:<toolbar action>'
  const formatShortcuts = [
    ['ctrl+b', 'bold'],
    ['ctrl+i', 'italic'],
    ['ctrl+e', 'inline-code'],
    ['ctrl+shift+e', 'code-block'],
    ['ctrl+k', 'link'],
    ['ctrl+1', 'h1'],
    ['ctrl+2', 'h2'],
    ['ctrl+3', 'h3'],
    ['ctrl+shift+u', 'unordered-list'],
    ['ctrl+shift+o', 'ordered-list'],
    ['ctrl+shift+x', 'check-mark'],
    ['ctrl+shift+q', 'blockquote'],
    ['ctrl+#', 'comment'],
  ];

  for (const [combo, action] of formatShortcuts) {
    shortcutManager.register(combo, () => eventBus.emit('editor:format', { action }), {
      context: 'docEditor',
      name: `Format:${action}`,
      description: desc(`Format:${action}`),
    });
  }

  // Word wrap and view mode of the doc editor. No key by default (''): they do nothing until
  // a key is set in the preferences (Hotkeys), the toolbar tooltips show it then.
  const VIEW_MODES = ['split', 'editor', 'preview'];
  const editorViewShortcuts = [
    ['Editor:wordWrapOn',     () => state.set('docEditorWordWrapEnabled', true)],
    ['Editor:wordWrapOff',    () => state.set('docEditorWordWrapEnabled', false)],
    ['Editor:wordWrapToggle', () => state.set('docEditorWordWrapEnabled', !state.get('docEditorWordWrapEnabled'))],
    // split -> editor only -> preview only -> split ...
    ['View:cycle', () => {
      const index = VIEW_MODES.indexOf(state.get('projectEditorMode'));
      state.set('projectEditorMode', VIEW_MODES[(index + 1) % VIEW_MODES.length]);
    }],
    ['View:split',   () => state.set('projectEditorMode', 'split')],
    ['View:editor',  () => state.set('projectEditorMode', 'editor')],
    ['View:preview', () => state.set('projectEditorMode', 'preview')],
  ];
  for (const [name, run] of editorViewShortcuts) {
    shortcutManager.register('', () => {
      if (document.querySelector('.modal-overlay--open'))
        return false;
      run();
    }, { context: 'docEditor', name, description: desc(name) });
  }

  // Alt+Left / Alt+Right - Back / forward between the opened entries (not while a modal is open)
  const entryHistoryShortcuts = [
    ['alt+arrowleft',  'Navigate:back',    -1],
    ['alt+arrowright', 'Navigate:forward',  1],
  ];
  for (const [combo, name, direction] of entryHistoryShortcuts) {
    shortcutManager.register(combo, () => {
      if (document.querySelector('.modal-overlay--open'))
        return false;
      eventBus.emit('editor:history', { direction });
    }, { context: 'docEditor', name, description: desc(name) });
  }

  // Alt+Up / Alt+Down - Entry above / below in the tree (visible entries),
  // Ctrl+Alt+Up / Down also steps into collapsed entries
  const treeShortcuts = [
    ['alt+arrowup',        'Navigate:treeUp',      -1, false],
    ['alt+arrowdown',      'Navigate:treeDown',     1, false],
    ['ctrl+alt+arrowup',   'Navigate:treeUpAll',   -1, true],
    ['ctrl+alt+arrowdown', 'Navigate:treeDownAll',  1, true],
  ];
  for (const [combo, name, direction, all] of treeShortcuts) {
    shortcutManager.register(combo, () => {
      if (document.querySelector('.modal-overlay--open'))
        return false;
      eventBus.emit('editor:tree-step', { direction, all });
    }, { context: 'docEditor', name, description: desc(name) });
  }

  // Ctrl+P - Quick open: search and open any entry
  shortcutManager.register('ctrl+p', () => {
    if (document.querySelector('.modal-overlay--open'))
      return false;
    eventBus.emit('editor:quick-open');
  }, {
    context: 'docEditor',
    name: 'Navigate:quickOpen',
    description: desc('Navigate:quickOpen'),
  });

  // Ctrl+N - New entry as a child of the open entry (top level of the tab without one)
  shortcutManager.register('ctrl+n', () => {
    if (document.querySelector('.modal-overlay--open'))
      return false;
    eventBus.emit('editor:new-entry');
  }, {
    context: 'docEditor',
    name: 'Entry:new',
    description: desc('Entry:new'),
  });

  // Ctrl+. - Edit the properties of the table / code block at the cursor
  shortcutManager.register('ctrl+.', () => eventBus.emit('editor:edit-structure'), {
    context: 'docEditor',
    name: 'Edit:structure',
    description: desc('Edit:structure'),
  });

  // Find / replace in the editor (FindWidget). One shortcut per scope, so each can get its own combo.
  const findShortcuts = [
    ['ctrl+f',           'Find:entry',        { scope: 'entry' }],
    ['ctrl+alt+shift+f', 'Find:selection',    { scope: 'selection' }],
    ['ctrl+alt+f',       'Find:tab',          { scope: 'tab' }],
    ['ctrl+shift+f',     'Find:all',          { scope: 'all' }],
    ['ctrl+h',           'Replace:entry',     { scope: 'entry', replace: true }],
    ['ctrl+alt+shift+h', 'Replace:selection', { scope: 'selection', replace: true }],
    ['ctrl+alt+h',       'Replace:tab',       { scope: 'tab', replace: true }],
    ['ctrl+shift+h',     'Replace:all',       { scope: 'all', replace: true }],
  ];

  for (const [combo, name, options] of findShortcuts) {
    shortcutManager.register(combo, () => eventBus.emit('editor:find:open', options), {
      context: 'docEditor',
      name,
      description: desc(name),
    });
  }

  shortcutManager.register('f3', () => eventBus.emit('editor:find:next', { direction: 1 }), {
    context: 'docEditor',
    name: 'FindNext',
    description: desc('FindNext'),
  });

  shortcutManager.register('shift+f3', () => eventBus.emit('editor:find:next', { direction: -1 }), {
    context: 'docEditor',
    name: 'FindPrevious',
    description: desc('FindPrevious'),
  });

  // only while the find box is open, otherwise the keys stay free
  const findToggles = [
    ['alt+c', 'matchCase', 'Find:matchCase'],
    ['alt+w', 'wholeWord', 'Find:wholeWord'],
    ['alt+r', 'useRegex', 'Find:regex'],
    ['alt+p', 'preserveCase', 'Find:preserveCase'],
  ];

  for (const [combo, option, name] of findToggles) {
    shortcutManager.register(combo, () => {
      if (!session.get('isEditorSearchOpen'))
        return false;
      eventBus.emit('editor:find:toggle', { option });
    }, {
      context: 'docEditor',
      name,
      description: desc(name),
    });
  }

  shortcutManager.register('ctrl+alt+enter', () => {
    if (!session.get('isEditorSearchOpen'))
      return false;
    eventBus.emit('editor:find:replace-all');
  }, {
    context: 'docEditor',
    name: 'Find:replaceAll',
    description: desc('Find:replaceAll'),
  });

  // ─── appearanceManager ──────────────────────────────────────────────────────────────
  // Switch between the doc editor and the appearance manager (also from the theme / language
  // editors). No key by default (''), set in the preferences (Hotkeys) like the view shortcuts.
  const goTo = event => {
    if (document.querySelector('.modal-overlay--open') || !getOpenProject())
      return false;
    if (viewManager.getCurrentRoute()?.event !== event)
      eventBus.emit(event);
  };
  const projectViewShortcuts = [
    ['Navigate:editorAppearanceToggle',
      () => goTo(shortcutManager.getContext() === 'docEditor' ? 'navigate:appearanceManager' : 'navigate:docEditor')],
    ['Navigate:docEditor',  () => goTo('navigate:docEditor')],
    ['Navigate:appearance', () => goTo('navigate:appearanceManager')],
  ];
  for (const [name, run] of projectViewShortcuts) {
    shortcutManager.register('', run, {
      context: ['docEditor', 'appearanceManager', 'themeEditor', 'languageEditor', 'languageStyleEditor'],
      name,
      description: desc(name),
    });
  }

  // ─── themeEditor ──────────────────────────────────────────────────────────────

  // ─── langEditor ──────────────────────────────────────────────────────────────

}