import { Component } from '@core/Component.js';

export default class DocThemePreview extends Component {

  onLoad() {
    this._activeThemeId = this.props['themeId'];
    if(!this._activeThemeId) {
      const errorMsg = '[themeEditor:preview] Faild to open Theme-editor';
      eventBus.emit('toast:show', { message: errorMsg, type: 'error' });
      eventBus.emit('navigate:themeManager');
      return;
    }
  }

  onDestroy() {

  }

}