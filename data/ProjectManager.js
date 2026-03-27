import { state } from '../core/State.js';

// ─── ID Generation ────────────────────────────────────────────────────────────

/**
 * Generates a short, collision-resistant unique ID.
 * @returns {string}
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Creates a new tree node object.
 * @param {string} name
 * @param {string} [content]
 * @param {Array} [children]
 * @returns {Object}
 */
export function createNode(name, content = '', children = []) {
  return { id: generateId(), name, content, children };
}

/**
 * Creates a new project with empty explanation/examples/reference tabs.
 * @param {string} name
 * @returns {Object} Project
 */
export function createProject(name) {
  return {
    id: generateId(),
    name,
    createdAt: Date.now(),
    docTheme: {},
    tabs: [createDefaultTab(), { id: generateId(), name: 'Other', nodes: [] }],
    themeId: null,   // Referenz auf eine gespeicherte DocTheme
    settings: {}
  };
}

/**
 * Creates the default "Documentation" tab with an empty node list.
 * @returns {Object} Tab
 */ 
export function createDefaultTab() {
  return { id: generateId(), name: 'Dokumentation', nodes: [] };
}

/**
 * Creates a tab within a project
 * @param {Object} project
 * @param {string} name
 * @returns {Object} Tab
 */
export function createTab(project, tabname) {
  const tab = { id: generateId(), name: tabname, nodes: [] };
  project.tabs.push(tab);
  return tab;
}

/**
 * Creates the default "CSS Documentation" project with pre-populated sample content.
 * Called on first launch when no projects exist.
 * @returns {Object}
 */
export function createDefaultProject() {
  const project = createProject('CSS Documentation');

  const styleNode = createNode('style', `# style

The \`style\` attribute applies inline CSS directly to an HTML element.

## Syntax

\`\`\`html
<element style="property: value; property: value;">
\`\`\`

## Note

Inline styles override external and embedded stylesheets (highest specificity).
`);

  const allAttributesNode = createNode('all attributes', `# all attributes

Overview of all CSS properties that can be set via the \`style\` attribute.

| Property   | Type        | Description               |
|------------|-------------|---------------------------|
| color      | \`<color>\`  | Text color                |
| font-size  | \`<length>\` | Font size                 |
| margin     | \`<length>\` | Outer spacing (all sides) |
| padding    | \`<length>\` | Inner spacing             |
| background | \`<color>\`  | Background color          |
| display    | keyword      | Display type              |
`);

  const colorNode = createNode('color', `# color

Sets the foreground (text) color of an element.

## Syntax

\`\`\`css
color: <color>;
\`\`\`

## Values

| Value   | Example                      |
|---------|------------------------------|
| Keyword | \`color: red;\`               |
| Hex     | \`color: #ff0000;\`           |
| RGB     | \`color: rgb(255, 0, 0);\`    |
| HSL     | \`color: hsl(0, 100%, 50%);\` |

## Inheritance

\`color\` is inherited by child elements.
`);

  styleNode.children.push(allAttributesNode, colorNode);
  project.tabs[0].nodes.push(styleNode);

  const editorDemoNode = createNode('Editor Features', `# Editor Features

All Markdown elements supported by this editor.

## Text Formatting

**Bold** with \`**text**\`, *italic* with \`*text*\`, ***both*** with \`***text***\`.

Inline code: \`const x = 1;\`

## Lists

- Item one
- Item two

1. First step
2. Second step

## Code Blocks

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Blockquote

> This is a blockquote. Use \`> text\`.

## Link

[SomeWebsite](https://google.com)

## Table

| Property  | Value   | Description |
|-----------|---------|-------------|
| color     | #ff0000 | Text color  |
| font-size | 16px    | Font size   |

---

All elements can be inserted via the toolbar or typed directly.
`);

  project.tabs[0].nodes.push(editorDemoNode);
  return project;
}

// ─── Active Project/Tab Accessors ─────────────────────────────────────────────

/**
 * Returns the currently active project object, or null if none is selected.
 * @returns {Object|null}
 */
export function getActiveProject() {
  const projects = state.get('projects');
  const activeId = state.get('activeProjectId');
  return projects.find(p => p.id === activeId) ?? null;
}

/**
 * Returns the doc theme object of the currently active project.
 * Falls back to an empty object if no project is selected or the project has no theme.
 * @returns {Object} Theme map e.g. { '--accent-color': '#ff0000', 'preview-font-size': 16 }
 */
export function getActiveDocTheme() {
  const project = getActiveProject();
  return project?.docTheme ?? {};
}

/**
 * Returns the active tab data ({ nodes: [] }) for the current project and tab.
 * @returns {Object|null}
 */
export function getActiveTab() {
  const project = getActiveProject();
  if (!project) 
    return null;

  const activeTabID = state.get('activeTabID');
  if (!activeTabID) 
    return null;
  
  return project.tabs.find(t => t.id === activeTabID) ?? null;
}

/**
 * Finds a tab by ID within the given tab list (defaults to active project's tabs).
 * @param {string} tabID
 * @param {Array|null} [tabs]
 * @returns {Object|null}
 */
export function findTab(tabID, tabs = null) {
  const searchTabs = tabs ?? (getActiveProject()?.tabs ?? []);
  if (!searchTabs)
    return null;
  return searchTabs.find(t => t.id === tabID) ?? null;
}


/**
 * Removes the tab with the specified ID from the given array of tabs. 
 * Changes the active tab if the removed tab was active.
 * @param {string} tabID
 * @param {Array} tabs
 * @returns {boolean} true if the tab was found and removed, false otherwise
 */
export function removeTabById(tabID, tabs) {
  let tab = tabs.find((t) => t.id === tabID);
  if(!tab)
    return false;

  // remove tab
  tabs.splice(tabs.indexOf(tab), 1);
  // changes active tab
  const activeID = state.get('activeTabID');
  if(activeID === tabID) {
    let newID = null;
    if(project.tabs.length > 2) {
      newID = project.tabs.find((t) => t.id !== tabID)?.id;
    }
    state.set('activeTabID', newID);
  }
  return true;
}

// ─── Node Tree Operations ─────────────────────────────────────────────────────

/**
 * Recursively finds a node by ID and returns its context.
 * @param {string} nodeId
 * @param {Array} nodes — The node list to search in
 * @param {Object|null} parentNode
 * @returns {{ node: Object, parentNode: Object|null, siblings: Array } | null}
 */
export function findNodeContext(nodeId, nodes, parentNode = null) {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return {
        node,
        parentNode,
        siblings: parentNode ? parentNode.children : nodes,
      };
    }
    const found = findNodeContext(nodeId, node.children, node);
    if (found) return found;
  }
  return null;
}

/**
 * Finds a node by ID within the given node list (defaults to active tab's nodes).
 * @param {string} nodeId
 * @param {Array|null} [nodes]
 * @returns {Object|null}
 */
export function findNode(nodeId, nodes = null) {
  const rootNodes = nodes ?? (getActiveTab()?.nodes ?? []);
  return findNodeContext(nodeId, rootNodes)?.node ?? null;
}

/**
 * Returns the path (array of nodes) from the root down to the target node.
 * @param {string} nodeId
 * @param {Array|null} [nodes]
 * @param {Array} [currentPath]
 * @returns {Array|null}
 */
export function getNodePath(nodeId, nodes = null, currentPath = []) {
  const rootNodes = nodes ?? (getActiveTab()?.nodes ?? []);
  for (const node of rootNodes) {
    if (node.id === nodeId) return [...currentPath, node];
    const found = getNodePath(nodeId, node.children, [...currentPath, node]);
    if (found) return found;
  }
  return null;
}

/**
 * Returns true if the node or any of its descendants match the (lowercase) search query.
 * @param {Object} node
 * @param {string} query — Should already be lowercased
 * @returns {boolean}
 */
export function nodeMatchesSearch(node, query) {
  if (!query) return true;
  if (node.name.toLowerCase().includes(query)) return true;
  return node.children.some(child => nodeMatchesSearch(child, query));
}

/**
 * Removes a node (and all its descendants) from the tree by ID.
 * @param {string} nodeId
 * @param {Array} nodes
 * @returns {boolean} true if the node was found and removed
 */
export function removeNodeById(nodeId, nodes) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === nodeId) {
      nodes.splice(i, 1);
      return true;
    }
    if (removeNodeById(nodeId, nodes[i].children)) return true;
  }
  return false;
}

/**
 * Collects all nodes in depth-first order (for export).
 * @param {Array} nodes
 * @returns {Array}
 */
export function flattenNodes(nodes) {
  const result = [];
  function walk(list) {
    list.forEach(node => {
      result.push(node);
      if (node.children.length) walk(node.children);
    });
  }
  walk(nodes);
  return result;
}

/**
 * Deep-clones an object via JSON serialization.
 * @param {*} value
 * @returns {*}
 */
export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
