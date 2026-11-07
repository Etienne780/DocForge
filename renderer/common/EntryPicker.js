import { escapeHTML } from '@common/Common.js';

/**
 * EntryPicker - a select-like button that opens a searchable list of the
 * project's entries, grouped by tab. Use it wherever an entry (or a place in
 * the tree) is chosen.
 *
 * Value: { tabId, nodeId } - nodeId null = the tab itself (only with selectTabs).
 *
 * Keyboard: Up / Down move the highlight, Enter picks, Escape / Tab close.
 * The panel lives in document.body above modals and stops Escape from closing them.
 *
 * @example
 *   const picker = new EntryPicker(container, { getProject: () => project, onChange: v => ... });
 *   picker.setValue({ tabId, nodeId });
 */
export class EntryPicker {

  /**
   * @param {HTMLElement} container - the button is appended here
   * @param {Object} options
   * @param {() => Object} options.getProject
   * @param {boolean} [options.selectTabs=false] - tab rows can be picked ("top level of the tab")
   * @param {Set<string>|(() => Set<string>)} [options.excludeIds] - entries hidden with their children
   * @param {string} [options.placeholder='Choose an entry…']
   * @param {string} [options.id] - id of the button (for a <label for>)
   * @param {(value: {tabId: string, nodeId: string|null}|null) => void} [options.onChange]
   */
  constructor(container, { getProject, selectTabs = false, excludeIds = null, placeholder = 'Choose an entry…', id = null, onChange = () => {} }) {
    this._getProject = getProject;
    this._selectTabs = selectTabs;
    this._excludeIds = excludeIds;
    this._placeholder = placeholder;
    this._onChange = onChange;
    this._value = null;

    this._button = document.createElement('button');
    this._button.type = 'button';
    this._button.className = 'entry-picker__button';
    this._button.setAttribute('aria-haspopup', 'listbox');
    if (id)
      this._button.id = id;
    this._button.addEventListener('click', () => this.isOpen() ? this.close() : this.open());
    this._button.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.open();
      }
    });
    container.append(this._button);

    this._panel = document.createElement('div');
    this._panel.className = 'entry-picker__panel hidden';
    this._panel.innerHTML = `
      <input type="text" class="entry-picker__search" placeholder="Search entries…" autocomplete="off" spellcheck="false">
      <div class="entry-picker__list" role="listbox"></div>`;
    this._search = this._panel.querySelector('.entry-picker__search');
    this._list = this._panel.querySelector('.entry-picker__list');

    this._search.addEventListener('input', () => this._renderList());
    this._panel.addEventListener('keydown', event => this._onKeyDown(event));
    this._list.addEventListener('mousedown', event => event.preventDefault()); // keep the focus in the search
    this._list.addEventListener('click', event => {
      const item = event.target.closest('[data-picker-index]');
      if (item)
        this._pick(this._items[Number(item.dataset.pickerIndex)]);
    });
    this._list.addEventListener('mousemove', event => {
      const item = event.target.closest('[data-picker-index]');
      if (item)
        this._highlight(Number(item.dataset.pickerIndex), false);
    });

    this._onOutside = event => {
      if (!this._panel.contains(event.target) && !this._button.contains(event.target))
        this.close();
    };
    this._onViewportChange = () => this.close();
    // scrolling the page / modal would leave the fixed panel behind; its own list may scroll
    this._onScroll = event => {
      if (!this._panel.contains(event.target))
        this.close();
    };

    this._renderButton();
  }

  /** @returns {{ tabId: string, nodeId: string|null }|null} */
  getValue() {
    return this._value ? { ...this._value } : null;
  }

  /** @param {{ tabId: string, nodeId: string|null }|null} value */
  setValue(value) {
    this._value = value ? { tabId: value.tabId, nodeId: value.nodeId ?? null } : null;
    this._renderButton();
  }

  /** Re-reads the project (e.g. after the excluded entries changed). */
  refresh() {
    this._renderButton();
    if (this.isOpen())
      this._renderList();
  }

  isOpen() {
    return !this._panel.classList.contains('hidden');
  }

  open() {
    if (this.isOpen())
      return;

    document.body.append(this._panel);
    this._panel.classList.remove('hidden');
    this._search.value = '';
    this._renderList();
    this._place();
    this._search.focus();
    this._button.setAttribute('aria-expanded', 'true');

    document.addEventListener('mousedown', this._onOutside, true);
    window.addEventListener('resize', this._onViewportChange);
    window.addEventListener('scroll', this._onScroll, true);
  }

  close({ focusButton = false } = {}) {
    if (!this.isOpen())
      return;

    this._panel.classList.add('hidden');
    this._panel.remove();
    this._button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', this._onOutside, true);
    window.removeEventListener('resize', this._onViewportChange);
    window.removeEventListener('scroll', this._onScroll, true);
    if (focusButton)
      this._button.focus();
  }

  destroy() {
    this.close();
    this._button.remove();
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  _renderButton() {
    const label = this._getLabel(this._value);
    this._button.textContent = label ?? this._placeholder;
    this._button.classList.toggle('entry-picker__button--empty', !label);
    this._button.title = label ?? '';
  }

  /** "Tab › Parent › Entry", "Tab (top level)", "(deleted entry)" or null without a value */
  _getLabel(value) {
    if (!value)
      return null;

    const tab = this._getProject()?.tabs?.find(t => t.id === value.tabId);
    if (!tab)
      return '(deleted entry)';
    if (!value.nodeId)
      return `${tab.name} (top level)`;

    const path = _findPath(tab.nodes, value.nodeId);
    return path ? `${tab.name} › ${path.map(n => n.name).join(' › ')}` : '(deleted entry)';
  }

  /** Builds the visible items: tab rows and entries (tree, or flat matches with their path while searching). */
  _renderList() {
    const project = this._getProject();
    const query = this._search.value.trim().toLowerCase();
    const excluded = typeof this._excludeIds === 'function' ? this._excludeIds() : this._excludeIds;
    this._items = [];

    for (const tab of project?.tabs ?? []) {
      const entries = [];
      const walk = (nodes, depth, path) => nodes.forEach(node => {
        if (excluded?.has(node.id))
          return;
        if (!query || node.name.toLowerCase().includes(query))
          entries.push({ tabId: tab.id, nodeId: node.id, name: node.name, depth: query ? 0 : depth, path: query ? path : [] });
        walk(node.children ?? [], depth + 1, [...path, node.name]);
      });
      walk(tab.nodes ?? [], 0, []);

      const tabMatches = !query || tab.name.toLowerCase().includes(query);
      if (!entries.length && !(this._selectTabs && tabMatches))
        continue;

      this._items.push({ tabId: tab.id, nodeId: null, name: tab.name, isTab: true, selectable: this._selectTabs });
      this._items.push(...entries.map(entry => ({ ...entry, selectable: true })));
    }

    this._list.innerHTML = '';
    if (!this._items.length) {
      this._list.innerHTML = `<div class="entry-picker__empty">${query ? 'No matching entries.' : 'No entries.'}</div>`;
      this._highlighted = -1;
      return;
    }

    this._items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = item.isTab ? 'entry-picker__tab' : 'entry-picker__item';
      if (item.selectable) {
        row.dataset.pickerIndex = String(index);
        row.setAttribute('role', 'option');
        row.classList.add('entry-picker__row--selectable');
      }
      if (!item.isTab)
        row.style.paddingLeft = `calc(var(--spacing-s) + ${Math.min(item.depth, 10)} * var(--spacing-m))`;

      row.innerHTML = item.isTab
        ? `<span class="entry-picker__name">${escapeHTML(item.name)}</span>`
        : `<span class="entry-picker__name">${escapeHTML(item.name)}</span>${item.path.length ? `<span class="entry-picker__hint">${escapeHTML(item.path.join(' › '))}</span>` : ''}`;

      if (this._isSelected(item))
        row.classList.add('entry-picker__row--selected');
      this._list.append(row);
    });

    // start at the selected item, while searching at the first match
    const selectedIndex = this._items.findIndex(item => item.selectable && this._isSelected(item));
    const firstIndex = this._items.findIndex(item => item.selectable && (!query || !item.isTab));
    this._highlight(!query && selectedIndex !== -1 ? selectedIndex : firstIndex, true);
  }

  _isSelected(item) {
    return !!this._value && item.tabId === this._value.tabId && item.nodeId === (this._value.nodeId ?? null);
  }

  _highlight(index, scroll) {
    this._list.querySelector('.entry-picker__row--highlighted')?.classList.remove('entry-picker__row--highlighted');
    this._highlighted = index;
    const row = this._list.querySelector(`[data-picker-index="${index}"]`);
    row?.classList.add('entry-picker__row--highlighted');
    if (scroll)
      row?.scrollIntoView({ block: 'nearest' });
  }

  _moveHighlight(direction) {
    let index = this._highlighted;
    do {
      index += direction;
    } while (index >= 0 && index < this._items.length && !this._items[index].selectable);
    if (index >= 0 && index < this._items.length)
      this._highlight(index, true);
  }

  _onKeyDown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this._moveHighlight(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this._moveHighlight(-1);
        break;
      case 'Enter':
        event.preventDefault();
        event.stopPropagation();
        if (this._items?.[this._highlighted]?.selectable)
          this._pick(this._items[this._highlighted]);
        break;
      case 'Escape':
        // only the picker closes, not the modal around it
        event.preventDefault();
        event.stopPropagation();
        this.close({ focusButton: true });
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  _pick(item) {
    this._value = { tabId: item.tabId, nodeId: item.nodeId };
    this._renderButton();
    this.close({ focusButton: true });
    this._onChange(this.getValue());
  }

  /** Below the button (or above if there is more room), inside the window. */
  _place() {
    const rect = this._button.getBoundingClientRect();
    const margin = parseFloat(getComputedStyle(this._panel).getPropertyValue('--dropdown-viewport-margin')) || 12;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const gap = 4;

    const width = Math.min(Math.max(rect.width, 280), viewportWidth - 2 * margin);
    this._panel.style.width = `${width}px`;
    this._panel.style.left = `${Math.max(margin, Math.min(rect.left, viewportWidth - width - margin))}px`;

    const spaceBelow = viewportHeight - margin - rect.bottom - gap;
    const spaceAbove = rect.top - margin - gap;
    const below = spaceBelow >= 240 || spaceBelow >= spaceAbove;
    this._panel.style.maxHeight = `${Math.max(below ? spaceBelow : spaceAbove, 120)}px`;
    this._panel.style.top = below ? `${rect.bottom + gap}px` : '';
    this._panel.style.bottom = below ? '' : `${viewportHeight - rect.top + gap}px`;
  }
}

function _findPath(nodes, nodeId, path = []) {
  for (const node of nodes ?? []) {
    if (node.id === nodeId)
      return [...path, node];
    const found = _findPath(node.children, nodeId, [...path, node]);
    if (found)
      return found;
  }
  return null;
}
