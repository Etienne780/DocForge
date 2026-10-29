import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { isDevelopment } from '@core/Platform.js';
import { domObserver } from '@core/DOMObserver.js';
import { storageManager } from '@core/storage/StorageManager.js';
import { initBackup } from '@core/BackupManager.js';
import { onAppClose, confirmAppSaveComplete, cancelAppClose, isPlatformWeb } from '@core/Platform.js';
import { viewManager } from '@core/ViewManager.js';
import { shortcutManager } from '@core/ShortcutManager.js';
import { blobManager } from '@core/BlobManager.js';
import { initSharedModals } from '@core/SharedModal.js';
import { updateManager } from '@core/UpdateManager.js';
import { syntaxHighlighter } from '@core/syntaxHighlighter/SyntaxHighlighter.js';
import { setCodeHighlighter, setHtmlCodeLineSplitter } from '@core/MarkdownParser.js';
import { confirmLeaveOpenProject, initUnsavedChangesGuard } from '@common/UnsavedChangesGuard.js';

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
      // the window waits until the close is confirmed or canceled
      let canClose = true;
      try {
        canClose = await confirmLeaveOpenProject();
        if (canClose)
          await storageManager.saveNow();
      } catch (error) {
        console.error('[Bootstrap] failed to prepare app close:', error);
      }

      if (canClose)
        confirmAppSaveComplete();
      else
        cancelAppClose();
    });
  }

  domObserver.init();
  
  blobManager.init();
  shortcutManager.init();

  syntaxHighlighter.warmpUp();
  setCodeHighlighter(({ langId, styleId, text }) =>
    syntaxHighlighter.highlightTextAsHTML({ langId, styleId, text })
  );
  setHtmlCodeLineSplitter((htmlCodeStr) => 
    syntaxHighlighter.splitHighlightedHtmlIntoLines(htmlCodeStr)
  );

  viewManager.init(document.getElementById('app'));
  initUnsavedChangesGuard();
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