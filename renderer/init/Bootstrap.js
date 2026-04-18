import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { isDevelopment } from '@core/Platform.js';
import { domObserver } from '@core/DOMObserver.js';
import { initStorage } from '@core/storage/StorageManager.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { viewManager } from '@core/ViewManager.js';
import { shortcutManager } from '@core/ShortcutManager.js';
import { blobManager } from '@core/BlobManager.js';

import { registerGlobalEvents } from './InitEvents.js';
import { registerDocThemesPresets } from './InitThemes.js';
import { registerKeyboardShortcuts } from './InitHotKeys.js';
import { firstLaunch } from './firstLaunch.js';

export async function bootstrap() {
  const isDev = Boolean(isDevelopment());
  session.set('isDev', isDev);

  domObserver.init();
  await initStorage();

  blobManager.init();
  shortcutManager.init();
  viewManager.init(document.getElementById('app'));

  await Promise.all([
    componentLoader.load('Toast',    document.getElementById('toast-slot')),
    componentLoader.load('Titlebar', document.getElementById('titlebar')),
  ]);

  document.documentElement.setAttribute(
    'data-theme',
    state.get('isDarkMode') ? 'dark' : 'light',
  );

  registerGlobalEvents();
  registerKeyboardShortcuts();
  registerDocThemesPresets();

  if(isDev) {
    console.info(
      '%c[DocForge] Running in development environment',
      'color: #70e85b; font-weight: bold;'
    );
  }

  if(state.get('isFirstLaunch')) {
    firstLaunch();
  }
}