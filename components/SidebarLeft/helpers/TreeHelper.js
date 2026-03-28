import { nodeMatchesSearch } from '../../../data/ProjectManager.js';
import { DragDropHelper } from '../../Common/DragDropHelper.js';

/**
 * Renders the full tree as an HTML string.
 *
 * @param {Array} nodes — Root nodes of the tree
 * @param {Object} options
 * @param {string} options.activeNodeId — Currently selected node ID (highlighted)
 * @param {Object} options.collapsedNodes — Map of nodeId -> boolean
 * @param {string} options.searchQuery — Lowercase search string for filtering
 * @param {string} options.componentInstanceId — Used as JS callback prefix
 * @returns {string} HTML string
 */
export function renderTree(nodes, { activeNodeId, collapsedNodes, searchQuery, componentInstanceId }) {
  if (!nodes.length) {
    return '<div class="tree-empty">Click <b>+ Add entry</b> to get started.</div>';
  }
  return nodes.map(node => renderNode(node, 0, { activeNodeId, collapsedNodes, searchQuery, componentInstanceId })).join('');
}

/**
 * Renders a single node and its children recursively.
 * Uses data-* attributes for event delegation (no inline onclick handlers).
 */
function renderNode(node, depth, options) {
  const { activeNodeId, collapsedNodes, searchQuery, componentInstanceId } = options;

  if (!nodeMatchesSearch(node, searchQuery)) 
    return '';

  const isActive = activeNodeId === node.id;
  const hasChildren = node.children.length > 0;
  const isExpanded = !collapsedNodes[node.id];
  const indentPx = 8 + depth * 16;

  const toggleClass = hasChildren ? (isExpanded ? 'tree-toggle tree-toggle--open' : 'tree-toggle') : 'tree-toggle tree-toggle--leaf';
  const toggleChar = hasChildren ? '›' : '·';
  const rootClass = depth === 0 ? ' tree-node--root' : '';
  const activeClass = isActive ? ' tree-node--active' : '';

  const displayName = escapeHTML(node.name);

  let html = `
    <div
      class="tree-node-element tree-node${rootClass}${activeClass}"
      style="padding-left:${indentPx}px"
      draggable="true"
      data-node-id="${node.id}"
      data-action="select"
      title="${escapeHTML(node.name)}"
    >
      <span class="${toggleClass}" data-node-id="${node.id}" data-action="toggle">${toggleChar}</span>
      <span class="tree-node__label">${displayName}</span>
      <div class="tree-node__actions">
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

export function setupDragAndDrop(container, onReorder) {
  let dnd  = new DragDropHelper(container, {
    itemSelector:   '.tree-node[data-node-id]',
    handleSelector: '.tree-node[data-node-id]',
    idAttribute:    'nodeId',
    onReorder: (from, to, fromId, toId) => { onReorder(from, to, fromId, toId) }
  });

  return function cleanup() {
    dnd.destroy();
  };
}

function escapeHTML(string) {
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
