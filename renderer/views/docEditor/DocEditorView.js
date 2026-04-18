import { BaseView } from '@core/BaseView.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { shortcutManager } from '@core/ShortcutManager';
import { findProject } from '@data/ProjectManager.js';
import { revokeThemeCache, createTabId } from '@common/HtmlBuilder.js';

export class DocEditorView extends BaseView {

  _viewPath() {
    return 'views/docEditor/DocEditorView';
  }

 async mount(componentLoader) {
    const projectId = this.props.projectId;
    this._activeProject = findProject(projectId) ?? getActiveProject();
    if(!this._activeProject) {
      const errorMsg = 'Failed to open Doc-editor';
      eventBus.emit('toast:show', { message: errorMsg, type: 'error' });
      eventBus.emit('navigate:projectManager');
      return;
    }

    // select project if not selected
    if(session.get('activeProjectId') !== projectId)
      session.set('activeProjectId', projectId);

    if(this._activeProject.tabs && this._activeProject.tabs.length > 0) {
      // clears the js from the preview in Project manager
      revokeThemeCache(createTabId(this._activeProject.tabs));
      
      // select first tab and if possible first node in this tab
      const tab = this._activeProject.tabs[0];
      session.set('activeTabId', tab.id);
      if(tab.nodes && tab.nodes.length > 0)
        session.set('activeNodeId', tab.nodes[0].id); 
    }
    
    const viewPrefix = `${this._getViewPath()}/components`;
    // viewPrefix = 'views/editor/components'
  
    const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/sidebarLeft/SidebarLeft`, this.slot('sidebar-left'), { project: this._activeProject }),
      componentLoader.load(`${viewPrefix}/editorArea/EditorArea`, this.slot('editor'), { project: this._activeProject }),
      componentLoader.load(`${viewPrefix}/sidebarRight/SidebarRight`, this.slot('sidebar-right'), { project: this._activeProject }),
    ]);
  
    this._instanceIds = instances.map(i => i.instanceId);

    shortcutManager.setContext('docEditor');
  }
}