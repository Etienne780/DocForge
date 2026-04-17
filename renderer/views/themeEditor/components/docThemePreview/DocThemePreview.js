import { Component } from '@core/Component.js';
import { createThemeShowcaseProject } from '@core/presets/ProjectPresets.js';
import { buildDocument, revokeThemeCache, createTabId } from '@common/HtmlBuilder.js';
import { setIframeContent } from '@common/Common.js';

export default class DocThemePreview extends Component {

  onLoad() {
    this._activeTheme = this.props.theme;
    this._showcaseProject = createThemeShowcaseProject();

    this._displayProjectBody(this._showcaseProject);

    this._updatePreview = this._debounce(() => {
      revokeThemeCache(this._activeTheme.id);
      this._displayProjectBody(this._showcaseProject);
    }, 150);

    this.subscribe('themeEditor:update:display', this._updatePreview);
  }

  onDestroy() {
    if (this._activeTheme)
      revokeThemeCache(this._activeTheme.id);
    if (this._showcaseProject)
      revokeThemeCache(createTabId(this._showcaseProject.tabs));
  }

  _displayProjectBody(project) {
    const container = this.element('preview-container');
    if(!project) {
      return;
    }

    const tabs = project.tabs.filter(t => t.nodes.length > 0);
    if(!tabs.length || tabs.length === 0) {
      return;
    }

    const html = buildDocument(project, this._activeTheme);
    if(!html.doc) {
      eventBus.emit('toast:show', { message: `Faild to display project preview: ${html.msg}`, type: 'error' });
      return;
    }

    setIframeContent(container, html.doc);
  }

  _debounce(fn, delay) {
    let t;

    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

}