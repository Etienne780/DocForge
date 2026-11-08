/**
 * EditorTextHistory - undo / redo of the text in the doc editor input, one history per entry.
 *
 * Replaces the browser undo of the textarea (which is lost when another entry is loaded or
 * the text is set from code). Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z and the Undo / Redo of the
 * context menu work on the text of the open entry; outside of the textarea the shortcuts
 * undo project changes (@data/ProjectHistory.js).
 *
 * Steps: typing is grouped until a pause (GROUP_PAUSE_MS), a switch between writing and
 * deleting, a line break or a cursor jump. Changes from code (toolbar, structure edit,
 * replace) are their own step (sync() before / after them, EditorArea._renderPreview calls it).
 * A step stores the text and the selection before it.
 *
 * When the entry's content changes from outside (project undo, find / replace in all
 * entries, reload) its text history starts again.
 */

const GROUP_PAUSE_MS = 1000;
const MAX_STEPS = 300;

/**
 * @typedef {Object} TextState
 * @property {string} value
 * @property {number} start
 * @property {number} end
 */

export class EditorTextHistory {
  /**
   * @param {HTMLTextAreaElement} textarea
   * @param {() => string|null} getEntryId - id of the open entry
   * @param {object} [options]
   * @param {(position: number) => void} [options.scrollToPosition] - brings a text position into view
   */
  constructor(textarea, getEntryId, { scrollToPosition = null } = {}) {
    this._textarea = textarea;
    this._getEntryId = getEntryId;
    this._scrollToPosition = scrollToPosition;
    /** @type {Map<string, { undo: TextState[], redo: TextState[], last: TextState, time: number, kind: string|null }>} */
    this._entries = new Map();
    this._selectionBefore = null;
    this._applying = false;

    this._onBeforeInput = event => this._beforeInput(event);
    this._onInput = event => this._input(event);
    this._onKeyDown = event => this._keyDown(event);
    this._onSelect = () => this._breakGroup();

    // capture: runs before the editor's own input handler, which saves the content
    textarea.addEventListener('beforeinput', this._onBeforeInput, true);
    textarea.addEventListener('input', this._onInput, true);
    textarea.addEventListener('keydown', this._onKeyDown, true);
    textarea.addEventListener('mousedown', this._onSelect);
  }

  /**
   * Called when an entry is shown. Keeps its history if the text is unchanged.
   * @param {string} entryId
   * @param {string} value
   */
  load(entryId, value) {
    const entry = this._entries.get(entryId);
    if (entry && entry.last.value === value)
      return;
    const position = Math.min(this._textarea.selectionStart, value.length);
    this._entries.set(entryId, {
      undo: [],
      redo: [],
      last: { value, start: position, end: position },
      time: 0,
      kind: null,
    });
  }

  /** Records a change made from code (no input event) as its own step. */
  sync() {
    const entry = this._current();
    if (!entry || this._applying || entry.last.value === this._textarea.value)
      return;
    this._push(entry, entry.last);
    entry.kind = null;
    entry.last = this._state();
  }

  undo() {
    return this._move('undo', 'redo');
  }

  redo() {
    return this._move('redo', 'undo');
  }

  destroy() {
    this._textarea.removeEventListener('beforeinput', this._onBeforeInput, true);
    this._textarea.removeEventListener('input', this._onInput, true);
    this._textarea.removeEventListener('keydown', this._onKeyDown, true);
    this._textarea.removeEventListener('mousedown', this._onSelect);
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _current() {
    const entryId = this._getEntryId();
    return entryId ? this._entries.get(entryId) ?? null : null;
  }

  _state() {
    const { value, selectionStart, selectionEnd } = this._textarea;
    return { value, start: selectionStart, end: selectionEnd };
  }

  _keyDown(event) {
    if (!event.ctrlKey || event.altKey || event.metaKey)
      return;
    const key = event.key.toLowerCase();
    const isUndo = key === 'z' && !event.shiftKey;
    const isRedo = (key === 'y' && !event.shiftKey) || (key === 'z' && event.shiftKey);
    if (!isUndo && !isRedo)
      return;

    // never the browser undo, and not the project undo (ShortcutManager) either
    event.preventDefault();
    event.stopPropagation();
    if (isUndo)
      this.undo();
    else
      this.redo();
  }

  _beforeInput(event) {
    // Undo / Redo of the context menu
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault();
      if (event.inputType === 'historyUndo')
        this.undo();
      else
        this.redo();
      return;
    }
    this._selectionBefore = { start: this._textarea.selectionStart, end: this._textarea.selectionEnd };
  }

  _input(event) {
    const entry = this._current();
    if (!entry || this._applying || entry.last.value === this._textarea.value)
      return;

    const now = Date.now();
    const type = event.inputType ?? '';
    const kind = type.startsWith('delete') ? 'delete' : type === 'insertText' ? 'insert' : 'other';
    const lineBreak = type === 'insertLineBreak' || type === 'insertParagraph';
    const selection = this._selectionBefore;
    const continues = kind !== 'other' && !lineBreak && kind === entry.kind
      && now - entry.time < GROUP_PAUSE_MS
      && selection && selection.start === entry.last.start && selection.end === entry.last.end;

    if (!continues)
      this._push(entry, selection ? { ...entry.last, start: selection.start, end: selection.end } : entry.last);

    entry.kind = lineBreak ? null : kind;
    entry.time = now;
    entry.last = this._state();
    this._selectionBefore = null;
  }

  _breakGroup() {
    const entry = this._current();
    if (entry)
      entry.kind = null;
  }

  _push(entry, state) {
    entry.undo.push(state);
    if (entry.undo.length > MAX_STEPS)
      entry.undo.shift();
    entry.redo = [];
  }

  _move(from, to) {
    const entry = this._current();
    // the text may have been changed from code since the last step
    this.sync();
    const state = entry?.[from].pop();
    if (!state)
      return false;

    entry[to].push(this._state());
    entry.last = state;
    entry.kind = null;

    this._applying = true;
    try {
      const textarea = this._textarea;
      textarea.value = state.value;
      textarea.setSelectionRange(state.start, state.end);
      // the editor saves the content (project change) and renders the preview
      textarea.dispatchEvent(new Event('input'));
    } finally {
      this._applying = false;
    }
    // the textarea doesn't scroll to the cursor by itself after value = ...
    this._scrollToPosition?.(state.start);
    return true;
  }
}
