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

  _langNameFor(langId) {
    const def = findSyntaxDefinition(langId, this._project?.languages);
    return def?.name ?? 'Unknown language';
  }

  _matchesSearch(style, query) {
    if (!query)
      return true;
    const q = query.toLowerCase();
    return style.name.toLowerCase().includes(q) || this._langNameFor(style.langId).toLowerCase().includes(q);
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

  async _renderLanguageStyleCards() {
    const searchQuery = session.get('themeSearchQuery');
    const cardSortAction = state.get('themeSortAction');
    const parent = this.element('languageStyleContainer');
    if (!parent)
      return;
  
    const visible = this._allStyles().filter(s => this._matchesSearch(s, searchQuery));
  
    if (!visible.length) {
      setHTML(parent, '<div class="theme-cards_empty">No language styles yet.</div>');
      return;
    }
  
    const groups = this._groupByLanguage(visible);
  
    const requestId = ++this._renderRequestId;
    const sectionsHTML = await Promise.all(groups.map(async group => {
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
            <span class="theme-cards_group-title">${escapeHTML(group.langName)}</span>
            <span class="theme-cards_count text-body text-muted">${group.styles.length}</span>
          </div>
          <div class="theme-cards_container">${cards.join('')}</div>
        </div>`;
    }));
  
    if (requestId !== this._renderRequestId)
      return;
  
    setHTML(parent, sectionsHTML.join(''));
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