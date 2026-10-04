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
import { openDocument } from '@core/DocumentManager.js';
import { 
  removeRecentProject,
  openProjectInEditor,
  openRecentProject,
  findRecentProject,
  revealRecentProject,
  recentProjectMatchesSearch
} from '@data/ProjectManager.js';
import { escapeHTML, formatTimeString, isNameValid } from '@common/Common.js'
import { buildConfirmationDeleteModal, buildRenameModal } from '@common/BaseModals.js';
import { renameRecentProject } from '@common/ProjectPersistence.js';
import { createActionMenu } from '@common/UIUtils.js';

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
      title: 'Rename project',
      placeholder: 'Project name...',
      validationType: 'PROJECT',
      onPrimary: async () => {
        const value = this._renameModal.querySelector('[data-role="rename-input"]').value.trim();
        if (!isNameValid(value, 'PROJECT'))
          return;

        closeModal(this._renameModal);
        const ok = await renameRecentProject(this._renameProjectId, value);
        eventBus.emit('toast:show', ok
          ? { message: 'Project renamed.', type: 'success' }
          : { message: 'Failed to rename project.', type: 'error' });
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
      title: 'Delete',
      message: 'Are you sure you want to delete this project?',
      zIndex: '1001',
      onConfirm: () => {
        this._projectDeleteCallback?.();
        this._projectDeleteCallback = null;
        closeModal(this._deleteProjectModal);
      }
    });
  }

  _renderProjects() {
    const container = this.element('recent-container');
    if (!container)
      return;

    const recentProjects = state.get('recentProjects');

    if (!recentProjects || recentProjects.length === 0) {
      container.innerHTML = `<div class="recent-projects__empty">No recent projects found.</div>`;
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
    const name = card.querySelector('.recent-card__name')?.textContent || 'this project';

    const messageEl = this._deleteProjectModal.querySelector('.modal__confirm-message');
    if (messageEl)
      messageEl.textContent = `Are you sure you want to delete "${name}" from recents?`;

    this._projectDeleteCallback = () => {
      removeRecentProject(projectId);
    };
    openModal(this._deleteProjectModal);
  }

  _createRecentCardHTML(entry) {
    const projectName = entry?.name || 'Unnamed Project';
    const safeName = escapeHTML(projectName);
    const lastOpened = formatTimeString(entry.lastOpenedAt);

    let sourceInfo = '';
    if (entry.sourceKind !== RECENT_PROJECT_SOURCE_TYPE_IN_APP) {
      sourceInfo = entry.sourceKind === RECENT_PROJECT_SOURCE_TYPE_FOLDER ? 'Folder' : 'File';
    } else if (entry.project) {
      sourceInfo = 'In-app';
    }

    return `
      <div class="recent-card" data-project-id="${entry.id}" title="${safeName}">
        <div class="recent-card__content">
          <span class="recent-card__name">${safeName}</span>
          <span class="recent-card__meta">${sourceInfo} · ${lastOpened}</span>
        </div>
      </div>
    `;
  }

  _bindCardEvents(container) {
    // "⋯" menu per card
    container.querySelectorAll('.recent-card').forEach(card => {
      const projectId = card.dataset.projectId;
      const items = [
        { name: 'Open', action: () => openRecentProject(projectId) },
        { name: 'Rename', action: () => this._openRenameModal(projectId) },
      ];

      if (!isPlatformWeb()) {
        items.push({ name: 'Open in File Explorer', action: () => revealRecentProject(projectId) });
      }
      items.push(
        { name: 'Create Template', action: () => eventBus.emit('show:modal:createTemplate', { recentProjectId: projectId }) },
        { name: 'Remove from recents', danger: true, action: () => this._confirmRemove(card) },
      );

      card.append(createActionMenu(items));
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