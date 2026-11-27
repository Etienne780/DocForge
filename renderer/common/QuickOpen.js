import { escapeHTML } from '@common/Common.js';
import { collectProjectEntries } from '@common/EntryPicker.js';
import { shortcutManager } from '@core/ShortcutManager.js';
import { t } from '@core/i18n/I18n.js';

const MAX_RESULTS = 100;
// px of the panel (search + list), the list scrolls
const MAX_HEIGHT = 360;
const MIN_WIDTH = 480;

/**
 * Search modes, picked by the first character of the query (like VS Code). No prefix = 'all'.
 * The mode is never stored: it is part of the text, closing the search drops it.
 */
export const QUICK_OPEN_PREFIX = {
  commands: '>',
  tabs: '#',
  entries: '@',
};

/**
 * QuickOpen - app-wide command bar at the top of the window. The first character picks the mode:
 * none = entries and tabs, '#' = tabs, '@' = entries, '>' = commands. Without an open project only
 * the commands are shown. Without a query the recently opened entries come first.
 *
 * Commands (see @core/CommandRegistry.js) can have sub-commands: choosing one shows its list, with
 * its label as breadcrumb in front of the (then empty) search field. Backspace in the empty field
 * goes one level back, Escape closes the bar. Looks like the EntryPicker list (.entry-picker__*).
 *
 * Keyboard: Up / Down, Enter opens, Escape closes.
 */
export class QuickOpen {

  /**
   * @param {Object} options
   * @param {() => Object|null} options.getProject - null: only commands
   * @param {() => string} options.getView - session.activeView, passed to the commands
   * @param {() => import('@core/CommandRegistry.js').Command[]} options.getCommands - top level of the '>' mode
   * @param {(commands: Object[]) => Object[]} [options.filterCommands] - applied to sub-command lists
   * @param {() => string[]} [options.getRecentIds] - most recent first
   * @param {() => string|null} [options.getActiveId] - left out of the list
   * @param {() => string|null} [options.getActiveTabId] - marked in the tab results
   * @param {(entry: { tabId: string, nodeId: string }) => void} options.onOpen
   * @param {(tabId: string) => void} [options.onOpenTab]
   * @param {() => HTMLElement|null} [options.getAnchor] - visible element the panel opens over
   *        (its search field covers it), e.g. the search field in the title bar
   */
  constructor({
    getProject, getView, getCommands, filterCommands = list => list,
    getRecentIds = () => [], getActiveId = () => null, getActiveTabId = () => null,
    onOpen, onOpenTab = () => {}, getAnchor = () => null,
  }) {
    this._getAnchor = getAnchor;
    this._getProject = getProject;
    this._getView = getView;
    this._getCommands = getCommands;
    this._filterCommands = filterCommands;
    this._getRecentIds = getRecentIds;
    this._getActiveId = getActiveId;
    this._getActiveTabId = getActiveTabId;
    this._onOpen = onOpen;
    this._onOpenTab = onOpenTab;
    this._results = [];
    // sub-command levels: { label, items(), placeholder? }, last = shown
    this._levels = [];

    this._panel = document.createElement('div');
    this._panel.className = 'quick-open entry-picker__panel hidden';
    this._panel.innerHTML = `
      <div class="quick-open__search-row">
        <span class="quick-open__crumbs hidden"></span>
        <input type="text" class="entry-picker__search quick-open__search" autocomplete="off" spellcheck="false">
      </div>
      <div class="entry-picker__list" role="listbox"></div>`;
    this._crumbs = this._panel.querySelector('.quick-open__crumbs');
    this._search = this._panel.querySelector('.entry-picker__search');
    this._list = this._panel.querySelector('.entry-picker__list');

    this._search.addEventListener('input', () => this._render());
    this._panel.addEventListener('keydown', event => this._onKeyDown(event));
    this._list.addEventListener('mousedown', event => event.preventDefault()); // keep the focus in the search
    this._crumbs.addEventListener('mousedown', event => event.preventDefault());
    this._crumbs.addEventListener('click', () => this.back());
    this._list.addEventListener('click', event => {
      const row = event.target.closest('[data-quick-index]');
      if (row)
        this._open(Number(row.dataset.quickIndex));
    });
    this._list.addEventListener('mousemove', event => {
      const row = event.target.closest('[data-quick-index]');
      if (row)
        this._highlight(Number(row.dataset.quickIndex), false);
    });

    this._onOutside = event => {
      if (!this._panel.contains(event.target))
        this.close();
    };
    this._onResize = () => this._place();
  }

  isOpen() {
    return !this._panel.classList.contains('hidden');
  }

  /**
   * @param {string} [query] - start text, e.g. a mode prefix ('>' opens the commands)
   */
  open(query = '') {
    if (this.isOpen()) {
      this.setQuery(query);
      this._search.select();
      return;
    }

    this._returnFocus = document.activeElement;
    document.body.append(this._panel);
    this._panel.classList.remove('hidden');
    this._place();
    this.setQuery(query);
    this._search.focus();

    document.addEventListener('mousedown', this._onOutside, true);
    window.addEventListener('resize', this._onResize);
  }

  /** Back to the top level, replaces the search text (cursor at the end) and updates the list. */
  setQuery(query) {
    this._levels = [];
    this._setText(query);
  }

  /**
   * Shows a list of sub-commands (e.g. the choices of a command), the label becomes the breadcrumb.
   * Opens the bar if it is closed.
   * @param {{ label: string, items: () => Object[], placeholder?: string }} level
   */
  showItems({ label, items, placeholder = '' }) {
    if (!this.isOpen())
      this.open(QUICK_OPEN_PREFIX.commands);
    this._levels.push({ label, items, placeholder });
    this._setText('');
  }

  /** One level of sub-commands back (to the commands at the top). */
  back() {
    if (!this._levels.length)
      return;
    this._levels.pop();
    this._setText(this._levels.length ? '' : QUICK_OPEN_PREFIX.commands);
  }

  close({ restoreFocus = false } = {}) {
    if (!this.isOpen())
      return;

    this._panel.classList.add('hidden');
    this._panel.remove();
    this._levels = [];
    document.removeEventListener('mousedown', this._onOutside, true);
    window.removeEventListener('resize', this._onResize);
    if (restoreFocus)
      this._returnFocus?.focus?.({ preventScroll: true });
    this._returnFocus = null;
  }

  destroy() {
    this.close();
  }

  _setText(text) {
    this._search.value = text;
    this._search.setSelectionRange(text.length, text.length);
    this._updateHeader();
    this._render();
  }

  _updateHeader() {
    const level = this._levels.at(-1);
    this._crumbs.classList.toggle('hidden', !level);
    this._crumbs.textContent = this._levels.map(l => l.label).join(' › ');
    this._crumbs.title = level ? t('common.quickOpen.back') : '';
    this._search.placeholder = level
      ? (level.placeholder || t('common.quickOpen.filter'))
      : t(this._getProject() ? 'common.quickOpen.placeholder' : 'common.quickOpen.placeholderCommands');
  }

  // ─── Results ──────────────────────────────────────────────────────────────

  /** Mode and the query without its prefix (lower case, trimmed). Sub-command list = 'items'. */
  _parseQuery() {
    const value = this._search.value;
    if (this._levels.length)
      return { mode: 'items', query: value.trim().toLowerCase() };

    let mode = Object.keys(QUICK_OPEN_PREFIX).find(key => value.startsWith(QUICK_OPEN_PREFIX[key])) ?? 'all';
    const query = (mode === 'all' ? value : value.slice(QUICK_OPEN_PREFIX[mode].length)).trim().toLowerCase();
    // nothing to search without a project
    if (!this._getProject())
      mode = 'commands';
    return { mode, query };
  }

  /** 0 = name starts with the query, 1 = contains it, 2 = only `extra` contains it, null = no match */
  _score(name, query, extra = '') {
    const lower = name.toLowerCase();
    if (lower.startsWith(query))
      return 0;
    if (lower.includes(query))
      return 1;
    if (extra && extra.toLowerCase().includes(query))
      return 2;
    return null;
  }

  /** Sorted by score, then tabs before entries, then in their order. */
  _rank(items) {
    return items
      .filter(item => item.score !== null)
      .sort((a, b) => a.score - b.score || (a.kind === 'tab' ? 0 : 1) - (b.kind === 'tab' ? 0 : 1) || a.order - b.order)
      .slice(0, MAX_RESULTS);
  }

  _collectCommands(commands, query) {
    return this._rank(commands.map((command, order) =>
      ({ kind: 'command', command, order, score: query ? this._score(command.label(), query, command.hint?.()) : 0 })));
  }

  _collectTabs(query) {
    const tabs = this._getProject()?.tabs ?? [];
    return tabs.map((tab, order) =>
      ({ kind: 'tab', tab, order, score: query ? this._score(tab.name, query) : 0 }));
  }

  /**
   * Without a query: recent entries first, then the others in tree order.
   * With a query: name starts with it, name contains it, path / tab contains it.
   */
  _collectEntries(query) {
    const activeId = this._getActiveId();
    const entries = collectProjectEntries(this._getProject()).filter(entry => entry.nodeId !== activeId);

    if (!query) {
      const byId = new Map(entries.map(entry => [entry.nodeId, entry]));
      const recent = this._getRecentIds().map(id => byId.get(id)).filter(Boolean);
      const recentIds = new Set(recent.map(entry => entry.nodeId));
      return [
        ...recent.map(entry => ({ ...entry, recent: true })),
        ...entries.filter(entry => !recentIds.has(entry.nodeId)),
      ].map((entry, order) => ({ kind: 'entry', entry, order, score: 0 }));
    }

    return entries.map((entry, order) => ({
      kind: 'entry', entry, order,
      score: this._score(entry.name, query, [entry.tabName, ...entry.path].join(' › ')),
    }));
  }

  _collect() {
    const { mode, query } = this._parseQuery();
    switch (mode) {
      case 'items':    return this._collectCommands(this._filterCommands(this._levels.at(-1).items() ?? []), query);
      case 'commands': return this._collectCommands(this._getCommands(), query);
      case 'tabs':     return this._rank(this._collectTabs(query));
      // without a query only the entries (recent first), tabs show up when typing
      case 'all':      return this._rank([...(query ? this._collectTabs(query) : []), ...this._collectEntries(query)]);
      default:         return this._rank(this._collectEntries(query));
    }
  }

  _render() {
    this._results = this._collect();

    if (!this._results.length) {
      const { query } = this._parseQuery();
      this._list.innerHTML = `<div class="entry-picker__empty">${escapeHTML(t(query ? 'common.quickOpen.noMatches' : 'common.quickOpen.empty'))}</div>`;
      this._highlighted = -1;
      return;
    }

    // line between the recent entries and the others
    const separator = (item, index) => index > 0 && !item.entry?.recent && this._results[index - 1].entry?.recent
      ? '<div class="quick-open__separator" role="separator"></div>'
      : '';

    this._list.innerHTML = this._results.map((item, index) => `${separator(item, index)}
      <div class="entry-picker__item entry-picker__row--selectable${item.command?.danger ? ' quick-open__item--danger' : ''}" role="option" data-quick-index="${index}">
        ${this._rowContentHTML(item)}
      </div>`).join('');
    this._highlight(0, true);
  }

  /** Shown key of a command's shortcut: in its context, the current one or global. */
  _shortcutEntry(command) {
    if (!command.shortcut)
      return null;
    const contexts = [command.shortcutContext, shortcutManager.getContext(), 'global'].filter(Boolean);
    for (const context of contexts) {
      const entry = shortcutManager.getByContext(context).find(e => e.name === command.shortcut);
      if (entry)
        return entry;
    }
    return null;
  }

  _rowContentHTML(item) {
    if (item.kind === 'command') {
      const command = item.command;
      const combo = this._shortcutEntry(command)?.displayCombo ?? '';
      const hint = command.hint?.() ?? '';
      return `<span class="entry-picker__name">${escapeHTML(command.label())}</span>
        ${hint ? `<span class="entry-picker__hint">${escapeHTML(hint)}</span>` : ''}
        ${combo ? `<kbd class="quick-open__key">${escapeHTML(combo)}</kbd>` : ''}
        ${command.items ? '<span class="quick-open__more" aria-hidden="true">›</span>' : ''}`;
    }

    if (item.kind === 'tab') {
      const active = item.tab.id === this._getActiveTabId();
      const hint = t('common.quickOpen.tab') + (active ? ` · ${t('common.quickOpen.currentTab')}` : '');
      return `<span class="entry-picker__name">${escapeHTML(item.tab.name)}</span>
        <span class="entry-picker__hint">${escapeHTML(hint)}</span>`;
    }

    const entry = item.entry;
    return `<span class="entry-picker__name">${escapeHTML(entry.name)}</span>
      <span class="entry-picker__hint">${escapeHTML([entry.tabName, ...entry.path].join(' › '))}${entry.recent ? ` · ${escapeHTML(t('common.quickOpen.recent'))}` : ''}</span>`;
  }

  _highlight(index, scroll) {
    this._list.querySelector('.entry-picker__row--highlighted')?.classList.remove('entry-picker__row--highlighted');
    this._highlighted = index;
    const row = this._list.querySelector(`[data-quick-index="${index}"]`);
    row?.classList.add('entry-picker__row--highlighted');
    if (scroll)
      row?.scrollIntoView({ block: 'nearest' });
  }

  _onKeyDown(event) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const next = this._highlighted + (event.key === 'ArrowDown' ? 1 : -1);
        if (next >= 0 && next < this._results.length)
          this._highlight(next, true);
        break;
      }
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        if (this._highlighted >= 0)
          this._open(this._highlighted);
        break;
      case 'Backspace':
        // in the empty field of a sub-command list: one level back
        if (this._levels.length && !this._search.value) {
          event.preventDefault();
          this.back();
        }
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close({ restoreFocus: true });
        break;
      case 'Tab':
        event.preventDefault();
        break;
    }
  }

  _open(index) {
    const item = this._results[index];
    if (!item)
      return;

    if (item.kind === 'command') {
      this._runCommand(item.command);
      return;
    }

    this.close();
    if (item.kind === 'tab')
      this._onOpenTab(item.tab.id);
    else
      this._onOpen({ tabId: item.entry.tabId, nodeId: item.entry.nodeId });
  }

  /** Sub-commands: shows their list. Otherwise closes (unless keepOpen) and runs it or its shortcut. */
  _runCommand(command) {
    if (command.items) {
      this.showItems({ label: command.label(), items: command.items, placeholder: command.placeholder?.() });
      return;
    }

    const view = this._getView();
    const shortcut = !command.run ? this._shortcutEntry(command) : null;
    if (!command.keepOpen)
      this.close({ restoreFocus: true });

    if (command.run)
      command.run({ quickOpen: this, view });
    else if (shortcut)
      shortcutManager.dispatch(shortcut.context, shortcut.name);
  }

  /**
   * Over the anchor (the search field lies where the anchor is, at least
   * MIN_WIDTH wide, centered on it), without one centered near the top.
   */
  _place() {
    const style = getComputedStyle(this._panel);
    const margin = parseFloat(style.getPropertyValue('--dropdown-viewport-margin')) || 12;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    const anchor = this._getAnchor()?.getBoundingClientRect();
    const hasAnchor = !!anchor && anchor.width > 0;

    const width = Math.min(Math.max(hasAnchor ? anchor.width : 0, MIN_WIDTH), viewportWidth - 2 * margin);
    const center = hasAnchor ? anchor.left + anchor.width / 2 : viewportWidth / 2;
    const left = Math.max(margin, Math.min(center - width / 2, viewportWidth - width - margin));
    const top = hasAnchor
      ? Math.max(0, anchor.top - parseFloat(style.paddingTop) - parseFloat(style.borderTopWidth))
      : Math.min(viewportHeight * 0.12, 120);

    this._panel.style.width = `${width}px`;
    this._panel.style.left = `${left}px`;
    this._panel.style.top = `${top}px`;
    // compact: at most MAX_HEIGHT, less in a small window
    this._panel.style.maxHeight = `${Math.max(Math.min(viewportHeight - top - margin, MAX_HEIGHT), 160)}px`;
  }
}
