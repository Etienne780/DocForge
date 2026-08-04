// data/DocumentManager.js
//
// Handles opening/saving projects as a live file or folder on disk ("open like Word").
// This is a desktop-only concept: on web there is no persistent file reference anymore -
// importing a project on web is a one-time read (see ImportHelper.js / Toolbar.js) and the
// full project snapshot is what gets stored in `recentProjects`, not a reference to a file.
import { eventBus } from '@core/EventBus.js';
import { isPlatformWeb } from '@core/Platform.js';
import { ElectronDocumentIOAdapter } from '@core/documentIO/ElectronDocumentIOAdapter.js';
import { WebDocumentIOAdapter } from '@core/documentIO/WebDocumentIOAdapter.js';
import { cleanProject, migrateProjects, openProject } from '@data/ProjectManager.js';

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
  project.lastOpenedAt = Date.now();

  openProject(project, { addToRecents });
  return project;
}

/**
 * Writes the project back to its known source (file or folder). No-op if the
 * project has no sourcePath (e.g. a web / in-memory project).
 * @param {Object} project
 * @returns {Promise<boolean>}
 */
export async function saveDocument(project) {
  if (!project.sourcePath)
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
// 'folder' projects keep their node ids and split content out into `__nodeContents`
// (id -> markdown), since ElectronDocumentIOAdapter writes one .md file per node and
// needs stable ids across saves to know which files to update/remove.

/**
 * Builds the JSON-serializable payload for `documentIO.write`.
 * @param {Object} project
 * @param {string} kind - 'file' | 'folder'
 * @returns {Object}
 */
export function serializeProject(project, kind) {
  if (kind !== 'folder')
    return { project: cleanProject(project) };

  const nodeContents = {};
  const stripContent = (nodes) => (nodes ?? []).map(node => {
    nodeContents[node.id] = node.content ?? '';
    return { id: node.id, name: node.name, children: stripContent(node.children) };
  });

  const tabs = (project.tabs ?? []).map(tab => ({
    id: tab.id,
    name: tab.name,
    nodes: stripContent(tab.nodes),
  }));

  return {
    project: { name: project.name, theme: project.theme, settings: project.settings, tabs },
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

  if (kind === 'folder') {
    const nodeContents = parsed.__nodeContents ?? {};
    const mergeContent = (nodes) => (nodes ?? []).map(node => ({
      ...node,
      content: nodeContents[node.id] ?? '',
      children: mergeContent(node.children),
    }));

    parsed.project.tabs = (parsed.project.tabs ?? []).map(tab => ({
      ...tab,
      nodes: mergeContent(tab.nodes),
    }));
  }

  return migrateProjects(parsed.project);
}
