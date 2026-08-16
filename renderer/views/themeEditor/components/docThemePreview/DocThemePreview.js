import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js'; 
import { createThemeShowcaseProject } from '@core/presets/ProjectPresets.js';
import { getOpenProject } from '@data/ProjectManager.js';
import { setIframeContent, debounce } from '@common/Common.js';
import { buildDocument, revokeThemeCache, createTabId } from '@common/HtmlBuilder.js';
import { selectTab } from '@common/UIUtils.js';

export default class DocThemePreview extends Component {

  async onLoad() {
    this._activeTheme = this.props.theme;
    this._openProject = getOpenProject();
    this._showcaseProject = createThemeShowcaseProject();

    await this._displayProjectBody(this._getActiveProject());
    this._setupElementEvents();

    const childElement = this.element('tab-element_showcase');
    this._switchSource(childElement, childElement.dataset?.tabAction ?? null);
    selectTab({
      element: childElement,
      tabAction: this._activeSource,
      isParent: false,
    });

    this._updatePreview = debounce(() => {
      revokeThemeCache(this._activeTheme.id);
      this._displayProjectBody(this._getActiveProject());
    }, 150);

    this.subscribe('themeEditor:update:display', this._updatePreview);
  }

  onDestroy() {
    this._updatePreview?.cancel();

    if (this._activeTheme)
      revokeThemeCache(this._activeTheme.id);
    if (this._showcaseProject)
      revokeThemeCache(createTabId(this._showcaseProject.tabs));
  }

  _setupElementEvents() {
    const tabContainer = this.element('tab-container_project-select');

    Array.from(tabContainer.children).forEach((tab) => {
      tab.addEventListener('click', () => {
        this._switchSource(tab, tab.dataset?.tabAction ?? null);
      });
    });
  }

  _getActiveProject() {
    return this._activeSource === 'openProject'
      ? this._openProject
      : this._showcaseProject;
  }

  _switchSource(sourceTab, source) {
    if (this._activeSource === source)
      return;

    this._activeSource = source;

    const tabContainer = this.element('tab-container_project-select');

    Array.from(tabContainer.children).forEach((tab) => {
      tab.classList.toggle('is-active', false);
    });

    sourceTab.classList.toggle('is-active', true);

    this._displayProjectBody(this._getActiveProject());
  }

  async _displayProjectBody(project) {
    const container = this.element('preview-container');
    if(!project) {
      return;
    }

    const tabs = project.tabs.filter(t => t.nodes.length > 0);
    if(!tabs.length || tabs.length === 0) {
      return;
    }

    const html = await buildDocument(project, this._activeTheme);
    if(!html.doc) {
      eventBus.emit('toast:show', { message: `Failed to display project preview: ${html.msg}`, type: 'error' });
      return;
    }

    setIframeContent(container, html.doc);
  }

}