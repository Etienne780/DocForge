import { state } from '@core/State.js'
import { storageManager } from '@core/storage/StorageManager.js'
import { saveDocument } from '@core/DocumentManager.js'
import { getOpenProject } from '@data/ProjectManager';

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

  storageManager.subscribe('projects', {
    save: () => saveDocument(getOpenProject()),
    load: () => {},
    reset: () => {},
  }, { selfPersisted: true });

  window.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      await storageManager.saveNow();
      window.location.reload();
    }
  });

  await storageManager.loadNow();
}