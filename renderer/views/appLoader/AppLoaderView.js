import { BaseView } from '@core/BaseView.js';
import { shortcutManager } from '@core/ShortcutManager';
import { state } from '@core/State.js';
import { eventBus } from '@core/EventBus.js';
import { closeProject } from '@data/ProjectManager.js'
import { getAppLogo } from '@core/AppMeta.js';
import { firstLaunch } from '../../init/InitFirstLaunch.js';

import { getArrowDownIcon, getArrowUpIcon } from '@ui/Icon.js'

export class AppLoaderView extends BaseView {
  static viewId = 'appLoader';

  _viewPath() {
    return this._buildBasePath(this.constructor.viewId);
  }

  async mount(componentLoader) {
    shortcutManager.setContext(this.constructor.viewId);

    const startTime = Date.now();

    const logo = this.container?.querySelector('[data-role="logo"]');
    if (logo)
      logo.innerHTML = getAppLogo();

    await Promise.all([
      componentLoader.load('Toast', document.getElementById('toast-slot')),
      componentLoader.load('Titlebar', document.getElementById('titlebar')),
      componentLoader.load('Navbar', document.getElementById('app-navbar')),
    ]);

    if (state.get('isFirstLaunch')) {
      firstLaunch();
    }

    if (!state.get('hasViewedOverview')) {
      eventBus.emit('show:modal:overview');
    }

    const elapsedTime = Date.now() - startTime;
    const remainingTime = Math.max(0, 500 - elapsedTime);

    setTimeout(() => {
      eventBus.emit('navigate:projectHub');
    }, remainingTime);
  }
}