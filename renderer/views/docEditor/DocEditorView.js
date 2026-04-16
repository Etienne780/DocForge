import { BaseView } from '@core/BaseView.js';
import { eventBus } from '@core/EventBus.js';
import { shortcutManager } from '@core/ShortcutManager';
import { findProject } from '@data/ProjectManager.js';

export class DocEditorView extends BaseView {

  _viewPath() {
    return 'views/docEditor/DocEditorView';
  }

 async mount(componentLoader) {
    const projectId = this.props.projectId;
    this._activeProject = findProject(projectId) ?? getActiveProject();
    if(!this._activeProject) {
      const errorMsg = 'Faild to open Doc-editor';
      eventBus.emit('toast:show', { message: errorMsg, type: 'error' });
      eventBus.emit('navigate:projectManager');
      return;
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