import { 
  RECENT_PROJECT_SOURCE_TYPE_FILE,
  RECENT_PROJECT_SOURCE_TYPE_FOLDER,
  RECENT_PROJECT_SOURCE_TYPE_IN_APP
} from '@core/AppMeta.js';
import { openModal, closeModal } from '@core/ModalBuilder.js';
import { Component } from '@core/Component.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { isPlatformWeb } from '@core/Platform.js';
import { 
  removeRecentProject,
  openRecentProject,
  findRecentProject,
  revealRecentProject,
  recentProjectMatchesSearch,
  hasTrashableProjectSource,
  trashRecentProjectSource
} from '@data/ProjectManager.js';
import { escapeHTML, formatTimeString, isNameValid } from '@common/Common.js'
import { buildConfirmationDeleteModal, buildRenameModal } from '@common/BaseModals.js';
import { renameRecentProject } from '@common/ProjectPersistence.js';
import { createActionMenu, setCheckBox, isCheckedBoxActive } from '@common/UIUtils.js';
import { addContextMenu } from '@common/MenuManager.js';
import { t } from '@core/i18n/I18n.js';

export default class RecentProjects extends Component {

  async onLoad() {
    this._buildProjectDeleteModal();
    this._buildRenameModal();
    this._renderProjects();
    
    const refresh = () => {
      this._renderProjects();
    };

    this.subscribe('state:change:recentProjects', refresh);
    this.subscribe('session:change:projectHubSearchQuery', refresh);
  }

  onDestroy() {
    this._deleteProjectModal.remove();
    this._renameModal.remove();
  }

  _buildRenameModal() {
    this._renameModal = buildRenameModal(this.elementId('rename-modal'), {
      inputId: this.elementId('rename-input'),
      title: t('hub.recent.renameTitle'),
      placeholder: t('hub.recent.namePlaceholder'),
      validationType: 'PROJECT',
      onPrimary: async () => {
        const value = this._renameModal.querySelector('[data-role="rename-input"]').value.trim();
        if (!isNameValid(value, 'PROJECT'))
          return;

        closeModal(this._renameModal);
        const ok = await renameRecentProject(this._renameProjectId, value);
        eventBus.emit('toast:show', ok
          ? { message: t('hub.recent.renamed'), type: 'success' }
          : { message: t('hub.recent.renameFailed'), type: 'error' });
      },
    });
  }

  _openRenameModal(projectId) {
    const entry = findRecentProject(projectId);
    if (!entry)
      return;

    this._renameProjectId = projectId;
    const input = this._renameModal.querySelector('[data-role="rename-input"]');
    input.value = entry.name ?? '';
    input.dispatchEvent(new Event('input'));
    openModal(this._renameModal);
    setTimeout(() => { input.focus(); input.select(); }, 80);
  }

  _buildProjectDeleteModal() {
    this._deleteProjectModal = buildConfirmationDeleteModal(this.elementId('delete-modal'), {
      title: t('hub.recent.deleteTitle'),
      message: t('hub.recent.deleteMessage'),
      zIndex: '1001',
      onConfirm: () => {
        this._projectDeleteCallback?.();
        this._projectDeleteCallback = null;
        closeModal(this._deleteProjectModal);
      }
    });

    // optional: also move the project file / folder to the trash (desktop only)
    const trashRow = document.createElement('div');
    trashRow.className = 'modal__confirm-option';
    trashRow.innerHTML = `
      <button class="checkbox-element" data-checkbox="true" data-role="trash-source"></button>
      <span data-role="trash-source-label"></span>`;
    this._deleteProjectModal.querySelector('.modal__confirm-message')?.after(trashRow);
    this._trashSourceRow = trashRow;
  }

  _renderProjects() {
    const container = this.element('recent-container');
    if (!container)
      return;

    const recentProjects = state.get('recentProjects');

    if (!recentProjects || recentProjects.length === 0) {
      container.innerHTML = `<div class="recent-projects__empty">${escapeHTML(t('hub.recent.empty'))}</div>`;
      return;
    }

    if (!Array.isArray(recentProjects)) {
      console.warn('recentProjects is not an array, resetting to empty array');
      state.set('recentProjects', []);
      return; // oder setze sorted = []
    }

    const searchQuery = session.get('projectHubSearchQuery');
    const sorted = [...recentProjects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);

    let cardsHTML = '';
    sorted.forEach(entry => {
      if(searchQuery) {
        if(!recentProjectMatchesSearch(entry, searchQuery.toLowerCase()))
          return;
      }

      cardsHTML += this._createRecentCardHTML(entry);
    });

    container.innerHTML = cardsHTML;
    this._bindCardEvents(container);
  }

  _confirmRemove(card) {
    const projectId = card.dataset.projectId;
    const name = card.querySelector('.recent-card__name')?.textContent || t('hub.recent.thisProject');

    const messageEl = this._deleteProjectModal.querySelector('.modal__confirm-message');
    if (messageEl)
      messageEl.textContent = t('hub.recent.removeMessage', { name });

    const entry = findRecentProject(projectId);
    const canTrash = hasTrashableProjectSource(entry);
    const trashCheckbox = this._trashSourceRow.querySelector('[data-role="trash-source"]');
    this._trashSourceRow.style.display = canTrash ? '' : 'none';
    setCheckBox(trashCheckbox, false);
    if (canTrash) {
      this._trashSourceRow.querySelector('[data-role="trash-source-label"]').textContent =
        t(entry.sourceKind === RECENT_PROJECT_SOURCE_TYPE_FOLDER ? 'hub.recent.trashFolder' : 'hub.recent.trashFile');
    }

    this._projectDeleteCallback = async () => {
      if (canTrash && isCheckedBoxActive(trashCheckbox)) {
        const ok = await trashRecentProjectSource(projectId);
        if (!ok) {
          eventBus.emit('toast:show', { message: t('hub.recent.trashFailed'), type: 'error' });
          return;
        }
      }
      removeRecentProject(projectId);
    };
    openModal(this._deleteProjectModal);
  }

  _createRecentCardHTML(entry) {
    const projectName = entry?.name || t('hub.recent.unnamed');
    const safeName = escapeHTML(projectName);
    const lastOpened = formatTimeString(entry.lastOpenedAt);

    let sourceInfo = '';
    if (entry.sourceKind !== RECENT_PROJECT_SOURCE_TYPE_IN_APP) {
      sourceInfo = t(entry.sourceKind === RECENT_PROJECT_SOURCE_TYPE_FOLDER ? 'hub.recent.folder' : 'hub.recent.file');
    } else if (entry.project) {
      sourceInfo = t('hub.recent.inApp');
    }

    return `
      <div class="recent-card" data-project-id="${entry.id}" title="${safeName}">
        <div class="recent-card__content">
          <span class="recent-card__name">${safeName}</span>
          <span class="recent-card__meta">${escapeHTML(sourceInfo)} · ${escapeHTML(lastOpened)}</span>
        </div>
      </div>
    `;
  }

  _bindCardEvents(container) {
    // "⋯" menu per card
    container.querySelectorAll('.recent-card').forEach(card => {
      const projectId = card.dataset.projectId;
      const items = [
        { name: t('hub.recent.open'), action: () => openRecentProject(projectId) },
        { name: t('hub.recent.rename'), action: () => this._openRenameModal(projectId) },
      ];

      if (!isPlatformWeb()) {
        items.push({ name: t('hub.recent.reveal'), action: () => revealRecentProject(projectId) });
      }
      items.push(
        { name: t('hub.recent.createTemplate'), action: () => eventBus.emit('show:modal:createTemplate', { recentProjectId: projectId }) },
        { name: t('hub.recent.remove'), danger: true, action: () => this._confirmRemove(card) },
      );

      card.append(createActionMenu(items));
      addContextMenu(card, items, 'dropdown--compact');
    });

    // Open project
    container.querySelectorAll('.recent-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) 
          return;

        const projectId = card.dataset.projectId;
        openRecentProject(projectId);
      });
    });
  }

}