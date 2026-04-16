import { Component } from '@core/Component.js';

export default class DocThemePreview extends Component {

  onLoad() {
    this._activeTheme = this.props.theme;
  }

  onDestroy() {

  }

}