import { Component } from "@core/Component.js";
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { state } from '@core/State.js';
import { getValidationError } from '@common/Validations.js';
import { setHTML, isNameValid } from '@common/Common.js'
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import {
  addDocTheme,
  createDocTheme,
  openDocThemeEditor,
  getDocThemes,
  findDocTheme,
  getPresetDocThemes,
  docThemeMatchesSearch,
  getCurrentTheme, 
  setCurrentTheme,
  dublicateDocThemeById
} from '@data/DocThemeManager.js';
import { 
  createThemeCard,
  sortCardList,
  buildDocThemeCardBody,
  buildDocThemeCardFooter,
  applyDocThemeCardColors
} from '@common/ThemeCardHelper.js';
import { themeSectionName } from '../helpers/SectionModalHelper.js';

export default class DocThemeCards extends Component {

  onLoad() {
    this._project = this.props.project;
    this._clickTimeout = null;

    const presets = getPresetDocThemes();
    this._presetIds = new Set(presets.map(p => p.id));

    this._buildCreateDocThemeModal();
    this._setupElementEvents();

    const refresh = () => {
      this._updateCounter();
      this._renderDocThemeCards();
    };

    refresh();
    this.subscribe('session:change:themeSearchQuery', () => refresh());
    this.subscribe('state:change:themeSortAction', () => refresh());
    this.subscribe('session:change:openProject:themes', () => refresh());
    this.subscribe('session:change:openProject:settings', () => refresh()); // active-theme changes
  }

  onDestroy() {
    this._themeCreationModal?.remove();
  }

  _setupElementEvents() {
    this.element('newTheme').addEventListener('click', () => this._openThemeCreationModal());

    const container = this.element('docThemeContainer');

    container.addEventListener('click', event => {
      const activateBtn = event.target.closest('[data-activate-theme]');
      if (activateBtn) {
        event.stopPropagation();
        this._activateTheme(activateBtn.dataset.activateTheme, this._presetIds.has(activateBtn.dataset.activateTheme));
        return;
      }

      const dupBtn = event.target.closest('[data-duplicate-theme]');
      if (dupBtn) {
        event.stopPropagation();
        this._duplicateTheme(dupBtn.dataset.duplicateTheme);
        return;
      }

      const target = event.target.closest('[data-theme-id]');
      if (!target || !target.dataset)
        return;

      const id = target.dataset.themeId;
      clearTimeout(this._clickTimeout);
      this._clickTimeout = setTimeout(() => {
        eventBus.emit(`appearanceManager:openModal:${themeSectionName}`, { id, isPreset: this._presetIds.has(id) });
      }, 225);
    });

    container.addEventListener('dblclick', event => {
      if (event.target.closest('[data-activate-theme], [data-duplicate-theme]'))
        return;

      const target = event.target.closest('[data-theme-id]');
      if (!target || !target.dataset)
        return;

      const id = target.dataset.themeId;
      clearTimeout(this._clickTimeout);

      const theme = findDocTheme(id, this._project.themes);
      if (!theme) {
        eventBus.emit('toast:show', { message: 'Failed to open theme.', type: 'error' });
        return;
      }

      openDocThemeEditor(this._project, theme);
    });
  }

  // ─── Activation & duplication ────────────────────────────────────────────

  _activateTheme(id, isPreset) {
    setCurrentTheme(this._project, id, isPreset);
    eventBus.emit('save:request');
    eventBus.emit('toast:show', { message: 'Theme activated.', type: 'success' });
  }

  _duplicateTheme(id) {
    dublicateDocThemeById(this._project, id);
  }

  // ─── Creation modal ───────────────────────────────────────────────────────

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
        if (!isNameValid(value, 'THEME'))
          return;

        addDocTheme(this._project, createDocTheme(value));
        closeModal(this._themeCreationModal);
        this._renderDocThemeCards();

        eventBus.emit('save:request');
        eventBus.emit('toast:show', { message: `Doc theme '${value}' created.`, type: 'success' });
      }
    });

    const input = this.globalElement('theme-creation-input', this._themeCreationModal);
    input.addEventListener('input', () => {
      const value = input.value.trim();
      const errorElement = this.query('[data-error-msg]', this._themeCreationModal);
      errorElement.classList.toggle('invisible', isNameValid(value, 'THEME'));
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
    this.query('[data-error-msg]', this._themeCreationModal)?.classList.add('invisible');
    openModal(this._themeCreationModal);
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  _updateCounter() {
    const searchQuery = session.get('themeSearchQuery');
    const counter = this.element('cardCounter');
    if (!counter)
      return;

    const presets = getPresetDocThemes();
    const themes = getDocThemes(this._project);
    let count = themes.length + presets.length;
    if (searchQuery) {
      count = [...presets, ...themes].filter(t => docThemeMatchesSearch(t, searchQuery.toLowerCase())).length;
    }

    counter.innerText = count || '0';
  }

  _renderDocThemeCards() {
    const searchQuery = session.get('themeSearchQuery');
    const cardSortAction = state.get('themeSortAction');
    const presets = getPresetDocThemes();
    const themes = getDocThemes(this._project);
    const current = getCurrentTheme(this._project);
    const parent = this.element('docThemeContainer');
    if (!parent)
      return;

    const list = [...themes, ...presets];
    const sorted = sortCardList(list, cardSortAction);

    let html = '';
    sorted.forEach(theme => {
      if (searchQuery && !docThemeMatchesSearch(theme, searchQuery.toLowerCase()))
        return;

      const isActive = current?.id === theme.id;
      html += createThemeCard({
        dataSet: 'theme-id',
        data: theme.id,
        extraClass: isActive ? 'theme-cards--current' : '',
        bodyHTML: buildDocThemeCardBody(theme),
        footerHTML: buildDocThemeCardFooter(theme, { isActive, showDuplicate: true }),
      });
    });

    setHTML(parent, html);
    applyDocThemeCardColors(parent);
  }

}