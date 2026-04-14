import { BaseView } from '@core/BaseView.js';
import { shortcutManager } from '@core/ShortcutManager.js';
import { eventBus } from '@core/EventBus.js';

export class ThemeEditorView extends BaseView {

  _viewPath() {
    return 'views/themeEditor/ThemeEditorView';
  }

  async mount(componentLoader) {
    this._activeThemeId = this.props['themeId'];
    if(!this._activeThemeId) {
      const errorMsg = '[themeEditor] Faild to open Theme-editor';
      eventBus.emit('toast:show', { message: errorMsg, type: 'error' });
      eventBus.emit('navigate:themeManager');
      return;
    }

    const viewPrefix = `${this._getViewPath()}/components`;
    // viewPrefix = 'views/docThemeEditor/components'
    
    const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/sidebarLeft/SidebarLeft`, this.slot('sidebar-left'), { themeId: this._activeThemeId }),
      componentLoader.load(`${viewPrefix}/docThemePreview/DocThemePreview`, this.slot('preview'), { themeId: this._activeThemeId }),
    ]);

    this._instanceIds = instances.map(i => i.instanceId); 

    shortcutManager.setContext('themeEditor');
  }
}