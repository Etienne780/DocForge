import { PROJECT_SCHEMA_VERSION } from '@core/AppMeta.js';
import { eventBus } from '@core/EventBus.js';
import { wrapEntity, unwrapEntity } from '@core/Envelope.js';
import { isPlatformWeb } from '@core/Platform.js';
import { ElectronDocumentIOAdapter } from '@core/documentIO/ElectronDocumentIOAdapter.js';
import { WebDocumentIOAdapter } from '@core/documentIO/WebDocumentIOAdapter.js';
import { cleanProject, openProjectInEditor, generateTabId, generateNodeId } from '@data/ProjectManager.js';
import { migrateProject } from '@migration/ProjectMigration.js';

// Handles opening/saving projects as a live file or folder on disk.
// This is a desktop-only concept: on web there is no persistent file reference -
// importing a project on web is a one-time read (see ImportHelper.js / Toolbar.js) and the
// full project snapshot is what gets stored in `recentProjects`, not a reference to a file.

const documentIO = isPlatformWeb()
  ? new WebDocumentIOAdapter()
  : new ElectronDocumentIOAdapter();

/**
 * Writes a full copy of the project as a folder structure to an arbitrary
 * target path — used for one-off exports, unlike saveDocument() which writes
 * back to the project's own sourcePath and updates its dirty/deleted-state.
 * Does NOT touch project.sourcePath, project.isDirty, or project.session.
 *
 * @param {Object} project
 * @param {string} targetFolderPath - absolute path to the folder to write into
 * @param {string} folderName - name of the folder
 * @returns {Promise<boolean>}
 */
export async function exportProjectAsFolder(project, targetFolderPath) {
  if (!project || !targetFolderPath)
    return false;

  if (!documentIO.supportsFolders()) {
    eventBus.emit('toast:show', { message: 'Folder export is not supported here.', type: 'error' });
    return false;
  }

  const payload = JSON.stringify(serializeProject(project, 'folder'), null, 2);
  return documentIO.write(targetFolderPath, 'folder', payload);
}

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
 *
 * For folder-kind projects, before writing, absorbs any content that was
 * added directly on disk since the project was last read (see
 * `_absorbNewDiskContent`) so that the write's orphan-cleanup never deletes
 * something the user just created outside the app - "editing the project
 * through the folder" only works if new files survive the next save.
 *
 * On success for a folder-kind project, also clears
 * `project.session.deletedTabIds`/`deletedNodeIds` - their contents were
 * already included in this save's payload (see `serializeProject`) and acted
 * on by the adapter, so they'd otherwise be re-sent (harmlessly, but
 * pointlessly) on every future save.
 *
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

  if (project.sourceKind === 'folder')
    await _absorbNewDiskContent(project);

  const payload = JSON.stringify(serializeProject(project, project.sourceKind), null, 2);
  const ok = await documentIO.write(project.sourcePath, project.sourceKind, payload);
  project.isDirty = !ok;

  if (ok && project.sourceKind === 'folder' && project.session) {
    project.session.deletedTabIds = {};
    project.session.deletedNodeIds = {};
    project.session.renamedTabIds = {};
    project.session.renamedNodeIds = {};
  }

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
 * @returns {Promise<Object>} project-shaped data: { name, settings, tabs, themes, languages }
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

// ─── Absorbing disk-only additions before save ──────────────────────────────
//
// `saveDocument()` always overwrites the folder with exactly what's in
// memory, then deletes anything on disk that isn't part of that payload
// (orphan cleanup, see ElectronDocumentIOAdapter._removeOrphanedFiles /
// _removeOrphanedTabFolders). That's correct for content the app itself
// removed (tracked explicitly via session.deletedTabIds/deletedNodeIds), but
// it's destructive for content a user added *directly in the folder*
// (outside the app) since the project was last read - the in-memory project
// has no idea it exists, so it would look like an orphan and get deleted on
// the very next save.
//
// `_absorbNewDiskContent` closes that gap: right before a save, it re-reads
// the folder and pulls in anything present on disk but not yet known to the
// project - new tab folders, new node files inside known tabs, new theme/
// language files - so it survives the save instead of being wiped. Content
// the user just deleted *in the app* (and is about to be deleted on disk by
// this same save, via session.deletedTabIds/deletedNodeIds) is explicitly
// skipped, otherwise it would be "absorbed" back in a split second before
// being removed.
//
// This is intentionally a one-way absorption (disk → memory), not a full
// re-sync: anything the project already knows about is left exactly as the
// in-memory state has it, even if its on-disk content differs (that's a
// conflict the app's own editor state should win, not something to silently
// merge here).

/**
 * @param {Object} project - mutated in place
 * @returns {Promise<Object>} the same project
 */
async function _absorbNewDiskContent(project) {
  if (project.sourceKind !== 'folder' || !project.sourcePath)
    return project;

  let disk;
  try {
    disk = JSON.parse(await documentIO.read(project.sourcePath, 'folder'));
  } catch {
    return project;
  }

  const nodeContentsByFolder = disk.__nodeContents ?? {};

  const pendingDeletedFolders = new Set(Object.values(project.session?.deletedTabIds ?? {}));
  const pendingRenamedFolders = new Set(Object.values(project.session?.renamedTabIds ?? {}));

  const pendingDeletedNodeKeys = new Set(
    Object.values(project.session?.deletedNodeIds ?? {})
      .map(({ tabFolderName, fileName } = {}) => tabFolderName && fileName ? `${tabFolderName}/${fileName}` : null)
      .filter(Boolean)
  );
  const pendingRenamedNodeKeys = new Set(
    Object.values(project.session?.renamedNodeIds ?? {})
      .map(({ tabFolderName, fileName } = {}) => tabFolderName && fileName ? `${tabFolderName}/${fileName}` : null)
      .filter(Boolean)
  );

  project.tabs = project.tabs ?? [];
  const knownFolderNames = new Set(project.tabs.map(tab => tab.folderName));

  // New tab folders found on disk that the project doesn't know about yet.
  for (const [folderName, folderContents] of Object.entries(nodeContentsByFolder)) {
    if (knownFolderNames.has(folderName) || pendingDeletedFolders.has(folderName) || pendingRenamedFolders.has(folderName))
      continue;

    const nodes = Object.entries(folderContents).map(([fileName, file]) => ({
      id: file.id ?? generateNodeId(),
      name: file.name,
      fileName,
      content: file.content ?? '',
      children: [],
    }));

    project.tabs.push({ id: generateTabId(), name: folderName, folderName, nodes });
  }

  // New node files found inside tabs the project already knows about.
  for (const tab of project.tabs) {
    const folderContents = nodeContentsByFolder[tab.folderName];
    if (!folderContents)
      continue;

    const knownFileNames = new Set(_collectFileNames(tab.nodes));
    tab.nodes = tab.nodes ?? [];

    for (const [fileName, file] of Object.entries(folderContents)) {
      const key = `${tab.folderName}/${fileName}`;
      if (knownFileNames.has(fileName) || pendingDeletedNodeKeys.has(key) || pendingRenamedNodeKeys.has(key))
        continue;

      tab.nodes.push({
        id: file.id ?? generateNodeId(),
        name: file.name,
        fileName,
        content: file.content ?? '',
        children: [],
      });
    }
  }

  project.themes = project.themes ?? [];
  const knownThemeIds = new Set(project.themes.map(theme => theme.id));
  for (const theme of disk.themes ?? []) {
    if (!knownThemeIds.has(theme.id))
      project.themes.push(theme);
  }

  project.languages = project.languages ?? [];
  const knownLanguageIds = new Set(project.languages.map(lang => lang.id));
  for (const lang of disk.languages ?? []) {
    if (!knownLanguageIds.has(lang.id))
      project.languages.push(lang);
  }

  return project;
}

function _collectFileNames(nodes) {
  return (nodes ?? []).flatMap(node => [node.fileName ?? node.name, ..._collectFileNames(node.children)]);
}

// ─── Filesystem-safe naming ─────────────────────────────────────────────────
//
// Folder-project tabs/nodes (and, the same way, themes/languages - see
// ElectronDocumentIOAdapter._writeThemes/_writeLanguages) are written to disk
// under human-readable names instead of their internal ids, so the resulting
// project folder is browsable and diffable on its own (e.g. in git) instead
// of being a pile of `tab_a1b2c3/node_x9y8z7.md`-style paths.
//
// Since names aren't unique or filesystem-safe by nature (two tabs/nodes/
// themes/languages can share a name, or contain characters that aren't valid
// in a path), each name is turned into a disambiguated "slug" via
// `uniqueSlug()` - that slug is what actually becomes the folder/file name on
// disk, while `id` stays the stable internal identifier used everywhere else
// (tree structure, selection state, etc.). For tabs/nodes the chosen slug is
// persisted alongside the id in the config (`tabs[].folderName`,
// `...nodes[].fileName`) so re-reading a folder can match disk entries back
// to the right tree position even across renames or same-name collisions -
// see `_reconcileFolderProject`. Themes/languages don't need that: their id
// is embedded in the file itself (via wrapEntity/unwrapEntity), so the
// filename is purely cosmetic and can be recomputed fresh on every save.

const INVALID_FS_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Turns an arbitrary tab/node/theme/language name into a filesystem-safe
 * base name. Falls back to a generic name if nothing usable remains (e.g. a
 * name made up entirely of invalid characters).
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
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
export function uniqueSlug(name, usedNames) {
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
    return wrapEntity('project', PROJECT_SCHEMA_VERSION, cleanProject(project));

  const nodeContents = {};
  const usedTabNames = new Set();

  const stripContent = (nodes, tabFolderName, usedNodeNames) => (nodes ?? []).map(node => {
    const fileName = uniqueSlug(node.name, usedNodeNames);
    node.fileName = fileName;
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
    tab.folderName = folderName;
    nodeContents[folderName] = {};
    const usedNodeNames = new Set();
    return {
      id: tab.id,
      name: tab.name,
      folderName,
      nodes: stripContent(tab.nodes, folderName, usedNodeNames),
    };
  });

  return {
    project: { name: project.name, settings: project.settings, tabs },
    themes: project.themes ?? [],
    languages: project.languages ?? [],
    __nodeContents: nodeContents,
    __deletedTabFolders: Object.values(project.session?.deletedTabIds ?? {}),
    __deletedNodeFiles: Object.values(project.session?.deletedNodeIds ?? {}),
  };
}

/**
 * Reconstructs a runtime project from a payload previously built by `serializeProject`.
 * @param {Object} parsed
 * @param {string} kind - 'file' | 'folder'
 * @returns {Object|null}
 */
function _deserializeProject(parsed, kind) {
  if (kind === 'folder')
    return migrateProject(_reconcileFolderProject(parsed), parsed.storageVersion ?? 0);
  return unwrapEntity(parsed, migrateProject, PROJECT_SCHEMA_VERSION);
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
 *   tree is appended flat at the root of the tab it was found in. Its id is
 *   recovered from the file's frontmatter (`__nodeContents[...].id`) when
 *   present, so it survives across reads instead of getting a new one every
 *   time the same orphan is re-discovered; only truly new files (no
 *   frontmatter id, e.g. hand-created on disk) get a freshly generated one
 * - any tab folder that exists on disk but isn't in the config file's tab
 *   list becomes a new tab (folder name used as name, fresh id generated)
 * - `themes` / `languages` are taken as-is from their own files, never from
 *   the config - a project can have multiple user-created themes; which one
 *   is active is tracked separately in `project.settings.currentThemeId`
 *
 * This is deliberately folder-structure-driven rather than config-path-driven,
 * so manually adding a node file, tab folder, or language file and reopening
 * the project is enough for it to show up - see @core/AppMeta.js.
 *
 * (This is the "read time" counterpart to `_absorbNewDiskContent` above,
 * which does the equivalent job right before a *save* so disk-only additions
 * survive a write even without the user reopening the project first.)
 *
 * @param {Object} parsed - { project, theme, languages, __nodeContents }, as
 *                           returned by documentIO.read(path, 'folder')
 * @returns {Object} project (still needs migrateProject() applied)
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
        id: file.id ?? generateNodeId(),
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
    themes: parsed.themes ?? [],
    languages: parsed.languages ?? [],
  };
}