import { Component } from "@core/Component.js";
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { setHTML, isNameValid } from '@common/Common.js'
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { addSyntaxDefinition, getLanguages, syntaxDefinitionMatchesSearch } from '@data/SyntaxDefinitionManager.js';
import { createThemeCard, buildLanguageCardBody, buildLanguageCardFooter } from '../helpers/ThemeCardHelper.js';
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
    this.subscribe('state:change:languages', () => refresh());
    this.subscribe('session:change:themeSearchQuery', () => refresh());
  }

  onDestroy() { 
    this._lanCreationModal?.remove();
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
    this._lanCreationModal = buildStandardModal(this.elementId('language-creation-modal'), {
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
        closeModal(this._lanCreationModal);
        this._renderLanguageThemeCards();
        
        eventBus.emit('save:request:languages');
        eventBus.emit('toast:show', { message: `Languages '${value}' created.`, type: 'success' });
      }
    });

    addModalEnterAction(this._lanCreationModal, { targetId: lanInputId });
  }

  _openLanguageCreationModal() {
    const input = this.element('lan-creation-input');
    if (input) {
      input.value = 'New language';
      input.focus();
      input.select();
    }
    openModal(this._lanCreationModal);
  }

  _updateCounter() {
    const counter = this.element('cardCounter');
    if(!counter)
      return;
    
    const languages = getLanguages();
    counter.innerText = languages ? languages.length: '0';
  }

  _renderLanguageThemeCards() {
    const searchQuery = session.get('themeSearchQuery');
    const langs = getLanguages();
    const parent = this.element('languageThemeContainer');
    if (!langs || !parent) 
      return;
  
    let html = '';
    langs.forEach(lang => {
      if(searchQuery) {
        if(!syntaxDefinitionMatchesSearch(lang, searchQuery.toLowerCase()))
          return;
      }

      html += createThemeCard({
        dataSet: 'lang-id',
        data: lang.id,
        bodyHTML:   buildLanguageCardBody(lang),
        footerHTML: buildLanguageCardFooter(lang),
      });
    });
  
    setHTML(parent, html);
  }

}