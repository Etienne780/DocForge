import { Component } from '@core/Component.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { ResizeController } from '@core/ResizeController';
import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { DragDropHelper } from '@common/DragDropHelper.js';
import { setCheckBox, setCheckboxDisabled, isCheckedBoxActive } from '@common/UIUtils.js';
import { buildRenameModal, buildConfirmationDeleteModal } from '@common/BaseModals.js';
import { escapeHTML, isNameValid, sortBy, SORT_ACTION_MAP } from '@common/Common.js'
import { createProject, findProject, removeProjectById, projectMatchesSearch } from '@data/ProjectManager.js';
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
    this._renameProjectModal = null;
    this._deleteProjectModal = null;
    this._selectedProjectId = null;// id the curren action is preformed on rename/delete
    this._pendingImportObj = null;
    this._resize = new ResizeController(this.container, { 
      initialSize: 200,
      minSize: 150,
      maxSize: 500,
      keepRatio: false,
      direction: 'right',
    });

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
    this._resize.destroy();
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
        case 'open':    openProject(projectId); break;
        case 'rename':  this._openRenameProjectModal(projectId); break;
        case 'delete':  this._openConfirmDeleteProjectModal(projectId); break;
      }
    });

    this.element('add-project-button').addEventListener('click', (e) => {
      eventBus.emit('show:modal:createProject');
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
          <button class="action-button" data-project-id="${project.id}" data-action="open" title="Open">
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
              <g transform="translate(0,-30)">
                <path d="m 35.5,471.5 c 21,133 42,266 63,399 7.45,47.18 59.137,85.5 115.35,85.5 h 594.3 c 56.221,0 95.798,-38.33 88.35,-85.5 -21,-133 -42,-266 -63,-399 C 826.05,424.32 774.363,386 718.15,386 h -594.3 c -56.221,0 -95.798,38.33 -88.35,85.5 z"/>
                <path d="m 242.33414,954.51928 c -42.19226,-7.65564 -75.46591,-41.14367 -82.86637,-83.40027 -2.20957,-12.61667 -2.20957,-496.62135 0,-509.23802 7.45675,-42.57802 40.8352,-75.95647 83.41322,-83.41322 C 249.95759,277.22844 271.28686,277 379.92616,277 h 128.66419 l 9.93506,-2.5822 c 5.46429,-1.42021 13.30556,-4.22572 17.42505,-6.23447 4.11949,-2.00875 28.65338,-18.60788 54.51976,-36.88695 26.74374,-18.89907 48.93983,-33.89499 51.45792,-34.76552 6.66375,-2.30374 203.83114,-2.29164 218.04439,0.0134 41.68401,6.76004 76.2802,35.99691 89.87901,75.95576 6.53137,19.19184 6.14001,-0.49708 6.14444,309.11901 0.003,242.67966 -0.19668,282.265 -1.46375,289.5 -7.45675,42.57802 -40.8352,75.95647 -83.41322,83.41322 -7.25343,1.2703 -49.63303,1.45563 -315,1.37752 -246.96184,-0.0727 -308.01323,-0.34323 -313.78487,-1.39047 z m 628.90741,-63.6421 c 18.36941,-7.14666 29.75737,-18.78267 35.96841,-36.75186 L 909.5,847.5 v -254 -254 l -2.26141,-8.87699 C 898.11576,294.81202 872.2228,269.26029 835,259.33643 c -5.87718,-1.5669 -14.93202,-1.76871 -94.5,-2.1062 -63.07511,-0.26753 -89.47333,-0.0525 -93.20175,0.75918 -4.36559,0.95039 -11.68224,5.66375 -45.51639,29.32151 -40.83179,28.5507 -46.84085,32.23623 -58.68489,35.99314 -6.52851,2.07084 -8.06018,2.09828 -147.59697,2.64425 l -141,0.55169 -5.93216,2.23834 c -13.99596,5.28099 -26.71624,16.50075 -32.53847,28.70011 -6.44805,13.51068 -6.08001,-2.74484 -5.7917,255.80671 L 210.5,848.5 l 2.57854,6.61957 c 5.25571,13.49234 12.09023,22.3934 22.27564,29.0111 6.20196,4.02955 14.53137,7.51647 21.14582,8.85221 2.2,0.44427 139.9,0.74237 306,0.66245 L 864.5,893.5 Z"/>
              </g>
            </svg>
          </button>
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
        if (!isNameValid(value, 'PROJECT')) {
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
      validationType: 'PROJECT'
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

  _openRenameProjectModal(projectId) {
    this._selectedProjectId = projectId;

    const input = this._renameProjectModal.querySelector('[data-role="rename-input"]');
    if(input) {
      const p = findProject(projectId);

      input.value = p.name ?? '';
      input.focus();
      input.select();
    }

    const error = this._renameProjectModal.querySelector('[data-role="error-msg"]');
    if(error) {
      error.classList.add('invisible');
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