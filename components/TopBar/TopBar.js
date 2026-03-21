import { buildDoneModal, openModal, closeModal } from '../../core/ModalBuilder.js';
import { Component } from '../../core/Component.js';
import { state } from '../../core/State.js';
import { eventBus } from '../../core/EventBus.js';
import {
  getModeIconSVG,
  applyCSSVariable,
  applyPreviewFontSize,
  resetTheme,
  applyStoredTheme,
  exportCurrentTabAsHTML,
} from './helpers/ThemeHelper.js';

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
    this._buildThemeModal();
    this._updateModeIcon();
    this._syncActiveTab(state.get('activeTab'));

    // ── Tab navigation ───────────────────────────────────────────────────────
    this.element('tab-nav').addEventListener('click', event => {
      const button = event.target.closest('[data-tab]');
      if (!button) return;
      const tab = button.dataset.tab;
      state.set('activeTab', tab);
      state.set('activeNodeId', null);
    });

    // ── Search ───────────────────────────────────────────────────────────────
    this.element('search-input').addEventListener('input', event => {
      state.set('searchQuery', event.target.value);
    });

    // ── Dark mode toggle ──────────────────────────────────────────────────────
    this.element('dark-mode-button').addEventListener('click', () => {
      const isDark = !state.get('isDarkMode');
      state.set('isDarkMode', isDark);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      this._updateModeIcon();
    });

    // ── Theme button ──────────────────────────────────────────────────────────
    this.element('theme-button').addEventListener('click', () => {
      this._populateThemeModal(); 
      openModal(this._themeModal)
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

  _updateModeIcon() {
    const isDark = state.get('isDarkMode');
    this.element('mode-icon').innerHTML = getModeIconSVG(isDark);
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

  // ─── Theme Modal ─────────────────────────────────────────────────────────

  _buildThemeModal() {
    const colorFields = [
      { label: 'Background',      property: '--background',          placeholder: '#0c0c12' },
      { label: 'Text',            property: '--text-primary',        placeholder: '#e0dbd0' },
      { label: 'Accent',          property: '--accent-color',        placeholder: '#22d4a8' },
      { label: 'Links',           property: '--link-color',          placeholder: '#78a8ff' },
      { label: 'Code background', property: '--code-background',     placeholder: '#07070f' },
      { label: 'Code text',       property: '--code-text',           placeholder: '#80d89a' },
    ];

    const colorGridHTML = colorFields.map(field => {
      const safeKey = field.property.replace(/--/g, '').replace(/-/g, '_');
      const pickerId = this.elementId(`color-picker-${safeKey}`);
      const textId   = this.elementId(`color-text-${safeKey}`);
      return `
        <div class="form-group">
          <label class="form-label">${field.label}</label>
          <div class="color-input-row">
            <input type="color" class="color-picker" id="${pickerId}" data-property="${field.property}">
            <input type="text" class="form-input" id="${textId}" placeholder="${field.placeholder}" data-property="${field.property}" data-is-text="true">
          </div>
        </div>`;
    }).join('');
    
    const resetButtonId   = this.elementId('theme-reset-button');
    const fontSizeRangeId = this.elementId('font-size-range');
    const fontSizeLabelId = this.elementId('font-size-label');
    
    this._themeModal = buildDoneModal(this.elementId('theme-modal-overlay'), {
      title: 'Customize Theme',
      bodyHTML: `
        <div class="form-section-label">Colors</div>
        <div class="color-grid">${colorGridHTML}</div>
        <div class="form-section-label">Typography</div>
        <div class="form-group">
          <label class="form-label">Preview font size</label>
          <div class="range-row">
            <input type="range" min="12" max="22" value="15" id="${fontSizeRangeId}">
            <span class="range-value" id="${fontSizeLabelId}">15px</span>
          </div>
        </div>
        <div class="form-section-label">Reset</div>
        <button class="button button--secondary" id="${resetButtonId}">Reset to defaults</button>`,
      wide: true,
    });
  
    document.getElementById(resetButtonId)?.addEventListener('click', () => {
      resetTheme();
      this._populateThemeModal();
      eventBus.emit('toast:show', { message: 'Theme reset to defaults.', type: 'success' });
    });
  
    this._themeModal.querySelectorAll('input[data-property]').forEach(input => {
      input.addEventListener('input', event => {
        const property = event.target.dataset.property;
        const value    = event.target.value;
        const isText   = !!event.target.dataset.isText;
        if (!value.match(/^#[0-9a-f]{6}$/i) && isText) return;
        applyCSSVariable(property, value);
        const safeKey  = property.replace(/--/g, '').replace(/-/g, '_');
        const pairedId = isText
          ? this.elementId(`color-picker-${safeKey}`)
          : this.elementId(`color-text-${safeKey}`);
        const paired = document.getElementById(pairedId);
        if (paired) paired.value = value;
      });
    });
  
    document.getElementById(fontSizeRangeId)?.addEventListener('input', event => {
      const size = Number(event.target.value);
      document.getElementById(fontSizeLabelId).textContent = `${size}px`;
      applyPreviewFontSize(size);
    });
  }

  _populateThemeModal() {
    const stored = state.get('theme');
    this._themeModal.querySelectorAll('input[data-property]').forEach(input => {
      const property = input.dataset.property;
      const stored_value = stored[property];
      const computed = getComputedStyle(document.documentElement)
        .getPropertyValue(property)
        .trim();
      const value = (stored[property] || computed).trim();
      if (input.type === 'color') {
        if (value.match(/^#[0-9a-f]{6}$/i)) {
          input.value = value.toLowerCase();
        }
      } else {
        input.value = value;
      }
    });

    const storedFontSize = stored['preview-font-size'] ?? 15;
    const rangeEl = document.getElementById(this.elementId('font-size-range'));
    const labelEl = document.getElementById(this.elementId('font-size-label'));
    if (rangeEl) rangeEl.value = storedFontSize;
    if (labelEl) labelEl.textContent = `${storedFontSize}px`;
  }
}
