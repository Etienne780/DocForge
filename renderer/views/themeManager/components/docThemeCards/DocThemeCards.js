import { Component } from "@core/Component.js";
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { setHTML, isNameValid } from '@common/Common.js'
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { addDocTheme, getDocThemes, docThemeMatchesSearch } from '@data/DocThemeManager.js';
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
    this.subscribe('session:change:themeSearchQuery', () => refresh());
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

    addModalEnterAction(this._themeCreationModal, { targetId: themeInputId });
  }

  _openThemeCreationModal() {
    const input = this.element('theme-creation-input');
    if (input) {
      input.value = 'New theme';
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
    const searchQuery = session.get('themeSearchQuery');
    const themes = getDocThemes();
    const parent = this.element('docThemeContainer');
    if (!themes || !parent) return;

    let html = '';
    themes.forEach(theme => {
      if(searchQuery) {
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