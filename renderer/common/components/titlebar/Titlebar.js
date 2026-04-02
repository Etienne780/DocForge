import { initWindowControls } from '@ui/WindowControls.js';
import { isPlatformWeb } from '@core/Platform.js';  
import { Component } from '@core/Component.js';
import { state } from '@core/State.js';
import { eventBus } from '@core/EventBus.js';
import { setHTML } from '@core/ModalBuilder.js'
import { exportCurrentTabAsHTML } from '@common/ExportHelper.js';

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
    
    this._updateModeIcon();

    this.element('brand-button').addEventListener('click', event => {
      openModal(this._projectManagerModal);
    });

    // ── Dark mode toggle ──────────────────────────────────────────────────────
    this.element('dark-mode-button').addEventListener('click', () => {
      const isDark = !state.get('isDarkMode');
      state.set('isDarkMode', isDark);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      this._updateModeIcon();
    });

    // ── Save button ───────────────────────────────────────────────────────────
    this.element('save-button').addEventListener('click', () => {
      eventBus.emit('save:request');
    });

    // ── Export button ─────────────────────────────────────────────────────────
    this.element('export-button').addEventListener('click', () => {
      const result = exportCurrentTabAsHTML();
      eventBus.emit('toast:show', {
        message: result.message,
        type: result.success ? 'success' : 'error',
      });
    });

    // ── State subscriptions ───────────────────────────────────────────────────
    this.subscribe('save:complete', () => this._flashAutosaveIndicator());
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
      console.warn('Faild to add window controll elements. Window controll not found!');
      return;
    }
    
    setHTML(win, 
    `<div class="horizontal-separator"></div>

    <button data-win-min>—</button>
    <button data-win-max><span class="window-controls__maximize">□</span></button>
    <button data-win-close>✕</button>`);

    initWindowControls();
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
