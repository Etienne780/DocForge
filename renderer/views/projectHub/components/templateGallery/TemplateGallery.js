// renderer/views/projectHub/components/templateGallery/TemplateGallery.js
import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js';
import { getAllProjectPresets } from '@data/ProjectManager.js';
import { escapeHTML } from '@common/Common.js';

export default class TemplateGallery extends Component {

  async onLoad() {
    this._renderPresets();

    this.subscribe('state:change:projectPresets', () => {
      this._renderPresets();
    });
  }

  onDestroy() {
  }

  _renderPresets() {
    const container = this.element('gallery-container');

    const presets = getAllProjectPresets();
    if (!presets || presets.length === 0) {
      container.innerHTML = `<div class="template-gallery__empty">No templates available.</div>`;
      return;
    }

    const sorted = [...presets].sort((a, b) => {
      if (a.builtIn && !b.builtIn) 
        return -1;
      if (!a.builtIn && b.builtIn) 
        return 1;
      return a.name.localeCompare(b.name);
    });

    let cardsHTML = '';
    sorted.forEach(preset => {
      cardsHTML += this._createPresetCardHTML(preset);
    });

    container.innerHTML = cardsHTML;
    this._bindCardEvents(container);
  }

  _createPresetCardHTML(preset) {
    const safeName = escapeHTML(preset.name);
    const safeDesc = escapeHTML(preset.description || '');

    const badgeHTML = preset.builtIn
      ? `<span class="form-tag">Built-in</span>`
      : '';

    return `
      <div class="template-card" data-preset-id="${preset.id}">
        <div class="template-card__header">
          <span class="template-card__name">${safeName}</span>
          ${badgeHTML}
        </div>
        <span class="template-card__desc">${safeDesc}</span>
      </div>
    `;
  }

  _bindCardEvents(container) {
    const cards = container.querySelectorAll('.template-card');
    cards.forEach(card => {
      card.addEventListener('click', (event) => {
        const presetId = card.dataset.presetId;
        const presets = getAllProjectPresets();
        const preset = presets.find(p => p.id === presetId);

        if (preset) {
          eventBus.emit('show:modal:createProject', { preset });
        } else {
          console.warn(`[TemplateGallery] Preset with ID "${presetId}" not found`);
        }
      });
    });
  }
}