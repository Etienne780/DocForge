import { Component } from "@core/Component.js";
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { setHTML, isNameValid } from '@common/Common.js'
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { addSyntaxDefinition, getLanguages, syntaxDefinitionMatchesSearch } from '@data/SyntaxDefinitionManager.js';
import { createThemeCard, sortCardList, buildLanguageCardBody, buildLanguageCardFooter } from '../helpers/ThemeCardHelper.js';
import { langSectionName } from '../helpers/SectionModalHelper.js';

export default class LanguageThemeCards extends Component {

  onLoad() {
    this._buildCreateLanguageModal();
    this._setupElementEvents();

    const refresh = () => {
      this._updateCounter();
      this._renderLanguageThemeCards();
    };

    refresh();
    this.subscribe('session:change:themeSortAction', () => refresh());
    this.subscribe('state:change:languages', () => refresh());
    this.subscribe('session:change:themeSearchQuery', () => refresh());
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
      if(!target || !target.dataset)
        return;
      
      const id = target.dataset.langId;
      eventBus.emit(`themeManager:openModal:${langSectionName}`, { id: id });
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
      </div>`,
      primaryLabel: 'Create',
      secondaryLabel: 'Cancel',
      onPrimary: () => {
        const value = document.getElementById(lanInputId).value.trim();
        if(!isNameValid(value))
          return;

        addSyntaxDefinition(value);
        closeModal(this._langCreationModal);
        this._renderLanguageThemeCards();
        
        eventBus.emit('save:request:languages');
        eventBus.emit('toast:show', { message: `Languages '${value}' created.`, type: 'success' });
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
    openModal(this._langCreationModal);
  }

  _updateCounter() {
    const searchQuery = session.get('themeSearchQuery');
    const counter = this.element('cardCounter');
    if(!counter)
      return;
    
    const languages = getLanguages();
    let count = languages?.length;
    if(searchQuery && searchQuery !== '') {
      count = 0;
      languages.forEach(lang => { 
        if(syntaxDefinitionMatchesSearch(lang, searchQuery.toLowerCase()))
          count++;
      });
    }

    counter.innerText = count ? count: '0';
  }

  _renderLanguageThemeCards() {
    const searchQuery = session.get('themeSearchQuery');
    const cardSortAction = session.get('themeSortAction');
    const langs = getLanguages();
    const parent = this.element('languageThemeContainer');
    if (!langs || !parent) 
      return;
  
    const sorted = sortCardList(langs, cardSortAction);
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