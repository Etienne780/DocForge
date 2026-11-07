import { tokenizeLine, lineStateKey, INITIAL_LINE_STATE } from './EditorTokenizer.js';
import { getFootnoteLabels } from './ToolbarHelper.js';

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
    // search marks, behind the lines
    this._marksLayer = document.createElement('div');
    this._marksLayer.className = 'editor-highlight__marks';
    this._content.append(this._marksLayer);
    this._layer.append(this._content);
    textarea.before(this._layer);

    /** @type {Array<{ element: HTMLElement, startKey: string|null, endState: object|null }>} */
    this._rows = [];
    this._lines = [];
    this._lineStarts = [0];
    this._value = null;
    /** @type {Array<{ start: number, end: number, type: 'match'|'active'|'range' }>} */
    this._marks = [];
    this._size = '';

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

    // a new / removed footnote definition changes how references in other lines look
    const footnotes = getFootnoteLabels(lines).defined;
    const footnoteKey = [...footnotes].sort().join('\n');
    const retokenizeAll = footnoteKey !== this._footnoteKey;
    this._footnoteKey = footnoteKey;
    this._footnotes = footnotes;

    const insertedCount = lines.length - end - start;
    const inserted = Array.from({ length: insertedCount }, () => this._createRow());

    this._rows.slice(start, old.length - end).forEach(row => row.element.remove());
    const next = this._rows[old.length - end]?.element ?? null;
    const fragment = document.createDocumentFragment();
    inserted.forEach(row => fragment.append(row.element));
    this._content.insertBefore(fragment, next);

    this._rows = [...this._rows.slice(0, start), ...inserted, ...this._rows.slice(old.length - end)];
    this._lines = lines;
    this._lineStarts = [0];
    for (let i = 0, offset = 0; i < lines.length - 1; i++) {
      offset += lines[i].length + 1;
      this._lineStarts.push(offset);
    }

    // tokenize the new lines, then continue as long as the start state of a kept line changed
    let state = start > 0 ? this._rows[start - 1].endState : INITIAL_LINE_STATE;
    for (let i = start; i < lines.length; i++) {
      const row = this._rows[i];
      const startKey = lineStateKey(state);
      if (!retokenizeAll && i >= start + insertedCount && row.startKey === startKey)
        break;

      const result = tokenizeLine(lines[i], state, {
        isRefValid: this._isRefValid,
        isFootnoteValid: label => this._footnotes.has(label),
      });
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

  /** @returns {import('./EditorTokenizer.js').LineState} state at the start of a line */
  getLineStartState(lineIndex) {
    this.update();
    return lineIndex > 0 ? this._rows[lineIndex - 1]?.endState ?? INITIAL_LINE_STATE : INITIAL_LINE_STATE;
  }

  /**
   * Screen position of a text position, measured in the highlighted line (same layout as the textarea).
   * @param {number} position - index in the textarea value
   * @returns {{ left: number, top: number, bottom: number }|null}
   */
  getCaretRect(position) {
    this.update();
    const location = this._locate(position);
    if (!location)
      return null;

    if (location.node.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      range.setStart(location.node, location.offset);
      range.collapse(true);
      const rect = range.getClientRects()[0];
      if (rect)
        return { left: rect.left, top: rect.top, bottom: rect.bottom };
    }

    // empty line
    const element = location.element;
    const rect = element.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || rect.height;
    return { left: rect.left, top: rect.top, bottom: rect.top + lineHeight };
  }

  /**
   * Marks ranges of the text (search matches) behind the highlighted text.
   * Call it again after the text changed, the positions are not moved along.
   * @param {Array<{ start: number, end: number, type?: 'match'|'active'|'range' }>} marks
   */
  setMarks(marks) {
    this._marks = marks ?? [];
    this._renderMarks();
  }

  /**
   * Position of a source line inside the textarea's client area (scroll position applied).
   * @returns {{ top: number, height: number }|null} height of the first visual line (wrapped lines are taller)
   */
  getLineBox(lineIndex) {
    this.update();
    const element = this._rows[lineIndex]?.element;
    if (!element)
      return null;
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || element.offsetHeight;
    return { top: element.offsetTop - this._textarea.scrollTop, height: lineHeight };
  }

  /** Scrolls the textarea so that `position` is visible (about a third from the top if it wasn't). */
  scrollToPosition(position) {
    this.update();
    const location = this._locate(position);
    if (!location)
      return;

    const textarea = this._textarea;
    const lineTop = location.element.offsetTop;
    const lineHeight = location.element.offsetHeight;
    if (lineTop < textarea.scrollTop || lineTop + lineHeight > textarea.scrollTop + textarea.clientHeight)
      textarea.scrollTop = Math.max(0, lineTop - textarea.clientHeight / 3);

    // without word wrap the position can be outside horizontally
    const caret = this.getCaretRect(position);
    const area = textarea.getBoundingClientRect();
    if (caret && (caret.left < area.left || caret.left > area.left + textarea.clientWidth))
      textarea.scrollLeft += caret.left - area.left - textarea.clientWidth / 2;
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

  /**
   * Text node and offset of a text position inside its line element.
   * The line's text nodes hold the source text 1:1 (entities are single characters).
   * @returns {{ element: HTMLElement, node: Node, offset: number }|null} node is the line element for empty lines
   */
  _locate(position) {
    const clamped = Math.max(0, Math.min(position, this._value.length));
    let low = 0;
    let high = this._lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this._lineStarts[mid] <= clamped)
        low = mid;
      else
        high = mid - 1;
    }

    const element = this._rows[low]?.element;
    if (!element)
      return null;

    let remaining = clamped - this._lineStarts[low];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    let last = null;
    while ((node = walker.nextNode())) {
      if (remaining <= node.length)
        return { element, node, offset: remaining };
      remaining -= node.length;
      last = node;
    }

    return last ? { element, node: last, offset: last.length } : { element, node: element, offset: 0 };
  }

  _renderMarks() {
    // the positions refer to the current textarea value (first: update() can render the marks itself)
    this.update();

    this._marksLayer.replaceChildren();
    if (!this._marks.length)
      return;

    const origin = this._content.getBoundingClientRect();
    const fragment = document.createDocumentFragment();

    for (const { start, end, type = 'match' } of this._marks) {
      const from = this._locate(start);
      const to = this._locate(end);
      if (!from || !to)
        continue;

      const range = document.createRange();
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset);

      for (const rect of range.getClientRects()) {
        if (!rect.width && type !== 'range')
          continue;
        const mark = document.createElement('div');
        mark.className = `editor-highlight__mark editor-highlight__mark--${type}`;
        mark.style.left = `${rect.left - origin.left}px`;
        mark.style.top = `${rect.top - origin.top}px`;
        mark.style.width = `${rect.width}px`;
        mark.style.height = `${rect.height}px`;
        fragment.append(mark);
      }
    }

    this._marksLayer.append(fragment);
  }

  /** The layer covers the textarea's client area (without its scrollbars). */
  _syncSize() {
    const { clientWidth, clientHeight } = this._textarea;
    this._layer.style.width = `${clientWidth}px`;
    this._layer.style.height = `${clientHeight}px`;

    // other line wrapping: the marks move
    const size = `${clientWidth}x${clientHeight}`;
    if (size !== this._size) {
      this._size = size;
      if (this._marks.length)
        this._renderMarks();
    }
  }

  _syncScroll() {
    const { scrollLeft, scrollTop } = this._textarea;
    this._content.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
  }
}
