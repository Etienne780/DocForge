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
import { escapeHTML, formatTimeString } from '@common/Common.js'
import { buildConfirmationDeleteModal } from '@common/BaseModals.js';
import { getFolderIcon } from '@ui/Icon.js';

export default class RecentProjects extends Component {

  async onLoad() {
    this._buildProjectDeleteModal();
    this._renderProjects();
    
    const refresh = () => {
      this._renderProjects();
    };

    this.subscribe('state:change:recentProjects', refresh);
    this.subscribe('session:change:projectHubSearchQuery', refresh);
  }

  onDestroy() {
    this._deleteProjectModal.remove();
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

    const isWeb = isPlatformWeb();
    const openFileExplorerHtml = `<button class="recent-card__action-button" data-action="folder" title="Open in File Fxplorer">${getFolderIcon()}</button>`;

    return `
      <div class="recent-card" data-project-id="${entry.id}" title="${escapeHTML(safeName)}">
        <div class="recent-card__content">
          <span class="recent-card__name">${safeName}</span>
          <span class="recent-card__meta">${sourceInfo} · ${lastOpened}</span>
        </div>

        <div class="recent-card__actions">
          ${!isWeb ? openFileExplorerHtml: ''}
          <!-- <button class="recent-card__action-button" data-action="rename" title="Rename">✎</button> -->
          <button class="recent-card__action-button recent-card__action-button--danger" data-action="delete" title="Remove from recents">✕</button>
        </div>
      </div>
    `;
  }

  _bindCardEvents(container) {
    // Folder-Buttons
    container.querySelectorAll('[data-action="folder"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.recent-card');
        const projectId = card.dataset.projectId;
        revealRecentProject(projectId);
      });
    });

    // Delete-Buttons
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.recent-card');
        const projectId = card.dataset.projectId;
        const name = card.querySelector('.recent-card__name')?.textContent || 'this project';
      
        const messageEl = this._deleteProjectModal.querySelector('.modal__confirm-message');
        if (messageEl)
          messageEl.textContent = `Remove "${escapeHTML(name)}" from recents?`;

        this._projectDeleteCallback = () => {
          removeRecentProject(projectId);
        };
        openModal(this._deleteProjectModal);
      });
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