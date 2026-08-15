import { isPlatformWeb } from '@core/Platform.js';
import { addRecentProject } from '@data/ProjectManager.js';
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