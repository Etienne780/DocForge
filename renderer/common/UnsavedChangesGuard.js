import { eventBus } from '@core/EventBus.js';
import { isPlatformWeb } from '@core/Platform.js';
import { viewManager } from '@core/ViewManager.js';
import { backupManager } from '@core/BackupManager.js';
import { getOpenProject, hasUnsavedChanges } from '@data/ProjectManager.js';
import { saveOpenProject } from '@common/ProjectPersistence.js';
import { askChoice } from '@common/BaseModals.js';

// Asks before the open project is left with unsaved changes (Hub, new project,
// app close, reload): save them, discard them or stay in the project.

let _pendingLeave = null;
let _discardedProject = null;

/**
 * Resolves true if the open project can be left: nothing unsaved, saved, or
 * the user chose to discard the changes. False if the user stays.
 * Concurrent calls share one dialog.
 * @returns {Promise<boolean>}
 */
export function confirmLeaveOpenProject() {
  const project = getOpenProject();
  if (!hasUnsavedChanges(project) || project === _discardedProject)
    return Promise.resolve(true);

  _pendingLeave ??= _askLeave(project).finally(() => { _pendingLeave = null; });
  return _pendingLeave;
}

/** Registers the navigation guard (leaving to the Hub) and, on web, the page-unload prompt. */
export function initUnsavedChangesGuard() {
  viewManager.setNavigationGuard(event =>
    event !== 'navigate:projectHub' || confirmLeaveOpenProject()
  );

  // web: the browser only shows its own generic prompt
  if (isPlatformWeb()) {
    window.addEventListener('beforeunload', event => {
      const project = getOpenProject();
      if (hasUnsavedChanges(project) && project !== _discardedProject)
        event.preventDefault();
    });
  }
}

async function _askLeave(project) {
  const choice = await askChoice({
    title: 'Unsaved changes',
    message: `Do you want to save your changes to "${project.name}"?`,
    choices: [
      { id: 'discard', label: "Don't save" },
      { id: 'cancel',  label: 'Cancel' },
      { id: 'save',    label: 'Save', style: 'primary' },
    ],
  });

  switch (choice) {
    case 'save': {
      const ok = await saveOpenProject();
      if (!ok)
        eventBus.emit('toast:show', { message: 'Failed to save the project.', type: 'error' });
      return ok;
    }

    case 'discard':
      _discardedProject = project;
      await backupManager.markResolved(project);
      return true;

    default:
      return false;
  }
}
