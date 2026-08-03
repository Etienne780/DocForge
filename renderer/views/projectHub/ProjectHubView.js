import { BaseView } from '@core/BaseView.js';
import { shortcutManager } from '@core/ShortcutManager';

export class ProjectHubView extends BaseView {
  static viewId = 'projectHub';

  _viewPath() {
    return this._buildBasePath(this.constructor.viewId);
  }

  async mount(componentLoader) {
    const viewPrefix = `${this._getViewPath()}/components`;
    // viewPrefix = 'views/projectHub/components'

    const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/toolbar/Toolbar`, this.slot('toolbar')),
      componentLoader.load(`${viewPrefix}/templateGallery/TemplateGallery`, this.slot('template-gallery')),
      componentLoader.load(`${viewPrefix}/recentProjects/RecentProjects`, this.slot('recent-projects')),
    ]);

    this._instanceIds = instances.map(i => i.instanceId);

    shortcutManager.setContext('projectHub');
  }
}