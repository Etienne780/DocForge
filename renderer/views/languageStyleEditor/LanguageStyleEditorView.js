import { BaseView } from '@core/BaseView.js';
import { session } from '@core/SessionState.js';
import { shortcutManager } from '@core/ShortcutManager';

export class LanguageStyleEditorView extends BaseView {
  static viewId = 'languageStyleEditor';

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
        { label: 'Appearance', event: 'navigate:appearanceManager' },
        { label: 'Language style Editor' },
      ],
    });
    shortcutManager.setContext('languageStyleEditor');
  }

  onDestroy() {
  }

}