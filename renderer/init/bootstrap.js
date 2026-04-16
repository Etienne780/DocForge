import { state } from '@core/State.js';
import { domObserver } from '@core/DOMObserver.js';
import { initStorage } from '@core/storage/StorageManager.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { viewManager } from '@core/ViewManager.js';
import { shortcutManager } from '@core/ShortcutManager.js';

import { registerGlobalEvents } from './initEvents.js';
import { registerDocThemesPresets } from './initThemes.js';
import { registerKeyboardShortcuts } from './initHotKeys.js';

export async function bootstrap() {
  domObserver.init();
  await initStorage();

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

  registerGlobalEvents(),
  registerKeyboardShortcuts()
  registerDocThemesPresets();
}