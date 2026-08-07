// renderer/views/projectHub/components/recentProjects/RecentProjects.js
import { Component } from '@core/Component.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { isPlatformWeb } from '@core/Platform.js';
import { openDocument } from '@core/DocumentManager.js';
import { removeRecentProject, openProjectInEditor } from '@data/ProjectManager.js';
import { escapeHTML, formatTimeString } from '@common/Common.js'
import { getFolderIcon } from '@ui/Icon.js';

export default class RecentProjects extends Component {

  async onLoad() {
    this._renderProjects();
    this._setupSubscriptions();
  }

  onDestroy() {
  }

  _setupSubscriptions() {
    this.subscribe('state:change:recentProjects', () => {
      this._renderProjects();
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

    const sorted = [...recentProjects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);

    let cardsHTML = '';
    sorted.forEach(entry => {
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
    if (entry.sourceKind) {
      sourceInfo = entry.sourceKind === 'folder' ? 'Folder' : 'File';
    } else if (entry.project) {
      sourceInfo = 'In-app';
    }

    return `
      <div class="recent-card" data-project-id="${entry.id} title="${escapeHTML(safeName)}">
        <div class="recent-card__content">
          <span class="recent-card__name">${safeName}</span>
          <span class="recent-card__meta">${sourceInfo} · ${lastOpened}</span>
        </div>

        <div class="recent-card__actions">
          <!-- <button class="recent-card__action-button" data-action="open" title="Open">${getFolderIcon()}</button> -->
          <button class="recent-card__action-button" data-action="rename" title="Rename">✎</button>
          <button class="recent-card__action-button recent-card__action-button--danger" data-action="delete" title="Remove from recents">✕</button>
        </div>
      </div>
    `;
  }

  _bindCardEvents(container) {
    // Delete-Buttons
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.recent-card');
        const projectId = card.dataset.projectId;
        const name = card.querySelector('.recent-card__name')?.textContent || 'this project';
        
        if (confirm(`Remove "${name}" from recents?`)) {
          removeRecentProject(projectId);
        }
      });
    });

    container.querySelectorAll('.recent-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) 
          return;

        const projectId = card.dataset.projectId;
        this._openRecentProject(projectId);
      });
    });
  }

  async _openRecentProject(projectId) {
    const recentProjects = state.get('recentProjects');
    const entry = recentProjects.find(p => p.id === projectId);

    if (!entry) {
      eventBus.emit('toast:show', { message: 'Project not found in recents.', type: 'error' });
      return;
    }

    if (entry.project) {
      openProjectInEditor(entry.project, { addToRecents: false });
      return;
    }

    if (entry.sourcePath) {
      try {
        // openDocument navigates itself on success; reopening a known path never
        // re-adds it to recents.
        const result = await openDocument(entry.sourceKind || 'file', entry.sourcePath);
        if (!result) {
          // eventBus.emit('toast:show', { message: 'Failed to open project.', type: 'error' });
          removeRecentProject(projectId);
        }
      } catch (error) {
        eventBus.emit('toast:show', { 
          message: `Failed to open project: ${error.message}`, 
          type: 'error' 
        });

        removeRecentProject(projectId);
      }
    } else {
      eventBus.emit('toast:show', { 
        message: 'Cannot open project: Invalid entry.', 
        type: 'error' 
      });
    }
  }
}