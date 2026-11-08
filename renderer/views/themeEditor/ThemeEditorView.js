import { BaseView } from '@core/BaseView.js';
import { session } from '@core/SessionState.js';
import { shortcutManager } from '@core/ShortcutManager.js';
import { eventBus } from '@core/EventBus.js';
import { getOpenProject } from '@data/ProjectManager.js';
import { findDocTheme } from '@data/DocThemeManager.js';
import { revokeThemeCache } from '@core/htmlBuilder/HtmlBuilder.js';
import { t } from '@core/i18n/I18n.js';

export class ThemeEditorView extends BaseView {
  static viewId = 'themeEditor';

  _viewPath() {
    return this._buildBasePath(this.constructor.viewId);
  }

  async mount(componentLoader) {
    const themeId = this.props.themeId;
    const openProject = getOpenProject();
    this._activeTheme = findDocTheme(themeId, openProject.themes);
    if(!this._activeTheme) {
      const errorMsg = t('themeEditor.openFailed');
      eventBus.emit('toast:show', { message: errorMsg, type: 'error' });
      eventBus.emit('navigate:appearanceManager');
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

    session.set('navContext', {
      path: [
        { label: t('themeEditor.appearance'), event: 'navigate:appearanceManager' },
        { label: t('themeEditor.title') },
      ],
    });
    shortcutManager.setContext('themeEditor');
  }
}