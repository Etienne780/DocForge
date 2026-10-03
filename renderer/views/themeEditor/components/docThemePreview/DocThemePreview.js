import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js'; 
import { createThemeShowcaseProject } from '@core/presets/ProjectPresets.js';
import { getOpenProject, createProject, createNode } from '@data/ProjectManager.js';
import { findSyntaxDefinition } from '@data/SyntaxDefinitionManager.js';
import { setIframeContent, debounce } from '@common/Common.js';
import { buildDocument, revokeThemeCache, createTabId } from '@core/HtmlBuilder.js';
import { selectTab } from '@common/UIUtils.js';

export default class DocThemePreview extends Component {

  async onLoad() {
    this._activeTheme = this.props.theme;
    this._openProject = getOpenProject();
    this._showcaseProject = createThemeShowcaseProject();
    this._renderToken = 0;

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
      this._displayProjectBody(this._getActiveProject(), this._captureLocation());
    }, 400);

    this.subscribe('themeEditor:update:display', this._updatePreview);
    this.subscribe('themeEditor:preview:language', ({ langId }) => this._showLanguage(langId));
  }

  onDestroy() {
    this._updatePreview?.cancel();
    this._renderToken++;

    if (this._activeTheme)
      revokeThemeCache(this._activeTheme.id);
    if (this._showcaseProject)
      revokeThemeCache(createTabId(this._showcaseProject.tabs));
    if (this._languageProject)
      revokeThemeCache(createTabId(this._languageProject.tabs));
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
    if (this._activeSource === 'openProject')
      return this._openProject;
    return this._languageProject ?? this._showcaseProject;
  }

  /**
   * Shows the example code of a language in the showcase tab, or the
   * regular showcase again when `langId` is null.
   * @param {string|null} langId
   */
  _showLanguage(langId) {
    if (this._languageProject)
      revokeThemeCache(createTabId(this._languageProject.tabs));

    const lang = langId ? findSyntaxDefinition(langId, this._openProject?.languages) : null;
    this._languageProject = lang ? this._createLanguageProject(lang) : null;

    const showcaseTab = this.element('tab-element_showcase');
    if (this._activeSource !== 'showcase') {
      this._switchSource(showcaseTab, 'showcase');
      return;
    }

    this._displayProjectBody(this._getActiveProject());
  }

  /**
   * Builds a one-page project that only contains the language's example code
   * as a code block. Languages and styles come from the open project, so
   * custom languages and the theme's style mapping are used.
   * @param {Object} lang
   * @returns {Object}
   */
  _createLanguageProject(lang) {
    const project = createProject(lang.name);
    project.session.builtIn = true;
    project.languages = this._openProject?.languages ?? [];
    project.languagesStyles = this._openProject?.languagesStyles ?? [];

    // the fence needs a name the markdown parser accepts as language
    const fenceLang = [...(lang.aliases ?? []), lang.name].find(n => /^[\w#+.-]+$/.test(n)) ?? '';
    // only strip surrounding newlines: spaces/tabs are the code itself in
    // languages like Whitespace
    const code = lang.exampleCode?.replace(/^\n+|\n+$/g, '') || '// no example code';
    const longestTicks = Math.max(0, ...(code.match(/`+/g) ?? []).map(t => t.length));
    const fence = '`'.repeat(Math.max(3, longestTicks + 1));

    const tab = project.tabs[0];
    tab.name = lang.name;
    tab.nodes = [createNode(lang.name, `# ${lang.name}\n\n${fence}${fenceLang}\n${code}\n${fence}\n`)];
    return project;
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

  _hideContainer(container) {
    container.style.transition = 'none';
    container.style.opacity = '0';
    void container.offsetHeight;
  }

  _revealContainer(container) {
    container.style.transition = 'opacity 0.1s ease-out';
    container.style.opacity = '1';
  }

  _captureLocation() {
    const container = this.element('preview-container');
    try {
      return container?.contentWindow?.docNav?.getLocation() ?? null;
    } catch (e) {
      return null;
    }
  }

  async _displayProjectBody(project, restoreLocation = null) {
    const container = this.element('preview-container');
    if (!project)
      return;

    const tabs = project.tabs.filter(t => t.nodes.length > 0);
    if (!tabs.length)
      return;

    const token = ++this._renderToken;
    this._hideContainer(container);

    const html = await buildDocument(project, this._activeTheme);

    if (token !== this._renderToken)
      return;

    if (!html.doc) {
      eventBus.emit('toast:show', { message: `Failed to display project preview: ${html.msg}`, type: 'error' });
      this._revealContainer(container);
      return;
    }

    setIframeContent(container, html.doc);

    if (!restoreLocation?.nodeId) {
      this._revealContainer(container);
      return;
    }

    const onMessage = (e) => {
      if (token !== this._renderToken) {
        window.removeEventListener('message', onMessage);
        return;
      }
      if (e.source !== container.contentWindow) 
        return;
      if (e.data?.source !== 'doc-nav' || e.data.type !== 'ready') 
        return;

      window.removeEventListener('message', onMessage);
      try {
        container.contentWindow.docNav.navigate({
          nodeId: restoreLocation.nodeId,
          scrollPosition: { ratio: restoreLocation.ratio },
        });
      } catch (err) {}
      this._revealContainer(container);
    };
    window.addEventListener('message', onMessage);

    setTimeout(() => {
      if (token === this._renderToken) {
        window.removeEventListener('message', onMessage);
        this._revealContainer(container);
      }
    }, 1500);
  }
}