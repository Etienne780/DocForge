import { Component } from '@core/Component.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { pickImportFile } from '@core/Platform.js';
import { FILE_EXTENSION_PROJECT } from '@core/AppMeta.js';
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { DragDropHelper } from '@common/DragDropHelper.js';
import { importProject } from '@common/ImportHelper.js';
import { buildRenameModal, buildConfirmationDeleteModal } from '@common/BaseModals.js';
import { escapeHTML, isNameValid, sortBy, SORT_ACTION_MAP } from '@common/Common.js'
import { createProject, findProject, removeProjectById, projectMatchesSearch, addProject } from '@data/ProjectManager.js';
import { openProject } from '../helpers/ProjektHelper.js';


/**
 * SidebarLeft - project selector.
 *
 * Responsibilities:
 *   - Project selector list
 *   - Drag & drop reordering within the same level
 *   - Modals: Rename projects, Delete confirm
 *   - Search filtering via session.projectSearchQuery
 */
export default class SidebarLeft extends Component {

  async onLoad() {
    this._teardownDragAndDrop = null;
    this._createProjectModal = null;
    this._renameProjectModal = null;
    this._deleteProjectModal = null;
    this._selectedProjectId = null;// id the curren action is preformed on rename/delete
  
    const instances = await Promise.all([
      componentLoader.load(
        'SortingActions',
        this.element('project-sort-container'),
        { target: 'projectSortAction', type: 'state' }
      ),
      componentLoader.load(
        'Searchbar', 
        this.element('project-search'),
        { target: 'projectSearchQuery', type: 'session', placeholder: 'Search project ...' },
      ),
    ]);

    this._instanceIds = instances.map(i => i.instanceId);

    this._setupData();
    this._buildModals();
    this._setupElementEvents();
    this._renderProjectList();

    const refresh = () => {
      this._renderProjectList();
    };

    this.subscribe('session:change:projectSearchQuery', refresh);
    this.subscribe('session:change:activeProjectId', refresh);
    this.subscribe('state:change:projectSortAction', refresh);
    this.subscribe('state:change:projects', refresh);
    this.subscribe('state:change:projects:name', refresh);
  }

  onDestroy() {
    this._instanceIds.forEach(id => componentLoader.destroy(id) );
    this._teardownDragAndDrop?.();
    [this._createProjectModal, this._renameProjectModal, this._deleteProjectModal]
      .forEach(m => m?.remove());
  }

  _setupData() {
    // select first project if no project is selected
    if(!session.get('activeProjectId'))  {
      const projects = state.get('projects');
      if(projects && projects.length > 0) 
        session.set('activeProjectId', projects[0].id);
    }
  }

  _setupElementEvents() {
    // ── Project list event delegation ─────────────────────────────────────────────────
    this.element('project-list').addEventListener('click', event => {
      const target = event.target.closest('[data-action]');
      if (!target) 
        return;

      event.stopPropagation();
      const { action, projectId } = target.dataset;
      if (!projectId) 
        return;

      if (event.detail >= 2) {
        openProject(projectId);
        return;
      }

      switch (action) {
        case 'select':  this._selectProject(projectId); break;
        case 'rename':  this._openRenameProjectModal(projectId); break;
        case 'delete':  this._openConfirmDeleteProjectModal(projectId); break;
      }
    });

    this.element('add-project-button').addEventListener('click', (e) => {
      const input = this.globalElement('project-creation-input', this._createProjectModal);
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

  _renderProjectList() {
    const searchQuery = session.get('projectSearchQuery');
    const list = this.element('project-list');
    const activeProjectID = session.get('activeProjectId');
    const projects = state.get('projects');

    const projectSortAction = state.get('projectSortAction');
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
    const sort = this._sortProjectList(projects, projectSortAction);

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
    if (!projects)
      projects = [];
  
    const from = projects.findIndex(n => n.id === draggedId);
    if (from < 0)
      return;
  
    const [removed] = projects.splice(from, 1);
  
    if (!targetId) {
      projects.push(removed);
    } else {
      const to = projects.findIndex(n => n.id === targetId);
      if (to < 0) {
        projects.push(removed);
      } else {
        projects.splice(to, 0, removed);
      }
    }
  
    state.set('projects', [...projects]);
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
        const toastErrorPayload = { message: 'Failed to rename project', type: 'error'};
        if(!this._selectedProjectId) {
          eventBus.emit('toast:show', toastErrorPayload);
          return;
        }

        const input = this._renameProjectModal.querySelector('[data-role="rename-input"]');
        const value = input.value.trim();
        if (!isNameValid(value)) {
          this._selectedProjectId = null;
          eventBus.emit('toast:show', { message: `Failed to rename project, name has to be at least 3 Characters long`, type: 'error' });
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
        const toastErrorPayload = { message: 'Failed to delete project', type: 'error'};
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
        <div class="form-top-row flex-end"><button class="button button--secondary no-outer-space" data-action-import>Import</button></div>
      </div>`,
      primaryLabel: 'Create',
      onPrimary: () => {
        const value = document.getElementById(projectInputId).value.trim();
        if(!isNameValid(value)) {
          eventBus.emit('toast:show', { message: `Failed to create project, name has to be at least 3 Characters long`, type: 'error' });
          return;
        }

        const project = createProject(value);
        addProject(project);
        session.set('activeProjectId', project.id);

        closeModal(this._createProjectModal);
        this._renderProjectList();
        eventBus.emit('save:request:projects');
        eventBus.emit('toast:show', { message: `Project ${value} created`, type: 'success' });
      }
    });

    this._createProjectModal.querySelector('[data-action-import]').addEventListener('click', async (e) => {
      try {
        const result = await pickImportFile();
        if (result.canceled) {
          const msg = 'import was canceled';
          eventBus.emit('toast:show', { message: msg, type: 'info' });
          return;
        }
      
        const ext = result.extension?.startsWith('.')
          ? result.extension.toLowerCase()
          : `.${result.extension}`.toLowerCase();
      
        if (ext !== FILE_EXTENSION_PROJECT.toLowerCase()) {
          const msg = `Failed to import project: invalid extension '${result.extension}'`;
          eventBus.emit('toast:show', { message: msg, type: 'error' });
          return;
        }
      
        let obj;
        try {
          obj = JSON.parse(result.data);
        } catch (e) {
          eventBus.emit('toast:show', {
            message: 'Failed to import project: invalid JSON file',
            type: 'error'
          });
          return;
        }
      
        addProject(importProject(obj));
        eventBus.emit('save:request');
        closeModal(this._createProjectModal);
      } catch(error) {
        const msg = `Failed to import project: ${error}`;
        eventBus.emit('toast:show', { message: msg, type: 'error' });
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


  _sortProjectList(projects, action) {
    const config = SORT_ACTION_MAP[action];
    return config ? sortBy(projects, config) : projects;
  }

}