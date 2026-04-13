import { BaseView } from '@core/BaseView.js';
import { shortcutManager } from '@core/ShortcutManager';

export class LanguageEditorView extends BaseView {

  _viewPath() {
    return 'views/languageEditor/LanguageEditorView';
  }

  async mount(componentLoader) {
    const viewPrefix = `${this._getViewPath()}/components`;
    // viewPrefix = 'views/docThemeEditor/components'
    /*
    const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/topbar/Topbar`, this.slot('topbar')),
    ]);

    this._instanceIds = instances.map(i => i.instanceId); */

    shortcutManager.setContext('themeEditor');
  }
}