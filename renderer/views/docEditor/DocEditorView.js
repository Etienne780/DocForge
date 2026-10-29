import { RECENT_PROJECT_SOURCE_TYPE_FILE } from '@core/AppMeta.js';
import { BaseView } from '@core/BaseView.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { shortcutManager } from '@core/ShortcutManager';
import { isPlatformWeb, watcherAPI } from '@core/Platform.js';
import { getOpenProject, updateProjectLastOpenedAt, hasUnsavedChanges } from '@data/ProjectManager.js';
import { revokeThemeCache, createTabId } from '@core/HtmlBuilder.js';
import { rebuildLinkUsages } from '@data/LinkManager.js';
import { backupManager, restoreBackupIntoOpenProject } from '@core/BackupManager.js';
import { askChoice } from '@common/BaseModals.js';

export class DocEditorView extends BaseView {
  static viewId = 'docEditor';

  _viewPath() {
    return this._buildBasePath(this.constructor.viewId);
  }

  async mount(componentLoader) {
    this._activeProject = getOpenProject();
    if (!this._activeProject) {
      const errorMsg = 'Failed to open Project-editor';
      eventBus.emit('toast:show', { message: errorMsg, type: 'error' });
      eventBus.emit('navigate:projectHub');
      return;
    }

    if (!isPlatformWeb())
      this._watchProject(this._activeProject);

    // updates the last opened at time
    updateProjectLastOpenedAt(this._activeProject.id);

    // link usages may be outdated (e.g. files edited outside the app)
    rebuildLinkUsages(this._activeProject);

    if (this._activeProject.tabs && this._activeProject.tabs.length > 0) {
      // clears the js from the preview in Project manager
      revokeThemeCache(createTabId(this._activeProject.tabs));

      // select first tab and if possible first node in this tab
      const tab = this._activeProject.tabs[0];
      session.set('activeTabId', tab.id);
      if (tab.nodes && tab.nodes.length > 0)
        session.set('activeNodeId', tab.nodes[0].id);
    }

    const viewPrefix = `${this._getViewPath()}/components`;

    const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/sidebarLeft/SidebarLeft`, this.slot('sidebar-left'), { project: this._activeProject }),
      componentLoader.load(`${viewPrefix}/editorArea/EditorArea`, this.slot('editor'), { project: this._activeProject }),
      componentLoader.load(`${viewPrefix}/sidebarRight/SidebarRight`, this.slot('sidebar-right'), { project: this._activeProject }),
    ]);

    this._instanceIds = instances.map(i => i.instanceId);
    shortcutManager.setContext('docEditor');

    this._offerBackupRecovery(this._activeProject);
  }

  onDestroy() {
    if (!isPlatformWeb() && this._activeProject)
      this._unwatchProject(this._activeProject);
  }

  _watchProject(project) {
    watcherAPI.watchProject(project);

    this._fileChangeUnsubscribe = watcherAPI.onFileChanged(
      (payload) => this._handleFileChanged(payload)
    );

    this._watcherErrorUnsubscribe = watcherAPI.onError(
      (payload) => this._handleWatcherError(payload)
    );
  }

  _unwatchProject(project) {
    this._fileChangeUnsubscribe?.();
    this._watcherErrorUnsubscribe?.();
    this._fileChangeUnsubscribe = null;
    this._watcherErrorUnsubscribe = null;

    watcherAPI.unwatchProject(project.id)?.catch((error) => {
      console.error(`[DocEditorView] failed to unwatch project '${project.id}':`, error);
    });
  }

  async _handleFileChanged(payload) {
    const { projectId } = payload;

    // Ignore events for a project other than the one this view is showing.
    if (!this._activeProject || projectId !== this._activeProject.id)
      return;

    // a burst of file events only asks once, the reload reads the latest state anyway
    if (this._isAskingExternalChange)
      return;

    const openProject = getOpenProject();
    if (hasUnsavedChanges(openProject)) {
      this._isAskingExternalChange = true;
      const choice = await askChoice({
        title: 'Project changed on disk',
        message: `"${openProject.name}" was changed outside of DocForge. Reload it and discard your unsaved changes?`,
        choices: [
          { id: 'keep',   label: 'Keep my changes' },
          { id: 'reload', label: 'Reload', style: 'danger' },
        ],
        cancelId: 'keep',
      });
      this._isAskingExternalChange = false;

      if (choice !== 'reload')
        return;

      await backupManager.markResolved(openProject);
    }

    const projToLoad = this._activeProject;
    const { openDocument } = await import('@core/DocumentManager.js');

    let project;
    try {
      project = await openDocument(projToLoad.sourceKind || RECENT_PROJECT_SOURCE_TYPE_FILE, projToLoad.sourcePath, { openInEditor: false });
    } catch (error) {
      console.error(`[DocEditorView] failed to load external changes for project '${projToLoad.id}':`, error);
      eventBus.emit('toast:show', {
        message: `Failed to load external project changes: ${error?.message ?? error}`,
        type: 'error'
      });
      return;
    }

    if (!project) {
      eventBus.emit('toast:show', {
        message: 'Failed to load external project changes.',
        type: 'error'
      });
      return;
    }

    eventBus.emit('toast:show', {
      message: 'Loaded external project changes',
      type: 'info'
    });

    project.id = projToLoad.id; // prevent id from changing
    this._activeProject = project;
    session.set('openProject', project);
    rebuildLinkUsages(project);
  }

  /** Offers the newest backup once per opened project if the app was closed without saving (crash). */
  async _offerBackupRecovery(project) {
    if (!project?.session || project.session.recoveryChecked)
      return;
    project.session.recoveryChecked = true;

    const slot = await backupManager.findRecoverySlot(project);
    if (!slot || getOpenProject() !== project)
      return;

    const date = new Date(slot.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const choice = await askChoice({
      title: 'Restore unsaved changes?',
      message: `DocForge was closed without saving "${project.name}". A backup from ${date} contains the unsaved changes.`
        + '\n\nIt stays available under File -> Backups.',
      choices: [
        { id: 'ignore',  label: 'Ignore' },
        { id: 'restore', label: 'Restore', style: 'primary' },
      ],
      cancelId: 'ignore',
    });

    if (choice === 'restore' && getOpenProject() === project) {
      restoreBackupIntoOpenProject(slot);
      eventBus.emit('toast:show', { message: 'Backup restored. Save the project to keep it.', type: 'success' });
      return;
    }

    await backupManager.markResolved(project);
  }

  _handleWatcherError(payload) {
    const { projectId, error } = payload;

    if (!this._activeProject || projectId !== this._activeProject.id)
      return;

    console.error(`[DocEditorView] watcher error for project '${this._activeProject.name ?? 'Unknown'}':`, error);

    eventBus.emit('toast:show', {
      message: `File watcher error: ${error?.message ?? error}`,
      type: 'error'
    });
  }
}