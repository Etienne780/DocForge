import { eventBus } from '@core/EventBus.js';
import { isPlatformWeb } from '@core/Platform.js';
import { ElectronDocumentIOAdapter } from '@core/documentIO/ElectronDocumentIOAdapter.js';
import { WebDocumentIOAdapter } from '@core/documentIO/WebDocumentIOAdapter.js';
import { cleanProject, migrateProjects, openProjectInEditor } from '@data/ProjectManager.js';

// Handles opening/saving projects as a live file or folder on disk.
// This is a desktop-only concept: on web there is no persistent file reference -
// importing a project on web is a one-time read (see ImportHelper.js / Toolbar.js) and the
// full project snapshot is what gets stored in `recentProjects`, not a reference to a file.

const documentIO = isPlatformWeb()
  ? new WebDocumentIOAdapter()
  : new ElectronDocumentIOAdapter();

/**
 * Opens a file/folder picker (or a known path) and loads the project it contains.
 * Automatically opens the project (session + navigation) on success.
 *
 * @param {string} kind - 'file' | 'folder'
 * @param {string|null} directPath - Optional: reopen a known path without showing a picker.
 * @param {Object} [options]
 * @param {boolean} [options.addToRecents] - Defaults to true for a fresh pick, false when reopening a known path.
 * @returns {Promise<Object|null>} The loaded project, or null on failure/cancel.
 */
export async function openDocument(kind, directPath = null, options = {}) {
  const addToRecents = options.addToRecents ?? !directPath;

  const result = directPath
    ? { ref: directPath, kind, data: await documentIO.read(directPath, kind) }
    : await documentIO.open(kind);

  if (!result)
    return null;

  let parsed;
  try {
    parsed = JSON.parse(result.data);
  } catch (error) {
    eventBus.emit('toast:show', { message: 'Failed to open project: invalid file.', type: 'error' });
    return null;
  }

  const project = _deserializeProject(parsed, result.kind ?? kind);
  if (!project) {
    eventBus.emit('toast:show', { message: 'Failed to open project: missing project data.', type: 'error' });
    return null;
  }

  project.sourcePath = result.ref;
  project.sourceKind = result.kind ?? kind;

  openProjectInEditor(project, { addToRecents });
  return project;
}

/**
 * Writes the project back to its known source (file or folder). No-op if the
 * project has no sourcePath (e.g. a web / in-memory project).
 * @param {Object} project
 * @returns {Promise<boolean>}
 */
export async function saveDocument(project) {
  if (!project || !project.sourcePath)
    return false;

  if (!documentIO.supportsLiveSave()) {
    eventBus.emit('toast:show', { message: 'Saving to the original file is not supported here.', type: 'error' });
    return false;
  }

  const payload = JSON.stringify(serializeProject(project, project.sourceKind), null, 2);
  const ok = await documentIO.write(project.sourcePath, project.sourceKind, payload);
  project.isDirty = !ok;
  return ok;
}

/**
 * Reads a folder project from disk and returns it as a single, fully-merged
 * project-shaped object (content inlined, theme/languages embedded) - the
 * same reconciliation openDocument('folder') uses internally, exposed
 * separately for callers that need the data without opening/registering the
 * project live (e.g. importing a folder project as a new, disconnected
 * project with fresh ids).
 *
 * @param {string} folderPath
 * @returns {Promise<Object>} project-shaped data: { name, settings, tabs, theme, languages }
 */
export async function readFolderProjectData(folderPath) {
  const raw = await documentIO.read(folderPath, 'folder');
  const parsed = JSON.parse(raw);
  return _reconcileFolderProject(parsed);
}

export function getSaveCapabilities(project) {
  return {
    canSave: !!project.sourcePath && documentIO.supportsLiveSave(),
    canSaveAs: true,
    canSaveAsFolder: documentIO.supportsFolders(),
  };
}

// ─── Serialization ──────────────────────────────────────────────────────────
//
// 'file' projects are stored as a single, id-less JSON document - identical to the
// .dfproj import/export format. Re-opening a file always regenerates fresh internal ids.
//
// 'folder' projects are split across several files/folders on disk - see the
// layout comment in @core/AppMeta.js. They keep their tab/node ids (folder and
// file names are derived directly from them) so saves can be reconciled against
// what's already there instead of blindly overwriting everything.

/**
 * Builds the JSON-serializable payload for `documentIO.write`.
 * @param {Object} project
 * @param {string} kind - 'file' | 'folder'
 * @returns {Object}
 */
export function serializeProject(project, kind) {
  if (kind !== 'folder')
    return { project: cleanProject(project) };

  // { [tabId]: { [nodeId]: { name, content } } } - written as one .md file
  // per node (see ElectronDocumentIOAdapter._writeTabFolders).
  const nodeContents = {};

  const stripContent = (nodes, tabId) => (nodes ?? []).map(node => {
    nodeContents[tabId][node.id] = { name: node.name, content: node.content ?? '' };
    return { id: node.id, name: node.name, children: stripContent(node.children, tabId) };
  });

  const tabs = (project.tabs ?? []).map(tab => {
    nodeContents[tab.id] = {};
    return { id: tab.id, name: tab.name, nodes: stripContent(tab.nodes, tab.id) };
  });

  return {
    project: { name: project.name, settings: project.settings, tabs },
    theme: project.theme ?? null,
    languages: project.languages ?? [],
    __nodeContents: nodeContents,
  };
}

/**
 * Reconstructs a runtime project from a payload previously built by `serializeProject`.
 * @param {Object} parsed
 * @param {string} kind - 'file' | 'folder'
 * @returns {Object|null}
 */
function _deserializeProject(parsed, kind) {
  if (!parsed?.project)
    return null;

  if (kind === 'folder')
    return migrateProjects(_reconcileFolderProject(parsed));

  return migrateProjects(parsed.project);
}

/**
 * Reconciles the config file's project (hierarchy/names only, no content) with
 * what the active documentIO adapter's `_readFolder()` actually found on disk:
 * - fills in node content from `__nodeContents`
 * - any node file that exists but isn't referenced anywhere in a tab's node
 *   tree is appended flat at the root of the tab it was found in
 * - any tab folder that exists on disk but isn't in the config file's tab
 *   list becomes a new tab (folder name used as id and name)
 * - `theme` / `languages` are taken as-is from their own files, never from the config
 *
 * This is deliberately folder-structure-driven rather than config-path-driven,
 * so manually adding a node file, tab folder, or language file and reopening
 * the project is enough for it to show up.
 *
 * @param {Object} parsed - { project, theme, languages, __nodeContents }, as
 *                           returned by documentIO.read(path, 'folder')
 * @returns {Object} project (still needs migrateProjects() applied)
 */
function _reconcileFolderProject(parsed) {
  const nodeContentsByTab = parsed.__nodeContents ?? {};
  const configTabs = parsed.project.tabs ?? [];
  const configTabsById = new Map(configTabs.map(tab => [tab.id, tab]));

  // Every folder found on disk (incl. ones the config file doesn't know
  // about yet) drives the tab list - not just what's listed in the config.
  const allTabIds = new Set([...configTabsById.keys(), ...Object.keys(nodeContentsByTab)]);

  const tabs = Array.from(allTabIds).map(tabId => {
    const configTab = configTabsById.get(tabId);
    const tabNodeContents = nodeContentsByTab[tabId] ?? {};

    const usedNodeIds = new Set();
    const mergeTree = (nodes) => (nodes ?? []).map(node => {
      usedNodeIds.add(node.id);
      const file = tabNodeContents[node.id];
      return {
        id: node.id,
        name: file?.name ?? node.name,
        content: file?.content ?? '',
        children: mergeTree(node.children),
      };
    });

    const nodes = mergeTree(configTab?.nodes);

    // Node files not referenced anywhere in the tree -> flat at the tab root.
    for (const [nodeId, file] of Object.entries(tabNodeContents)) {
      if (usedNodeIds.has(nodeId)) 
          continue;
      nodes.push({ id: nodeId, name: file.name, content: file.content, children: [] });
    }

    return {
      id: tabId,
      name: configTab?.name ?? tabId,
      nodes,
    };
  });

  return {
    ...parsed.project,
    tabs,
    theme: parsed.theme ?? null,
    languages: parsed.languages ?? [],
  };
}