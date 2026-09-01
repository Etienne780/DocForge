import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { isDevelopment } from '@core/Platform.js';
import { domObserver } from '@core/DOMObserver.js';
import { storageManager } from '@core/storage/StorageManager.js';
import { initBackup, backupManager } from '@core/BackupManager.js';
import { onAppClose, confirmAppSaveComplete, isPlatformWeb } from '@core/Platform.js';
import { viewManager } from '@core/ViewManager.js';
import { shortcutManager } from '@core/ShortcutManager.js';
import { blobManager } from '@core/BlobManager.js';
import { initSharedModals } from '@core/SharedModal.js';
import { updateManager } from '@core/UpdateManager.js';
import { syntaxHighlighter } from '@core/syntaxHighlighter/SyntaxHighlighter.js';

import { setCodeHighlighter } from '@common/MarkdownParser.js';

import { registerGlobalEvents } from './InitEvents.js';
import { registerPresets } from './InitPresets.js';
import { registerKeyboardShortcuts } from './InitHotkeys.js';
import { registerStorageKeys } from './InitStorage.js';


export async function bootstrap() {
  const isDev = Boolean(isDevelopment());
  session.set('isDev', isDev);

  await registerStorageKeys();
  await initBackup();

  if (!isPlatformWeb()) {
    onAppClose(async () => {
      await storageManager.saveNow();
      await backupManager.createBackupNow();
      confirmAppSaveComplete();
    });
  }

  domObserver.init();
  
  blobManager.init();
  shortcutManager.init();

  setCodeHighlighter(({ langId, styleId, text }) =>
    syntaxHighlighter.highlightTextAsHTML({ langId, styleId, text })
  );

  viewManager.init(document.getElementById('app'));
  updateManager.init();
  
  document.documentElement.setAttribute(
    'data-theme',
    state.get('isDarkMode') ? 'dark' : 'light',
  );
  
  registerGlobalEvents();
  registerKeyboardShortcuts();
  registerPresets();
  
  initSharedModals();
  
  if(isDev) {
    console.info(
      '%c[DocForge] Running in development environment',
      'color: #70e85b; font-weight: bold;'
    );
  }
}