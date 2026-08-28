import { buildStandardModal, buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { Component } from '@core/Component.js';
import { session } from '@core/SessionState.js'
import { eventBus } from '@core/EventBus.js';
import { ResizeController } from '@core/ResizeController';
import { buildRenameModal, buildConfirmationDeleteModal } from '@common/BaseModals.js';
import { escapeHTML, debounce } from '@common/Common.js'
import {
  getActiveTab,
  createNode,
  findNodeContext, findNode,
  removeNodeById, removeTabById, findTab,
  createTab, notifyOpenProjectChange,
  renameNodeById, renameTabById,
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
 *   - Drag & drop reordering + reparenting within the same tab
 *   - Modals: Tab Manager, Rename (tabs & nodes), Delete confirm
 *   - Search filtering via session.projectTreeSearchQuery
 */
export default class SidebarLeft extends Component {

  onLoad() {
    this._activeProject = this.props.project;

    session.set('projectTreeSearchQuery', '');

    this._teardownDragAndDrop = null;
    this._tabManager = null;
    this._resize = new ResizeController(this.container, {
      initialSize: 200,
      minSize: 150,
      maxSize: 500,
      keepRatio: false,
      direction: 'right',
    });

    this._buildModals();
    this._setupElementEvents();

    this._refreshTabSelector();
    this._refreshTree();

    // ── State subscriptions ───────────────────────────────────────────────────
    const refresh = () => {
      this._ensureActiveTab();
      this._refreshTabSelector();
      this._refreshTree();
    };

    // Actual project switch → reset selection, then refresh everything
    this.subscribe('session:change:openProject', ({ value, previousValue }) => {
      if (value?.id !== previousValue?.id) {
        session.set('activeTabId', null);
        session.set('activeNodeId', null);
      }
      refresh();
    });

    // Mutations of the currently open projects tabs/nodes
    this.subscribe('session:change:openProject:tabs',              refresh);
    this.subscribe('session:change:openProject:tabs:name', () => {
      this._refreshTabSelector();
      this._tabManager?.render();
    });
    this.subscribe('session:change:openProject:tabs:nodes',         refresh);
    this.subscribe('session:change:openProject:tabs:nodes:name',    () => this._refreshTree());

    this.subscribe('session:change:activeTabId',              refresh);
    this.subscribe('session:change:activeNodeId',             () => this._refreshTree());
    this.subscribe('session:change:projectTreeSearchQuery',   () => this._refreshTree());
    this.subscribe('session:change:collapsedNodes',           () => this._refreshTree());
  }

  onDestroy() {
    this._resize.destroy();
    this._teardownDragAndDrop?.();
    this._tabManager?.destroy();
    [this._renameModal, this._deleteModal, this._tabManagerModal, this._tabCreationModal]
      .forEach(m => m?.remove());
  }

  _setupElementEvents() {
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
      session.set('projectTreeSearchQuery', event.target.value);
    });

    // ── Tree event delegation ─────────────────────────────────────────────────
    const treeContainer = this.element('tree-container');
    const handleSelectNode = debounce(
      (nodeId) => {
        this._selectNode(nodeId)
      }, 200
    );

    treeContainer.addEventListener('click', event => {
      if (event.detail >= 2)
        return;

      const target = event.target.closest('[data-action]');
      if (!target)
        return;

      event.stopPropagation();
      const { action, nodeId } = target.dataset;
      if (!nodeId)
        return;

      switch (action) {
        case 'select': handleSelectNode(nodeId); break;
        case 'toggle': this._toggleNode(nodeId); break;
        case 'add-child': this._createNode({ parentId: nodeId }); break;
        case 'rename': this._openRenameNodeModal(nodeId); break;
        case 'delete': this._confirmDeleteNode(nodeId); break;
      }
    });

    treeContainer.addEventListener('dblclick', event => {
      handleSelectNode.cancel();
      // Do not toggle when double-clicking an action button that is not select.
      const actionTarget = event.target.closest('[data-action]');
      if (!actionTarget)
        return;
    
      const { action, nodeId } = actionTarget.dataset;
      if (!nodeId || action !== 'select')
        return;
    
      event.stopPropagation();
      this._toggleNode(nodeId);
    });

    // ── Add root entry ────────────────────────────────────────────────────────
    this.element('add-root-entry-button').addEventListener('click', () => {
      if (!getActiveTab()) {
        eventBus.emit('toast:show', { message: 'No tab selected.', type: 'error' });
        return;
      }
      this._createNode({ parentId: null });
    });
  }

  _ensureActiveTab() {
    const project = this._activeProject;
    if (!project || project.tabs.length === 0)
      return;

    const activeId = session.get('activeTabId');
    const tabExists = project.tabs.some(t => t.id === activeId);
    if (!tabExists) {
      session.set('activeTabId', project.tabs[0].id);
    }
  }

  // ─── Tree ─────────────────────────────────────────────────────────────────

  _refreshTree() {
    const treeContainer = this.element('tree-container');
    let tab = getActiveTab();

    this._teardownDragAndDrop?.();
    this._teardownDragAndDrop = null;

    if (!tab) {
      const project = this._activeProject;

      if (!project) {
        treeContainer.innerHTML = '<div class="project-manager-tree-empty">No project selected.</div>';
        return;
      }

      if (project.tabs.length <= 0) {
        treeContainer.innerHTML = '<div class="project-manager-tree-empty">No tab available.</div>';
        return;
      }

      tab = getActiveTab();
    }

    if (!tab) {
      treeContainer.innerHTML = '<div class="project-manager-tree-empty">content not available.</div>';
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
      searchQuery: session.get('projectTreeSearchQuery').toLowerCase(),
      componentInstanceId: this.instanceId,
    });

    this._teardownDragAndDrop = setupDragAndDrop(treeContainer, (draggedId, targetId, position) => {
      this._reorderNodes(draggedId, targetId, position);
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

  /**
   * Returns true if `id` is `node` itself or anywhere in its subtree.
   * Used to refuse drops that would nest a node inside itself.
   * @param {Object} node
   * @param {string} id
   */
  _isSelfOrDescendant(node, id) {
    if (node.id === id)
      return true;
    if (!node.children)
      return false;
    return node.children.some(child => this._isSelfOrDescendant(child, id));
  }

  /**
   * Moves `draggedId` relative to `targetId`.
   *   position === 'into'            → draggedId becomes the last child of targetId
   *   position === 'before'/'after'  → draggedId becomes a sibling of targetId,
   *                                     in targetId's own parent
   *
   * Safety: refuses the move entirely (no-op) if targetId is the dragged
   * node itself, or anywhere inside the dragged node's own subtree - doing
   * that move would detach the dragged node's whole subtree from the tree
   * (it'd end up nested inside itself), which is what made nodes vanish.
   * The check happens before anything is removed from any list, so a
   * refused drop never touches the data at all.
   *
   * @param {string} draggedId
   * @param {string} targetId
   * @param {'before'|'after'|'into'} position
   */
  _reorderNodes(draggedId, targetId, position) {
    if (!draggedId || !targetId || draggedId === targetId)
      return;

    notifyOpenProjectChange(() => {
      const tab = getActiveTab();
      if (!tab)
        return;

      const draggedNode = findNode(draggedId);
      const targetNode = findNode(targetId);
      if (!draggedNode || !targetNode)
        return;

      if (this._isSelfOrDescendant(draggedNode, targetId))
        return; // refused: would nest the node inside itself

      const draggedCtx = findNodeContext(draggedId, tab.nodes);
      if (!draggedCtx)
        return;

      const dragParent = draggedCtx.parentNode;
      const fromList = dragParent ? dragParent.children : tab.nodes;

      const from = fromList.findIndex(n => n.id === draggedId);
      if (from < 0)
        return;

      const [removed] = fromList.splice(from, 1);

      if (position === 'into') {
        if (!targetNode.children)
          targetNode.children = [];
        targetNode.children.push(removed);

        // Auto-expand the new parent so the node doesn't seem to disappear.
        const collapsed = { ...session.get('collapsedNodes'), [targetId]: false };
        session.set('collapsedNodes', collapsed);
        return;
      }

      // 'before' / 'after': sibling of targetId, inside targetId's own parent.
      const targetCtx = findNodeContext(targetId, tab.nodes);
      if (!targetCtx) {
        // Shouldn't happen (target existed a moment ago), but if it does,
        // put the dragged node back rather than losing it.
        fromList.splice(from, 0, removed);
        return;
      }

      const tarParent = targetCtx.parentNode;
      const toList = tarParent ? tarParent.children : tab.nodes;
      const targetIndex = toList.findIndex(n => n.id === targetId);
      const insertAt = position === 'after' ? targetIndex + 1 : targetIndex;

      toList.splice(insertAt, 0, removed);
    }, 'tabs:nodes');
  }

  // ─── Tab Selector ────────────────────────────────────────────────────

  _refreshTabSelector() {
    const selector = this.element('tab-selector');
    const project = this._activeProject;
    const activeTabID = session.get('activeTabId');

    if (!project)
      return;

    selector.innerHTML = project.tabs
      .map(t => `<option value="${t.id}"${t.id === activeTabID ? ' selected' : ''}>${escapeHTML(t.name)}</option>`)
      .join('');
  }

  /**
   * Creates a new node, either at the tab root (parentId = null) or as a
   * child of an existing node.
   * @param {Object} options
   * @param {string|null} options.parentId
   */
  _createNode({ parentId }) {
    this._openRenameModal(
      parentId ? 'New child entry' : 'New entry',
      'New Entry',
      newName => {
        notifyOpenProjectChange(() => {
          const tab = getActiveTab();
          if (!tab)
            return;

          const targetList = parentId
            ? findNode(parentId)?.children
            : tab.nodes;

          if (!targetList)
            return;

          const node = createNode(newName, `# ${newName}\n\n`);
          targetList.push(node);

          if (parentId) {
            const collapsed = { ...session.get('collapsedNodes'), [parentId]: false };
            session.set('collapsedNodes', collapsed);
          }

          session.set('activeNodeId', node.id);
        }, 'tabs:nodes');

        eventBus.emit('toast:show', { message: 'Entry created.', type: 'success' });
      }
    );
  }

  // ─── Modals ───────────────────────────────────────────────────────────────

  _buildModals() {
    // Shared rename modal (used for tabs, nodes, and node/child creation)
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
        const project = this._activeProject;
        if (!value || !project)
          return;

        createTab(value, project);
        closeModal(this._tabCreationModal);
        this._tabManager?.render();
        this._refreshTabSelector();
        eventBus.emit('toast:show', { message: `Tab '${value}' created.`, type: 'success' });
      }
    });

    addModalEnterAction(this._tabCreationModal, { targetId: tabInputId });
    this._tabCreationModal.style.zIndex = '1001';

    // Tab manager
    const contentId = this.elementId('tab-manager-content');
    const createBtnId = this.elementId('tab-manager-create-btn');

    this._tabManagerModal = buildDoneModal(this.elementId('tab-manager-modal'), {
      title: 'Tab manager',
      bodyHTML: `
        <div class="project-manager-tab-element_header">
          <button id="${createBtnId}" class="icon-button icon-button--small" title="Create Tab" aria-label="Create a tab">+</button>
        </div>
        <div id="${contentId}"></div>`,
      wide: 'm',
      doneCallback: () => { eventBus.emit('save:request'); },
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
              const project = this._activeProject;
              if (!project)
                return;

              notifyOpenProjectChange(() => {
                removeTabById(tabId, project);
              }, 'tabs');

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
    const inputEl = this.globalElement('rename-input', this._renameModal);

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

  _openRenameNodeModal(nodeID) {
    const node = findNode(nodeID);
    if (!node) {
      eventBus.emit('toast:show', { message: 'Failed to rename node.', type: 'error' });
      return;
    }

    this._openRenameModal('Rename entry', node.name, newName => {
      notifyOpenProjectChange((project) => {
        const tab = getActiveTab();
        if (!tab)
          return;

        const ok = renameNodeById(nodeID, tab.nodes, project, tab.folderName ?? tab.name, newName);
        if (!ok) {
          eventBus.emit('toast:show', { message: 'Failed to rename entry.', type: 'error' });
          return;
        }

        eventBus.emit('toast:show', { message: 'Entry renamed.', type: 'success' });
      }, 'tabs:nodes:name');
    });
  }
  _openRenameTabModal(tabID) {
    const tab = findTab(tabID);
    if (!tab) {
      eventBus.emit('toast:show', { message: 'Failed to rename tab.', type: 'error' });
      return;
    }

    this._openRenameModal('Rename tab', tab.name, newName => {
      notifyOpenProjectChange((project) => {
        const ok = renameTabById(tabID, project, newName);
        if (!ok) {
          eventBus.emit('toast:show', { message: 'Failed to rename tab.', type: 'error' });
          return;
        }

        eventBus.emit('toast:show', { message: 'Tab renamed.', type: 'success' });
      }, 'tabs:name');
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
        notifyOpenProjectChange((project) => {
          const tab = getActiveTab();
          if (!tab)
            return;
          
          removeNodeById(nodeId, tab.nodes, project, tab.folderName ?? tab.name);
          const activeNodeID = session.get('activeNodeId');
          if (activeNodeID === nodeId || !findNode(activeNodeID)) {
            session.set('activeNodeId', null);
          }
        }, 'tabs:nodes');

        eventBus.emit('toast:show', { message: 'Entry deleted.', type: 'success' });
      }
    );
  }
}