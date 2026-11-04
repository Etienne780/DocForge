import { tokenizeLine, lineStateKey, INITIAL_LINE_STATE } from './EditorTokenizer.js';

/**
 * EditorHighlighter - syntax highlighting for a textarea.
 *
 * The textarea stays the input (undo, selection, IME and all editor helpers keep working),
 * its text is transparent. A layer with the same font, padding and wrapping lies behind it
 * and shows the highlighted text, one element per source line. On a change only the changed
 * lines are tokenized again, plus the following lines whose start state changed
 * (e.g. after opening a code fence).
 *
 * Changes made through the textarea fire `input` and are picked up automatically.
 * After setting `textarea.value` from code, call update().
 */
export class EditorHighlighter {
  /**
   * @param {HTMLTextAreaElement} textarea - Its parent must be positioned (the layer is inserted before it).
   * @param {object} [options]
   * @param {(slug: string) => boolean} [options.isRefValid] - Marks [[slug]] links as broken when false.
   */
  constructor(textarea, { isRefValid = () => true } = {}) {
    this._textarea = textarea;
    this._isRefValid = isRefValid;

    this._layer = document.createElement('div');
    this._layer.className = 'editor-highlight';
    this._layer.setAttribute('aria-hidden', 'true');
    this._content = document.createElement('div');
    this._content.className = 'editor-highlight__content';
    this._layer.append(this._content);
    textarea.before(this._layer);

    /** @type {Array<{ element: HTMLElement, startKey: string|null, endState: object|null }>} */
    this._rows = [];
    this._lines = [];
    this._value = null;

    this._onInput = () => this.update();
    this._onScroll = () => this._syncScroll();
    textarea.addEventListener('input', this._onInput);
    textarea.addEventListener('scroll', this._onScroll);

    // the textarea's client area changes with the split pane and when its scrollbar appears
    this._resizeObserver = new ResizeObserver(() => this._syncSize());
    this._resizeObserver.observe(textarea);

    this.update();
  }

  /** Renders the changed lines of the textarea value. */
  update() {
    const value = this._textarea.value;
    if (value === this._value)
      return;
    this._value = value;

    const lines = value.split('\n');
    const old = this._lines;

    // unchanged lines at the start and at the end
    const max = Math.min(lines.length, old.length);
    let start = 0;
    while (start < max && lines[start] === old[start])
      start++;
    let end = 0;
    while (end < max - start && lines[lines.length - 1 - end] === old[old.length - 1 - end])
      end++;

    const insertedCount = lines.length - end - start;
    const inserted = Array.from({ length: insertedCount }, () => this._createRow());

    this._rows.slice(start, old.length - end).forEach(row => row.element.remove());
    const next = this._rows[old.length - end]?.element ?? null;
    const fragment = document.createDocumentFragment();
    inserted.forEach(row => fragment.append(row.element));
    this._content.insertBefore(fragment, next);

    this._rows = [...this._rows.slice(0, start), ...inserted, ...this._rows.slice(old.length - end)];
    this._lines = lines;

    // tokenize the new lines, then continue as long as the start state of a kept line changed
    let state = start > 0 ? this._rows[start - 1].endState : INITIAL_LINE_STATE;
    for (let i = start; i < lines.length; i++) {
      const row = this._rows[i];
      const startKey = lineStateKey(state);
      if (i >= start + insertedCount && row.startKey === startKey)
        break;

      const result = tokenizeLine(lines[i], state, { isRefValid: this._isRefValid });
      row.element.innerHTML = result.html || '<br>';
      row.startKey = startKey;
      row.endState = result.state;
      state = result.state;
    }

    this._syncSize();
    this._syncScroll();
  }

  /** Renders every line again (e.g. after the project links changed). */
  refresh() {
    this._rows.forEach(row => row.element.remove());
    this._rows = [];
    this._lines = [];
    this._value = null;
    this.update();
  }

  destroy() {
    this._textarea.removeEventListener('input', this._onInput);
    this._textarea.removeEventListener('scroll', this._onScroll);
    this._resizeObserver.disconnect();
    this._layer.remove();
  }

  _createRow() {
    const element = document.createElement('div');
    element.className = 'editor-highlight__line';
    return { element, startKey: null, endState: null };
  }

  /** The layer covers the textarea's client area (without its scrollbars). */
  _syncSize() {
    this._layer.style.width = `${this._textarea.clientWidth}px`;
    this._layer.style.height = `${this._textarea.clientHeight}px`;
  }

  _syncScroll() {
    const { scrollLeft, scrollTop } = this._textarea;
    this._content.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
  }
}
