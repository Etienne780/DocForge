import { escapeHTML } from '@common/Common.js';
import { collectProjectEntries } from '@common/EntryPicker.js';

const MAX_RESULTS = 100;
// px of the panel (search + list), the list scrolls
const MAX_HEIGHT = 360;
const MIN_WIDTH = 480;

/**
 * QuickOpen - search field at the top of the window to open any entry
 * (Navigate:quickOpen, Ctrl+P). Without a query the recently opened entries
 * come first. Looks like the EntryPicker list (.entry-picker__* classes).
 *
 * Keyboard: Up / Down, Enter opens, Escape closes.
 */
export class QuickOpen {

  /**
   * @param {Object} options
   * @param {() => Object} options.getProject
   * @param {() => string[]} [options.getRecentIds] - most recent first
   * @param {() => string|null} [options.getActiveId] - left out of the list
   * @param {(entry: { tabId: string, nodeId: string }) => void} options.onOpen
   * @param {() => HTMLElement|null} [options.getAnchor] - visible element the panel opens over
   *        (its search field covers it), e.g. the search field in the title bar
   */
  constructor({ getProject, getRecentIds = () => [], getActiveId = () => null, onOpen, getAnchor = () => null }) {
    this._getAnchor = getAnchor;
    this._getProject = getProject;
    this._getRecentIds = getRecentIds;
    this._getActiveId = getActiveId;
    this._onOpen = onOpen;
    this._results = [];

    this._panel = document.createElement('div');
    this._panel.className = 'quick-open entry-picker__panel hidden';
    this._panel.innerHTML = `
      <input type="text" class="entry-picker__search" placeholder="Open entry…" autocomplete="off" spellcheck="false">
      <div class="entry-picker__list" role="listbox"></div>`;
    this._search = this._panel.querySelector('.entry-picker__search');
    this._list = this._panel.querySelector('.entry-picker__list');

    this._search.addEventListener('input', () => this._render());
    this._panel.addEventListener('keydown', event => this._onKeyDown(event));
    this._list.addEventListener('mousedown', event => event.preventDefault()); // keep the focus in the search
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

  open() {
    if (this.isOpen()) {
      this._search.select();
      return;
    }

    this._returnFocus = document.activeElement;
    document.body.append(this._panel);
    this._panel.classList.remove('hidden');
    this._search.value = '';
    this._place();
    this._render();
    this._search.focus();

    document.addEventListener('mousedown', this._onOutside, true);
    window.addEventListener('resize', this._onResize);
  }

  close({ restoreFocus = false } = {}) {
    if (!this.isOpen())
      return;

    this._panel.classList.add('hidden');
    this._panel.remove();
    document.removeEventListener('mousedown', this._onOutside, true);
    window.removeEventListener('resize', this._onResize);
    if (restoreFocus)
      this._returnFocus?.focus?.({ preventScroll: true });
    this._returnFocus = null;
  }

  destroy() {
    this.close();
  }

  // ─── Results ──────────────────────────────────────────────────────────────

  /**
   * Without a query: recent entries first, then the others in tree order.
   * With a query: name starts with it, name contains it, path / tab contains it.
   */
  _collect(query) {
    const activeId = this._getActiveId();
    const entries = collectProjectEntries(this._getProject()).filter(entry => entry.nodeId !== activeId);

    if (!query) {
      const byId = new Map(entries.map(entry => [entry.nodeId, entry]));
      const recent = this._getRecentIds().map(id => byId.get(id)).filter(Boolean);
      const recentIds = new Set(recent.map(entry => entry.nodeId));
      return [
        ...recent.map(entry => ({ ...entry, recent: true })),
        ...entries.filter(entry => !recentIds.has(entry.nodeId)),
      ].slice(0, MAX_RESULTS);
    }

    const scored = [];
    entries.forEach((entry, order) => {
      const name = entry.name.toLowerCase();
      let score;
      if (name.startsWith(query))
        score = 0;
      else if (name.includes(query))
        score = 1;
      else if ([entry.tabName, ...entry.path].join(' › ').toLowerCase().includes(query))
        score = 2;
      else
        return;
      scored.push({ entry, score, order });
    });

    return scored
      .sort((a, b) => a.score - b.score || a.order - b.order)
      .slice(0, MAX_RESULTS)
      .map(({ entry }) => entry);
  }

  _render() {
    const query = this._search.value.trim().toLowerCase();
    this._results = this._collect(query);

    if (!this._results.length) {
      this._list.innerHTML = `<div class="entry-picker__empty">${query ? 'No matching entries.' : 'No entries.'}</div>`;
      this._highlighted = -1;
      return;
    }

    // line between the recent entries and the others
    const separator = (entry, index) => index > 0 && !entry.recent && this._results[index - 1].recent
      ? '<div class="quick-open__separator" role="separator"></div>'
      : '';

    this._list.innerHTML = this._results.map((entry, index) => `${separator(entry, index)}
      <div class="entry-picker__item entry-picker__row--selectable" role="option" data-quick-index="${index}">
        <span class="entry-picker__name">${escapeHTML(entry.name)}</span>
        <span class="entry-picker__hint">${escapeHTML([entry.tabName, ...entry.path].join(' › '))}${entry.recent ? ' · recent' : ''}</span>
      </div>`).join('');
    this._highlight(0, true);
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
    const entry = this._results[index];
    if (!entry)
      return;
    this.close();
    this._onOpen({ tabId: entry.tabId, nodeId: entry.nodeId });
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
