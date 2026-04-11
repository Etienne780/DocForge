import { Component } from '@core/Component.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { DragDropHelper } from '@common/DragDropHelper.js';
import { buildRenameModal, buildConfirmationDeleteModal } from '@common/BaseModals.js';
import { escapeHTML, isNameValid } from '@common/Common.js'
import { createProject, findProject, removeProjectById, projectMatchesSearch } from '@data/ProjectManager.js';

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
    this._renameProjectModal = null;
    this._deleteProjectModal = null;
    this._selectedProjectId = null;// id the curren action is preformed on rename/delete
    
    this._setupData();
    this._buildModals();
    this._setupElementEvents();
    this._renderProjectSort();
    this._renderProjectList();

    const refresh = () => {
      this._renderProjectList();
    };

    this.subscribe('session:change:projectSortAction', ({value}) => this._renderProjectSort(value));
    this.subscribe('session:change:searchQuery', refresh);
    this.subscribe('session:change:activeProjectId', refresh);
    this.subscribe('state:change:projects', refresh);
    this.subscribe('state:change:projects:name', refresh);
  }

  onDestroy() {
    this._teardownDragAndDrop?.();
    [this._createProjectModal, this._renameProjectModal, this._deleteProjectModal]
      .forEach(m => m?.remove());
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
    // ── Search ───────────────────────────────────────────────────────────────
    this.element('search-input').addEventListener('input', event => {
      session.set('searchQuery', event.target.value);
    });

    // ── Sort ───────────────────────────────────────────────────────────────
    this.element('project-sort-container').addEventListener('click', event => {
      const target = event.target.closest('[data-sort-action]');
      if (!target)
        return;
    
      event.stopPropagation();
      let action = target.dataset.sortAction;
      if (!action)
        return;
    
      if(session.get('projectSortAction') === action) {
        switch (action) {
          case 'recent':
          case 'oldest':
            action = (action === 'recent') ? 'oldest' : 'recent';
            target.dataset.sortAction = action;
            target.title = action;
            target.innerHTML = this._getIcon(action);
            break;
          case 'order-az':
          case 'order-za':
            action = (action === 'order-az') ? 'order-za' : 'order-az';
            target.dataset.sortAction = action;
            target.title = action;
            target.innerHTML = this._getIcon(action);
            break;
        }
      }
    
      session.set('projectSortAction', action);
      this._renderProjectList();
    });

    // ── Project list event delegation ─────────────────────────────────────────────────
    this.element('project-list').addEventListener('click', event => {
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
        input.value = 'New project';
        input.focus();
        input.select();
      }
      openModal(this._createProjectModal);
    });
  }

  _selectProject(projectId) {
    session.set('activeProjectId', projectId);
  }

  _renderProjectSort(value) {
    const action = value ?? session.get('projectSortAction');
    const parent = this.element('project-sort-container');
    
    Array.from(parent.children).forEach(el =>  {
      if(el.dataset.sortAction === action)
        el.classList.add('active');
      else
        el.classList.remove('active');
    });
  }

  _renderProjectList() {
    const searchQuery = session.get('searchQuery');
    const list = this.element('project-list');
    const activeProjectID = session.get('activeProjectId');
    const projects = state.get('projects');

    const projectSortAction = session.get('projectSortAction');
    const canDrag = !projectSortAction || projectSortAction === 'none';

    if(canDrag) {
      this._setupProjectDragAndDrop(list);
    }  else {
      this._teardownDragAndDrop?.();
      this._teardownDragAndDrop = null;
    }

    if(!projects || projects.length <= 0) {
      this.element('project-item-count').textContent = '0 projects';
      list.innerHTML = '<div class="project-manager__list-empty">No projects available.</div>';
      return;
    }
    const sort = this._sortProjectList(projectSortAction, projects);

    let shownProjects = 0;
    let listHTML = '';
    sort.forEach(project => {
      if(searchQuery) {
        if(!projectMatchesSearch(project, searchQuery.toLowerCase()))
          return;
      }

      shownProjects++;
      listHTML += 
      `<div
        class="project-manager_element project-manager_element${project.id === activeProjectID ? '--active' : ''}"
        draggable="${canDrag}"
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

    this.element('project-item-count').textContent = 
      `${(shownProjects < projects.length) ? shownProjects + '/' + projects.length : projects.length} projects`;

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
        if (!isNameValid(value)) {
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
        eventBus.emit('save:request:projects');
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
        eventBus.emit('save:request:projects');
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
        if(!isNameValid(value)) {
          eventBus.emit('toast:show', { message: `Faild to create project, name has to be at least 3 Characters long`, type: 'error' });
          return;
        }

        const projects = state.get('projects');
        if(!projects)
          projects = [];

        projects.push(createProject(value));
        session.set('activeProjectId', projects[projects.length - 1].id);

        closeModal(this._createProjectModal);
        this._renderProjectList();
        eventBus.emit('save:request:projects');
        eventBus.emit('toast:show', { message: `Project ${value} created`, type: 'success' });
      }
    });

    addModalEnterAction(this._createProjectModal, { targetId: projectInputId });
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


  _sortProjectList(action, projects) {
    switch(action) {
      case 'recent':
        return projects.toSorted((a, b) => new Date(b.lastOpenedAt) - new Date(a.lastOpenedAt));
      case 'oldest':
        return projects.toSorted((a, b) => new Date(a.lastOpenedAt) - new Date(b.lastOpenedAt));
      case 'order-az':
        return projects.toSorted((a, b) => a.name.localeCompare(b.name));
      case 'order-za':
        return projects.toSorted((a, b) => b.name.localeCompare(a.name));
      case 'none':
      default:
        return projects;
    }
  }

  _getIcon(name) {
    switch (name) {
      case 'recent':
        return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6.5" cy="10" r="5" stroke="currentColor" stroke-width="1.25"/>
          <path d="M6.5 7.5v2.708l1.667 1.667" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16 5.5v9.5m0 0l2.5-2.5m-2.5 2.5l-2.5-2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case 'oldest':
        return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6.5" cy="10" r="5" stroke="currentColor" stroke-width="1.25"/>
          <path d="M6.5 7.5v2.708l1.667 1.667" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16 5.5v9.5m0-9.5l2.5 2.5m-2.5-2.5l-2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case 'order-az':
        return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 15.5l3.75-11l3.75 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4.3 12h4.791" stroke="currentColor" stroke-width="1.44"/>
          <path d="M15 5.5v9.5m0 0l2.5-2.5m-2.5 2.5l-2.5-2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case 'order-za':
        return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 15.5l3.75-11l3.75 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4.3 12h4.908" stroke="currentColor" stroke-width="1.46"/>
          <path d="M15 5.5v9.5m0-9.5l2.5 2.5m-2.5-2.5l-2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      default:
        return '';
    }
  }

}