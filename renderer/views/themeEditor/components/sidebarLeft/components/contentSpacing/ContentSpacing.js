import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js';
import { 
  initThemeContent,
  bindThemeInputs 
} from '../helper/ThemeContentHelper.js';

export default class ContentSpacing extends Component {

  async onLoad() {
    this._activeTheme = this.props.theme;

    const sidebar = this.element('theme-editor_sidebar-left');
    bindThemeInputs(sidebar, this._activeTheme);
    initThemeContent(sidebar, this._activeTheme);
  }

  onDestroy() {
  }

}