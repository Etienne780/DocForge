import { BaseView } from '@core/BaseView.js';
import { shortcutManager } from '@core/ShortcutManager';

export class ProjectManagerView extends BaseView {

  _viewPath() {
    return 'views/projectManager/ProjectManagerView';
  }

  async mount(componentLoader) {
    const viewPrefix = `${this._getViewPath()}/components`;
    // viewPrefix = 'views/projectManager/components'

    const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/sidebarLeft/SidebarLeft`, this.slot('sidebar-left')),
      componentLoader.load(`${viewPrefix}/projectArea/ProjectArea`, this.slot('project-area')),
    ]);

    this._instanceIds = instances.map(i => i.instanceId);

    shortcutManager.setContext('projectManager');
  }
}