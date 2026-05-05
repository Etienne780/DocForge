import { Component } from "@core/Component.js";
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { state } from '@core/State.js';
import { getValidationError } from '@common/Validations.js';  
import { setHTML, isNameValid } from '@common/Common.js'
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { addDocTheme, createDocTheme, openDocThemeEditor, getDocThemes, findDocTheme, getPresetDocThemes, docThemeMatchesSearch } from '@data/DocThemeManager.js';
import { createThemeCard, sortCardList, buildDocThemeCardBody, buildDocThemeCardFooter, applyDocThemeCardColors } from '@common/ThemeCardHelper.js';
import { themeSectionName } from '../helpers/SectionModalHelper.js';

export default class DocThemeCards extends Component {

  onLoad() {
    this._clickTimeout = null;

    const presets = getPresetDocThemes();
    this._presetIds = new Set(
      presets.map(p => p.id)
    );

    this._buildCreateDocThemeModal();
    this._setupElementEvents();

    const refresh = () => {
      this._updateCounter();
      this._renderDocThemeCards();
    };

    refresh();
    this.subscribe('session:change:themeSearchQuery', () => refresh());
    this.subscribe('state:change:themeSortAction', () => refresh());
    this.subscribe('state:change:docThemes', () => refresh());
  }

  onDestroy() { 
    this._themeCreationModal?.remove();
  }

  _setupElementEvents() {
    // ─── New Theme ───────────────────────────────────────────────────────────────
    this.element('newTheme').addEventListener('click', event => {
      this._openThemeCreationModal();
    });

    // ─── Theme card ───────────────────────────────────────────────────────────────
    this.element('docThemeContainer').addEventListener('click', event => {
      const target = event.target.closest('[data-theme-id]');
      if (!target || !target.dataset)
        return;
      
      const id = target.dataset.themeId;

      // delay single click
      clearTimeout(this._clickTimeout);
      this._clickTimeout = setTimeout(() => {
        eventBus.emit(`themeManager:openModal:${themeSectionName}`, {
          id: id,
          isPreset: this._presetIds.has(id)
        });
      }, 225);
    });

    this.element('docThemeContainer').addEventListener('dblclick', event => {
      const target = event.target.closest('[data-theme-id]');
      if (!target || !target.dataset)
        return;
      
      const id = target.dataset.themeId;

      // cancel single click
      clearTimeout(this._clickTimeout);

      // open directly
      const theme = findDocTheme(id);
      if (!theme) {
        eventBus.emit('toast:show', { message: 'Failed to open theme.', type: 'error' });
        return;
      }

      openDocThemeEditor(theme);
    });
  }

  // ─── Modals ───────────────────────────────────────────────────────────────

  _buildCreateDocThemeModal() {
    const themeInputId = this.elementId('theme-creation-input');
    this._themeCreationModal = buildStandardModal(this.elementId('theme-creation-modal'), {
      title: 'Create theme',
      bodyHTML: 
      `<div class="form-group">
        <label class="form-label" for="${themeInputId}">Name</label>
        <input type="text" class="form-input" id="${themeInputId}" autocomplete="off" placeholder="Theme name...">
        <span class="body-label text-error" data-error-msg>${getValidationError('THEME', 'NAME_MIN_LENGTH')}</span>
      </div>`,
      primaryLabel: 'Create',
      secondaryLabel: 'Cancel',
      onPrimary: () => {
        const value = document.getElementById(themeInputId).value.trim();
        if(!isNameValid(value, 'THEME'))
          return;
        
        addDocTheme(createDocTheme(value));
        closeModal(this._themeCreationModal);
        this._renderDocThemeCards();
        
        eventBus.emit('save:request:docThemes');
        eventBus.emit('toast:show', { message: `Doc theme '${value}' created.`, type: 'success' });
      }
    });

    const input = this.globalElement('theme-creation-input', this._themeCreationModal);
    input.addEventListener('input', () => {
      const value = input.value.trim();
      const errorElement = this.query('[data-error-msg]', this._themeCreationModal);
      
      if(isNameValid(value, 'THEME')) {
        errorElement.classList.add('invisible');
      } else {
        errorElement.classList.remove('invisible');
      }
    });

    addModalEnterAction(this._themeCreationModal, { targetId: themeInputId });
  }

  _openThemeCreationModal() {
    const input = this.globalElement('theme-creation-input', this._themeCreationModal);
    if (input) {
      input.value = 'New theme';
      input.focus();
      input.select();
    }
    
    const errorElement = this.query('[data-error-msg]', this._themeCreationModal);
    if(errorElement) {
      errorElement.classList.add('invisible');
    }

    openModal(this._themeCreationModal);
  }

  _updateCounter() {
    const searchQuery = session.get('themeSearchQuery');
    const counter = this.element('cardCounter');
    if(!counter)
      return;
    
    const presets = getPresetDocThemes();
    const themes = getDocThemes();
    let count = themes.length + presets.length;
    if(searchQuery && searchQuery !== '') {
      count = 0;
      presets.forEach(theme => { 
        if(docThemeMatchesSearch(theme, searchQuery.toLowerCase()))
          count++;
      });

      themes.forEach(theme => { 
        if(docThemeMatchesSearch(theme, searchQuery.toLowerCase()))
          count++;
      });
    }

    counter.innerText = count ? count : '0';
  }

  _renderDocThemeCards() {
    const searchQuery = session.get('themeSearchQuery');
    const cardSortAction = state.get('themeSortAction');
    const presets = getPresetDocThemes();
    const themes = getDocThemes();
    const parent = this.element('docThemeContainer');
    if (!parent) 
      return;

    const list = [...themes, ...presets];

    const sorted = sortCardList(list, cardSortAction);
    let html = '';
    sorted.forEach(theme => {
      if(searchQuery && searchQuery !== '') {
        if(!docThemeMatchesSearch(theme, searchQuery.toLowerCase()))
          return;
      }

      html += createThemeCard({
        dataSet: 'theme-id',
        data: theme.id,
        bodyHTML: buildDocThemeCardBody(theme),
        footerHTML: buildDocThemeCardFooter(theme),
      });
    });

    setHTML(parent, html);
    applyDocThemeCardColors(parent);
  }

}