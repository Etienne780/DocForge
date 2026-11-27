import { eventBus } from '@core/EventBus.js';
import { isPlatformWeb } from '@core/Platform.js';
import { viewManager } from '@core/ViewManager.js';
import { backupManager } from '@core/BackupManager.js';
import { getOpenProject, hasUnsavedChanges } from '@data/ProjectManager.js';
import { saveOpenProject } from '@common/ProjectPersistence.js';
import { askChoice } from '@common/BaseModals.js';
import { t } from '@core/i18n/I18n.js';

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
  if (!needsLeaveConfirm())
    return Promise.resolve(true);

  _pendingLeave ??= _askLeave(project).finally(() => { _pendingLeave = null; });
  return _pendingLeave;
}

/**
 * True if leaving the open project would ask first (unsaved changes, not discarded yet).
 * The command bar asks with its own sub-commands, then calls resolveLeaveOpenProject().
 * @returns {boolean}
 */
export function needsLeaveConfirm() {
  const project = getOpenProject();
  return hasUnsavedChanges(project) && project !== _discardedProject;
}

/**
 * Does the answer to "leave with unsaved changes?" without the dialog: 'save' saves the project,
 * 'discard' marks the changes as discarded (the leave guard lets it go). Anything else stays.
 * @param {'save'|'discard'|'cancel'} choice
 * @returns {Promise<boolean>} true if the project can be left now
 */
export async function resolveLeaveOpenProject(choice) {
  const project = getOpenProject();
  if (!project)
    return true;

  switch (choice) {
    case 'save': {
      const ok = await saveOpenProject();
      if (!ok)
        eventBus.emit('toast:show', { message: t('common.unsaved.saveFailed'), type: 'error' });
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
    title: t('common.unsaved.title'),
    message: t('common.unsaved.message', { name: project.name }),
    choices: [
      { id: 'discard', label: t('common.dontSave') },
      { id: 'cancel',  label: t('common.cancel') },
      { id: 'save',    label: t('common.save'), style: 'primary' },
    ],
  });

  return resolveLeaveOpenProject(choice);
}
