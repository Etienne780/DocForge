import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js';
import { getOpenProject } from '@data/ProjectManager.js';
import { getLanguageStyleId, setLanguageStyleId } from '@data/DocThemeManager.js';
import {
  getLanguages,
  getPresetLanguages,
  findSyntaxDefinition,
  findHighlightStyle,
  getHighlightStylesForLang,
  isHighlightStylesBuiltIn,
  syntaxDefinitionMatchesSearch,
} from '@data/SyntaxDefinitionManager.js';
import { escapeHTML, isQueryMatchesBuiltIn, setHTML } from '@common/Common.js';

/**
 * Theme editor tab that maps a highlight style to every language.
 * Shows the language list first, clicking a language shows its styles.
 */
export default class ContentMapping extends Component {

  onLoad() {
    this._activeTheme = this.props.theme;
    this._activeLangId = null;
    this._lastLangId = null;
    this._langQuery = '';
    this._styleQuery = '';

    this._setupElementEvents();
    this._render();

    this.subscribe('session:change:openProject:themes', () => this._render());
  }

  onDestroy() {
  }

  _setupElementEvents() {
    this.element('search-input').addEventListener('input', () => this._render());
    this.element('back-button').addEventListener('click', () => this._showLanguages());

    this.element('list').addEventListener('click', event => {
      const langRow = event.target.closest('[data-mapping-lang]');
      if (langRow) {
        this._showStyles(langRow.dataset.mappingLang);
        return;
      }

      const styleRow = event.target.closest('[data-mapping-style]');
      if (styleRow)
        this._selectStyle(styleRow.dataset.mappingStyle);
    });
  }

  _showLanguages() {
    this._styleQuery = this.element('search-input').value;
    this._activeLangId = null;
    this._setSearch(this._langQuery, 'Search languages…');
    this._render();
    eventBus.emit('themeEditor:preview:language', { langId: null });
  }

  _showStyles(langId) {
    this._langQuery = this.element('search-input').value;

    // the style search only carries over when the same language is reopened
    if (langId !== this._lastLangId)
      this._styleQuery = '';
    this._lastLangId = langId;

    this._activeLangId = langId;
    this._setSearch(this._styleQuery, 'Search styles…');
    this._render();
    eventBus.emit('themeEditor:preview:language', { langId });
  }

  _setSearch(value, placeholder) {
    const input = this.element('search-input');
    input.value = value ?? '';
    input.placeholder = placeholder;
  }

  _selectStyle(styleId) {
    const project = getOpenProject();
    if (!project || !this._activeLangId)
      return;

    setLanguageStyleId(project, this._activeTheme, this._activeLangId, styleId);
    eventBus.emit('themeEditor:update:display');
    eventBus.emit('save:request');
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  _render() {
    const project = getOpenProject();
    const query = this.element('search-input').value.trim().toLowerCase();
    const lang = this._activeLangId
      ? findSyntaxDefinition(this._activeLangId, project?.languages)
      : null;

    this.element('back-button').classList.toggle('hidden', !lang);
    this.element('list-header').textContent = lang ? lang.name : 'Languages';

    setHTML(this.element('list'), lang
      ? this._buildStyleRows(project, lang, query)
      : this._buildLanguageRows(project, query));
  }

  _buildLanguageRows(project, query) {
    const langs = [...getLanguages(project), ...getPresetLanguages()]
      .filter(lang => syntaxDefinitionMatchesSearch(lang, query))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!langs.length)
      return `<div class="content-mapping_empty">${query ? 'No languages match your search' : 'No languages'}</div>`;

    return langs.map(lang => {
      const style = findHighlightStyle(project, getLanguageStyleId(project, this._activeTheme, lang));
      return `
        <div class="content-mapping_row" data-mapping-lang="${escapeHTML(lang.id)}">
          <span class="content-mapping_row-name">${escapeHTML(lang.name)}</span>
          <span class="content-mapping_row-meta" title="${escapeHTML(style?.name ?? '')}">${escapeHTML(style?.name ?? 'No styles')} ›</span>
        </div>`;
    }).join('');
  }

  _buildStyleRows(project, lang, query) {
    const activeId = getLanguageStyleId(project, this._activeTheme, lang);
    const styles = getHighlightStylesForLang(project, lang.id).filter(style => {
      if (!query)
        return true;
      if (isQueryMatchesBuiltIn(query))
        return isHighlightStylesBuiltIn(style.id);
      return style.name.toLowerCase().includes(query);
    });

    if (!styles.length)
      return `<div class="content-mapping_empty">${query ? 'No styles match your search' : 'No styles for this language'}</div>`;

    return styles.map(style => {
      const isActive = style.id === activeId;
      const builtIn = isHighlightStylesBuiltIn(style.id);
      return `
        <div class="content-mapping_row${isActive ? ' content-mapping_row--active' : ''}" data-mapping-style="${escapeHTML(style.id)}">
          <span class="content-mapping_row-name">${escapeHTML(style.name)}</span>
          <span class="content-mapping_row-meta">
            ${builtIn ? '<span class="form-tag form-tag--small">Built In</span>' : ''}
            ${isActive ? '<span class="form-tag form-tag--small">Active</span>' : ''}
          </span>
        </div>`;
    }).join('');
  }

}
