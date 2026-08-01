import { BaseView } from '@core/BaseView.js';
import { shortcutManager } from '@core/ShortcutManager';
import { ResizeController } from '@core/ResizeController';
import { syntaxHighlighter } from '@core/SyntaxHighlighter.js'

import { addTabIndenting } from '@common/UIUtils';
import { findSyntaxDefinitionByName } from "@data/SyntaxDefinitionManager.js"

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

    const HTMLInput = document.getElementById('language_input');
    const HTMLContainer = document.getElementById('language_output');
    addTabIndenting(HTMLInput);
    this._resize = new ResizeController(document.getElementById('language_input_wrapper'), { 
      keepRatio: false,
      direction: 'right',
    });

    const def = findSyntaxDefinitionByName('Assembly');

    // this._removeHighlighter = syntaxHighlighter.autoHighlightTextById(
    //   {
    //     langId: def.id,
    //     styleId: null,
    //     inputHTML: HTMLInput,
    //     outputHTML: HTMLContainer,
    //     debounceTimeMS: 300,
    //   }
    // );

    this._removeHighlighter = syntaxHighlighter.highlightExampleToElement({
      outputElement: HTMLContainer, 
      alias: 'Assembly', 
      styleId: null,
    });

    shortcutManager.setContext('languageEditor');
  }

  onDestroy() {
    this._resize.destroy();
    this._removeHighlighter?.();
  }

}