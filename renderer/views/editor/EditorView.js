import { BaseView } from '@core/BaseView.js';

export class EditorView extends BaseView {

  _viewPath() {
    return 'views/editor/EditorView';
  }

 async mount(componentLoader) {
    const viewPrefix = `${this._getViewPath()}/components`;
    // viewPrefix = 'views/editor/components'
  
    const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/topBar/TopBar`,           this.slot('topbar')),
      componentLoader.load(`${viewPrefix}/sidebarLeft/SidebarLeft`, this.slot('sidebar-left')),
      componentLoader.load(`${viewPrefix}/editorArea/EditorArea`,   this.slot('editor')),
      componentLoader.load(`${viewPrefix}/sidebarRight/SidebarRight`, this.slot('sidebar-right')),
    ]);
  
    this._instanceIds = instances.map(i => i.instanceId);
  }
}