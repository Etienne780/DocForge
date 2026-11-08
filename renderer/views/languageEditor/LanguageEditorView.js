import { BaseView } from '@core/BaseView.js';
import { session } from '@core/SessionState.js';
import { shortcutManager } from '@core/ShortcutManager';
import { t } from '@core/i18n/I18n.js';

export class LanguageEditorView extends BaseView {
  static viewId = 'languageEditor';

  _viewPath() {
    return this._buildBasePath(this.constructor.viewId);
  }

  async mount(componentLoader) {
    const viewPrefix = `${this._getViewPath()}/components`;
    // viewPrefix = 'views/docThemeEditor/components'
    /*
    const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/topbar/Topbar`, this.slot('topbar')),
    ]);

    this._instanceIds = instances.map(i => i.instanceId); */

    session.set('navContext', {
      path: [
        { label: t('data.editors.appearance'), event: 'navigate:appearanceManager' },
        { label: t('data.editors.language') },
      ],
    });
    shortcutManager.setContext('languageEditor');
  }

  onDestroy() {
  }

}