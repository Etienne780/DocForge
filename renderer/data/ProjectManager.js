import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { PROJECT_PRESETS } from '@core/presets/ProjectPresets.js';
import { isPlatformWeb } from '@core/Platform.js';
import { generateId } from '@common/Common.js';

export const MAX_NUMBER_OF_RECENT_PROJECTS = 10;

// ─── ID Generation ────────────────────────────────────────────────────────────

/**
 * Generates a short, collision-resistant unique ID for a project.
 * @returns {string}
 */
export function generateProjectId() {
  return 'project_' + generateId();
}

/**
 * Generates a short, collision-resistant unique ID for a tab.
 * @returns {string}
 */
export function generateTabId() {
  return 'tab_' + generateId();
}

/**
 * Generates a short, collision-resistant unique ID for a node.
 * @returns {string}
 */
export function generateNodeId() {
  return 'node_' + generateId();
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Creates a new project.
 * @param {string} name
 * @returns {Object} Project
 */
export function createProject(name) {
  return {
    id: generateProjectId(),
    name,
    builtIn: false,
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
    tabs: [createDefaultTab()],
    theme: null,
    settings: {},
    codeBlockCache: new Map(),

    sourcePath: null,   // absolute path. is null on web
    sourceKind: null,   // 'file' | 'folder' | null
    isDirty: false,     // changed since last save
  };
}

/**
 * Creates the default "Documentation" tab with an empty node list.
 * @returns {Object} Tab
 */ 
export function createDefaultTab() {
  return { id: generateTabId(), name: 'Dokumentation', nodes: [] };
}

/**
 * Creates a tab within a project if project is not null
 * @param {Object} project
 * @param {string} name
 * @returns {Object} Tab
 */
export function createTab(tabname, project = null) {
  const tab = { id: generateTabId(), name: tabname, nodes: [] };
  project?.tabs.push(tab);
  return tab;
}

/**
 * Creates a new tree node object.
 * @param {string} name
 * @param {string} [content]
 * @param {Array} [children]
 * @returns {Object}
 */
export function createNode(name, content = '', children = []) {
  return { id: generateNodeId(), name, content, children };
}

/**
 * Removes internal runtime fields from a project object
 * and returns a clean export-safe version.
 *
 * This function strips:
 * - internal IDs
 * - timestamps
 * - runtime-only references (like docThemeId)
 *
 * It also deeply cleans all tabs and node structures.
 *
 * @param {Object} project - The project object to clean
 * @returns {Object} Clean project ready for export
 */
export function cleanProject(project) {
  const {
    id,
    builtIn,
    createdAt,
    lastOpenedAt,
    tabs,
    isDirty,
    ...rest
  } = project;

  return {
    ...rest,
    tabs: (tabs ?? []).map(tab => {
      const { id, nodes, ...tabRest } = tab;

      return {
        ...tabRest,
        nodes: (nodes ?? []).map(node => _cleanNode(node))
      };
    })
  };
}

function _cleanNode(node) {
  const { id, ...rest } = node;

  return {
    ...rest,
    children: (node.children ?? []).map(child => _cleanNode(child))
  };
}

export function addRecentProject(project) {
  let recentProjects = state.get('recentProjects');

  if (!Array.isArray(recentProjects))
    recentProjects = [];

  if (recentProjects.length + 1 > MAX_NUMBER_OF_RECENT_PROJECTS) {
    // Delete the least recently opened project
    let oldestIndex = 0;
    let oldestDate = recentProjects[0]?.lastOpenedAt ?? Infinity;

    recentProjects.forEach((recentProject, index) => {
      if (recentProject.lastOpenedAt < oldestDate) {
        oldestDate = recentProject.lastOpenedAt;
        oldestIndex = index;
      }
    });

    if (recentProjects.length > 0) {
      recentProjects.splice(oldestIndex, 1);
    }
  }
  
  if (isPlatformWeb()) {
    recentProjects.push({
      id: project.id,
      name: project.name,
      lastOpenedAt: project.lastOpenedAt,
      // differs from desktop
      project: project,
    });
  } else {
    recentProjects.push({
      id: project.id,
      name: project.name,
      lastOpenedAt: project.lastOpenedAt,
      // differs from web
      sourcePath: project.sourcePath,
      sourceKind: project.sourceKind,
    });
  }
  state.set('recentProjects', recentProjects);
}

export function removeRecentProject(projectId) {
  let recentProjects = state.get('recentProjects');

  if (!Array.isArray(recentProjects))
    return;

  for (let i = 0; i < recentProjects.length; i++) {
    if (recentProjects[i].id === projectId) {
      recentProjects.splice(i, 1);
      break;
    }
  } 

  state.set('recentProjects', recentProjects);
}

/**
 * Opens a project and navigates to the DocEditor.
 * Used by RecentProjects, ImportHelper, and other components.
 *
 * @param {Object} project - The project object to open.
 * @param {Object} options - Optional parameters.
 * @param {boolean} options.addToRecents - Whether the project should be added to the recent projects list (default: true).
 */
export function openProject(project, options = { addToRecents: true }) {
  if (!project) {
    eventBus.emit('toast:show', { 
      message: 'Cannot open project: Invalid project data.', 
      type: 'error' 
    });
    return;
  }

  session.set('openProject', project);

  if (options.addToRecents)
    addRecentProject(project);
  
  eventBus.emit('navigate:docEditor');
}

// ─── Active Project/Tab Accessors ─────────────────────────────────────────────

/**
 * Returns the currently open project object, or null if none is opend.
 * @returns {Object|null}
 */
export function getOpenProject() {
  return session.get('openProject');
}

/**
 * Returns the doc theme object of the currently active project.
 * Falls back to an null if no project is selected or the project has no falid theme.
 * @returns {Object} DocTheme
 */
export function getOpenProjectTheme() {
  const project = getOpenProject();
  return project ? project.theme : null
}

/**
 * Returns the active tab data ({ nodes: [] }) for the current project and tab.
 * @returns {Object|null}
 */
export function getActiveTab() {
  const project = getOpenProject();
  if (!project) 
    return null;

  const activeTabID = session.get('activeTabId');
  if (activeTabID === null)
    return null;
  
  return project.tabs.find(t => t.id === activeTabID) ?? null;
}

export function notifyProjectChange(mutateFn, extension = null) {
  const project = getOpenProject();
  if (!project)
    return false;

  const previousProject = { ...project };
  mutateFn(project);
  session.notify('openProject', { value: project, previousValue: previousProject }, (extension ? extension : ''));
  return true;
}

/**
 * Finds a tab by ID within the given tab list (defaults to active project's tabs).
 * @param {string} tabID
 * @param {Array|null} [tabs]
 * @returns {Object|null}
 */
export function findTab(tabID, tabs = null) {
  if(tabID === null)
    return null;

  const searchTabs = tabs ?? (getOpenProject()?.tabs ?? []);
  if (!searchTabs)
    return null;
  return searchTabs.find(t => t.id === tabID) ?? null;
}

/**
 * Removes the tab with the specified ID from the given array of tabs. 
 * Changes the active tab if the removed tab was active.
 * @param {string} tabID
 * @param {Array} tabs
 * @returns {boolean} true if the tab was found and removed, false otherwise. Emits session:change:openProject:tabs
 */
export function removeTabById(tabID, project) {
  if (tabID === null)
    return false;

  let tab = findTab(tabID, project.tabs);
  if(!tab)
    return false;

  const prevProject = { ...project };

  // remove tab
  project.tabs.splice(project.tabs.indexOf(tab), 1);
  // changes active tab
  const activeID = session.get('activeTabId');
  if(activeID === tabID) {
    let newID = null;
    if(project.tabs.length > 1) {
      newID = project.tabs.find((t) => t.id !== tabID)?.id;
    }
    session.set('activeTabId', newID);
  }
  // emit changed event
  session.notify('openProject', { value: project, previousValue: prevProject}, 'tabs');
  return true;
}

/**
 * Returns true if the project match the (lowercase) search query.
 * @param {Object} project
 * @param {string} query - Should already be lowercased
 * @returns {boolean}
 */
export function projectMatchesSearch(project, query) {
  if (!query)
    return true;
  return project.name.toLowerCase().includes(query);
}

/**
 * Returns a combined list of all available project presets.
 * - Built-in presets (from PROJECT_PRESETS) with builtIn: true
 * - User-defined presets (from state.projectPresets) with builtIn: false
 *
 * Each preset has the following structure:
 * {
 *   id: string,
 *   name: string,
 *   description?: string,
 *   builtIn: boolean,
 *   factory: () => Object   // creates a new project object
 * }
 */
export function getAllProjectPresets() {
  const builtInPresets = PROJECT_PRESETS.map(p => ({
    ...p,
    builtIn: true,
    factory: p.factory,
  }));

  const userPresets = state.get('projectPresets') || [];
  const userMapped = userPresets.map(p => {
    return {
      id: p.id,
      name: p.name || 'Unnamed Preset',
      description: p.description || 'User-defined project template',
      builtIn: false,
      factory: () => {
        const projectSnapshot = JSON.parse(JSON.stringify(p.project));

        const newProject = {
          ...projectSnapshot,
          id: generateProjectId(),
          createdAt: Date.now(),
          lastOpenedAt: Date.now(),
          builtIn: false,
          codeBlockCache: new Map(),
        };
        
        return newProject;
      }
    };
  });

  return [...builtInPresets, ...userMapped];
}

// ─── Node Tree Operations ─────────────────────────────────────────────────────

/**
 * Recursively finds a node by ID and returns its context.
 * @param {string} nodeId
 * @param {Array} nodes - The node list to search in
 * @param {Object|null} parentNode
 * @returns {{ node: Object, parentNode: Object|null, siblings: Array } | null}
 */
export function findNodeContext(nodeId, nodes, parentNode = null) {
  if (nodeId === null || nodes === null)
    return null

  for (const node of nodes) {
    if (node.id === nodeId) {
      return {
        node,
        parentNode,
        siblings: parentNode ? parentNode.children : nodes,
      };
    }
    const found = findNodeContext(nodeId, node.children, node);
    if (found) 
      return found;
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
  if (nodeId === null)
    return null;

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
  if (nodeId === null)
    return null;

  const rootNodes = nodes ?? (getActiveTab()?.nodes ?? []);
  for (const node of rootNodes) {
    if (node.id === nodeId) 
      return [...currentPath, node];
    const found = getNodePath(nodeId, node.children, [...currentPath, node]);
    if (found) 
      return found;
  }
  return null;
}

/**
 * Returns true if the node or any of its descendants match the (lowercase) search query.
 * @param {Object} node
 * @param {string} query - Should already be lowercased
 * @returns {boolean}
 */
export function nodeMatchesSearch(node, query) {
  if (!node || !query) 
    return true;

  if (node.name.toLowerCase().includes(query)) 
    return true;
  
  return node.children.some(child => nodeMatchesSearch(child, query));
}

/**
 * Removes a node (and all its descendants) from the tree by ID.
 * @param {string} nodeId
 * @param {Array} nodes
 * @returns {boolean} true if the node was found and removed. Emits session:change:openProject 
 */
export function removeNodeById(nodeId, nodes) {
  if (nodeId === null || !nodes)
    return false;

  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === nodeId) {
      nodes.splice(i, 1);
      return true;
    }
    if (removeNodeById(nodeId, nodes[i].children)) 
      return true;
  }

  session.set('openProject', [...session.get('openProject')]);
  return false;
}

/**
 * Collects all nodes in depth-first order (for export).
 * @param {Array} nodes
 * @returns {Array}
 */
export function flattenNodes(nodes) {
  if (!nodes)
    return [];

  const result = [];
  function walk(list) {
    list.forEach(node => {
      result.push(node);
      if (node.children.length) 
        walk(node.children);
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

// ─── Migrate ─────────────────────────────────────────────────────

export function  migrateProjects(project) {
  const defaultProject = createProject('unknown');
  
  return {
    ...defaultProject,
    ...project,
    builtIn: false,
    tabs: Array.isArray(project.tabs)
      ? project.tabs.map(tab => migrateTab(tab))
      : [createDefaultTab()]
  };
}

/**
 * Migrates a single tab object to the current schema.
 *
 * The tab is merged with a default tab definition and its nodes
 * are recursively migrated to ensure schema consistency.
 *
 * Behavior:
 * - Missing fields are filled from defaultTab
 * - Nodes are migrated recursively via migrateNode
 * - Invalid or missing node arrays are replaced with an empty array
 *
 * @param {Object} tab - Raw tab data
 * @returns {Object} Migrated tab object
 */
export function migrateTab(tab) {
  const defaultTab = createDefaultTab();

  return {
    ...defaultTab,
    ...tab,
    nodes: Array.isArray(tab.nodes)
      ? tab.nodes.map(node => migrateNode(node))
      : []
  };
}

/**
 * Migrates a node recursively into the current internal node schema.
 *
 * Each node is merged with a default node template and its children
 * are recursively processed to ensure full tree consistency.
 *
 * Behavior:
 * - Missing fields are filled from defaultNode
 * - Children are recursively migrated via migrateNode
 * - Invalid or missing children arrays are replaced with an empty array
 *
 * @param {Object} node - Raw node data
 * @returns {Object} Migrated node object
 */
export function migrateNode(node) {
  const defaultNode = createNode('');

  return {
    ...defaultNode,
    ...node,
    children: Array.isArray(node.children)
      ? node.children.map(child => migrateNode(child))
      : []
  };
}