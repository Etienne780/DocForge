import { 
  RECENT_PROJECT_SOURCE_TYPE_FILE,
  RECENT_PROJECT_SOURCE_TYPE_FOLDER,
  RECENT_PROJECT_SOURCE_TYPE_IN_APP
} from '@core/AppMeta.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { PROJECT_PRESETS } from '@core/presets/ProjectPresets.js';
import { isPlatformWeb } from '@core/Platform.js';
import { generateId, isQueryMatchesBuiltIn } from '@common/Common.js';

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
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
    tabs: [createDefaultTab()],
    themes: [],
    languages: [],        // all custome langs
    languagesStyles: [],  // all custome language styles
    settings: createProjectSettings(),

    sourcePath: null,   // absolute path. is null on web
    sourceKind: null,   // 'file' | 'folder' | null

    // session attributes (att that will not be stored)
    session: createProjectSession(),

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
 * Creates a new settings object
 * @returns {Object}
 */
export function createProjectSettings() {
  const defaultSettings = {
    isThemePreset: false,
    currentThemeId: null, // isThemePreset ? preset id : theme id
  }

  return defaultSettings;
}

/**
 * Creates a fresh, empty session object for a project.
 *
 * `deletedTabIds`/`deletedNodeIds` are populated by `removeTabById` /
 * `removeNodeById` whenever a tab/node is removed from a *folder*-kind
 * project, so DocumentManager knows which folder/file to explicitly delete
 * from disk on the next save - see `serializeProject` /
 * `ElectronDocumentIOAdapter._deleteExplicit`. Both maps are cleared again
 * once that save succeeds.
 *
 * @returns {Object}
 */
export function createProjectSession() {
  const defaultSession = {
    builtIn: false,
    codeBlockCache: new Map(),
    // desktop only
    deletedTabIds: {},  // { [tabId]: folderName }
    deletedNodeIds: {}, // { [nodeId]: { tabFolderName, fileName } }
    isDirty: false,     // changed since last save
  };

  return defaultSession;
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
    session,
    createdAt,
    lastOpenedAt,
    tabs,
    sourcePath,
    sourceKind,
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
  
  for(let i = 0; i < recentProjects.length; i++) {
    const curr = recentProjects[i];
    if (curr.sourceKind === project.sourceKind && 
      curr.sourcePath === project.sourcePath) {
      return curr.id;
    }
  }

  if (isPlatformWeb()) {
    project.sourceKind = RECENT_PROJECT_SOURCE_TYPE_IN_APP;
    recentProjects.push({
      id: project.id,
      name: project.name,
      lastOpenedAt: project.lastOpenedAt,
      // differs from desktop
      project: project,
      sourceKind: RECENT_PROJECT_SOURCE_TYPE_IN_APP,
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
  return recentProjects[recentProjects.length - 1].id;
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
 * Opens a project from der recent-projects list by id and navigates to the
 * DocEditor.
 *
 * - Web-Einträge tragen den kompletten Projekt-Snapshot inline (`entry.project`)
 *   und werden 1:1 geöffnet, da es keine Datei zum Nachladen gibt.
 * - Desktop-Einträge tragen `sourcePath`/`sourceKind` und werden über
 *   DocumentManager.openDocument() erneut geöffnet - das navigiert bei Erfolg
 *   selbst und fügt einen bekannten Pfad nie erneut zu recents hinzu.
 * - Ein kaputter/veralteter Eintrag (fehlende Daten, oder Datei/Ordner lässt
 *   sich nicht mehr öffnen) wird aus recents entfernt statt still zu scheitern.
 *
 * @param {string} projectId
 * @returns {Promise<void>}
 */
export async function openRecentProject(projectId) {
  const recentProjects = state.get('recentProjects');
  const entry = recentProjects.find(p => p.id === projectId);

  if (!entry) {
    eventBus.emit('toast:show', { message: 'Project not found in recents.', type: 'error' });
    return;
  }

  if (entry.project) {
    entry.project.id = projectId;
    openProjectInEditor(entry.project, { addToRecents: false });
    return;
  }

  if (!entry.sourcePath) {
    eventBus.emit('toast:show', { message: 'Cannot open project: Invalid entry.', type: 'error' });
    return;
  }

  try {
    // Dynamic import to avoid a static import cycle - DocumentManager.js
    const { openDocument } = await import('@core/DocumentManager.js');

    // openDocument navigates itself on success; reopening a known path never
    // re-adds it to recents.
    const result = await openDocument(entry.sourceKind || RECENT_PROJECT_SOURCE_TYPE_FILE, entry.sourcePath);
    if (!result)
      removeRecentProject(projectId);
    else 
      result.id = projectId;
  } catch (error) {
    eventBus.emit('toast:show', {
      message: `Failed to open project: ${error.message}`,
      type: 'error'
    });
    removeRecentProject(projectId);
  }
}

/**
 * Opens a project
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

  let projToOpen = project
  if (options.addToRecents) {
    const projectId = addRecentProject(project);
    if (projectId !== projToOpen.id) {
      openRecentProject(projectId);
      return;
    } 
  }

  session.set('openProject', projToOpen);
  eventBus.emit('navigate:docEditor');
}

/**
 * Opens a project and navigates to the DocEditor.
 *
 * @param {Object} project - The project object to open.
 * @param {Object} options - Optional parameters.
 * @param {boolean} options.addToRecents - Whether the project should be added to the recent projects list (default: true).
 */
export function openProjectInEditor(project, options = { addToRecents: true }) {
  openProject(project, options);
  eventBus.emit('navigate:docEditor');
}

/**
 * Closes a current open project
 */
export function closeProject() {
  eventBus.emit('save:request');
  session.set('openProject', null);
  session.set('activeTabId', null);
  session.set('activeNodeId', null);
  eventBus.emit('navigate:projectHub');
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

export function updateProjectLastOpenedAt(projectId, lastOpenedAt = null) {
  const recentProjects = state.get('recentProjects');
  if (!recentProjects)
    return false;

  const previous = { ...recentProjects };
  const project = recentProjects.find((a) => a.id === projectId);
  if (!project)
      return false;

  project.lastOpenedAt = lastOpenedAt ?? Date.now();

  state.notify('recentProjects', { value: recentProjects, previousValue: previous }, 'lastOpenedAt');
  return true;
}

export function findRecentProject(projectId) {
  const recentProjects = state.get('recentProjects');
  if (!recentProjects)
    return null;
  return recentProjects.find((a) => a.id === projectId);
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
 * Changes the active tab if the removed tab was active. Records the tab's
 * on-disk folder name in `project.session.deletedTabIds` (folder-kind
 * projects only really care, but it's harmless to always record) so
 * DocumentManager can explicitly delete the folder on the next save,
 * independent of the regular orphan-cleanup diff - see
 * `ElectronDocumentIOAdapter._deleteExplicit`.
 * @param {string} tabID
 * @param {Object} project
 * @returns {boolean} true if the tab was found and removed, false otherwise. Emits session:change:openProject:tabs
 */
export function removeTabById(tabID, project) {
  if (tabID === null || !project)
    return false;

  const tab = findTab(tabID, project.tabs);
  if (!tab)
    return false;

  project.tabs.splice(project.tabs.indexOf(tab), 1);

  project.session ??= createProjectSession();
  project.session.deletedTabIds[tabID] = tab.folderName ?? tab.name;

  const activeID = session.get('activeTabId');
  if (activeID === tabID) {
    const newID = project.tabs.length > 0 ? project.tabs[0].id : null;
    session.set('activeTabId', newID);
  }

  return true;
}

/**
 * Returns true if the recent project match the (lowercase) search query.
 * @param {Object} recentProject
 * @param {string} query - Should already be lowercased
 * @returns {boolean}
 */
export function recentProjectMatchesSearch(recentProject, query) {
  if (!query)
    return true;
  return recentProject.name.toLowerCase().includes(query);
}

/**
 * Returns true if the project preset match the (lowercase) search query.
 * @param {Object} projectPreset
 * @param {string} query - Should already be lowercased
 * @returns {boolean}
 */
export function projectPresetMatchesSearch(projectPreset, query) {
  if (!query) 
    return true;
  if(isQueryMatchesBuiltIn(query) && projectPreset.builtIn)
    return true;
  return projectPreset.name.toLowerCase().includes(query);
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
          session: createProjectSession(),
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
 *
 * When `project` is supplied, also records the removed node's on-disk file
 * name in `project.session.deletedNodeIds` (keyed by `tabFolderName` -
 * pass the owning tab's `folderName`) so DocumentManager can explicitly
 * delete the file on the next save, independent of the regular
 * orphan-cleanup diff - see `ElectronDocumentIOAdapter._deleteExplicit`.
 * `project`/`tabFolderName` are optional so existing call sites that don't
 * care about disk cleanup (e.g. in-memory-only manipulation) keep working.
 *
 * @param {string} nodeId
 * @param {Array} nodes
 * @param {Object|null} [project]
 * @param {string|null} [tabFolderName]
 * @returns {boolean} true if the node was found and removed. Emits session:change:openProject
 */
export function removeNodeById(nodeId, nodes, project = null, tabFolderName = null) {
  if (nodeId === null || !nodes)
    return false;

  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === nodeId) {
      const [removed] = nodes.splice(i, 1);

      if (project) {
        project.session ??= createProjectSession();
        project.session.deletedNodeIds[nodeId] = {
          tabFolderName,
          fileName: removed.fileName ?? removed.name,
        };
      }

      return true;
    }
    if (removeNodeById(nodeId, nodes[i].children, project, tabFolderName))
      return true;
  }

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
    session: createProjectSession(),
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