import { BaseView } from '@core/BaseView.js';
import { shortcutManager } from '@core/ShortcutManager';
import { state } from '@core/State.js';
import { eventBus } from '@core/EventBus.js';
import { startFileImports } from '@core/FileImportManager.js';
import { closeProject } from '@data/ProjectManager.js'
import { getAppLogo } from '@core/AppMeta.js';
import { firstLaunch } from '../../init/InitFirstLaunch.js';

import { getArrowDownIcon, getArrowUpIcon } from '@ui/Icon.js'

export class AppLoaderView extends BaseView {
  static viewId = 'appLoader';

  static _loaderShowTimeMS = 750; // 0.75 secs

  _viewPath() {
    return this._buildBasePath(this.constructor.viewId);
  }

  async mount(componentLoader) {
    shortcutManager.setContext(this.constructor.viewId);

    const startLoadTime = Date.now();

    const logo = this.container?.querySelector('[data-role="logo"]');
    if (logo)
      logo.innerHTML = getAppLogo();

    if (state.get('isFirstLaunch')) {
      firstLaunch();
    }

    // dev builds: check all UI texts (vars, languages, duplicate keys), results in the console.
    // import.meta.env.DEV (= isDevelopment()) so the check is left out of release builds
    if (import.meta.env.DEV) {
      import('@core/i18n/I18nValidator.js')
        .then(({ validateStrings }) => validateStrings())
        .catch(error => console.error('[i18n] text check failed:', error));
    }

    const elapsedLoadTime = Date.now() - startLoadTime;
    this._remainingLoadTime = Math.max(0, AppLoaderView._loaderShowTimeMS - elapsedLoadTime);
  }

  async onLoad(componentLoader) {
    await Promise.all([
      componentLoader.load('Toast', document.getElementById('toast-slot')),
      componentLoader.load('Titlebar', document.getElementById('titlebar')),
      componentLoader.load('Navbar', document.getElementById('app-navbar')),
      componentLoader.load('FileDrop', document.getElementById('file-drop-slot')),
    ]);

    setTimeout(() => {
      if (!state.get('hasViewedOverview')) {
        eventBus.emit('show:modal:overview');
      }

      eventBus.emit('navigate:projectHub');
      startFileImports();
    }, this._remainingLoadTime);
  }
}