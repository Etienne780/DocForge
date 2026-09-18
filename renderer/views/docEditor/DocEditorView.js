import { RECENT_PROJECT_SOURCE_TYPE_FILE } from '@core/AppMeta.js';
import { BaseView } from '@core/BaseView.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { shortcutManager } from '@core/ShortcutManager';
import { isPlatformWeb, watcherAPI } from '@core/Platform.js';
import { getOpenProject, updateProjectLastOpenedAt } from '@data/ProjectManager.js';
import { revokeThemeCache, createTabId } from '@common/HtmlBuilder.js';

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

    const projToLoad = this._activeProject;
    const { openDocument } = await import('@core/DocumentManager.js');

    let project;
    try {
      project = await openDocument(projToLoad.sourceKind || RECENT_PROJECT_SOURCE_TYPE_FILE, projToLoad.sourcePath);
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
    session.set('openProject', project);
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