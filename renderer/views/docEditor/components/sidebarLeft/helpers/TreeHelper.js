import { DragDropHelper } from '@common/DragDropHelper.js';
import { escapeHTML } from '@common/Common.js'
import { nodeMatchesSearch } from '@data/ProjectManager.js';

/**
 * Renders the full tree as an HTML string.
 *
 * @param {Array} nodes - Root nodes of the tree
 * @param {Object} options
 * @param {string} options.activeNodeId - Currently selected node ID (highlighted)
 * @param {Object} options.collapsedNodes - Map of nodeId -> boolean
 * @param {string} options.searchQuery - Lowercase search string for filtering
 * @param {string} options.componentInstanceId - Used as JS callback prefix
 * @returns {string} HTML string
 */
export function renderTree(nodes, { activeNodeId, collapsedNodes, searchQuery, componentInstanceId }) {
  if (!nodes.length) {
    return '<div class="project-manager-tree-empty">Click <b>Add entry</b> to get started.</div>';
  }
  return nodes.map(node => renderNode(node, 0, { activeNodeId, collapsedNodes, searchQuery, componentInstanceId })).join('');
}

/**
 * Renders a single node and its children recursively.
 * Uses data-* attributes for event delegation (no inline onclick handlers).
 *
 * Note: children are rendered as flat siblings after their parent's own
 * row, not nested inside a wrapper element - indentation is purely visual
 * (via depthClass / padding). The drag & drop layer does not rely on DOM
 * nesting for anything; it works off node ids and the pointer position
 * over a row, which is why this flat markup is fine as-is.
 */
function renderNode(node, depth, options) {
  const { activeNodeId, collapsedNodes, searchQuery, componentInstanceId } = options;

  if (!nodeMatchesSearch(node, searchQuery)) 
    return '';

  const isActive = activeNodeId === node.id;
  const hasChildren = node.children.length > 0;
  const isExpanded = !collapsedNodes[node.id];
  const indentPx = 8 + depth * 16;

  const toggleClass = hasChildren ? (isExpanded ? 'project-manager-tree-toggle open' : 'project-manager-tree-toggle') : 'project-manager-tree-toggle leaf';
  const toggleChar = hasChildren ? '›' : '·';
  const rootClass = depth === 0 ? ' project-manager-tree-node--root' : '';
  const activeClass = isActive ? ' project-manager-tree-node--active' : '';

  const displayName = escapeHTML(node.name);
  const depthClass = `project-manager-tree-node--depth-${Math.min(depth, 10)}`;

  let html = `
    <div
      class="project-manager-tree-node-element project-manager-tree-node${rootClass}${activeClass} ${depthClass}"
      draggable="true"
      data-node-id="${node.id}"
      data-action="select"
      title="${escapeHTML(node.name)}"
    >
      <span class="${toggleClass}" data-node-id="${node.id}" data-action="toggle">${toggleChar}</span>
      <span class="project-manager-tree-node__label">${displayName}</span>
      <div class="project-manager-tree-node__actions">
        <button class="action-button" data-node-id="${node.id}" data-action="add-child" title="Add child entry">+</button>
        <button class="action-button" data-node-id="${node.id}" data-action="rename" title="Rename">✎</button>
        <button class="action-button action-button--danger" data-node-id="${node.id}" data-action="delete" title="Delete">✕</button>
      </div>
    </div>`;

  if (hasChildren && isExpanded) {
    html += node.children
      .map(child => renderNode(child, depth + 1, options))
      .join('');
  }

  return html;
}

/**
 * Wires up drag & drop reordering / reparenting for the tree.
 *
 * Runs the DragDropHelper in "nestable" mode: instead of moving DOM
 * elements around during the drag and inferring the drop target from the
 * final DOM position (ambiguous, and unsafe for a tree that can nest
 * arbitrarily deep), it computes an explicit intent on every dragover -
 * which node is hovered, and whether the pointer is in the top/middle/
 * bottom band of that row - and reports that straight to `onReorder` as
 * (draggedId, targetId, position), with position being 'before' | 'after'
 * | 'into'. No placeholder element is created, so there's nothing that can
 * be left behind or duplicated across renders.
 *
 * @param {HTMLElement} container
 * @param {(draggedId: string, targetId: string, position: 'before'|'after'|'into') => void} onReorder
 * @returns {() => void} cleanup function
 */
export function setupDragAndDrop(container, onReorder) {
  let dnd  = new DragDropHelper(container, {
    itemSelector:   '.project-manager-tree-node[data-node-id]',
    handleSelector: '.project-manager-tree-node[data-node-id]',
    idAttribute:    'nodeId',
    nestable: true,
    onReorder: (draggedId, targetId, position) => { onReorder(draggedId, targetId, position); }
  });

  return function cleanup() {
    dnd.destroy();
  };
}