import { buildStandardModal, openModal, closeModal } from '../../core/ModalBuilder.js';
import { Component } from '../../core/Component.js';
import { state } from '../../core/State.js';
import { eventBus } from '../../core/EventBus.js';
import { exportCurrentTabAsHTML } from '../Comman/ExportHelper.js';

/**
 * TopBar — application header component.
 *
 * Responsibilities:
 *   - Tab navigation (Explanation / Examples / Reference)
 *   - Global search input
 *   - Dark/light mode toggle
 *   - Theme customization modal
 *   - Save button
 *   - HTML export button
 *   - Autosave status indicator
 */
export default class TopBar extends Component {

  onLoad() {
    this._buildProjectManagerModal();
    
    this._updateModeIcon();
    this._syncActiveTab(state.get('activeTab'));

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
    this.subscribe('state:change:activeTab', ({ value }) => this._syncActiveTab(value));
    this.subscribe('save:complete', () => this._flashAutosaveIndicator());
  }

  onDestroy() {
    this._themeModal?.remove();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  _syncActiveTab(activeTab) {
    this.queryAll('[data-tab]').forEach(button => {
      button.classList.toggle('tab-button--active', button.dataset.tab === activeTab);
    });
  }

  _buildProjectManagerModal() {
    // Project manager modal (list of all projects)
    const pmBodyId = this.elementId('project-manager-body');
    this._projectManagerModal = buildStandardModal(this.elementId('project-manager-modal'), {
      title:         'Manage Projects',
      bodyHTML:      `<div id="${pmBodyId}"></div>`,
      primaryLabel:  'New Project',
      secondaryLabel: 'Close',
      onPrimary: () => {
        closeModal(this._projectManagerModal);
        this._openNewProjectModal();
      },
    });
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
