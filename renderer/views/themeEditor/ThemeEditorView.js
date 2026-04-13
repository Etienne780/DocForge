import { BaseView } from '@core/BaseView.js';
import { shortcutManager } from '@core/ShortcutManager';

export class ThemeEditorView extends BaseView {

  _viewPath() {
    return 'views/themeEditor/ThemeEditorView';
  }

  async mount(componentLoader) {
    const viewPrefix = `${this._getViewPath()}/components`;
    // viewPrefix = 'views/docThemeEditor/components'
    
    const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/sidebarLeft/SidebarLeft`, this.slot('sidebar-left')),
      componentLoader.load(`${viewPrefix}/docThemePreview/DocThemePreview`, this.slot('preview')),
    ]);

    this._instanceIds = instances.map(i => i.instanceId); 

    shortcutManager.setContext('themeEditor');
  }
}