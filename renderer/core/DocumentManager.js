import { eventBus } from '@core/EventBus.js';
import { isPlatformWeb } from '@core/Platform.js';
import { ElectronDocumentIOAdapter } from '@core/documentIO/ElectronDocumentIOAdapter.js';
import { WebDocumentIOAdapter } from '@core/documentIO/WebDocumentIOAdapter.js';
import { cleanProject, migrateProjects, openProjectInEditor, generateTabId, generateNodeId } from '@data/ProjectManager.js';

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

// ─── Filesystem-safe naming ─────────────────────────────────────────────────
//
// Folder-project tabs/nodes are written to disk under human-readable names
// instead of their internal ids, so the resulting project folder is browsable
// and diffable on its own (e.g. in git) instead of being a pile of
// `tab_a1b2c3/node_x9y8z7.md`-style paths.
//
// Since names aren't unique or filesystem-safe by nature (two tabs/nodes can
// share a name, or contain characters that aren't valid in a path), each name
// is turned into a disambiguated "slug" via `uniqueSlug()` - that slug is what
// actually becomes the folder/file name on disk, while `id` stays the stable
// internal identifier used everywhere else (tree structure, selection state,
// etc.). The chosen slug is persisted alongside the id in the config
// (`tabs[].folderName`, `...nodes[].fileName`) so re-reading a folder can
// match disk entries back to the right tree position even across renames or
// same-name collisions - see `_reconcileFolderProject`.

const INVALID_FS_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Turns an arbitrary tab/node name into a filesystem-safe base name.
 * Falls back to a generic name if nothing usable remains (e.g. a name made
 * up entirely of invalid characters).
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  const cleaned = (name ?? '')
    .replace(INVALID_FS_CHARS, '')
    .trim()
    .replace(/\.+$/, ''); // trailing dots are invalid/stripped on Windows

  return cleaned || 'Unbenannt';
}

/**
 * Picks a filesystem-safe name for `name` that is unique within `usedNames`,
 * appending " (2)", " (3)", … on collision (e.g. two tabs both named "Setup"
 * become "Setup" and "Setup (2)"). Mutates `usedNames` as a side effect.
 * @param {string} name
 * @param {Set<string>} usedNames - lower-cased names already taken in this scope.
 * @returns {string}
 */
function uniqueSlug(name, usedNames) {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${base} (${suffix})`;
    suffix++;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

// ─── Serialization ──────────────────────────────────────────────────────────
//
// 'file' projects are stored as a single, id-less JSON document - identical to the
// .dfproj import/export format. Re-opening a file always regenerates fresh internal ids.
//
// 'folder' projects are split across several files/folders on disk - see the
// layout comment in @core/AppMeta.js. Tree structure (nesting, order) is kept
// in the config via `id`, but the actual folder/file each tab/node is written
// to is named after it (`folderName` / `fileName`, see "Filesystem-safe
// naming" above) rather than after its id, so saves can still be reconciled
// against what's already there instead of blindly overwriting everything.

/**
 * Builds the JSON-serializable payload for `documentIO.write`.
 * @param {Object} project
 * @param {string} kind - 'file' | 'folder'
 * @returns {Object}
 */
export function serializeProject(project, kind) {
  if (kind !== 'folder')
    return { project: cleanProject(project) };

  // { [tabFolderName]: { [nodeFileName]: { id, name, content } } } - written as
  // one .md file per node by whichever documentIO adapter handles the current
  // platform (see e.g. ElectronDocumentIOAdapter._writeTabFolders for the
  // desktop case). Node file names are unique per tab (flat namespace - all of
  // a tab's nodes land in the same folder regardless of nesting depth), tab
  // folder names are unique per project.
  const nodeContents = {};
  const usedTabNames = new Set();

  const stripContent = (nodes, tabFolderName, usedNodeNames) => (nodes ?? []).map(node => {
    const fileName = uniqueSlug(node.name, usedNodeNames);
    nodeContents[tabFolderName][fileName] = { id: node.id, name: node.name, content: node.content ?? '' };
    return {
      id: node.id,
      name: node.name,
      fileName,
      children: stripContent(node.children, tabFolderName, usedNodeNames),
    };
  });

  const tabs = (project.tabs ?? []).map(tab => {
    const folderName = uniqueSlug(tab.name, usedTabNames);
    nodeContents[folderName] = {};
    const usedNodeNames = new Set(); // flat per-tab namespace, see comment above
    return {
      id: tab.id,
      name: tab.name,
      folderName,
      nodes: stripContent(tab.nodes, folderName, usedNodeNames),
    };
  });

  return {
    // No `theme`/`languages` here - those are their own files (theme.dftheme,
    // languages/*.dflang), kept separate below so they round-trip independently.
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
 * - fills in node content from `__nodeContents`, matched by `fileName`/
 *   `folderName` (the actual on-disk name) rather than by id - a node/tab
 *   keeps its `id` (and therefore its selection/session state etc.) even if
 *   its file was renamed on disk between reads, as long as the config still
 *   lists it
 * - any node file that exists but isn't referenced anywhere in a tab's node
 *   tree is appended flat at the root of the tab it was found in, with a
 *   freshly generated id (there's nothing on disk to recover an old id from)
 * - any tab folder that exists on disk but isn't in the config file's tab
 *   list becomes a new tab (folder name used as name, fresh id generated)
 * - `theme` / `languages` are taken as-is from their own files, never from the config
 *
 * This is deliberately folder-structure-driven rather than config-path-driven,
 * so manually adding a node file, tab folder, or language file and reopening
 * the project is enough for it to show up - see @core/AppMeta.js.
 *
 * @param {Object} parsed - { project, theme, languages, __nodeContents }, as
 *                           returned by documentIO.read(path, 'folder')
 * @returns {Object} project (still needs migrateProjects() applied)
 */
function _reconcileFolderProject(parsed) {
  const nodeContentsByFolder = parsed.__nodeContents ?? {};
  const configTabs = parsed.project.tabs ?? [];
  const configTabsByFolder = new Map(
    configTabs.map(tab => [tab.folderName ?? tab.name, tab])
  );

  // Every folder found on disk (incl. ones the config file doesn't know
  // about yet) drives the tab list - not just what's listed in the config.
  const allFolderNames = new Set([...configTabsByFolder.keys(), ...Object.keys(nodeContentsByFolder)]);

  const tabs = Array.from(allFolderNames).map(folderName => {
    const configTab = configTabsByFolder.get(folderName);
    const folderContents = nodeContentsByFolder[folderName] ?? {};

    const usedFileNames = new Set();
    const mergeTree = (nodes) => (nodes ?? []).map(node => {
      const fileName = node.fileName ?? node.name;
      usedFileNames.add(fileName);
      const file = folderContents[fileName];
      return {
        id: node.id,
        name: file?.name ?? node.name,
        fileName,
        content: file?.content ?? '',
        children: mergeTree(node.children),
      };
    });

    const nodes = mergeTree(configTab?.nodes);

    // Node files not referenced anywhere in the tree -> flat at the tab root.
    for (const [fileName, file] of Object.entries(folderContents)) {
      if (usedFileNames.has(fileName))
        continue;
      nodes.push({
        id: generateNodeId(),
        name: file.name,
        fileName,
        content: file.content,
        children: [],
      });
    }

    return {
      id: configTab?.id ?? generateTabId(),
      name: configTab?.name ?? folderName,
      folderName,
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