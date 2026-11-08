import { initWindowControls } from '@ui/WindowControls.js';
import { 
  isPlatformMatch, 
  isPlatformWeb, 
  isPlatformMacOS, 
  isDevelopment, 
  openFolder, 
  getUserDataPath 
} from '@core/Platform.js';
import { Component } from '@core/Component.js';
import { session } from '@core/SessionState.js';
import { state } from '@core/State.js';
import { eventBus } from '@core/EventBus.js';
import { shortcutManager } from '@core/ShortcutManager.js';
import { getAppLogo } from '@core/AppMeta.js';
import { closeModals } from '@core/ModalBuilder.js';
import { revealOpenProject, getOpenProject } from '@data/ProjectManager.js';
import { undoProjectChange, redoProjectChange, canUndo, canRedo, getUndoLabel, getRedoLabel } from '@data/ProjectHistory.js';
import { openPreferences, PREFERENCE_SECTIONS } from '@common/PreferencesNav.js';
import { setHTML } from '@common/Common.js'
import { openMenu, closeMenu, isMenuOpenFor } from '@common/MenuManager.js';

/** Delay after the last dark mode toggle click before the theme is applied and saved. */
const DARK_MODE_APPLY_DELAY_MS = 300;


// ─── File Dropdown ──────────────────────────────────────────────────────────────
export const FILE_DROP_DOWN_ITEMS = [
  {
    name: 'Create project',
    description: 'Creates a new project',
    platform: 'any',
    views: ['projectHub'],
    shortcut: 'CreateNewProject',
    shortcutContext: 'projectHub',
  },
  { divider: true },
  {
    name: 'Save Project',
    description: 'Save project',
    platform: 'any',
    views: ['docEditor', 'appearanceManager', 'themeEditor', 'languageEditor'],
    shortcut: 'SaveOpenProject',
    shortcutContext: 'docEditor',
  },
  {
    name: 'Save recent projects',
    description: 'Save recent projects',
    platform: 'any',
    views: ['projectHub'],
    shortcut: 'SaveRecentProjects',
    shortcutContext: 'projectHub',
  },
  {
    name: 'Save All',
    description: 'Save everything',
    platform: 'any',
    shortcut: 'Save',
    shortcutContext: 'global',
  },
  {
    name: 'Save as Template',
    description: 'Save the project as a template',
    platform: 'any',
    views: ['docEditor'],
    action: (view) => { eventBus.emit('show:modal:createTemplate', { project: getOpenProject() }); },
  },
  { divider: true },
  {
    name: 'Export',
    description: 'Exports project',
    platform: 'any',
    views: ['docEditor'],
    shortcut: 'ExportProject',
    shortcutContext: 'docEditor',
  },
  {
    name: 'Preview Export',
    description: 'Preview the exported HTML',
    platform: 'any',
    views: ['docEditor'],
    shortcut: 'PreviewExport',
    shortcutContext: 'docEditor',
  },
  { divider: true },
  {
    name: 'Project Settings',
    description: 'Settings of the open project',
    platform: 'any',
    views: ['docEditor'],
    action: (view) => { eventBus.emit('show:modal:projectSettings', { project: getOpenProject() }); },
  },
  {
    name: 'Reveal in File Explorer',
    description: 'Reveal in File Explorer',
    platform: '!web',
    views: ['docEditor', 'appearanceManager'],
    action: (view) => { revealOpenProject() },
  },
  { divider: true },
  // submenu with one entry per section, a click on "Preferences" itself opens all (MENU_GROUPS)
  ...PREFERENCE_SECTIONS.map(section => ({
    name: () => section.label,
    description: () => section.menuDescription,
    group: 'Preferences',
    platform: 'any',
    action: () => { openPreferences(section.id); },
  })),
  {
    name: 'Backups',
    description: 'Opens the backup manager',
    platform: 'any',
    action: (view) => { eventBus.emit('show:modal:backupManager', { view }); },
  },
];

/** Submenus (`group` of the items) that do something on click themselves. */
const MENU_GROUPS = {
  Preferences: {
    description: 'Opens the preferences',
    shortcut: 'OpenPreferences',
    shortcutContext: 'global',
    action: () => { openPreferences(); },
  },
};

// ─── Edit Dropdown ──────────────────────────────────────────────────────────────
// Undo / redo of project changes (@data/ProjectHistory.js). The text in the doc editor input
// has its own history per entry (Ctrl+Z while typing), the menu always works on the project.
export const EDIT_DROP_DOWN_ITEMS = [
  {
    name: () => { const label = getUndoLabel(); return label ? `Undo ${label}` : 'Undo'; },
    description: 'Undo the last project change',
    platform: 'any',
    shortcut: 'Edit:undo',
    shortcutContext: 'global',
    disabled: () => !canUndo(),
    action: () => { undoProjectChange(); },
  },
  {
    name: () => { const label = getRedoLabel(); return label ? `Redo ${label}` : 'Redo'; },
    description: 'Redo the last undone change',
    platform: 'any',
    shortcut: 'Edit:redo',
    shortcutContext: 'global',
    disabled: () => !canRedo(),
    action: () => { redoProjectChange(); },
  },
];

export const HELP_DROP_DOWN_ITEMS = [
  {
    name: 'Overview',
    description: 'Show application structur',
    platform: 'any',
    action: (view) => { eventBus.emit('show:modal:overview', { view }); },
  },
  {
    name: 'Changelog',
    description: 'Show the changelog of all versions',
    platform: 'any',
    action: (view) => { eventBus.emit('show:modal:changelog', { view }); },
  },
  {
    name: 'Info',
    description: 'Show application info',
    platform: 'any',
    action: (view) => { eventBus.emit('show:modal:info', { view }); },
  },
  { divider: true },
  {
    name: 'Toggle Developer Tools',
    description: 'Toggle developer tools',
    platform: '!web',
    shortcut: 'toggleDeveloperTools',
    shortcutContext: 'global',
  },
  {
    name: 'Update',
    description: 'Show application update modal',
    group: 'Dev',
    platform: 'any',
    developmentOnly: true,
    action: (view) => { eventBus.emit('show:modal:update', { view }); },
  },
  {
    name: 'Open AppData',
    description: 'Opens the user date folder',
    group: 'Dev',
    platform: '!web',
    developmentOnly: true,
    action: async (view) => { openFolder(await getUserDataPath()); },
  },
  {
    name: 'Reset first init',
    description: 'Resets to first launch',
    group: 'Dev',
    platform: 'any',
    developmentOnly: true,
    action: (view) => { state.set('isFirstLaunch', true); },
  },
];

/**
 * Titlebar - application header component.
 *
 * Responsibilities:
 *   - Tab navigation (Explanation / Examples / Reference)
 *   - Global search input
 *   - Dark/light mode toggle
 *   - Theme customization modal
 *   - Save button
 *   - Autosave status indicator
 */
export default class Titlebar extends Component {

  onLoad() {
    this._initWindow();

    this.element('logo').innerHTML = getAppLogo();

    this._updateModeIcon();
    this._setupElementEvents();

    // dark mode changed elsewhere (preferences)
    this.subscribe('state:change:isDarkMode', ({ value }) => {
      if (this._pendingDarkMode == null)
        this._updateModeIcon(value);
    });
    this.subscribe('session:change:activeView', () => {
      closeMenu();
      this._updateQuickOpen();
    });
    this._updateQuickOpen();
    this.subscribe('save:complete', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:recentProjects', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:openProject', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:projectPresets', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:themePresets', () => this._flashAutosaveIndicator());
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  _initWindow() {
    if (isPlatformWeb())
      return;

    // like a native titlebar: no window buttons / traffic light gap in fullscreen
    const setFullScreen = isFullScreen => this.element('header').classList.toggle('fullscreen', isFullScreen);
    this.subscribe('window:fullscreen-changed', setFullScreen);
    window.electronAPI?.isFullScreen().then(setFullScreen);

    if (isPlatformMacOS()) {
      this.element('header').classList.add('mac');
      return;
    }

    const win = document.querySelector('.window-controls');
    if(!win) {
      console.warn('Failed to add window controll elements. Window controll not found!');
      return;
    }
    
    setHTML(win, 
    `<div class="horizontal-separator"></div>

    <button data-win-min>—</button>
    <button data-win-max><span class="window-controls__maximize">□</span></button>
    <button class="danger" data-win-close>✕</button>`);

    initWindowControls();
  }

  /** The quick open field is only shown in the doc editor. */
  _updateQuickOpen() {
    this.element('quick-open').classList.toggle('hidden', session.get('activeView') !== 'docEditor');
  }

  _setupElementEvents() {
    // ── quick open (Navigate:quickOpen) ────────────────────────────────────
    this.element('quick-open').addEventListener('click', () => eventBus.emit('editor:quick-open'));

    // ── brand button  ──────────────────────────────────────────────────────
    this.element('brand-button').addEventListener('click', () => {
      closeModals();
      eventBus.emit('navigate:projectHub');
    })

    // ── menu buttons ──────────────────────────────────────────────────────
    const menus = {
      file: FILE_DROP_DOWN_ITEMS,
      edit: EDIT_DROP_DOWN_ITEMS,
      help: HELP_DROP_DOWN_ITEMS,
    };
    const openTitlebarMenu = button =>
      openMenu(this._buildMenuItems(session.get('activeView'), menus[button.dataset.menu]), { anchor: button }, { trigger: button });

    this.container.querySelectorAll('[data-menu]').forEach(button => {
      button.addEventListener('click', () => {
        closeModals();
        if (isMenuOpenFor(button))
          closeMenu();
        else
          openTitlebarMenu(button);
      });

      // switch between the menus on hover while one of them is open
      button.addEventListener('mouseenter', () => {
        const openButton = this.container.querySelector('[data-menu].open');
        if (openButton && openButton !== button)
          openTitlebarMenu(button);
      });
    });

    // ── Dark mode toggle ──────────────────────────────────────────────────────
    // icon flips per click; theme + save are debounced so spamming doesn't flash
    this.element('dark-mode-button').addEventListener('click', () => {
      this._pendingDarkMode = !(this._pendingDarkMode ?? state.get('isDarkMode'));
      this._updateModeIcon(this._pendingDarkMode);

      clearTimeout(this._darkModeTimer);
      this._darkModeTimer = setTimeout(() => this._applyPendingDarkMode(), DARK_MODE_APPLY_DELAY_MS);
    });
  }

  _applyPendingDarkMode() {
    const isDark = this._pendingDarkMode;
    this._pendingDarkMode = null;
    this._darkModeTimer = null;

    if (isDark === state.get('isDarkMode'))
      return;

    state.set('isDarkMode', isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }

  /** Menu items for the shared menu host (see @common/MenuManager.js), built on open. */
  _buildMenuItems(activeView, items) {
    const shouldSkip = (item) =>
      !isPlatformMatch(item.platform)
      || (item.developmentOnly && !isDevelopment())
      || (item.views?.length && !item.views.includes(activeView));

    // name / description / disabled can be functions (evaluated when the menu opens)
    const resolve = value => typeof value === 'function' ? value() : value;
    const toMenuItem = (i) => ({
      name: i.developmentOnly ? `${resolve(i.name)} (dev)` : resolve(i.name),
      description: resolve(i.description),
      shortcut: i.shortcut,
      shortcutContext: i.shortcutContext,
      disabled: Boolean(resolve(i.disabled)),
      // an own action wins, the shortcut is then only shown
      action: () => {
        if (i.action) {
          i.action(activeView);
        } else if (i.shortcut) {
          shortcutManager.dispatch(i.shortcutContext || 'global', i.shortcut);
        }
      },
    });

    const result = [];
    for (const entry of this._collectGroups(items)) {
      if (entry.divider) {
        // no leading or double dividers when the items around them are hidden
        if (result.length && !result.at(-1).divider)
          result.push({ divider: true });
        continue;
      }

      if (entry.__group) {
        const visibleItems = entry.items.filter(i => !shouldSkip(i));
        if (visibleItems.length === 0) continue;

        result.push({ ...MENU_GROUPS[entry.__group], name: entry.__group, items: visibleItems.map(toMenuItem) });
      } else {
        if (shouldSkip(entry))
          continue;

        result.push(toMenuItem(entry));
      }
    }
    return result;
  }

  /**
 * Flattens items into a render list where grouped items are collected
 * into a single group-slot at the position of their first occurrence.
 * 
 * Input:  [a, b, {group:'x'}, c, {group:'x'}, d]
 * Output: [a, b, {__group:'x', items:[...]}, c_skipped, d]
 */
  _collectGroups(items) {
    const result = [];
    const groupSlots = new Map(); // group name -> slot object

    for (const item of items) {
      if (item.group) {
        if (!groupSlots.has(item.group)) {
          const slot = { __group: item.group, items: [] };
          groupSlots.set(item.group, slot);
          result.push(slot); // placeholder an erster Stelle der Group
        }
        groupSlots.get(item.group).items.push(item);
      } else {
        result.push(item);
      }
    }

    return result;
  };

  _updateModeIcon(isDark = state.get('isDarkMode')) {
    this.element('mode-icon').innerHTML = this._getModeIconSVG(isDark);
  }

  _flashAutosaveIndicator() {
    const indicator = this.element('autosave-indicator');
    indicator.textContent = '● Saved';
    indicator.classList.add('autosave-indicator--active');
    setTimeout(() => {
      indicator.textContent = '●';
      indicator.classList.remove('autosave-indicator--active');
    }, 1500);
  }

  _getModeIconSVG(isDark) {
    if (isDark) {
      return `<path d="M21 12.8A9 9 0 0 1 11.2 3 7 7 0 1 0 21 12.8Z" fill="currentColor"/>`;
    }
    return `
      <circle cx="12" cy="12" r="5" fill="currentColor"/>
      <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="12" y1="1"  x2="12" y2="4"/>
        <line x1="12" y1="20" x2="12" y2="23"/>
        <line x1="1"  y1="12" x2="4"  y2="12"/>
        <line x1="20" y1="12" x2="23" y2="12"/>
      </g>`;
  }
}
