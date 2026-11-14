// renderer/views/projectHub/components/templateGallery/TemplateGallery.js
import { Component } from '@core/Component.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { openModal, closeModal } from '@core/ModalBuilder.js';
import {
  getAllProjectPresets,
  projectPresetMatchesSearch,
  renameProjectPreset,
  removeProjectPreset,
} from '@data/ProjectManager.js';
import { escapeHTML } from '@common/Common.js';
import { buildRenameModal, buildConfirmationDeleteModal } from '@common/BaseModals.js';
import { createActionMenu } from '@common/UIUtils.js';
import { addContextMenu } from '@common/MenuManager.js';
import { t } from '@core/i18n/I18n.js';

export default class TemplateGallery extends Component {

  async onLoad() {
    this._buildModals();
    this._renderPresets();

    const refresh = () => {
      this._renderPresets();
    };

    this.subscribe('state:change:projectPresets', refresh);
    this.subscribe('session:change:projectHubSearchQuery', refresh);
  }

  onDestroy() {
    this._renameModal?.remove();
    this._deleteModal?.remove();
  }

  _buildModals() {
    this._renameModal = buildRenameModal(this.elementId('rename-modal'), {
      inputId: this.elementId('rename-input'),
      title: t('hub.templates.renameTitle'),
      placeholder: t('hub.templates.namePlaceholder'),
      onPrimary: () => {
        const value = this._renameModal.querySelector('[data-role="rename-input"]').value.trim();
        if (!value)
          return;

        closeModal(this._renameModal);
        renameProjectPreset(this._activePresetId, value);
      },
    });

    this._deleteModal = buildConfirmationDeleteModal(this.elementId('delete-modal'), {
      title: t('hub.templates.deleteTitle'),
      onConfirm: () => {
        closeModal(this._deleteModal);
        removeProjectPreset(this._activePresetId);
        eventBus.emit('toast:show', { message: t('hub.templates.deleted'), type: 'success' });
      },
    });
  }

  _renderPresets() {
    const container = this.element('gallery-container');

    const presets = getAllProjectPresets();
    if (!presets || presets.length === 0) {
      container.innerHTML = `<div class="template-gallery__empty">${escapeHTML(t('hub.templates.empty'))}</div>`;
      return;
    }

    const searchQuery = session.get('projectHubSearchQuery');
    // built-in presets keep their order from PROJECT_PRESETS (names are translated, so sorting them would change it per language)
    const sorted = [...presets].sort((a, b) => {
      if (a.builtIn && b.builtIn)
        return presets.indexOf(a) - presets.indexOf(b);
      if (a.builtIn !== b.builtIn)
        return a.builtIn ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    let cardsHTML = '';
    sorted.forEach(preset => {
      if(searchQuery) {
        if(!projectPresetMatchesSearch(preset, searchQuery.toLowerCase()))
          return;
      }

      cardsHTML += this._createPresetCardHTML(preset);
    });

    container.innerHTML = cardsHTML;
    this._bindCardEvents(container, sorted);
  }

  _createPresetCardHTML(preset) {
    const safeName = escapeHTML(preset.name);
    const safeDesc = escapeHTML(preset.description || '');

    const badgeHTML = preset.builtIn
      ? `<span class="form-tag">${escapeHTML(t('hub.templates.builtIn'))}</span>`
      : '<div class="template-card__actions"></div>';

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

  _bindCardEvents(container, presets) {
    const cards = container.querySelectorAll('.template-card');
    cards.forEach(card => {
      const presetId = card.dataset.presetId;
      const preset = presets.find(p => p.id === presetId);

      const actionsContainer = card.querySelector('.template-card__actions');
      if (actionsContainer) {
        const actions = [
          { name: t('hub.templates.rename'), action: () => this._openRenameModal(preset) },
          { name: t('hub.templates.delete'), danger: true, action: () => this._openDeleteModal(preset) },
        ];
        actionsContainer.append(createActionMenu(actions));
        addContextMenu(card, actions, 'dropdown--compact');
      }

      card.addEventListener('click', (event) => {
        if (event.target.closest('.menu-item'))
          return;

        if (preset) {
          eventBus.emit('show:modal:createProject', { preset });
        } else {
          console.warn(`[TemplateGallery] Preset with ID "${presetId}" not found`);
        }
      });
    });
  }

  _openRenameModal(preset) {
    if (!preset)
      return;

    this._activePresetId = preset.id;
    const input = this._renameModal.querySelector('[data-role="rename-input"]');
    input.value = preset.name;
    openModal(this._renameModal);
    setTimeout(() => { input.focus(); input.select(); }, 80);
  }

  _openDeleteModal(preset) {
    if (!preset)
      return;

    this._activePresetId = preset.id;
    const messageEl = this._deleteModal.querySelector('.modal__confirm-message');
    if (messageEl)
      messageEl.textContent = t('hub.templates.deleteMessage', { name: preset.name });
    openModal(this._deleteModal);
  }
}
