import { Component } from '@core/Component.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { debounce } from '@common/Common.js';
import { applyReplacements, getReplacement } from '@common/TextSearch.js';
import { searchProject } from '@data/ProjectSearch.js';
import { notifyOpenProjectChange } from '@data/ProjectManager.js';
import { rebuildLinkUsages } from '@data/LinkManager.js';
import { openReplacePreview, isReplacePreviewOpen } from '../../helpers/ReplacePreviewModal.js';

const MAX_MARKS = 1000;
const MULTI_ENTRY_SCOPES = ['tab', 'all'];

/**
 * FindWidget - find / replace box of the doc editor (top right of the editor input).
 *
 * The options live in session.editorSearch, so the widget, the shortcuts and the
 * "Search" tab of the right sidebar share them. Every search result is published
 * with `editor:search:results`.
 *
 * Props: { textarea, highlighter, getProject }
 */
export default class FindWidget extends Component {

  onLoad() {
    this._textarea = this.props.textarea;
    this._highlighter = this.props.highlighter;
    this._getProject = this.props.getProject;

    this._isOpen = false;
    this._selection = null;      // { nodeId, start, end } range of the 'selection' scope
    this._result = { error: null, groups: [], total: 0 };
    this._matches = [];          // matches of the open entry
    this._activeIndex = -1;
    this._anchor = 0;            // text position the next match is searched from
    this._pendingSelect = null;  // { nodeId, start } match to select after another entry opened
    this._lastLength = 0;

    this._setupElements();
    this._setupTextarea();

    this.subscribe('editor:find:open', (options = {}) => this.open(options));
    this.subscribe('editor:find:next', ({ direction = 1 } = {}) => {
      // the open replace preview steps through its own matches
      if (isReplacePreviewOpen())
        return;
      if (!this._isOpen) {
        this.open({ scope: this._options().scope === 'selection' ? 'entry' : this._options().scope });
        return;
      }
      this._navigate(direction);
    });
    this.subscribe('editor:find:toggle', ({ option }) => {
      if (this._isOpen)
        this._toggleOption(option);
    });
    this.subscribe('editor:find:replace-all', () => {
      if (this._isOpen)
        this._replaceAll();
    });

    this.subscribe('session:change:activeNodeId', () => this._onEntryChange());
    this.subscribe('session:change:activeTabId', () => this._refresh());
    const refreshLater = debounce(() => this._refresh(), 150);
    ['session:change:openProject:tabs', 'session:change:openProject:tabs:nodes'].forEach(event => this.subscribe(event, refreshLater));
  }

  onDestroy() {
    this._textarea.removeEventListener('input', this._onTextareaInput);
    this._textarea.removeEventListener('keydown', this._onTextareaKeyDown);
    session.set('isEditorSearchOpen', false);
    eventBus.emit('editor:search:results', null);
  }

  /**
   * @param {object} [options]
   * @param {string|null} [options.scope] - 'selection' | 'entry' | 'tab' | 'all', null keeps the current one
   * @param {boolean} [options.replace=false] - shows the replace row
   */
  open({ scope = null, replace = false } = {}) {
    const textarea = this._textarea;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const selected = textarea.value.slice(start, end);
    const changes = {};
    let nextScope = scope ?? this._options().scope;

    // the selection scope searches in the selected text, otherwise a selection inside one line becomes the query
    if (selected && scope === 'selection') {
      this._selection = { nodeId: session.get('activeNodeId'), start, end };
      nextScope = 'selection';
    } else if (selected && !selected.includes('\n')) {
      changes.query = selected;
    }
    if (nextScope === 'selection' && !this._selectionIsValid())
      nextScope = 'entry';
    changes.scope = nextScope;

    this._anchor = start;
    this._lastLength = textarea.value.length;
    this._isOpen = true;
    this.element('find').classList.remove('hidden');
    this._setReplaceVisible(replace || (!scope && !this.element('replace-row').classList.contains('hidden')));
    session.set('isEditorSearchOpen', true);

    this._setOptions(changes);
    this._syncInputs();

    const input = this.element('find-input');
    input.focus();
    input.select();

    if (MULTI_ENTRY_SCOPES.includes(nextScope))
      eventBus.emit('editor:search:show');
  }

  close() {
    if (!this._isOpen)
      return;

    this._isOpen = false;
    this._selection = null;
    this.element('find').classList.add('hidden');
    session.set('isEditorSearchOpen', false);
    this._highlighter.setMarks([]);
    eventBus.emit('editor:search:results', null);
    this._textarea.focus();
  }

  // ─── Setup ──────────────────────────────────────────────────────────────────

  _setupElements() {
    const findInput = this.element('find-input');
    const replaceInput = this.element('replace-input');

    findInput.addEventListener('input', () => {
      this._anchor = this._matches[this._activeIndex]?.start ?? this._textarea.selectionStart;
      this._setOptions({ query: findInput.value });
    });
    replaceInput.addEventListener('input', () => {
      // only stored, the matches don't change
      session.set('editorSearch', { ...this._options(), replace: replaceInput.value });
    });

    findInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this._navigate(event.shiftKey ? -1 : 1);
      } else if (event.key === 'Escape') {
        event.stopPropagation();
        this.close();
      }
    });
    replaceInput.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        this._replaceNext();
      } else if (event.key === 'Escape') {
        event.stopPropagation();
        this.close();
      }
    });

    this.element('find').addEventListener('click', event => {
      const option = event.target.closest('[data-find-option]');
      if (option)
        this._toggleOption(option.dataset.findOption);
    });

    this.element('scope').addEventListener('change', event => this._setScope(event.target.value));
    this.element('previous').addEventListener('click', () => this._navigate(-1));
    this.element('next').addEventListener('click', () => this._navigate(1));
    this.element('close').addEventListener('click', () => this.close());
    this.element('replace-next').addEventListener('click', () => this._replaceNext());
    this.element('replace-all').addEventListener('click', () => this._replaceAll());
    this.element('toggle-replace').addEventListener('click', () => {
      this._setReplaceVisible(this.element('replace-row').classList.contains('hidden'));
    });
  }

  _setupTextarea() {
    this._onTextareaInput = () => {
      if (!this._isOpen)
        return;

      const length = this._textarea.value.length;
      const delta = length - this._lastLength;
      this._lastLength = length;
      if (delta)
        this._moveSelectionRange(delta);
      this._refresh();
    };

    this._onTextareaKeyDown = event => {
      if (this._isOpen && event.key === 'Escape' && !event.defaultPrevented)
        this.close();
    };

    this._textarea.addEventListener('input', this._onTextareaInput);
    this._textarea.addEventListener('keydown', this._onTextareaKeyDown);
  }

  // ─── Options ────────────────────────────────────────────────────────────────

  _options() {
    return session.get('editorSearch');
  }

  _setOptions(changes) {
    session.set('editorSearch', { ...this._options(), ...changes });
    this._syncInputs();
    this._refresh();
  }

  _toggleOption(option) {
    if (!(option in this._options()))
      return;
    this._setOptions({ [option]: !this._options()[option] });
  }

  _setScope(scope) {
    if (scope === 'selection' && !this._selectionIsValid()) {
      const { selectionStart: start, selectionEnd: end } = this._textarea;
      if (start === end) {
        eventBus.emit('toast:show', { message: 'Select the text to search in first', type: 'info' });
        this._syncInputs();
        return;
      }
      this._selection = { nodeId: session.get('activeNodeId'), start, end };
    }

    this._setOptions({ scope });
    if (MULTI_ENTRY_SCOPES.includes(scope))
      eventBus.emit('editor:search:show');
  }

  _syncInputs() {
    const options = this._options();
    const findInput = this.element('find-input');
    const replaceInput = this.element('replace-input');
    if (findInput.value !== options.query)
      findInput.value = options.query;
    if (replaceInput.value !== options.replace)
      replaceInput.value = options.replace;

    this.queryAll('[data-find-option]').forEach(button => {
      const active = Boolean(options[button.dataset.findOption]);
      button.classList.toggle('find-widget__option--active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    this.element('scope').value = options.scope;
  }

  _setReplaceVisible(visible) {
    this.element('replace-row').classList.toggle('hidden', !visible);
    this.element('toggle-replace').classList.toggle('find-widget__toggle--open', visible);
  }

  // ─── Search ─────────────────────────────────────────────────────────────────

  _refresh() {
    if (!this._isOpen)
      return;

    const options = this._options();
    const activeNodeId = session.get('activeNodeId');
    this._result = searchProject(this._getProject(), options, {
      scope: options.scope,
      activeTabId: session.get('activeTabId'),
      activeNodeId,
      selection: options.scope === 'selection' ? this._selection : null,
    });

    this._matches = this._result.groups.find(group => group.node.id === activeNodeId)?.matches ?? [];

    if (this._pendingSelect?.nodeId === activeNodeId) {
      const index = this._matches.findIndex(match => match.start === this._pendingSelect.start);
      this._pendingSelect = null;
      this._activeIndex = index;
      if (index >= 0)
        this._select(index);
    } else {
      // the first match from the anchor on, wraps to the first one
      const next = this._matches.findIndex(match => match.start >= this._anchor);
      this._activeIndex = next >= 0 ? next : (this._matches.length ? 0 : -1);
    }

    this._render();
    eventBus.emit('editor:search:results', { ...this._result, options });
  }

  _onEntryChange() {
    if (!this._isOpen)
      return;

    // the selection belongs to the entry that was open
    if (this._options().scope === 'selection' && !this._selectionIsValid()) {
      this._selection = null;
      session.set('editorSearch', { ...this._options(), scope: 'entry' });
      this._syncInputs();
    }

    this._lastLength = this._textarea.value.length;
    if (!this._pendingSelect)
      this._anchor = 0;
    this._refresh();
  }

  _selectionIsValid() {
    return Boolean(this._selection && this._selection.nodeId === session.get('activeNodeId'));
  }

  /** Keeps the 'selection' range on the same text while typing inside or before it. */
  _moveSelectionRange(delta) {
    if (!this._selection)
      return;

    // start of the edit: the caret minus the inserted text (deletions leave the caret at the start)
    const editAt = this._textarea.selectionStart - Math.max(delta, 0);
    if (editAt < this._selection.start) {
      this._selection.start = Math.max(0, this._selection.start + delta);
      this._selection.end = Math.max(this._selection.start, this._selection.end + delta);
    } else if (editAt <= this._selection.end) {
      this._selection.end = Math.max(this._selection.start, this._selection.end + delta);
    }
  }

  _render() {
    const { error, total, groups } = this._result;
    const options = this._options();
    const count = this.element('count');
    const errorElement = this.element('error');

    errorElement.classList.toggle('hidden', !error);
    errorElement.textContent = error ? `Invalid pattern: ${error}` : '';
    errorElement.title = error ?? '';
    this.element('find-input').parentElement.classList.toggle('find-widget__field--error', Boolean(error));

    let text = '';
    if (options.query && !error) {
      if (!total) {
        text = 'No results';
      } else if (MULTI_ENTRY_SCOPES.includes(options.scope)) {
        const groupIndex = groups.findIndex(group => group.node.id === session.get('activeNodeId'));
        const before = groups.slice(0, Math.max(groupIndex, 0)).reduce((sum, group) => sum + group.matches.length, 0);
        text = this._activeIndex >= 0 && groupIndex >= 0
          ? `${before + this._activeIndex + 1} of ${total}`
          : `${total} in ${groups.length} ${groups.length === 1 ? 'entry' : 'entries'}`;
      } else {
        text = this._activeIndex >= 0 ? `${this._activeIndex + 1} of ${total}` : `${total} results`;
      }
    }
    count.textContent = text;
    count.classList.toggle('find-widget__count--empty', Boolean(options.query) && !total);

    for (const id of ['previous', 'next', 'replace-next', 'replace-all'])
      this.element(id).disabled = !total;

    this._renderMarks();
  }

  _renderMarks() {
    const marks = [];
    if (this._options().scope === 'selection' && this._selectionIsValid())
      marks.push({ start: this._selection.start, end: this._selection.end, type: 'range' });

    this._matches.slice(0, MAX_MARKS).forEach((match, index) => {
      marks.push({ start: match.start, end: match.end, type: index === this._activeIndex ? 'active' : 'match' });
    });
    const active = this._matches[this._activeIndex];
    if (active && this._activeIndex >= MAX_MARKS)
      marks.push({ start: active.start, end: active.end, type: 'active' });

    this._highlighter.setMarks(marks);
  }

  // ─── Navigation ─────────────────────────────────────────────────────────────

  /** Next / previous match. In the tab and all-tabs scopes it continues in the next entry with matches. */
  _navigate(direction) {
    if (!this._result.total)
      return;

    const matches = this._matches;
    let index;
    if (this._activeIndex >= 0) {
      index = this._activeIndex + direction;
    } else {
      const caret = this._textarea.selectionStart;
      index = direction > 0
        ? matches.findIndex(match => match.start >= caret)
        : matches.findLastIndex(match => match.start < caret);
      if (index < 0)
        index = matches.length;
    }

    if (index >= 0 && index < matches.length) {
      this._select(index);
      return;
    }

    const groups = this._result.groups;
    const activeNodeId = session.get('activeNodeId');
    if (MULTI_ENTRY_SCOPES.includes(this._options().scope) && groups.some(group => group.node.id !== activeNodeId)) {
      const current = groups.findIndex(group => group.node.id === activeNodeId);
      const target = current < 0
        ? groups[direction > 0 ? 0 : groups.length - 1]
        : groups[(current + direction + groups.length) % groups.length];
      const match = direction > 0 ? target.matches[0] : target.matches[target.matches.length - 1];

      this._pendingSelect = { nodeId: target.node.id, start: match.start };
      eventBus.emit('editor:select-range', { nodeId: target.node.id, start: match.start, end: match.end });
      return;
    }

    // wrap around inside the entry
    if (matches.length)
      this._select(direction > 0 ? 0 : matches.length - 1);
  }

  /** Makes a match of the open entry the current one: selected in the textarea and scrolled into view. */
  _select(index) {
    const match = this._matches[index];
    if (!match)
      return;

    this._activeIndex = index;
    this._anchor = match.start;
    this._textarea.setSelectionRange(match.start, match.end);
    this._highlighter.scrollToPosition(match.start);
    this._render();
  }

  // ─── Replace ────────────────────────────────────────────────────────────────

  /** Replaces the current match and selects the next one. The first press only selects the match. */
  _replaceNext() {
    const match = this._matches[this._activeIndex];
    if (!match) {
      this._navigate(1);
      return;
    }

    const textarea = this._textarea;
    if (textarea.selectionStart !== match.start || textarea.selectionEnd !== match.end) {
      this._select(this._activeIndex);
      return;
    }

    const options = this._options();
    const replacement = getReplacement(match, options.replace, options);
    this._anchor = match.start + replacement.length;
    this._insertText(match.start, match.end, replacement);

    // the input event refreshed the matches (from the anchor on)
    const next = this._matches[this._activeIndex];
    if (next && next.start >= this._anchor)
      this._select(this._activeIndex);
    else
      this._navigate(1);
  }

  /** Shows the replace preview for all matches of the scope. */
  _replaceAll() {
    const options = this._options();
    const result = searchProject(this._getProject(), options, {
      scope: options.scope,
      activeTabId: session.get('activeTabId'),
      activeNodeId: session.get('activeNodeId'),
      selection: options.scope === 'selection' ? this._selection : null,
      withReplacement: true,
    });

    if (!result.total) {
      eventBus.emit('toast:show', { message: 'Nothing to replace', type: 'info' });
      return;
    }

    openReplacePreview({ groups: result.groups, onApply: groups => this._applyReplacements(groups) });
  }

  _applyReplacements(groups) {
    const project = this._getProject();
    const activeNodeId = session.get('activeNodeId');
    const count = groups.reduce((sum, group) => sum + group.matches.length, 0);

    // the open entry through the textarea: part of its undo history
    const active = groups.find(group => group.node.id === activeNodeId);
    if (active)
      eventBus.emit('editor:replace-content', { nodeId: activeNodeId, content: applyReplacements(this._textarea.value, active.matches) });

    const others = groups.filter(group => group !== active);
    if (others.length) {
      notifyOpenProjectChange(() => {
        for (const group of others)
          group.node.content = applyReplacements(group.node.content ?? '', group.matches);
      }, 'tabs:nodes');
    }

    rebuildLinkUsages(project);
    this._lastLength = this._textarea.value.length;
    this._refresh();

    eventBus.emit('toast:show', {
      message: `Replaced ${count} ${count === 1 ? 'match' : 'matches'} in ${groups.length} ${groups.length === 1 ? 'entry' : 'entries'}`,
      type: 'success',
    });
  }

  /** Inserts into the textarea like typing (undo history, input event), the focus stays where it was. */
  _insertText(start, end, text) {
    const textarea = this._textarea;
    const focused = document.activeElement;

    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(start, end);
    const done = text
      ? document.execCommand('insertText', false, text)
      : document.execCommand('delete');
    if (!done) {
      textarea.setRangeText(text, start, end, 'end');
      textarea.dispatchEvent(new Event('input'));
    }

    if (focused && focused !== textarea)
      focused.focus({ preventScroll: true });
  }
}
