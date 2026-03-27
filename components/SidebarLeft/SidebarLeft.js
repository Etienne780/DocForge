import { buildStandardModal, buildDoneModal, openModal, closeModal } from '../../core/ModalBuilder.js';
import { Component } from '../../core/Component.js';
import { state } from '../../core/State.js';
import { eventBus } from '../../core/EventBus.js';
import {
  getActiveProject, getActiveTab,
  createNode, createProject, deepClone, generateId,
  findNodeContext, findNode, getNodePath,
  removeNodeById, findNode as findNodeById,
} from '../../data/ProjectManager.js';
import { renderTree, setupDragAndDrop } from './helpers/TreeHelper.js';

/**
 * SidebarLeft — project selector and documentation tree.
 *
 * Responsibilities:
 *   - Project selector dropdown (switch active project)
 *   - Node tree rendering with collapse/expand
 *   - Node selection
 *   - Drag & drop reordering within the same level
 *   - Modals: New Project, Project Manager, Rename (projects & nodes), Delete confirm
 *   - Search filtering via state.searchQuery
 */
export default class SidebarLeft extends Component {

  onLoad() {
    this._buildModals();
    this._teardownDragAndDrop = null;

    this._refreshTabSelector();
    this._refreshTree();

    // ── Tab selector ─────────────────────────────────────────────────────
    this.element('tab-selector').addEventListener('change', event => {
      state.set('activeTabID', event.target.value);
      state.set('activeNodeId', null);
    });

    this.element('tab-manager-button').addEventListener('click', () => {
      this._openTabManagerModal();
    });

    // ── Search ───────────────────────────────────────────────────────────────
    this.element('search-input').addEventListener('input', event => {
      state.set('searchQuery', event.target.value);
    });

    // ── Tree event delegation ─────────────────────────────────────────────────
    this.element('tree-container').addEventListener('click', event => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      event.stopPropagation();

      const { action, nodeId } = target.dataset;
      if (!nodeId && action !== 'toggle') return;

      switch (action) {
        case 'select':   this._selectNode(nodeId);         break;
        case 'toggle':   this._toggleNode(nodeId);         break;
        case 'add-child': this._openAddChildModal(nodeId); break;
        case 'rename':   this._openRenameNodeModal(nodeId); break;
        case 'delete':   this._confirmDeleteNode(nodeId);  break;
      }
    });

    // ── Add root entry ────────────────────────────────────────────────────────
    this.element('add-root-entry-button').addEventListener('click', () => {
      const tab = getActiveTab();
      if (!tab) { 
        eventBus.emit('toast:show', { message: 'Create a project first.', type: 'error' }); 
        return; 
      }

      this._openRenameModal('New entry', 'New Entry', newName => {
        const node = createNode(newName, `# ${newName}\n\n`);
        tab.nodes.push(node);
        state.set('projects', [...state.get('projects')]);
        state.set('activeNodeId', node.id);
        eventBus.emit('toast:show', { message: 'Entry created.', type: 'success' });
      });
    });

    // ── State subscriptions ───────────────────────────────────────────────────
    const refresh = () => { 
      this._refreshTabSelector(); 
      this._refreshTree(); 
    };
    
    this.subscribe('state:change:activeProjectId', refresh);
    this.subscribe('state:change:activeTab',       () => this._refreshTree());
    this.subscribe('state:change:activeNodeId',    () => this._refreshTree());
    this.subscribe('state:change:searchQuery',     () => this._refreshTree());
    this.subscribe('state:change:collapsedNodes',  () => this._refreshTree());
    this.subscribe('state:change:projects',        refresh);
  }

  onDestroy() {
    this._teardownDragAndDrop?.();
    [this._renameModal, this._newProjectModal, this._projectManagerModal].forEach(m => m?.remove());
  }

  // ─── Tree ─────────────────────────────────────────────────────────────────

  _refreshTree() {
    const treeContainer = this.element('tree-container');
    let tab = getActiveTab();

    this._teardownDragAndDrop?.();
    this._teardownDragAndDrop = null;

    if (!tab) {
      const project = getActiveProject();

      if(!project) {
        treeContainer.innerHTML = '<div class="tree-empty">No project selected.</div>';
        return;
      }

      if(project.tabs.length <= 0) {
        treeContainer.innerHTML = '<div class="tree-empty">No tab available.</div>';
        return;
      }
      
      state.set('activeTabID', project.tabs[0].id);
      tab = getActiveTab();
    }

    if (!tab) { 
      treeContainer.innerHTML = '<div class="tree-empty">content not available.</div>';
      return;
    }

    let activeNodeId = state.get('activeNodeId');
    if (!activeNodeId && tab.nodes.length > 0) {
      activeNodeId = tab.nodes[0].id;
      state.set('activeNodeId', activeNodeId);
    }

    treeContainer.innerHTML = renderTree(tab.nodes, {
      activeNodeId: activeNodeId,
      collapsedNodes: state.get('collapsedNodes'),
      searchQuery: state.get('searchQuery').toLowerCase(),
      componentInstanceId: this.instanceId,
    });

    this._teardownDragAndDrop = setupDragAndDrop(treeContainer, (draggedId, targetId) => {
      this._reorderNodes(draggedId, targetId);
    });
  }

  _selectNode(nodeId) {
    state.set('activeNodeId', nodeId);
  }

  _toggleNode(nodeId) {
    const collapsed = { ...state.get('collapsedNodes') };
    collapsed[nodeId] = !collapsed[nodeId];
    state.set('collapsedNodes', collapsed);
  }

  _reorderNodes(draggedId, targetId) {
    const tab = getActiveTab();
    if (!tab) 
      return;

    const draggedCtx = findNodeContext(draggedId, tab.nodes);
    const targetCtx  = findNodeContext(targetId,  tab.nodes);
    if (!draggedCtx || !targetCtx) 
      return;
    if (draggedCtx.siblings !== targetCtx.siblings) 
      return; // only within same level

    const siblings = draggedCtx.siblings;
    const fromIndex = siblings.findIndex(n => n.id === draggedId);
    const toIndex   = siblings.findIndex(n => n.id === targetId);
    if (fromIndex < 0 || toIndex < 0) 
      return;

    const [removed] = siblings.splice(fromIndex, 1);
    siblings.splice(toIndex, 0, removed);

    state.set('projects', [...state.get('projects')]);
  }

  // ─── Tab Selector ────────────────────────────────────────────────────

  _refreshTabSelector() {
    const selector = this.element('tab-selector');
    const project = getActiveProject();
    const activeTabID = state.get('activeTabID');
    
    if(!project)
      return;

    selector.innerHTML = project.tabs
      .map(t => `<option value="${t.id}"${t.id === activeTabID ? ' selected' : ''}>${escapeHTML(t.name)}</option>`)
      .join('');
  }

  // ─── Modals ───────────────────────────────────────────────────────────────

  _buildModals() {
    // Shared rename modal (used for projects and nodes)
    this._renameModal = buildStandardModal(this.elementId('rename-modal'), {
      title: 'Rename',
      bodyHTML: `
      <div class="form-group">
        <label class="form-label" for="${this.elementId('rename-input')}">Name</label>
        <input type="text" class="form-input" id="${this.elementId('rename-input')}" autocomplete="off">
      </div>`,
      primaryLabel:   'Save',
      secondaryLabel: 'Cancel',
      onPrimary: () => {
        const value = document.getElementById(this.elementId('rename-input')).value.trim();
        if (!value) return;
        closeModal(this._renameModal);
        this._renameCallback?.(value);
        this._renameCallback = null;
      },
    });

    document.getElementById(this.elementId('rename-input'))?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._renameModal.querySelector('[data-modal-primary]')?.click();
    });

    // Tab manager modal
    this._tabManagerModal = buildDoneModal(this.elementId('tab-manager-modal'), {
      title: 'Tab manager',
      bodyHTML: `<div id="${this.elementId('tab-manager-content')}"></div>`,
      wide: true,
    });
  }

  _openRenameModal(modalTitle, defaultValue, callback) {
    const titleEl = this._renameModal.querySelector('.modal__title');
    const inputEl = document.getElementById(this.elementId('rename-input'));
    if (titleEl) titleEl.textContent = modalTitle;
    if (inputEl) { inputEl.value = defaultValue; }
    this._renameCallback = callback;
    openModal(this._renameModal);
    setTimeout(() => { inputEl?.focus(); inputEl?.select(); }, 80);
  }

  _openTabManagerModal() {
    this._populateTabManager();
    openModal(this._tabManagerModal);
  }

  _openAddChildModal(parentNodeId) {
    this._openRenameModal('New child entry', 'New Entry', newName => {
      const tab = getActiveTab();
      if (!tab) 
        return;
      
      const parentNode = findNode(parentNodeId);
      if (!parentNode) 
        return;
      
      const newNode = createNode(newName, `# ${newName}\n\n`);
      parentNode.children.push(newNode);

      const collapsed = { ...state.get('collapsedNodes'), [parentNodeId]: false };
      state.set('collapsedNodes', collapsed);
      state.set('projects', [...state.get('projects')]);
      state.set('activeNodeId', newNode.id);
      eventBus.emit('toast:show', { message: 'Child entry created.', type: 'success' });
    });
  }

  _openRenameNodeModal(nodeId) {
    const node = findNode(nodeId);
    if (!node) return;
    this._openRenameModal('Rename entry', node.name, newName => {
      node.name = newName;
      state.set('projects', [...state.get('projects')]);
      eventBus.emit('toast:show', { message: 'Entry renamed.', type: 'success' });
    });
  }
  
  _confirmDeleteNode(nodeId) {
    if (!confirm('Delete this entry and all its children?')) return;
    const tab = getActiveTab();
    if (!tab)
      return;
    removeNodeById(nodeId, tab.nodes);
    if (state.get('activeNodeId') === nodeId || !findNode(state.get('activeNodeId'))) {
      state.set('activeNodeId', null);
    }
    state.set('projects', [...state.get('projects')]);
    eventBus.emit('toast:show', { message: 'Entry deleted.', type: 'success' });
  }

  _populateTabManager()  {
    const activeProject = getActiveProject();
    const activeTabID = state.get('activeTabID');
    let content = document.getElementById(this.elementId('tab-manager-content'));
    if (!activeProject || !content)
      return;
    
    let htmlTabs = '';
    activeProject.tabs.forEach((t) => {
      if (!t)
        return;

      const active = (t.id === activeTabID);
      htmlTabs += 
      `<div class="tab-element tab-element__name ${(active) ? ' tab-element--active'  : ''}">
        <div style="padding: var(--spacing-xs); margin-right: var(--spacing-xs); border-right: 2px solid var(${(active ? '--accent-color' : '--border-color')});">
          <div class="tab-element_handle">||</div>
        </div>
        <span>${t.name}</span>
      </div>
      `;
    });
    
    const noTabs = !htmlTabs;
    if (noTabs) {
      htmlTabs += 'No tabs available';
    }

    content.innerHTML = `
    <div class="tab-element_header">
      <button class="icon-button icon-button--small" title="Create Tab" aria-label="Create a tab">+</button>
    </div>
    <div class="tab-element__name ${(noTabs) ? 'tab-element_scroll-no_tabs' : 'tab-element_scroll'}">
      ${htmlTabs}
    </div>
    `;
  }

  _createProject(name) {
    const newProject = createProject(name);
    const projects = [...state.get('projects'), newProject];
    state.set('projects', projects);
    state.set('activeProjectId', newProject.id);
    state.set('activeNodeId', null);
    eventBus.emit('toast:show', { message: `Project "${name}" created.`, type: 'success' });
  }
}

function escapeHTML(string) {
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}