// ─── Node types ─────────────────────────────────────────────────────────────
//
// A node's type decides how it (and its children) show up in the exported
// document. It never changes the tree in the editor.
//
//   page   - default: own page, children are own pages
//   folder - no page, content is never exported; groups its children in the nav
//   merged - own page, children are appended to it as sections
//
// For 'merged' nodes `mergeDescendants` decides what happens with the
// children of the children:
//
//   embed    - every descendant becomes a section of the merged page
//   separate - only direct children become sections; their children are
//              lifted one level up and listed in the nav under the merged node
//
// Inside a merged page the type of a section node is ignored, except that a
// folder's content stays hidden (only its name is shown as a heading).

export const NODE_TYPE = Object.freeze({
  PAGE:   'page',
  FOLDER: 'folder',
  MERGED: 'merged',
});

export const NODE_MERGE_MODE = Object.freeze({
  EMBED:    'embed',
  SEPARATE: 'separate',
});

export const DEFAULT_NODE_TYPE = NODE_TYPE.PAGE;
export const DEFAULT_NODE_MERGE_MODE = NODE_MERGE_MODE.EMBED;

export const NODE_TYPE_INFO = Object.freeze({
  [NODE_TYPE.PAGE]: {
    label: 'Page',
    description: 'Own page in the export. Children are own pages.',
  },
  [NODE_TYPE.FOLDER]: {
    label: 'Folder',
    description: 'Only groups its children in the navigation. Its content is not exported.',
  },
  [NODE_TYPE.MERGED]: {
    label: 'Merged',
    description: 'Children are shown as sections on this page instead of own pages.',
  },
});

export const NODE_MERGE_MODE_INFO = Object.freeze({
  [NODE_MERGE_MODE.EMBED]: {
    label: 'Include all descendants',
    description: 'Children of children are added to the page as well.',
  },
  [NODE_MERGE_MODE.SEPARATE]: {
    label: 'Keep grandchildren as own entries',
    description: 'Only direct children are merged. Their children move one level up and stay own entries.',
  },
});

/** Highest heading level a section heading is shifted to. */
export const MAX_SECTION_HEADING_LEVEL = 4;

export function normalizeNodeType(value) {
  return Object.values(NODE_TYPE).includes(value) ? value : DEFAULT_NODE_TYPE;
}

export function normalizeNodeMergeMode(value) {
  return Object.values(NODE_MERGE_MODE).includes(value) ? value : DEFAULT_NODE_MERGE_MODE;
}

export function getNodeType(node) {
  return normalizeNodeType(node?.type);
}

export function getNodeMergeMode(node) {
  return normalizeNodeMergeMode(node?.mergeDescendants);
}

/**
 * Returns the node without type fields its type doesn't use (`mergeDescendants`
 * only matters for merged nodes). Used when writing projects; missing fields
 * get their defaults again on load.
 * @param {Object} node
 * @returns {Object} shallow copy (or the node itself when nothing is removed)
 */
export function stripUnusedNodeTypeFields(node) {
  if (getNodeType(node) === NODE_TYPE.MERGED)
    return node;

  const { mergeDescendants, ...rest } = node;
  return rest;
}

// ─── Export context ─────────────────────────────────────────────────────────

/**
 * Export context of a node:
 *   embedded - the node is a section of a merged page
 *   embedAll - its children are sections of that page too
 */
const CONTEXT_NONE = Object.freeze({ embedded: false, embedAll: false });
const CONTEXT_SECTION = Object.freeze({ embedded: true, embedAll: false });
const CONTEXT_EMBED_ALL = Object.freeze({ embedded: true, embedAll: true });

export const ROOT_EXPORT_CONTEXT = CONTEXT_NONE;

/**
 * Returns the export context of the children of `node`.
 * @param {Object} node
 * @param {{ embedded: boolean, embedAll: boolean }} context - context of `node` itself
 */
export function getChildExportContext(node, context = CONTEXT_NONE) {
  if (context.embedAll)
    return CONTEXT_EMBED_ALL;
  // a section of a 'separate' merge -> its children are lifted out of the page
  if (context.embedded)
    return CONTEXT_NONE;
  if (getNodeType(node) === NODE_TYPE.MERGED)
    return getNodeMergeMode(node) === NODE_MERGE_MODE.EMBED ? CONTEXT_EMBED_ALL : CONTEXT_SECTION;
  return CONTEXT_NONE;
}

/**
 * Describes how the last node of `path` ends up in the export.
 * @param {Array<Object>} path - nodes from the tab root down to the node
 * @returns {{ type: string, embedded: boolean, mergedInto: Object|null }}
 */
export function getNodeExportRole(path) {
  const node = path?.[path.length - 1] ?? null;
  let context = CONTEXT_NONE;
  let mergedInto = null;

  for (let i = 0; i < (path?.length ?? 0) - 1; i++) {
    const ancestor = path[i];
    const childContext = getChildExportContext(ancestor, context);
    if (childContext.embedded && !context.embedded)
      mergedInto = ancestor;
    else if (!childContext.embedded)
      mergedInto = null;
    context = childContext;
  }

  return {
    type: getNodeType(node),
    embedded: context.embedded,
    mergedInto: context.embedded ? mergedInto : null,
  };
}

// ─── Export tree ────────────────────────────────────────────────────────────

/**
 * Resolves a tab's node tree into what the exported document shows.
 *
 * @param {Array<Object>} nodes - root nodes of a tab
 * @returns {{
 *   nav: Array<{ node: Object, kind: 'page'|'folder', children: Array }>,
 *   pages: Array<{ node: Object, sections: Array<{ node: Object, depth: number, showContent: boolean }> }>,
 *   aliases: Object<string, { pageId: string, anchor: string|null }>
 * }}
 *   nav     - navigation tree (only pages and folders)
 *   pages   - every page in navigation order with its sections (first section is the page node)
 *   aliases - nodes without an own page -> the page that shows them (and the section to scroll to)
 */
export function resolveExportTree(nodes) {
  const out = { nav: [], pages: [], aliases: {} };
  out.nav = _resolveList(nodes ?? [], out);
  return out;
}

function _resolveList(nodes, out) {
  return nodes.map(node => _resolveNode(node, out));
}

function _resolveNode(node, out) {
  const type = getNodeType(node);
  const children = node.children ?? [];

  if (type === NODE_TYPE.FOLDER) {
    const navChildren = _resolveList(children, out);
    const firstPageId = _findFirstPageId(navChildren);
    if (firstPageId)
      out.aliases[node.id] = { pageId: firstPageId, anchor: null };
    return { node, kind: 'folder', children: navChildren };
  }

  const page = { node, sections: [_createSection(node, 0)] };
  out.pages.push(page); // before the children, so pages stay in nav order

  if (type !== NODE_TYPE.MERGED)
    return { node, kind: 'page', children: _resolveList(children, out) };

  if (getNodeMergeMode(node) === NODE_MERGE_MODE.EMBED) {
    children.forEach(child => _embedSubtree(child, 1, page, out));
    return { node, kind: 'page', children: [] };
  }

  const lifted = [];
  for (const child of children) {
    _addSection(child, 1, page, out);
    lifted.push(...(child.children ?? []));
  }
  return { node, kind: 'page', children: _resolveList(lifted, out) };
}

function _embedSubtree(node, depth, page, out) {
  _addSection(node, depth, page, out);
  (node.children ?? []).forEach(child => _embedSubtree(child, depth + 1, page, out));
}

function _addSection(node, depth, page, out) {
  page.sections.push(_createSection(node, depth));
  out.aliases[node.id] = { pageId: page.node.id, anchor: node.id };
}

function _createSection(node, depth) {
  return { node, depth, showContent: getNodeType(node) !== NODE_TYPE.FOLDER };
}

function _findFirstPageId(navItems) {
  for (const item of navItems) {
    if (item.kind === 'page')
      return item.node.id;
    const found = _findFirstPageId(item.children);
    if (found)
      return found;
  }
  return null;
}
