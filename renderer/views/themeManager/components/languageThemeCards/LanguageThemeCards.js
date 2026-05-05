import { Component } from "@core/Component.js";
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { state } from '@core/State.js';
import { getValidationError } from '@common/Validations.js';  
import { setHTML, isNameValid } from '@common/Common.js'
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { addSyntaxDefinition, createSyntaxDefinition, openSyntaxDefinitionEditor, findSyntaxDefinition, getLanguages, getPresetLanguages, syntaxDefinitionMatchesSearch } from '@data/SyntaxDefinitionManager.js';
import { createThemeCard, sortCardList, buildLanguageCardBody, buildLanguageCardFooter } from '@common/ThemeCardHelper.js';
import { langSectionName } from '../helpers/SectionModalHelper.js';

export default class LanguageThemeCards extends Component {

  onLoad() {
    this._clickTimeout = null;

    const presets = getPresetLanguages();
    this._presetIds = new Set(
      presets.map(p => p.id)
    );

    this._buildCreateLanguageModal();
    this._setupElementEvents();

    const refresh = () => {
      this._updateCounter();
      this._renderLanguageThemeCards();
    };

    refresh();
    this.subscribe('session:change:themeSearchQuery', () => refresh());
    this.subscribe('state:change:languages', () => refresh());
    this.subscribe('state:change:themeSortAction', () => refresh());
  }

  onDestroy() { 
    this._langCreationModal?.remove();
  }

  _setupElementEvents() {
    // ─── New Language ───────────────────────────────────────────────────────────────
    this.element('newLanguage').addEventListener('click', event => {
      this._openLanguageCreationModal();
    });

    // ─── Language card ───────────────────────────────────────────────────────────────
    this.element('languageThemeContainer').addEventListener('click', event => {
      const target = event.target.closest('[data-lang-id]');
      if (!target || !target.dataset)
        return;
      
      const id = target.dataset.langId;
    
      // delay single click
      clearTimeout(this._clickTimeout);
      this._clickTimeout = setTimeout(() => {
        eventBus.emit(`themeManager:openModal:${langSectionName}`, { 
          id: id, 
          isPreset: this._presetIds.has(id) 
        });
      }, 225);
    });
    
    this.element('languageThemeContainer').addEventListener('dblclick', event => {
      const target = event.target.closest('[data-lang-id]');
      if (!target || !target.dataset)
        return;
      
      const id = target.dataset.langId;
    
      // cancel single click
      clearTimeout(this._clickTimeout);
    
      // open directly
      const lang = findSyntaxDefinition(id);
      if (!lang) {
        eventBus.emit('toast:show', { message: 'Failed to open language.', type: 'error' });
        return;
      }
    
      openSyntaxDefinitionEditor(lang);
    });
    
  }

  _buildCreateLanguageModal() {
    const lanInputId = this.elementId('lan-creation-input');
    this._langCreationModal = buildStandardModal(this.elementId('language-creation-modal'), {
      title: 'Create language',
      bodyHTML: 
      `<div class="form-group">
        <label class="form-label" for="${lanInputId}">Name</label>
        <input type="text" class="form-input" id="${lanInputId}" autocomplete="off" placeholder="Language name...">
        <span class="body-label text-error" data-error-msg>${getValidationError('LANGUAGE', 'NAME_MIN_LENGTH')}</span>
      </div>`,
      primaryLabel: 'Create',
      secondaryLabel: 'Cancel',
      onPrimary: () => {
        const value = document.getElementById(lanInputId).value.trim();
        if(!isNameValid(value, 'LANGUAGE'))
          return;

        addSyntaxDefinition(createSyntaxDefinition(value));
        closeModal(this._langCreationModal);
        this._renderLanguageThemeCards();
        
        eventBus.emit('save:request:languages');
        eventBus.emit('toast:show', { message: `Languages '${value}' created.`, type: 'success' });
      }
    });

    const input = this.globalElement('lan-creation-input', this._langCreationModal);
    input.addEventListener('input', () => {
      const value = input.value.trim();
      const errorElement = this.query('[data-error-msg]', this._langCreationModal);
      
      if(isNameValid(value, 'LANGUAGE')) {
        errorElement.classList.add('invisible');
      } else {
        errorElement.classList.remove('invisible');
      }
    });

    addModalEnterAction(this._langCreationModal, { targetId: lanInputId });
  }

  _openLanguageCreationModal() {
    const input = this.globalElement('lan-creation-input', this._langCreationModal);
    if (input) {
      input.value = 'New language';
      input.focus();
      input.select();
    }

    const errorElement = this.query('[data-error-msg]', this._langCreationModal);
    if(errorElement) {
      errorElement.classList.add('invisible');
    }

    openModal(this._langCreationModal);
  }

  _updateCounter() {
    const searchQuery = session.get('themeSearchQuery');
    const counter = this.element('cardCounter');
    if(!counter)
      return;
    
    const presets = getPresetLanguages();
    const languages = getLanguages();
    let count = languages.length + presets.length;
    if(searchQuery && searchQuery !== '') {
      count = 0;
      presets?.forEach(lang => { 
        if(syntaxDefinitionMatchesSearch(lang, searchQuery.toLowerCase()))
          count++;
      });

      languages.forEach(lang => { 
        if(syntaxDefinitionMatchesSearch(lang, searchQuery.toLowerCase()))
          count++;
      });
    }

    counter.innerText = count ? count: '0';
  }

  _renderLanguageThemeCards() {
    const searchQuery = session.get('themeSearchQuery');
    const cardSortAction = state.get('themeSortAction');
    const presets = getPresetLanguages();
    const langs = getLanguages();
    const parent = this.element('languageThemeContainer');
    if (!parent) 
      return;

    const list = [...langs, ...presets];
  
    const sorted = sortCardList(list, cardSortAction);
    let html = '';
    sorted.forEach(lang => {
      if(searchQuery  && searchQuery !== '') {
        if(!syntaxDefinitionMatchesSearch(lang, searchQuery.toLowerCase()))
          return;
      }

      html += createThemeCard({
        dataSet: 'lang-id',
        data: lang.id,
        bodyHTML:   buildLanguageCardBody(lang),
        footerHTML: buildLanguageCardFooter(lang, searchQuery),
      });
    });
  
    setHTML(parent, html);
  }

}