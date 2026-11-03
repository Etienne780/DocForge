import { Component } from "@core/Component.js";
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { state } from '@core/State.js';
import { getValidationError } from '@common/Validations.js';
import { setHTML, isNameValid } from '@common/Common.js'
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction, buildRenameModal, buildConfirmationDeleteModal } from '@common/BaseModals.js';
import { createActionMenu } from '@common/UIUtils.js';
import { addContextMenu } from '@common/MenuManager.js';
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
  dublicateDocThemeById,
  updateDocTheme,
  removeDocThemeById
} from '@data/DocThemeManager.js';
import {
  createThemeCard,
  sortCardList,
  buildDocThemeCardBody,
  buildDocThemeCardFooter,
  applyDocThemeCardColors
} from '@common/ThemeCardHelper.js';

export default class DocThemeCards extends Component {

  onLoad() {
    this._project = this.props.project;
    this._renameThemeId = null;
    this._deleteThemeId = null;

    const presets = getPresetDocThemes();
    this._presetIds = new Set(presets.map(p => p.id));

    this._buildCreateDocThemeModal();
    this._buildRenameModal();
    this._buildDeleteModal();
    this._setupElementEvents();

    const refresh = () => {
      this._updateCounter();
      this._renderDocThemeCards();
    };

    refresh();
    this.subscribe('session:change:themeSearchQuery', () => refresh());
    this.subscribe('state:change:appereanceSortAction', () => refresh());
    this.subscribe('session:change:openProject:themes', () => refresh());
    this.subscribe('session:change:openProject:settings', () => refresh()); // active-theme changes
  }

  onDestroy() {
    this._themeCreationModal?.remove();
    this._renameModal?.remove();
    this._deleteModal?.remove();
  }

  _setupElementEvents() {
    this.element('newTheme').addEventListener('click', () => this._openThemeCreationModal());
    this.element('importTheme').addEventListener('click', () => {
      eventBus.emit('show:modal:importDocTheme', { projectId: this._project?.id });
    });

    const container = this.element('docThemeContainer');

    container.addEventListener('click', event => {
      const activateBtn = event.target.closest('[data-activate-theme]');
      if (activateBtn) {
        event.stopPropagation();
        this._activateTheme(activateBtn.dataset.activateTheme, this._presetIds.has(activateBtn.dataset.activateTheme));
        return;
      }

      const target = event.target.closest('[data-theme-id]');
      if (target)
        this._openEditor(target.dataset.themeId);
    });
  }

  // ─── Theme actions ────────────────────────────────────────────────────────

  /** Menu items of a card, built-in themes can only be exported and duplicated. */
  _themeMenuItems(theme) {
    const items = [
      { name: 'Export', action: () => eventBus.emit('show:modal:exportDocTheme', { project: this._project, themeId: theme.id }) },
    ];

    if (!theme.builtIn)
      items.push({ name: 'Rename', action: () => this._openRenameModal(theme.id) });

    items.push({ name: 'Duplicate', action: () => dublicateDocThemeById(this._project, theme.id) });

    if (!theme.builtIn)
      items.push({ name: 'Delete', danger: true, action: () => this._openDeleteModal(theme.id) });

    return items;
  }

  _openEditor(id) {
    const theme = findDocTheme(id, this._project.themes);
    if (!theme) {
      eventBus.emit('toast:show', { message: 'Failed to open theme.', type: 'error' });
      return;
    }

    if (theme.builtIn) {
      eventBus.emit('toast:show', { message: 'Built-in themes cannot be edited.', type: 'info' });
      return;
    }

    openDocThemeEditor(this._project, theme);
  }

  _activateTheme(id, builtIn) {
    setCurrentTheme(this._project, id, builtIn);
    eventBus.emit('save:request');
    eventBus.emit('toast:show', { message: 'Theme activated.', type: 'success' });
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
      errorElement.classList.toggle('hidden', isNameValid(value, 'THEME'));
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
    this.query('[data-error-msg]', this._themeCreationModal)?.classList.add('hidden');
    openModal(this._themeCreationModal);
  }

  // ─── Rename modal ─────────────────────────────────────────────────────────

  _buildRenameModal() {
    this._renameModal = buildRenameModal(this.elementId('rename-modal'), {
      inputId: this.elementId('rename-input'),
      title: 'Rename theme',
      placeholder: 'Theme name...',
      validationType: 'THEME',
      onPrimary: () => {
        const value = this._renameModal.querySelector('[data-role="rename-input"]').value.trim();
        if (!isNameValid(value, 'THEME'))
          return;

        closeModal(this._renameModal);
        const ok = updateDocTheme(this._project, this._renameThemeId, { name: value });
        eventBus.emit('toast:show', ok
          ? { message: 'Theme renamed.', type: 'success' }
          : { message: 'Failed to rename theme.', type: 'error' });
      },
    });
  }

  _openRenameModal(id) {
    const theme = findDocTheme(id, this._project.themes);
    if (!theme)
      return;

    this._renameThemeId = id;
    const input = this._renameModal.querySelector('[data-role="rename-input"]');
    input.value = theme.name ?? '';
    input.dispatchEvent(new Event('input'));
    openModal(this._renameModal);
    setTimeout(() => { input.focus(); input.select(); }, 80);
  }

  // ─── Delete modal ─────────────────────────────────────────────────────────

  _buildDeleteModal() {
    this._deleteModal = buildConfirmationDeleteModal(this.elementId('delete-modal'), {
      title: 'Delete theme',
      onConfirm: () => {
        closeModal(this._deleteModal);
        const ok = removeDocThemeById(this._project, this._deleteThemeId);
        eventBus.emit('toast:show', ok
          ? { message: 'Theme deleted.', type: 'success' }
          : { message: 'Failed to delete theme.', type: 'error' });
      },
    });
  }

  _openDeleteModal(id) {
    const theme = findDocTheme(id, this._project.themes);
    if (!theme)
      return;

    this._deleteThemeId = id;
    const messageEl = this._deleteModal.querySelector('.modal__confirm-message');
    if (messageEl)
      messageEl.textContent = `Are you sure you want to delete the theme "${theme.name}"?`;
    openModal(this._deleteModal);
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
    const cardSortAction = state.get('appereanceSortAction');
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
        footerHTML: buildDocThemeCardFooter(theme, { isActive }),
      });
    });

    setHTML(parent, html);
    applyDocThemeCardColors(parent);
    this._bindCardMenus(parent);
  }

  /** "⋯" menu and context menu per card */
  _bindCardMenus(parent) {
    parent.querySelectorAll('[data-theme-id]').forEach(card => {
      const theme = findDocTheme(card.dataset.themeId, this._project.themes);
      if (!theme)
        return;

      const items = () => this._themeMenuItems(theme);
      card.querySelector('.theme-cards_footer-actions')?.append(createActionMenu(items()));
      addContextMenu(card, items, 'dropdown--compact');
    });
  }

}
