import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js';
import { 
  updateThemeContent,
  bindCheckboxEvents,
  bindThemeInputs 
} from '../helper/ThemeContentHelper.js';

export default class ContentAppearance extends Component {

  async onLoad() {
    this._activeTheme = this.props['theme'];

    const sidebar = this.element('theme-editor_sidebar-left');
    bindCheckboxEvents(sidebar, this._activeTheme);
    bindThemeInputs(sidebar, this._activeTheme);

    this._updateContent();
    this.subscribe('state:change:docThemes', () => this._updateContent());
  }

  onDestroy() {
  }

  _updateContent() {
    const sidebar = this.element('theme-editor_sidebar-left');
    updateThemeContent(sidebar, this._activeTheme);
  }

}