import { state } from '@core/State.js'
import { storageManager } from '@core/storage/StorageManager.js'
import { eventBus } from '@core/EventBus.js'
import { saveOpenProject } from '@common/ProjectPersistence.js';
import { confirmLeaveOpenProject } from '@common/UnsavedChangesGuard.js'

/**
 * Inits the storage manager with the base sub events
 */
export async function registerStorageKeys() {
  storageManager.init();

  storageManager.subscribe('state', {
    save: () => state.uiStateSnapshot(),
    load: (data) => state.load(data),
    reset: () => state.uiStateReset(),
    merge: null,
  });

  storageManager.subscribe('recentProjects', {
    save: () => state.recentProjectsSnapshot(),
    load: (data) => state.loadRecentProjects(data),
    reset: () => state.resetRecentProjects(),
    merge: null,
  });

  storageManager.subscribe('projectPresets', {
    save: () => state.projectPresetsSnapshot(),
    load: (data) => state.loadProjectPresets(data),
    reset: () => state.resetProjectPresets(),
    merge: null,
  });

  storageManager.subscribe('themePresets', {
    save: () => state.themePresetsSnapshot(),
    load: (data) => state.loadThemePresets(data),
    reset: () => state.resetThemePresets(),
    merge: null,
  });

  // The open project is not a storage key: it is only written on an explicit
  // save (Ctrl+S / Save All), never by the auto-save.
  eventBus.on('save:request:openProject', () => saveOpenProject());

  window.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      if (!(await confirmLeaveOpenProject()))
        return;

      await storageManager.saveNow();
      window.location.reload();
    }
  });

  await storageManager.loadNow();
}