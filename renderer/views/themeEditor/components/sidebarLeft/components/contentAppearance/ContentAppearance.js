import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js';
import { closeColorPicker } from '@common/ColorPicker.js';
import { 
  initThemeContent,
  bindThemeInputs 
} from '../helper/ThemeContentHelper.js';

export default class ContentAppearance extends Component {

  async onLoad() {
    this._activeTheme = this.props.theme;

    const sidebar = this.element('theme-editor_sidebar-left');
    bindThemeInputs(sidebar, this._activeTheme);
    initThemeContent(sidebar, this._activeTheme);

    // hovering a color makes it blink in the preview, to show what it changes
    this._flashKey = null;
    const setFlash = key => {
      if (key === this._flashKey)
        return;
      this._flashKey = key;
      eventBus.emit('themeEditor:preview:flash', { key });
    };
    sidebar.addEventListener('mouseover', event => {
      setFlash(event.target.closest('.item[data-type="color"]')?.dataset.key ?? null);
    });
    sidebar.addEventListener('mouseleave', () => setFlash(null));
  }

  onDestroy() {
    closeColorPicker();
    if (this._flashKey)
      eventBus.emit('themeEditor:preview:flash', { key: null });
  }

}