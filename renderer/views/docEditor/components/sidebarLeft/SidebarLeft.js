import { buildStandardModal, buildDoneModal, openModal, closeModal, isModalOpen } from '@core/ModalBuilder.js';
import { Component } from '@core/Component.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js'
import { eventBus } from '@core/EventBus.js';
import { buildRenameModal, buildConfirmationDeleteModal } from '@common/BaseModals.js';
import { escapeHTML } from '@common/Common.js'
import {
  getActiveProject, getActiveTab,
  createNode, flattenNodes,
  findNodeContext, findNode,
  removeNodeById, removeTabById, findTab,
  createTab,
} from '@data/ProjectManager.js';
import { renderTree, setupDragAndDrop } from './helpers/TreeHelper.js';
import { TabManager } from './helpers/TabManagerHelper.js';

/**
 * SidebarLeft - tab selector and documentation tree.
 *
 * Responsibilities:
 *   - Tab selector dropdown (switch active tab)
 *   - Node tree rendering with collapse/expand
 *   - Node selection
 *   - Drag & drop reordering within the same level
 *   - Modals: Tab Manager, Rename (tabs & nodes), Delete confirm
 *   - Search filtering via session.searchQuery
 */
export default class SidebarLeft extends Component {

  onLoad() {
    session.set('searchQuery', '');

    this._teardownDragAndDrop = null;
    this._tabManager = null;

    this._buildModals();
    this._refreshTabSelector();
    this._refreshTree();

    // ── Tab selector ─────────────────────────────────────────────────────
    this.element('tab-selector').addEventListener('change', event => {
      session.set('activeTabId', event.target.value);
      session.set('activeNodeId', null);
    });

    this.element('tab-manager-button').addEventListener('click', () => {
      this._openTabManagerModal();
    });

    // ── Search ───────────────────────────────────────────────────────────────
    this.element('search-input').addEventListener('input', event => {
      session.set('searchQuery', event.target.value);
    });

    // ── Tree event delegation ─────────────────────────────────────────────────
    const treeContainer = this.element('tree-container');
    treeContainer.addEventListener('click', event => {
      if (event.detail >= 2)
        return;

      const target = event.target.closest('[data-action]');
      if (!target) 
        return;

      event.stopPropagation();
      const { action, nodeId } = target.dataset;
      if (!nodeId && action !== 'toggle') 
        return;

      switch (action) {
        case 'select':   this._selectNode(nodeId);         break;
        case 'toggle':   this._toggleNode(nodeId);         break;
        case 'add-child': this._openAddChildModal(nodeId); break;
        case 'rename':   this._openRenameNodeModal(nodeId); break;
        case 'delete':   this._confirmDeleteNode(nodeId);  break;
      }
    });

    treeContainer.addEventListener('dblclick', event => {
      const nodeEl = event.target.closest('.tree-node-element'); // ← das Node-Element
      if (!nodeEl) 
        return;

      event.stopPropagation();
      const data = nodeEl.closest('[data-node-id]');
      if (!data)
        return;
     
      this._toggleNode(data.dataset.nodeId);
    });

    // ── Add root entry ────────────────────────────────────────────────────────
    this.element('add-root-entry-button').addEventListener('click', () => {
      const tab = getActiveTab();
      if (!tab) { 
        eventBus.emit('toast:show', { message: 'No tab selected.', type: 'error' }); 
        return; 
      }

      this._openRenameModal('New entry', 'New Entry', newName => {
        const node = createNode(newName, `# ${newName}\n\n`);
        tab.nodes.push(node);
        state.set('projects', [...state.get('projects')]);
        session.set('activeNodeId', node.id);
        eventBus.emit('toast:show', { message: 'Entry created.', type: 'success' });
      });
    });

    // ── State subscriptions ───────────────────────────────────────────────────
    const refresh = () => { 
      this._refreshTabSelector(); 
      this._refreshTree();
    };

    this.subscribe('session:change:activeProjectId', refresh);
    this.subscribe('session:change:activeTabId',     refresh);
    this.subscribe('session:change:activeNodeId',    () => this._refreshTree());
    this.subscribe('session:change:searchQuery',     () => this._refreshTree());
    this.subscribe('session:change:collapsedNodes',  () => this._refreshTree());
    this.subscribe('state:change:projects',          refresh);
    this.subscribe('state:change:projects:tabs',     refresh);
    this.subscribe('state:change:projects:tabs:names', refresh);
    this.subscribe('state:change:projects:tabs:nodes', refresh);
    this.subscribe('state:change:projects:tabs:nodes:name', () => this._refreshTree());
  }

  onDestroy() {
    this._teardownDragAndDrop?.();
    this._tabManager?.destroy();
    [this._renameModal, this._deleteModal, this._tabManagerModal, this._tabCreationModal]
      .forEach(m => m?.remove());
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
        treeContainer.innerHTML = '<div class="projekt-manager-tree-empty">No project selected.</div>';
        return;
      }

      if(project.tabs.length <= 0) {
        treeContainer.innerHTML = '<div class="projekt-manager-tree-empty">No tab available.</div>';
        return;
      }
      
      state.set('activeTabId', project.tabs[0].id);
      tab = getActiveTab();
    }

    if (!tab) { 
      treeContainer.innerHTML = '<div class="projekt-manager-tree-empty">content not available.</div>';
      return;
    }

    let activeNodeId = session.get('activeNodeId');
    if (!activeNodeId && tab.nodes.length > 0) {
      activeNodeId = tab.nodes[0].id;
      session.set('activeNodeId', activeNodeId);
    }

    treeContainer.innerHTML = renderTree(tab.nodes, {
      activeNodeId: activeNodeId,
      collapsedNodes: session.get('collapsedNodes'),
      searchQuery: session.get('searchQuery').toLowerCase(),
      componentInstanceId: this.instanceId,
    });

    this._teardownDragAndDrop = setupDragAndDrop(treeContainer, (from, to, fromId, toId) => {
      this._reorderNodes(fromId, toId);
    });
  }

  _selectNode(nodeId) {
    session.set('activeNodeId', nodeId);
  }

  _toggleNode(nodeId) {
    const collapsed = { ...session.get('collapsedNodes') };
    collapsed[nodeId] = !collapsed[nodeId];
    session.set('collapsedNodes', collapsed);
  }

  _reorderNodes(draggedId, targetId) {
    const tab = getActiveTab();
    if (!tab) 
      return;

    const draggedCtx = findNodeContext(draggedId, tab.nodes);
    const targetCtx  = findNodeContext(targetId,  tab.nodes);
    if (!draggedCtx || !targetCtx) 
      return;

    const dragParent = draggedCtx.parentNode;
    const tarParent = targetCtx.parentNode;

    let fromList = null;
    let toList = null;

    if(dragParent && tarParent && 
      dragParent === tarParent) {
      fromList = dragParent.children;
      toList = dragParent.children;
    } else {
      fromList = (dragParent) ? dragParent.children : tab.nodes;
      toList = (tarParent) ? tarParent.children : tab.nodes;
    }

    if(!fromList || !toList)
      return;

    const from = fromList.findIndex(n => n.id === draggedId);
    const to = toList.findIndex(n => n.id === targetId);

    if (from < 0 || to < 0)
      return;

    const [remove] = fromList.splice(from, 1);
    toList.splice(to, 0, remove);

    // emits the change event of project
    state.set('projects', [...state.get('projects')]);
  }

  // ─── Tab Selector ────────────────────────────────────────────────────

  _refreshTabSelector() {
    const selector = this.element('tab-selector');
    const project = getActiveProject();
    const activeTabID = session.get('activeTabId');
    
    if(!project)
      return;

    selector.innerHTML = project.tabs
      .map(t => `<option value="${t.id}"${t.id === activeTabID ? ' selected' : ''}>${escapeHTML(t.name)}</option>`)
      .join('');
  }

  // ─── Modals ───────────────────────────────────────────────────────────────

  _buildModals() {
    // Shared rename modal (used for tabs and nodes)
    this._renameModal = buildRenameModal(this.elementId('rename-modal'), {
      inputId: this.elementId('rename-input'),
      title: 'Rename',
      placeholder: 'New name...',
      zIndex: '1001',
      onPrimary: () => {
        const input = this._renameModal.querySelector('[data-role="rename-input"]');
        const value = input.value.trim();
        if (!value)
          return;

        closeModal(this._renameModal);
        this._renameCallback?.(value);
        this._renameCallback = null;
      },
    });

    // Shared delete modal (used for tabs and nodes)
    this._deleteModal = buildConfirmationDeleteModal(this.elementId('delete-modal'), {
      title: 'Delete',
      message: 'Are you sure you want to delete this item?',
      zIndex: '1001',
      onConfirm: () => {
        this._deleteCallback?.();
        this._deleteCallback = null;
        closeModal(this._deleteModal);
      }
    });

    // Tab creation modal
    const tabInputId = this.elementId('tab-creation-input');
    this._tabCreationModal = buildStandardModal(this.elementId('tab-creation-modal'), {
      title: 'Create tab',
      bodyHTML: 
      `<div class="form-group">
        <label class="form-label" for="${tabInputId}">Name</label>
        <input type="text" class="form-input" id="${tabInputId}" autocomplete="off" placeholder="Tab name...">
      </div>`,
      primaryLabel: 'Create',
      secondaryLabel: 'Cancel',
      onPrimary: () => {
        const value = document.getElementById(tabInputId).value.trim();
        const project = getActiveProject();
        if (!value || !project)
          return;

        createTab(project, value);
        closeModal(this._tabCreationModal);
        this._tabManager?.render();
        this._refreshTabSelector();
        eventBus.emit('toast:show', { message: `Tab '${value}' created.`, type: 'success' });
      }
    });

    document.getElementById(tabInputId)?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && isModalOpen(this._tabCreationModal)) this._tabCreationModal.querySelector('[data-modal-primary]')?.click();
    });
    this._tabCreationModal.style.zIndex = '1001';

    // Tab manager
    const contentId = this.elementId('tab-manager-content');
    const createBtnId = this.elementId('tab-manager-create-btn');
 
    this._tabManagerModal = buildDoneModal(this.elementId('tab-manager-modal'), {
      title: 'Tab manager',
      bodyHTML: `
        <div class="projekt-manager-tab-element_header">
          <button id="${createBtnId}" class="icon-button icon-button--small" title="Create Tab" aria-label="Create a tab">+</button>
        </div>
        <div id="${contentId}"></div>`,
      wide: true,
      doneCallback: () => { eventBus.emit('save:request:projects'); },
    });
 
    document.getElementById(createBtnId)?.addEventListener('click', () => {
      const el = document.getElementById(tabInputId);
      if (el) { 
        el.value = ''; 
        el.focus(); 
      }
      openModal(this._tabCreationModal);
    });
 
    // Create TabManager once the container exists in the DOM
    const contentEl = document.getElementById(contentId);
    if (contentEl) {
      this._tabManager = new TabManager(contentEl, {
        onRenameTab: (tabId) => this._openRenameTabModal(tabId),
        onDeleteTab: (tabId) => {
          const tab = findTab(tabId);
          if (!tab) 
            return;

          this._openDeleteConfirmationModal(
            `Delete tab '${escapeHTML(tab.name)}'?`,
            `Are you sure you want to delete '${escapeHTML(tab.name)}'?`,
            () => {
              const project = getActiveProject();
              if (!project) 
                return;

              removeTabById(tabId, project);
              this._tabManager.render();
              this._refreshTabSelector();
            }
          );
        }
      });
    }
  }

  _openRenameModal(modalTitle, defaultValue, callback) {
    const titleEl = this._renameModal.querySelector('.modal__title');
    const inputEl = document.getElementById(this.elementId('rename-input'));
    
    if (titleEl) 
      titleEl.textContent = modalTitle;
    if (inputEl) {
      inputEl.value = defaultValue ?? '';
      inputEl.focus();
      inputEl.select();
    }
    this._renameCallback = callback;

    openModal(this._renameModal);
    setTimeout(() => { inputEl?.focus(); inputEl?.select(); }, 80);
  }

  _openDeleteConfirmationModal(title, message, callback) {
    const titleEl = this._deleteModal.querySelector('.modal__title');
    if (titleEl)
      titleEl.textContent = title;

    const messageEl = this._deleteModal.querySelector('.modal__confirm-message');
    if (messageEl)
      messageEl.textContent = message;

    this._deleteCallback = callback;
    openModal(this._deleteModal);
  }

  _openTabManagerModal() {
    this._tabManager?.render();
    openModal(this._tabManagerModal);
  }

  _openAddChildModal(parentNodeId) {
    this._openRenameModal('New child entry', 'New Entry', newName => {
      const tab = getActiveTab();
      const parentNode = findNode(parentNodeId);
      if (!tab || !parentNode) 
        return;
      
      const newNode = createNode(newName, `# ${newName}\n\n`);
      parentNode.children.push(newNode);

      const collapsed = { ...session.get('collapsedNodes'), [parentNodeId]: false };
      session.set('collapsedNodes', collapsed);
      state.set('projects', [...state.get('projects')]);
      session.set('activeNodeId', newNode.id);
      eventBus.emit('toast:show', { message: 'Child entry created.', type: 'success' });
    });
  }

  _openRenameNodeModal(nodeID) {
    const node = findNode(nodeID);
    if (!node)
      return;
    this._openRenameModal('Rename entry', node.name, newName => {
      const project = getActiveProject();
      const prevProject = {...project};
      
      node.name = newName;
      state.notify('projects', { value: project, previousValue: prevProject}, 'tabs:nodes:name');
      eventBus.emit('toast:show', { message: 'Entry renamed.', type: 'success' });
    });
  }

  _openRenameTabModal(tabID) {
    const tab = findTab(tabID);
    if(!tab)
      return;
    this._openRenameModal('Rename tab', tab.name, newName => {
      const project = getActiveProject();
      const preProject = [...project];

      tab.name = newName;
      state.notify('projects', { value: project, previousValue: preProject }, 'tabs:name');
      this._tabManager?.render();
      eventBus.emit('toast:show', { message: 'Tab renamed.', type: 'success' });
    });
  }

  _confirmDeleteNode(nodeId) {
    const node = findNode(nodeId);
    if (!node) 
      return;

    this._openDeleteConfirmationModal(
      `Delete entry '${escapeHTML(node.name)}'?`, 
      `Are you sure you want to delete this entry '${escapeHTML(node.name)}' and all children?`, 
      () => {
        const tab = getActiveTab();
        if (!tab)
          return;

        removeNodeById(nodeId, tab.nodes);
        const activeNodeID = session.get('activeNodeId');
        if (activeNodeID === nodeId || !findNode(activeNodeID)) {
          session.set('activeNodeId', null);
        }
        state.set('projects', [...state.get('projects')]);
        eventBus.emit('toast:show', { message: 'Entry deleted.', type: 'success' });
      }
    );
  }
} 