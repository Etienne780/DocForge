import { Component } from "@core/Component.js";
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { state } from '@core/State.js';
import { setHTML } from '@common/Common.js';
import {
  findHighlightStyle, getHighlightStylesForLang,
  findSyntaxDefinition, getLanguages, getPresetLanguages,
} from '@data/SyntaxDefinitionManager.js';
import { escapeHTML } from '@common/Common.js';
import { createThemeCard, sortCardList, buildLanguageStyleCardBody, buildLanguageStyleCardFooter } from '@common/ThemeCardHelper.js';
import { styleSectionName } from '../helpers/SectionModalHelper.js';

export default class LanguageStyleCards extends Component {

  onLoad() {
    this._project = this.props.project;
    this._clickTimeout = null;
    this._renderRequestId = 0;
    this._expandedLangId = null; // null = folder grid, langId = drilled into that language

    this._presetIds = new Set(
      (session.get('languageStylePresets') ?? []).map(s => s.id)
    );

    this._setupElementEvents();

    const refresh = () => {
      this._updateCounter();
      this._renderLanguageStyleCards();
    };

    refresh();
    this.subscribe('session:change:themeSearchQuery', () => refresh());
    this.subscribe('state:change:themeSortAction', () => refresh());
    this.subscribe('session:change:openProject:languagesStyles', () => refresh());
    this.subscribe('session:change:openProject:languages', () => refresh()); // lang names may change
  }

  onDestroy() {}

  _setupElementEvents() {
    const container = this.element('languageStyleContainer');

    container.addEventListener('click', event => {
      const folderTarget = event.target.closest('[data-lang-folder]');
      if (folderTarget) {
        this._expandedLangId = folderTarget.dataset.langFolder;
        this._renderLanguageStyleCards();
        return;
      }

      const backTarget = event.target.closest('[data-folder-back]');
      if (backTarget) {
        this._expandedLangId = null;
        this._renderLanguageStyleCards();
        return;
      }

      const target = event.target.closest('[data-style-id]');
      if (!target || !target.dataset)
        return;

      const id = target.dataset.styleId;
      clearTimeout(this._clickTimeout);
      this._clickTimeout = setTimeout(() => {
        eventBus.emit(`appearanceManager:openModal:${styleSectionName}`, {
          id: id,
          isPreset: this._presetIds.has(id)
        });
      }, 225);
    });

    container.addEventListener('dblclick', event => {
      const target = event.target.closest('[data-style-id]');
      if (!target || !target.dataset)
        return;

      const id = target.dataset.styleId;
      clearTimeout(this._clickTimeout);

      const style = findHighlightStyle(this._project, id);
      if (!style || this._presetIds.has(id)) {
        eventBus.emit('toast:show', { message: 'Failed to open style.', type: 'error' });
        return;
      }

      // Style editor doesn't exist yet — navigate event is wired for when it does.
      eventBus.emit('navigate:languageStyleEditor', { project: this._project, styleId: id, langId: style.langId });
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _allStyles() {
    const own = this._project?.languagesStyles ?? [];
    const presets = session.get('languageStylePresets') ?? [];
    return [...own, ...presets];
  }

  _langDefFor(langId) {
    return findSyntaxDefinition(langId, this._project?.languages);
  }

  _langNameFor(langId) {
    return this._langDefFor(langId)?.name ?? 'Unknown language';
  }

  _matchesSearch(style, query) {
    if (!query)
      return true;
    const q = query.toLowerCase();

    if (style.name.toLowerCase().includes(q))
      return true;

    const langDef = this._langDefFor(style.langId);
    if (!langDef)
      return false;

    if (langDef.name.toLowerCase().includes(q))
      return true;

    return (langDef.aliases ?? []).some(alias => alias.toLowerCase().includes(q));
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  _updateCounter() {
    const searchQuery = session.get('themeSearchQuery');
    const counter = this.element('cardCounter');
    if (!counter)
      return;

    const all = this._allStyles();
    const count = searchQuery
      ? all.filter(s => this._matchesSearch(s, searchQuery)).length
      : all.length;

    counter.innerText = count || '0';
  }

  _buildFolderCardHTML(group) {
    const langDef = this._langDefFor(group.langId);
    const snippet = (langDef?.exampleCode ?? '').slice(0, 160);

    const bodyHTML = `
      <div class="theme-cards_code">
        <pre><code>${snippet ? escapeHTML(snippet) : '// no example'}</code></pre>
      </div>`;

    const footerHTML = `
      <div class="theme-cards_footer-inner">
        <div class="theme-cards_footer-row">
          <span class="theme-cards_name">${escapeHTML(group.langName)}</span>
        </div>
        <div class="theme-cards_footer-row">
          <span class="theme-cards_meta">${group.styles.length} style${group.styles.length !== 1 ? 's' : ''}</span>
        </div>
      </div>`;

    return createThemeCard({
      dataSet: 'lang-folder',
      data: group.langId,
      bodyHTML,
      footerHTML,
    });
  }

  _renderFolderGrid(groups) {
    const cards = groups.map(group => this._buildFolderCardHTML(group));
    return `<div class="theme-cards_container">${cards.join('')}</div>`;
  }

  async _renderExpandedGroup(group, cardSortAction) {
    const sorted = sortCardList(group.styles, cardSortAction);
    const cards = await Promise.all(sorted.map(async style => createThemeCard({
      dataSet: 'style-id',
      data: style.id,
      bodyHTML:   await buildLanguageStyleCardBody(this._project, style),
      footerHTML: buildLanguageStyleCardFooter(style, group.langName, this._presetIds.has(style.id)),
    })));

    return `
      <div class="theme-cards_group">
        <div class="theme-cards_group-header">
          ${this._expandedLangId ? '<button class="icon-button" data-folder-back title="Back to languages">←</button>' : ''}
          <span class="theme-cards_group-title">${escapeHTML(group.langName)}</span>
          <span class="theme-cards_count text-body text-muted">${group.styles.length}</span>
        </div>
        <div class="theme-cards_container">${cards.join('')}</div>
      </div>`;
  }

  async _renderLanguageStyleCards() {
    const searchQuery = session.get('themeSearchQuery');
    const cardSortAction = state.get('themeSortAction');
    const parent = this.element('languageStyleContainer');
    if (!parent)
      return;

    const styles = this._allStyles();
    if (!styles.length) {
      this._expandedLangId = null;
      setHTML(parent, '<div class="theme-cards_empty">No language styles yet.</div>');
      return;
    }

    const visible = styles.filter(s => this._matchesSearch(s, searchQuery));
    if (!visible.length) {
      setHTML(parent, '<div class="theme-cards_empty">No language styles match your search.</div>');
      return;
    }

    const groups = this._groupByLanguage(visible);
    const requestId = ++this._renderRequestId;

    // While actively searching, skip the folder view - matches across every
    // language should stay visible at a glance instead of hiding behind a
    // folder the user would still have to open.
    if (searchQuery) {
      const sections = await Promise.all(groups.map(group => this._renderExpandedGroup({ ...group, _forceHeader: true }, cardSortAction)));
      if (requestId !== this._renderRequestId)
        return;
      setHTML(parent, sections.join(''));
      return;
    }

    const expandedGroup = this._expandedLangId
      ? groups.find(g => g.langId === this._expandedLangId)
      : null;

    // The expanded language might have lost all its styles (e.g. last one
    // deleted, or a filter change) - fall back to the folder grid rather
    // than rendering a dead, empty view.
    if (this._expandedLangId && !expandedGroup)
      this._expandedLangId = null;

    const html = expandedGroup
      ? await this._renderExpandedGroup(expandedGroup, cardSortAction)
      : this._renderFolderGrid(groups);

    if (requestId !== this._renderRequestId)
      return;

    setHTML(parent, html);
  }

  /**
   * Groups styles by langId, sorted alphabetically by language name.
   * @returns {Array<{ langId: string, langName: string, styles: Object[] }>}
   */
  _groupByLanguage(styles) {
    const map = new Map();

    styles.forEach(style => {
      if (!map.has(style.langId)) {
        map.set(style.langId, { langId: style.langId, langName: this._langNameFor(style.langId), styles: [] });
      }
      map.get(style.langId).styles.push(style);
    });

    return [...map.values()].sort((a, b) => a.langName.localeCompare(b.langName));
  }

}