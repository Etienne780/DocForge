import { BaseView } from '@core/BaseView.js';
import { shortcutManager } from '@core/ShortcutManager';

import { blobManager } from '@core/BlobManager.js';
import { highlightExampleByAlias } from '@common/SyntaxHighlighter.js'

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

    const cancel = highlightExampleByAlias('TestLang', null, (c) => { this._onChunk(c); });

    shortcutManager.setContext('languageEditor');
  }

  _onChunk(chunk) {
    if (!chunk) {
      console.error('chunk is ' + chunk);
      return;
    }

    if (!chunk.ok) { 
      console.error(chunk.error); 
      return; 
    }

    if (chunk.type === 'css') {
      this._ensureCssBlob(chunk.defId, chunk.css);   // einmalig Blob erstellen + <link> einbinden
      return;
    }

    const codeElement = document.getElementById('language_container');
    if (chunk.lineStart === 0) {
      codeElement.innerHTML = chunk.html;
    } else {
      codeElement.innerHTML += chunk.html;
    }
  }

  _ensureCssBlob(defId, css) {
    if (blobManager.has(`${defId}-syntax-css`, defId)) 
      return;

    const entry = blobManager.add(`${defId}-syntax-css`, defId, { data: css, type: 'text/css' });

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = entry.url;
    link.dataset.syntaxDef = defId;
    document.head.appendChild(link);
  }
}