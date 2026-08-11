import { Component } from "@core/Component.js";
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { state } from '@core/State.js';
import { getValidationError } from '@common/Validations.js';
import { setHTML, isNameValid } from '@common/Common.js'
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import {
  addSyntaxDefinition, createSyntaxDefinition, openSyntaxDefinitionEditor,
  findSyntaxDefinition, getLanguages, getPresetLanguages, syntaxDefinitionMatchesSearch,
} from '@data/SyntaxDefinitionManager.js';
import { createThemeCard, sortCardList, buildLanguageCardBody, buildLanguageCardFooter } from '@common/ThemeCardHelper.js';
import { langSectionName, styleListSectionName } from '../helpers/SectionModalHelper.js';

export default class LanguageThemeCards extends Component {

  onLoad() {
    this._project = this.props.project;
    this._clickTimeout = null;
    this._renderRequestId = 0;

    const presets = getPresetLanguages();
    this._presetIds = new Set(presets.map(p => p.id));

    this._buildCreateLanguageModal();
    this._setupElementEvents();

    const refresh = () => {
      this._updateCounter();
      this._renderLanguageThemeCards();
    };

    refresh();
    this.subscribe('session:change:themeSearchQuery', () => refresh());
    this.subscribe('state:change:themeSortAction', () => refresh());
    this.subscribe('session:change:openProject:languages', () => refresh());
  }

  onDestroy() {
    this._langCreationModal?.remove();
  }

  _setupElementEvents() {
    this.element('newLanguage').addEventListener('click', () => this._openLanguageCreationModal());

    const container = this.element('languageThemeContainer');

    container.addEventListener('click', event => {
      const dupBtn = event.target.closest('[data-duplicate-lang]');
      if (dupBtn) {
        event.stopPropagation();
        this._duplicateLanguage(dupBtn.dataset.duplicateLang);
        return;
      }

      const stylesBtn = event.target.closest('[data-manage-styles]');
      if (stylesBtn) {
        event.stopPropagation();
        eventBus.emit(`appearanceManager:openModal:${styleListSectionName}`, {
          id: stylesBtn.dataset.manageStyles,
        });
        return;
      }

      const target = event.target.closest('[data-lang-id]');
      if (!target || !target.dataset)
        return;

      const id = target.dataset.langId;
      clearTimeout(this._clickTimeout);
      this._clickTimeout = setTimeout(() => {
        eventBus.emit(`appearanceManager:openModal:${langSectionName}`, {
          id: id,
          builtIn: this._presetIds.has(id)
        });
      }, 225);
    });

    container.addEventListener('dblclick', event => {
      if (event.target.closest('[data-duplicate-lang]') || event.target.closest('[data-manage-styles]'))
        return;

      const target = event.target.closest('[data-lang-id]');
      if (!target || !target.dataset)
        return;

      const id = target.dataset.langId;
      clearTimeout(this._clickTimeout);

      const lang = findSyntaxDefinition(id, this._project.languages);
      if (!lang || lang.builtIn) {
        eventBus.emit('toast:show', { message: 'Failed to open language.', type: 'error' });
        return;
      }

      openSyntaxDefinitionEditor(this._project, lang);
    });
  }

  // ─── Duplication ──────────────────────────────────────────────────────────

  _duplicateLanguage(id) {
    const source = findSyntaxDefinition(id, this._project.languages);
    if (!source) {
      eventBus.emit('toast:show', { message: 'Failed to duplicate language.', type: 'error' });
      return;
    }

    const copy = createSyntaxDefinition(`${source.name} Copy`);
    copy.aliases = [...source.aliases];
    copy.symbolHoisting = source.symbolHoisting;
    copy.states = JSON.parse(JSON.stringify(source.states));
    copy.rootStateId = source.rootStateId;
    copy.predefinedSymbols = [...source.predefinedSymbols];
    copy.exampleCode = source.exampleCode;
    // Styles live separately in project.languagesStyles and stay attached
    // to the original language — intentionally not copied here.

    addSyntaxDefinition(this._project, copy);
    eventBus.emit('save:request');
    eventBus.emit('toast:show', { message: 'Language duplicated.', type: 'success' });
  }

  // ─── Creation modal ───────────────────────────────────────────────────────

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
        if (!isNameValid(value, 'LANGUAGE'))
          return;

        addSyntaxDefinition(this._project, createSyntaxDefinition(value));
        closeModal(this._langCreationModal);
        this._renderLanguageThemeCards();

        eventBus.emit('save:request');
        eventBus.emit('toast:show', { message: `Language '${value}' created.`, type: 'success' });
      }
    });

    const input = this.globalElement('lan-creation-input', this._langCreationModal);
    input.addEventListener('input', () => {
      const value = input.value.trim();
      const errorElement = this.query('[data-error-msg]', this._langCreationModal);
      errorElement.classList.toggle('invisible', isNameValid(value, 'LANGUAGE'));
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
    this.query('[data-error-msg]', this._langCreationModal)?.classList.add('invisible');
    openModal(this._langCreationModal);
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  _updateCounter() {
    const searchQuery = session.get('themeSearchQuery');
    const counter = this.element('cardCounter');
    if (!counter)
      return;

    const presets = getPresetLanguages();
    const languages = getLanguages(this._project);
    let count = languages.length + presets.length;
    if (searchQuery) {
      count = [...presets, ...languages].filter(l => syntaxDefinitionMatchesSearch(l, searchQuery.toLowerCase())).length;
    }

    counter.innerText = count || '0';
  }

  async _renderLanguageThemeCards() {
    const searchQuery = session.get('themeSearchQuery');
    const cardSortAction = state.get('themeSortAction');
    const presets = getPresetLanguages();
    const langs = getLanguages(this._project);
    const parent = this.element('languageThemeContainer');
    if (!parent)
      return;

    const list = [...langs, ...presets];
    const sorted = sortCardList(list, cardSortAction);
    const visible = sorted.filter(lang => {
      if (searchQuery)
        return syntaxDefinitionMatchesSearch(lang, searchQuery.toLowerCase());
      return true;
    });

    const requestId = ++this._renderRequestId;
    const cardsHTML = await Promise.all(visible.map(async lang => createThemeCard({
      dataSet: 'lang-id',
      data: lang.id,
      bodyHTML:   await buildLanguageCardBody(this._project, lang),
      footerHTML: buildLanguageCardFooter(lang, searchQuery, { showDuplicate: !lang.builtIn }),
    })));

    if (requestId !== this._renderRequestId)
      return;

    setHTML(parent, cardsHTML.join(''));
  }

}