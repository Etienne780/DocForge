import { Component } from "@core/Component.js";
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { state } from '@core/State.js';
import { setHTML, isNameValid } from '@common/Common.js'
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { addDocTheme, getDocThemes, docThemeMatchesSearch } from '@data/DocThemeManager.js';
import { createThemeCard, sortCardList, buildDocThemeCardBody, buildDocThemeCardFooter, applyDocThemeCardColors } from '../helpers/ThemeCardHelper.js';
import { themeSectionName } from '../helpers/SectionModalHelper.js';

export default class DocThemeCards extends Component {

  onLoad() {
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
      if(!target || !target.dataset)
        return;
      
      const id = target.dataset.themeId;
      eventBus.emit(`themeManager:openModal:${themeSectionName}`, { id: id });
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

    addModalEnterAction(this._themeCreationModal, { targetId: themeInputId });
  }

  _openThemeCreationModal() {
    const input = this.globalElement('theme-creation-input', this._themeCreationModal);
    if (input) {
      console.log('dsadsas');
      input.value = 'New theme';
      input.focus();
      input.select();
    }
    openModal(this._themeCreationModal);
  }

  _updateCounter() {
    const searchQuery = session.get('themeSearchQuery');
    const counter = this.element('cardCounter');
    if(!counter)
      return;
    
    const themes = getDocThemes();
    let count = themes?.length;
    if(searchQuery && searchQuery !== '') {
      count = 0;
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
    const themes = getDocThemes();
    const parent = this.element('docThemeContainer');
    if (!themes || !parent) 
      return;

    const sorted = sortCardList(themes, cardSortAction);
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