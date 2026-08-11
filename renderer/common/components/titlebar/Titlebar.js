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
import { revealOpenProject } from '@data/ProjectManager.js';
import { setHTML } from '@common/Common.js'
import { selectTab, addDropdownEventListener, createDropDownItem, createDropDownGroup } from '@common/UIUtils.js';
import { escapeHTML } from '@common/Common.js';


// ─── File Dropdown ──────────────────────────────────────────────────────────────
export const FILE_DROP_DOWN_ITEMS = [
  {
    name: 'Save recent projects',
    description: 'Save recent projects',
    platform: 'any',
    views: ['projectHub'],
    shortcut: 'SaveRecentProjects',
    shortcutContext: 'projectHub',
  },
  {
    name: 'Create project',
    description: 'Creates a new project',
    platform: 'any',
    views: ['projectHub'],
    shortcut: 'CreateNewProject',
    shortcutContext: 'projectHub',
  },
  {
    name: 'Save Project',
    description: 'Save project',
    platform: 'any',
    views: ['docEditor'],
    shortcut: 'SaveOpenProject',
    shortcutContext: 'docEditor',
  },
  {
    name: 'Save Themes',
    description: 'Save themes',
    platform: 'any',
    views: ['appearanceManager'],
    shortcut: 'SaveThemes',
    shortcutContext: 'appearanceManager',
  },
  {
    name: 'Save All',
    description: 'Save everything',
    platform: 'any',
    shortcut: 'Save',
    shortcutContext: 'global',
  },
  {
    name: 'Export',
    description: 'Exports project',
    platform: 'any',
    views: ['docEditor'],
    shortcut: 'ExportProject',
    shortcutContext: 'docEditor',
  },
  {
    name: 'Reveal in File Explorer',
    description: 'Reveal in File Explorer',
    platform: '!web',
    views: ['docEditor', 'appearanceManager'],
    action: (view) => { revealOpenProject() },
  },
  {
    name: 'Backups',
    description: 'Opens the backup manager',
    platform: 'any',
    action: (view) => { eventBus.emit('show:modal:backup_manager', { view }); },
  },
];

export const HELP_DROP_DOWN_ITEMS = [
  {
    name: 'Toggle Developer Tools',
    description: 'Toggle developer tools',
    platform: '!web',
    shortcut: 'toggleDeveloperTools',
    shortcutContext: 'global',
  },
  {
    name: 'Info',
    description: 'Show application info',
    platform: 'any',
    action: (view) => { eventBus.emit('show:modal:info', { view }); },
  },
  {
    name: 'Overview',
    description: 'Show application structur',
    platform: 'any',
    action: (view) => { eventBus.emit('show:modal:overview', { view }); },
  },
  {
    name: 'Update',
    description: 'Show application update modal',
    platform: 'any',
    developmentOnly: true,
    action: (view) => { eventBus.emit('show:modal:update', { view }); },
  },
  {
    name: 'Open AppData',
    description: 'Opens the user date folder',
    platform: '!web',
    developmentOnly: true,
    action: async (view) => { openFolder(await getUserDataPath()); },
  },
  {
    name: 'Reset first init',
    group: 'init',
    description: 'Resets to first launch',
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
    this._renderDropDownItems(session.get('activeView'));

    this.subscribe('session:change:activeView', ({ value }) => this._renderDropDownItems(value));
    this.subscribe('save:complete', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:recentProjects', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:openProject', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:projectPresets', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:themePresets', () => this._flashAutosaveIndicator());
  }
  
  onDestroy() {
    this._themeModal?.remove();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  _initWindow() {
    if (isPlatformWeb())
      return;

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

  _setupElementEvents() {
    // ── brand button  ──────────────────────────────────────────────────────
    this.element('brand-button').addEventListener('click', () => {
      closeModals();
      eventBus.emit('navigate:projectHub');
    })

    // ── menu buttons ──────────────────────────────────────────────────────
    const items = this.container.querySelectorAll('.menu-item');
    Array.from(items).forEach(i => {
      i.addEventListener('click', () => { closeModals(); })
    });

    // ── Dark mode toggle ──────────────────────────────────────────────────────
    this.element('dark-mode-button').addEventListener('click', () => {
      const isDark = !state.get('isDarkMode');
      state.set('isDarkMode', isDark);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      this._updateModeIcon();
    });
  }

  _renderDropDownItems(activeView) {
    this._renderDropDown(activeView, this.element('file-dropdown'), FILE_DROP_DOWN_ITEMS);
    this._renderDropDown(activeView, this.element('help-dropdown'), HELP_DROP_DOWN_ITEMS);
  }

   _renderDropDown(activeView, container, items) {
    container.replaceChildren();

    const shouldSkip = (item) =>
      !isPlatformMatch(item.platform)
      || (item.developmentOnly && !isDevelopment())
      || (item.views?.length && !item.views.includes(activeView)); // ← neu: leer/undefined = überall

    const createAndBindItem = (i) => {
      const name = i.developmentOnly ? `${i.name} (dev)` : i.name;
      const element = createDropDownItem(name, {
        description: i.description,
        shortcut: i.shortcut,
        shortcutContext: i.shortcutContext,
      });
      addDropdownEventListener(element, () => {
        if (i.shortcut) {
          shortcutManager.dispatch(i.shortcutContext || this._context, i.shortcut);
        } else {
          i.action?.(activeView); // ← view-Name in die Action gereicht
        }
      });
      return element;
    };

    for (const entry of this._collectGroups(items)) {
      if (entry.__group) {
        const visibleItems = entry.items.filter(i => !shouldSkip(i));
        if (visibleItems.length === 0) continue;

        const groupEl = createDropDownGroup(entry.__group);
        const submenu = groupEl.querySelector('.dropdown-submenu');
        for (const i of visibleItems) {
          submenu.append(createAndBindItem(i));
        }
        container.append(groupEl);
      } else {
        if (shouldSkip(entry))
          continue;

        container.append(createAndBindItem(entry));
      }
    }
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

  _updateModeIcon() {
    const isDark = state.get('isDarkMode');
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
