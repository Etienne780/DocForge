import { Component } from "@core/Component.js";
import { eventBus } from '@core/EventBus.js';
import { setHTML, isNameValid } from '@common/Common.js'
import { buildStandardModal, openModal, closeModal, isModalOpen } from '@core/ModalBuilder.js';
import { addDocTheme, getDocThemes } from '@data/DocThemeManager.js';
import { createThemeCard, buildDocThemeCardBody, buildDocThemeCardFooter, applyDocThemeCardColors } from '../helpers/ThemeCardHelper.js';

export default class DocThemeCards extends Component {

  onLoad() {
    this._buildCreateDocThemeModal();
    this._setupElementEvents();

    const refresh = () => {
      this._updateCounter();
      this._renderDocThemeCards();
    };

    refresh();
    this.subscribe('state:change:docThemes', () => refresh());
  }

  onDestroy() { 
    this._themeCreationModal?.remove();
  }

  _setupElementEvents() {
    this.element('newTheme').addEventListener('click', event => {
      this._openThemeCreationModal();
    });
  }

  _buildCreateDocThemeModal() {
    const themeInputId = this.elementId('theme-creation-input');
    this._themeCreationModal = buildStandardModal(this.elementId('theme-creation-modal'), {
      title: 'Create theme',
      bodyHTML: 
      `<div class="form-group">
        <label class="form-label" for="${themeInputId}">Name</label>
        <input type="text" class="form-input" id="${themeInputId}" autocomplete="off" placeholder="Theme name...">
      </div>`,
      primaryLabel: 'Create',
      secondaryLabel: 'Cancel',
      onPrimary: () => {
        const value = document.getElementById(themeInputId).value.trim();
        if(!isNameValid(value))
          return;
        
        addDocTheme(value);
        closeModal(this._themeCreationModal);
        this._renderDocThemeCards();
        
        eventBus.emit('save:request:docThemes');
        eventBus.emit('toast:show', { message: `Doc theme '${value}' created.`, type: 'success' });
      }
    });

    document.getElementById(themeInputId)?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && isModalOpen(this._themeCreationModal)) this._themeCreationModal.querySelector('[data-modal-primary]')?.click();
    });
  }

  _openThemeCreationModal() {
    const input = this.element('theme-creation-input');
    if (input) {
      input.value = '';
      input.focus();
      input.select();
    }
    openModal(this._themeCreationModal);
  }

  _updateCounter() {
    const counter = this.element('cardCounter');
    if(!counter)
      return;
    
    const themes = getDocThemes();
    counter.innerText = themes ? themes.length: '0';
  }

  _renderDocThemeCards() {
    const themes = getDocThemes();
    const parent = this.element('docThemeContainer');
    if (!themes || !parent) return;

    let html = '';
    themes.forEach(t => {
      html += createThemeCard({
        dataSet: 'theme-id',
        data: t.id,
        bodyHTML: buildDocThemeCardBody(t),
        footerHTML: buildDocThemeCardFooter(t),
      });
    });

    setHTML(parent, html);
    applyDocThemeCardColors(parent);
  }

}