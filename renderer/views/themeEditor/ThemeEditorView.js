import { BaseView } from '@core/BaseView.js';
import { shortcutManager } from '@core/ShortcutManager.js';
import { eventBus } from '@core/EventBus.js';
import { findDocTheme } from '@data/DocThemeManager';
import { revokeThemeCache } from '@common/HtmlBuilder.js';

export class ThemeEditorView extends BaseView {
  static viewId = 'themeEditor';

  _viewPath() {
    return this._buildBasePath(this.constructor.viewId);
  }

  async mount(componentLoader) {
    const themeId = this.props.themeId;
    this._activeTheme = findDocTheme(themeId);
    if(!this._activeTheme) {
      const errorMsg = 'Failed to open Theme-editor';
      eventBus.emit('toast:show', { message: errorMsg, type: 'error' });
      eventBus.emit('navigate:themeManager');
      return;
    }
    revokeThemeCache(themeId);
    const viewPrefix = `${this._getViewPath()}/components`;
    // viewPrefix = 'views/docThemeEditor/components'
    
    const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/sidebarLeft/SidebarLeft`, this.slot('sidebar-left'), { theme: this._activeTheme }),
      componentLoader.load(`${viewPrefix}/docThemePreview/DocThemePreview`, this.slot('preview'), { theme: this._activeTheme }),
    ]);

    this._instanceIds = instances.map(i => i.instanceId); 

    shortcutManager.setContext('themeEditor');
  }
}