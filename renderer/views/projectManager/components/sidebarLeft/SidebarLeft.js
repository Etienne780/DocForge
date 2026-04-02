import { Component } from '@core/Component.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { DragDropHelper } from '@common/DragDropHelper.js';
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { createProject } from '@data/ProjectManager.js';

/**
 * SidebarLeft - project selector.
 *
 * Responsibilities:
 *   - Project selector list
 *   - Drag & drop reordering within the same level
 *   - Modals: Rename projects, Delete confirm
 *   - Search filtering via session.searchQuery
 */
export default class SidebarLeft extends Component {

  onLoad() {
    this._teardownDragAndDrop = null;
    this._createProjectModal = null;
    
    this._setupData();
    this._buildModals();
    this._setupElementEvents();
    this._renderProjectList();

    this.subscribe('session:change:activeProjectId', () => this._renderProjectList());
    this.subscribe('state:change:project', () => this._renderProjectList());
  }

  onDestroy() {
    this._teardownDragAndDrop?.();
    this._createProjectModal?.remove();
  }

  _setupData() {
    // reset search query
    session.set('searchQuery', '');

    // select first project if no project is selected
    if(!session.get('activeProjectId'))  {
      const projects = state.get('projects');
      if(projects && projects.length > 0) 
        session.set('activeProjectId', projects[0].id);
    }
  }

  _buildModals() {
    this._buildProjectModal();
  }

  _buildProjectModal() {
    const projectInputId = this.elementId('project-creation-input');

    this._createProjectModal = buildStandardModal(this.elementId('project-manager-create-modal'), {
      title: 'Create Project',
      bodyHTML:  
      `<div class="form-group">
        <label class="form-label" for="${projectInputId}">Name</label>
        <input type="text" class="form-input" id="${projectInputId}" autocomplete="off" placeholder="Project name...">
      </div>`,
      primaryLabel: 'Create',
      onPrimary: () => {
        const value = document.getElementById(projectInputId).value.trim();
        if(!value || value.length < 3) {
          eventBus.emit('toast:show', { message: `Faild to create project, name has to be at least 3 Characters long`, type: 'error' });
          return;
        }

        let projects = state.get('projects');
        if(!projects)
          projects = [];

        projects.push(createProject(value));
        closeModal(this._createProjectModal);
        this._renderProjectList();
        eventBus.emit('save:request');
        eventBus.emit('toast:show', { message: `Project ${value} created`, type: 'success' });
      }
    });

    document.getElementById(projectInputId)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._createProjectModal.querySelector('[data-modal-primary]')?.click();
    });
  }

  _setupElementEvents() {
    // ── Project list event delegation ─────────────────────────────────────────────────
    const list = this.element('project-list');
    list.addEventListener('click', event => {
      if (event.detail >= 2)
        return;

      const target = event.target.closest('[data-action]');
      if (!target) 
        return;

      event.stopPropagation();
      const { action, projectId } = target.dataset;
      if (!projectId) 
        return;

      switch (action) {
        case 'select':   this._selectProject(projectId); break;
        case 'rename':   this._openRenameNodeModal(projectId); break;
        case 'delete':   this._confirmDeleteProject(projectId);  break;
      }
    });

    this.element('add-project-button').addEventListener('click', (e) => {
      const input = this.element('project-creation-input');
      if(input) {
        input.value = '';
        input.focus();
      }
      openModal(this._createProjectModal);
    });
  }

  _selectProject(projectId) {
    session.set('activeProjectId', projectId);
  }

  _renderProjectList() {
    const list = this.element('project-list');
    const activeProjectID = session.get('activeProjectId');
    const projects = state.get('projects');

    this._setupProjectDragAndDrop(list);

    if(!projects || projects.length <= 0) {
      list.innerHTML = '<div class="project-manager__list-empty">No projects available.</div>';
      return;
    }

    let listHTML = '';
    projects.forEach(project => {
      listHTML += 
      `<div
        class="project-manager_element project-manager_element${project.id === activeProjectID ? '--active' : ''}"
        draggable="true"
        data-project-id="${project.id}"
        data-action="select"
        title="${escapeHTML(project.name)}"
      >
        <span class="project-manager_element__label">${escapeHTML(project.name)}</span>
        <div class="project-manager_element__actions">
          <button class="action-button" data-node-id="${project.id}" data-action="rename" title="Rename">✎</button>
          <button class="action-button action-button--danger" data-node-id="${project.id}" data-action="delete" title="Delete">✕</button>
        </div>
      </div>`
    });

    list.innerHTML = listHTML;
  }

  _reorderProjects(fromId, toId) {
    console.log('Project move from ' + fromId + ' to ' +  toId);
  }

  _setupProjectDragAndDrop(container) {
    // Destroy old drag and drop helper
    this._teardownDragAndDrop?.();
    this._teardownDragAndDrop = null;

    // Create new drag and drop helper
    let dnd = new DragDropHelper(container, {
      itemSelector:   '.project-manager_element[data-project-id]',
      handleSelector: '.project-manager_element[data-project-id]',
      idAttribute:    'projectId',
      onReorder: (from, to, fromId, toId) => { this._reorderProjects(fromId, toId) }
    });

    this._teardownDragAndDrop = () => {
      dnd.destroy();
    };
  }

}

function escapeHTML(string) {
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}