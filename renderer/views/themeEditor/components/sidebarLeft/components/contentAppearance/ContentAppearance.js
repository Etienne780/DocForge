import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js';
import { updateThemeContent } from '../helper/ThemeContentHelper.js';

export default class ContentAppearance extends Component {

  async onLoad() {
    this._activeThemeId = this.props['themeId'];
    if(!this._activeThemeId) {
      const errorMsg = '[themeEditor:sidebar:contentAppearance] Faild to open Theme-editor';
      eventBus.emit('toast:show', { message: errorMsg, type: 'error' });
      eventBus.emit('navigate:themeManager');
      return;
    }

    this._updateContent();
    this.subscribe('state:change:docThemes', this._updateContent());
  }

  onDestroy() {
  }

  _updateContent() {
    const sidebar = this.element('theme-editor_sidebar-left');
    updateThemeContent('contentAppearance', sidebar, this._activeThemeId);
  }

}