import { RECENT_PROJECT_SOURCE_TYPE_FILE } from '@core/AppMeta.js';
import { eventBus } from '@core/EventBus.js';
import { state } from '@core/State.js';
import { isPlatformWeb } from '@core/Platform.js';
import { addRecentProject, getOpenProject, findRecentProject, notifyOpenProjectChange } from '@data/ProjectManager.js';
import { storageManager } from '@core/storage/StorageManager.js';

/**
 * Saves a project to disk (desktop) or to memory (web) and registers it
 * in the recent-projects list. Shared by CreateProjectModal and
 * ImportProjectModal so the persistence logic only lives in one place.
 * @param {Object} project - The project object to save
 * @returns {Promise<string>} The id the project was registered under
 */
export async function saveProject(project) {
  // ─── Desktop: Write to the known source path via DocumentManager ──
  if (!isPlatformWeb() && project.sourcePath) {
    const { saveDocument } = await import('@core/DocumentManager.js');
    const success = await saveDocument(project);
    if (!success) {
      throw new Error('Failed to write project file');
    }
  }

  // ─── Web & Desktop: Add to recents (saves in state) ──────────
  const projectId = addRecentProject(project);

  // ─── Persist storage ──────────────────────────────────────────
  await storageManager.saveNow('recentProjects');
  return projectId;
}

/**
 * Renames a project from the recent-projects list (or the open project) and
 * saves it. Only the project name changes, not the file/folder on disk.
 * @param {string} projectId
 * @param {string} newName
 * @returns {Promise<boolean>}
 */
export async function renameRecentProject(projectId, newName) {
  const project = await loadTargetProject(projectId);
  if (!project)
    return false;

  const entry = findRecentProject(projectId);
  if (entry)
    entry.name = newName;

  const ok = await commitTargetProject(project, p => { p.name = newName; }, 'name');

  const recentProjects = state.get('recentProjects');
  state.notify('recentProjects', { value: recentProjects, previousValue: recentProjects });
  return ok;
}

/**
 * Returns every project an element (theme, language, style) can be imported
 * into: the open project first, followed by the recent projects.
 * @returns {{ id: string, name: string, isOpen: boolean }[]}
 */
export function getImportTargetProjects() {
  const openProject = getOpenProject();
  const targets = openProject ? [{ id: openProject.id, name: openProject.name, isOpen: true }] : [];

  (state.get('recentProjects') ?? []).forEach(entry => {
    if (entry.id === openProject?.id || (!entry.project && !entry.sourcePath))
      return;
    targets.push({ id: entry.id, name: entry.name, isOpen: false });
  });

  return targets;
}

/**
 * Loads a project from `getImportTargetProjects()` without opening it in the
 * editor. On desktop a recent project is read from its source path.
 * @param {string} projectId
 * @returns {Promise<Object|null>}
 */
export async function loadTargetProject(projectId) {
  const openProject = getOpenProject();
  if (openProject?.id === projectId)
    return openProject;

  const entry = findRecentProject(projectId);
  if (!entry)
    return null;

  if (entry.project)
    return entry.project;

  const { openDocument } = await import('@core/DocumentManager.js');
  return openDocument(entry.sourceKind || RECENT_PROJECT_SOURCE_TYPE_FILE, entry.sourcePath, {
    openInEditor: false,
    addToRecents: false,
  });
}

/**
 * Applies `mutateFn` to a project loaded via `loadTargetProject()` and
 * persists it. The open project goes through notifyOpenProjectChange().
 * @param {Object} project
 * @param {(project: Object) => void} mutateFn
 * @param {string} extension - change event extension, e.g. 'themes'
 * @returns {Promise<boolean>}
 */
export async function commitTargetProject(project, mutateFn, extension) {
  if (project === getOpenProject()) {
    notifyOpenProjectChange(mutateFn, extension);
    eventBus.emit('save:request');
    return true;
  }

  mutateFn(project);

  if (!isPlatformWeb() && project.sourcePath) {
    const { saveDocument } = await import('@core/DocumentManager.js');
    return saveDocument(project);
  }

  const recentProjects = state.get('recentProjects');
  state.notify('recentProjects', { value: recentProjects, previousValue: recentProjects }, 'project');
  return storageManager.saveNow('recentProjects');
}
