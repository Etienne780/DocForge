import { state } from '../../../core/State.js';
import { getActiveProject } from '../../../data/ProjectManager.js';
import { DragDropHelper } from '../../Common/DragDropHelper.js';

export class TabManager {
  /**
   * @param {HTMLElement} containerEl
   * @param {object}      callbacks
   * @param {Function}    callbacks.onRenameTab  (tabId: string) => void
   * @param {Function}    callbacks.onDeleteTab  (tabId: string) => void
   */
  constructor(containerEl, { onRenameTab, onDeleteTab } = {}) {
    this._container = containerEl;
    this._onRenameTab = onRenameTab;
    this._onDeleteTab = onDeleteTab;
    this._dnd = null;

    this._onClick = this._handleClick.bind(this);
    this._container.addEventListener('click', this._onClick);
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  render() {
    const project     = getActiveProject();
    const activeTabID = state.get('activeTabID');

    // DragDropHelper listeners are on the container which persists,
    // but the inner list is replaced on every render → re-init DnD
    this._dnd?.destroy();
    this._dnd = null;

    if (!project) {
      this._container.innerHTML = '<span class="tab-element_scroll-no_tabs">No project selected.</span>';
      return;
    }

    if (!project.tabs.length) {
      this._container.innerHTML = '<span class="tab-element_scroll-no_tabs">No tabs available.</span>';
      return;
    }

    const items = project.tabs.map(t => {
      const active    = t.id === activeTabID;
      const accentVar = active ? '--accent-color' : '--border-color';
      return `
        <div class="tab-element${active ? ' tab-element--active' : ''}"
             draggable="true" data-tab-id="${t.id}">
          <div class="tab-element__Drag" style="border-color:var(${accentVar})">||</div>
          <span class="tab-element__name" style="user-select:none">${escapeHTML(t.name)}</span>
          <div class="tab-element__actions">
            <button class="action-button action-button--danger"
                    data-action="delete" data-tab-id="${t.id}" title="Delete">✕</button>
            <button class="action-button"
                    data-action="rename" data-tab-id="${t.id}" title="Rename">✎</button>
          </div>
        </div>`;
    }).join('');

    this._container.innerHTML = `<div class="tab-element_scroll">${items}</div>`;

    // Attach DnD to the freshly rendered list
    const list = this._container.querySelector('.tab-element_scroll');
    this._dnd  = new DragDropHelper(list, {
      itemSelector:   '.tab-element[data-tab-id]',
      handleSelector: '.tab-element__Drag',
      idAttribute:    'tabId',
      onReorder: (from, to, fromId, toId) => {
        const project = getActiveProject();
        if (!project) 
          return;
        const [removed] = project.tabs.splice(from, 1);
        project.tabs.splice(to, 0, removed);
        state.set('projects', [...state.get('projects')]);
        this.render();
      },
    });
  }

  destroy() {
    this._dnd?.destroy();
    this._container.removeEventListener('click', this._onClick);
  }

  // ─── Click delegation ─────────────────────────────────────────────────────

  _handleClick(e) {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      e.stopPropagation();
      const { action, tabId } = actionBtn.dataset;
      if (action === 'rename') 
        this._onRenameTab?.(tabId);
      if (action === 'delete') 
        this._onDeleteTab?.(tabId);
      return;
    }

    const tabEl = e.target.closest('.tab-element[data-tab-id]');
    if (!tabEl) 
      return;

    state.set('activeTabID', tabEl.dataset.tabId);
    state.set('activeNodeId', null);
    this.render();
  }
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
