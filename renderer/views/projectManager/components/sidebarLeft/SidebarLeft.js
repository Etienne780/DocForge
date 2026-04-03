import { Component } from '@core/Component.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { DragDropHelper } from '@common/DragDropHelper.js';
import { buildRenameModal, buildConfirmationDeleteModal } from '@common/BaseModals.js';
import { escapeHTML } from '@common/Common.js'
import { createProject, findProject, removeProjectById } from '@data/ProjectManager.js';

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
    this._selectedProjectId = null;// id the curren action is preformed on rename/delete
    
    this._setupData();
    this._buildModals();
    this._setupElementEvents();
    this._renderProjectList();

    this.subscribe('session:change:activeProjectId', () => this._renderProjectList());
    this.subscribe('state:change:projects', () => this._renderProjectList());
    this.subscribe('state:change:projects:name', () => this._renderProjectList());
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
        case 'select':  this._selectProject(projectId); break;
        case 'rename':  this._openRenameProjectModal(projectId); break;
        case 'delete':  this._openConfirmDeleteProjectModal(projectId); break;
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
          <button class="action-button" data-project-id="${project.id}" data-action="rename" title="Rename">✎</button>
          <button class="action-button action-button--danger" data-project-id="${project.id}" data-action="delete" title="Delete">✕</button>
        </div>
      </div>`
    });

    list.innerHTML = listHTML;
  }

  _reorderProjects(draggedId, targetId) {
    let projects = state.get('projects');
    if(!projects)
      projects = [];
    
    const from = projects.findIndex(n => n.id === draggedId);
    const to = projects.findIndex(n => n.id === targetId);

    if (from < 0 || to < 0)
      return;

    const [remove] = projects.splice(from, 1);
    projects.splice(to, 0, remove);

    // emits the change event of project
    state.set('projects', [...state.get('projects')]);
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
      placeHolderClass: 'project-manager_element-placeholder',
      onReorder: (from, to, fromId, toId) => { this._reorderProjects(fromId, toId) }
    });

    this._teardownDragAndDrop = () => {
      dnd.destroy();
    };
  }

  _isProjectNameValid(name) {
    return (name) ? name.length >= 3 : false;
  }

  // ─── Modals ───────────────────────────────────────────────────────────────

  _buildModals() {
    this._buildProjectModal();

    this._renameProjectModal = buildRenameModal(this.elementId('rename-modal'), {
      inputId: this.elementId('rename-input'),
      title: 'Rename Project',
      placeholder: 'New name...',
      zIndex: '1001',
      onPrimary: () => {
        const toastErrorPayload = { message: 'Faild to rename project', type: 'error'};
        if(!this._selectedProjectId) {
          eventBus.emit('toast:show', toastErrorPayload);
          return;
        }

        const input = this._renameProjectModal.querySelector('[data-role="rename-input"]');
        const value = input.value.trim();
        if (!this._isProjectNameValid(value)) {
          this._selectedProjectId = null;
          eventBus.emit('toast:show', { message: `Faild to rename project, name has to be at least 3 Characters long`, type: 'error' });
          return;
        }

        let p = findProject(this._selectedProjectId);
        if(!p) {
          this._selectedProjectId = null;
          eventBus.emit('toast:show', toastErrorPayload);
          return;
        }

        const prevP = { ...p };
        p.name = value;
        state.notify('projects', { value: p, previousValue: prevP}, 'name');

        this._selectedProjectId = null;
        closeModal(this._renameProjectModal);
        eventBus.emit('save:request');
        eventBus.emit('toast:show', { message: `Rename project`, type: 'success' });
      },
    });

    this._deleteProjectModal = buildConfirmationDeleteModal(this.elementId('delete-modal'), {
      title: 'Delete Project',
      message: 'set in open',
      zIndex: '1001',
      onConfirm: () => {
        const toastErrorPayload = { message: 'Faild to delete project', type: 'error'};
        if(!this._selectedProjectId) {
          eventBus.emit('toast:show', toastErrorPayload);
          return;
        }

        const result = removeProjectById(this._selectedProjectId);
        closeModal(this._deleteProjectModal);
        eventBus.emit('save:request');
        if(result)
          eventBus.emit('toast:show', { message: `Deleted project`, type: 'success' });
        else
          eventBus.emit('toast:show', toastErrorPayload);
      }
    });
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
        if(!this._isProjectNameValid(value)) {
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

  _openRenameProjectModal(projectId) {
    this._selectedProjectId = projectId;

    const input = this._renameProjectModal.querySelector('[data-role="rename-input"]');
    if(input) {
      const p = findProject(projectId);

      input.value = p.name ?? '';
      input.focus();
      input.select();
    }

    openModal(this._renameProjectModal);
  }

  _openConfirmDeleteProjectModal(projectId) {
    this._selectedProjectId = projectId;

    const el = this._deleteProjectModal.querySelector('.modal__confirm-message');
    if (el) {
      const project = findProject(projectId);
      el.textContent = `Are you sure you want to delete '${(project) ? project.name : '?'}' project?`;
    }

    openModal(this._deleteProjectModal);
  }

}