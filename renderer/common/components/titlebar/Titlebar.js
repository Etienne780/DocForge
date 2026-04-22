import { initWindowControls } from '@ui/WindowControls.js';
import { isPlatformWeb } from '@core/Platform.js';  
import { Component } from '@core/Component.js';
import { session } from '@core/SessionState.js';
import { state } from '@core/State.js';
import { eventBus } from '@core/EventBus.js';
import { isPlatformMatch, isDevelopment } from '@core/Platform.js';
import { shortcutManager } from '@core/ShortcutManager.js';
import { getAppLogo } from '@core/AppMeta.js';
import { setHTML } from '@common/Common.js'
import { selectTab, createDropDownItem } from '@common/UIUtils.js';
import { escapeHTML } from '@common/Common.js';

// ─── File Dropdown ──────────────────────────────────────────────────────────────
export const FILE_DROP_DOWN_ITEMS = {
  projects: [
    {
      name: 'Save Projects',
      description: 'Save projects',
      platform: 'any',
      shortcut: 'SaveProjects',
      shortcutContext: 'projectManager',
    }
  ],
  themes: [
    {
      name: 'Save Themes',
      description: 'Save themes',
      platform: 'any',
      shortcut: 'SaveThemes',
      shortcutContext: 'themeManager',
    }
  ],
  both: [
    {
      name: 'Save All',
      description: 'Save everything',
      platform: 'any',
      shortcut: 'Save',
      shortcutContext: 'global',
    }
  ]
};

// ─── Help Dropdown ──────────────────────────────────────────────────────────────
export const HELP_DROP_DOWN_ITEMS = {
  projects: [],
  themes: [],
  both: [
    {
      name: 'Toggle Developer Tools',
      description: 'Toggle developer tools',
      platform: '!web',
      shortcut: 'toggleDeveloperTools',
      shortcutContext: 'global',
    },
    { 
      name: 'About', 
      description: 'Show application info',
      platform: 'any',
      action: () => { eventBus.emit('show:modal:about') },
    },
    { 
      name: 'Update', 
      description: 'Show application update modal',
      platform: 'any',
      developmentOnly: true,
      action: () => { eventBus.emit('show:modal:update') },
    },
  ]
};

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
    this._renderDropDownItems(session.get('activeSection'));

    this.subscribe('session:change:activeView', ({ value, previousValue }) => this._updateTabSelection(value));
    this.subscribe('session:change:activeSection', ({ value, previousValue }) => this._renderDropDownItems(value));
    this.subscribe('save:complete', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:projects', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:project', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:docThemes', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:docTheme', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:languages', () => this._flashAutosaveIndicator());
    this.subscribe('save:complete:language', () => this._flashAutosaveIndicator());
  }
  
  onDestroy() {
    this._themeModal?.remove();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  _initWindow() {
    if(isPlatformWeb())
      return;

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
      const section = session.get('activeSection');
      if(section === 'theme') {
        eventBus.emit('navigate:themeManager');
      }
      else {
        eventBus.emit('navigate:projectManager');
      }
      eventBus.emit('save:request');
    })

    // ── Tab elements ──────────────────────────────────────────────────────
    this.element('tab-element_projects').addEventListener('click', () => {
      eventBus.emit('navigate:projectManager');
      eventBus.emit('save:request');
    });

    this.element('tab-element_themes').addEventListener('click', () => {
      eventBus.emit('navigate:themeManager');
      eventBus.emit('save:request');
    });

    // ── Dark mode toggle ──────────────────────────────────────────────────────
    this.element('dark-mode-button').addEventListener('click', () => {
      const isDark = !state.get('isDarkMode');
      state.set('isDarkMode', isDark);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      this._updateModeIcon();
    });
  }

  _renderDropDownItems(activeSection) {
    const renderDropDown = (container, items) => {
      let html = '';
      let curr = (activeSection === 'project') ? items.projects
               : (activeSection === 'theme')   ? items.themes
               : [];

      curr = curr.concat(items.both);

      const isValidItem = (item) => {
        return !item.platform || 
          !isPlatformMatch(item.platform) || 
          (item.developmentOnly && !isDevelopment());
      };

      const getItemName = (item) => {
        const name = (item.developmentOnly) ? 
          item.name + ' (dev)' : 
          item.name;
        return escapeHTML(name);
      };

      curr.forEach(i => {
        if (isValidItem(i))
          return;

        const name = getItemName(i);
        // Create the HTML for the dropdown item
        const itemHtml = createDropDownItem(name, {
          description: i.description,
          shortcut: i.shortcut,
          shortcutContext: i.shortcutContext
        });

        html += itemHtml;
      });

      container.innerHTML = html;

      curr.forEach(i => {
        if (isValidItem(i))
          return;

        const name = getItemName(i);
        const element = container.querySelector(`[data-item-name="${name}"]`);
        if (!element)
          return;

        if (i.shortcut) {
          // Automatically dispatch registered shortcut action on click
          element.addEventListener('click', () => {
            shortcutManager.dispatch(i.shortcutContext || this._context, i.shortcut);
          });
        } else if (i.action) {
          // If no shortcut, use the provided manual action
          element.addEventListener('click', i.action);
        }
      });
    };

    renderDropDown(this.element('file-dropdown'), FILE_DROP_DOWN_ITEMS);
    renderDropDown(this.element('help-dropdown'), HELP_DROP_DOWN_ITEMS);
  }

  _updateTabSelection(viewName) {
    const childElement = this.element('tab-element_projects');
    const lowerName = viewName.toLowerCase();
    const isProject = lowerName.indexOf('project') !== -1 || lowerName.indexOf('doc') !== -1;

    if(isProject) {
      selectTab({
        element: childElement,
        tabAction: 'projects',
        isParent: false,
      });
      session.set('activeSection', 'project');
    } else {
      selectTab({
        element: childElement,
        tabAction: 'themes',
        isParent: false,
      });
      session.set('activeSection', 'theme');
    }
  }

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
