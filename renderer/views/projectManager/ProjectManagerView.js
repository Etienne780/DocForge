import { BaseView } from '@core/BaseView.js';
import { eventBus } from '@core/EventBus.js'

export class ProjectManagerView extends BaseView {
  
  _viewPath() {
    return 'views/projectManager/ProjectManagerView';
  }

async mount(componentLoader) {
    const viewPrefix = `${this._getViewPath()}/components`;
    // viewPrefix = 'views/projectManager/components'

    /*const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/topBar/TopBar`, this.slot('topbar')),
    ]);

    this._instanceIds = instances.map(i => i.instanceId);*/
  }
}