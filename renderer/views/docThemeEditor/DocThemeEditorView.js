import { BaseView } from '@core/BaseView.js';

export class DocThemeEditorView extends BaseView {

  _viewPath() {
    return 'views/docThemeEditor/DocThemeEditorView';
  }

async mount(componentLoader) {
    const viewPrefix = `${this._getViewPath()}/components`;
    // viewPrefix = 'views/docThemeEditor/components'
  
    /*const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/topBar/TopBar`, this.slot('topbar')),
    ]);

    this._instanceIds = instances.map(i => i.instanceId);*/
  }
}