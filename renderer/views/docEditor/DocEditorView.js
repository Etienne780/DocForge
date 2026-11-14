import { RECENT_PROJECT_SOURCE_TYPE_FILE } from '@core/AppMeta.js';
import { BaseView } from '@core/BaseView.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { shortcutManager } from '@core/ShortcutManager';
import { isPlatformWeb, watcherAPI } from '@core/Platform.js';
import { getOpenProject, updateProjectLastOpenedAt, hasUnsavedChanges } from '@data/ProjectManager.js';
import { revokeThemeCache, createTabId } from '@core/htmlBuilder/HtmlBuilder.js';
import { rebuildLinkUsages } from '@data/LinkManager.js';
import { recordEntryVisit, navigateEntryHistory, getRecentEntryIds } from '@data/EntryHistory.js';
import { QuickOpen } from '@common/QuickOpen.js';
import { backupManager, restoreBackupIntoOpenProject } from '@core/BackupManager.js';
import { askChoice } from '@common/BaseModals.js';
import { t, getUiLanguage } from '@core/i18n/I18n.js';

export class DocEditorView extends BaseView {
  static viewId = 'docEditor';

  _viewPath() {
    return this._buildBasePath(this.constructor.viewId);
  }

  async mount(componentLoader) {
    this._activeProject = getOpenProject();
    if (!this._activeProject) {
      const errorMsg = t('editor.view.openFailed');
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

    // back / forward between the opened entries (Navigate:back / Navigate:forward)
    recordEntryVisit(this._activeProject, session.get('activeNodeId'));
    this.subscribe('session:change:activeNodeId', ({ value }) => recordEntryVisit(this._activeProject, value));
    this.subscribe('editor:history', ({ direction }) => navigateEntryHistory(this._activeProject, direction));

    // Navigate:quickOpen (Ctrl+P)
    this._quickOpen = new QuickOpen({
      getProject: () => this._activeProject,
      getRecentIds: () => getRecentEntryIds(this._activeProject),
      getActiveId: () => session.get('activeNodeId'),
      onOpen: ({ nodeId }) => eventBus.emit('editor:open-node', { nodeId }),
      // opens over the search field of the title bar, so it looks like that field
      getAnchor: () => document.querySelector('.topbar__quick-open:not(.hidden)'),
    });
    this.subscribe('editor:quick-open', () => this._quickOpen.open());

    this._offerBackupRecovery(this._activeProject);
  }

  onDestroy() {
    this._quickOpen?.destroy();
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
        title: t('editor.view.changedTitle'),
        message: t('editor.view.changedMessage', { name: openProject.name }),
        choices: [
          { id: 'keep',   label: t('editor.view.keepChanges') },
          { id: 'reload', label: t('editor.view.reload'), style: 'danger' },
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
        message: t('editor.view.loadFailedError', { error: error?.message ?? error }),
        type: 'error'
      });
      return;
    }

    if (!project) {
      eventBus.emit('toast:show', {
        message: t('editor.view.loadFailed'),
        type: 'error'
      });
      return;
    }

    eventBus.emit('toast:show', {
      message: t('editor.view.loaded'),
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

    const date = new Date(slot.date).toLocaleString(getUiLanguage(), { dateStyle: 'medium', timeStyle: 'short' });
    const choice = await askChoice({
      title: t('editor.view.recoveryTitle'),
      message: t('editor.view.recoveryMessage', { name: project.name, date }),
      choices: [
        { id: 'ignore',  label: t('editor.view.ignore') },
        { id: 'restore', label: t('editor.view.restore'), style: 'primary' },
      ],
      cancelId: 'ignore',
    });

    if (choice === 'restore' && getOpenProject() === project) {
      restoreBackupIntoOpenProject(slot);
      eventBus.emit('toast:show', { message: t('editor.view.restored'), type: 'success' });
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
      message: t('editor.view.watcherError', { error: error?.message ?? error }),
      type: 'error'
    });
  }
}