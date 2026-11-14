import { getCompletions } from './EditorCompletions.js';
import { eventBus } from '@core/EventBus.js';
import { isAnyModalOpen } from '@core/ModalBuilder.js';

const VIEWPORT_MARGIN = 4;
const CARET_GAP = 2;

/**
 * EditorAutocomplete - suggestion list at the cursor of the doc editor.
 *
 * Opens while typing when the context has suggestions (see EditorCompletions.js), or with Ctrl+Space.
 * Arrow keys select, Enter / Tab insert, Escape closes. A list that opened by itself without typed
 * text (e.g. right after '{') lets Enter through as a line break until an item is chosen with the arrows. The text is inserted with
 * execCommand('insertText'), so it is part of the textarea's undo history and fires `input`.
 */
export class EditorAutocomplete {
  /**
   * @param {HTMLTextAreaElement} textarea
   * @param {import('./EditorHighlighter.js').EditorHighlighter} highlighter - Line states and caret position.
   * @param {object} options
   * @param {() => Object} options.getProject
   * @param {() => string|null} [options.getNodeId] - entry being edited
   */
  constructor(textarea, highlighter, { getProject, getNodeId = () => null }) {
    this._textarea = textarea;
    this._highlighter = highlighter;
    this._getProject = getProject;
    this._getNodeId = getNodeId;

    this._result = null;
    this._activeIndex = 0;
    this._suppressNextInput = false;

    // popover in the top layer, so the list is not clipped by the editor
    this._panel = document.createElement('div');
    this._panel.className = 'editor-suggest';
    this._panel.setAttribute('popover', 'manual');
    this._panel.setAttribute('role', 'listbox');
    document.body.append(this._panel);

    // keep the focus in the textarea while clicking an item
    this._panel.addEventListener('mousedown', event => event.preventDefault());
    this._panel.addEventListener('click', event => {
      const item = event.target.closest('[data-index]');
      if (item)
        this._accept(Number(item.dataset.index));
    });

    this._onInput = () => this._handleInput();
    // capture: runs before the Tab / Enter handlers of the textarea (addTabIndenting, addLineBreakIndenting)
    this._onKeyDown = event => this._handleKeyDown(event);
    this._onClose = () => this.close();
    this._onScroll = () => {
      if (this._result)
        this._place();
    };

    textarea.addEventListener('input', this._onInput);
    textarea.addEventListener('keydown', this._onKeyDown, true);
    textarea.addEventListener('blur', this._onClose);
    textarea.addEventListener('pointerdown', this._onClose);
    textarea.addEventListener('scroll', this._onScroll);
    window.addEventListener('resize', this._onClose);
    // the popover is in the top layer and would stay above a modal
    eventBus.on('modal:open', this._onClose);
  }

  /** @returns {boolean} */
  isOpen() {
    return Boolean(this._result);
  }

  /**
   * Shows the suggestions for the cursor position.
   * @param {boolean} [manual=false] - true ignores the minimum query length (Ctrl+Space)
   */
  open(manual = false) {
    const textarea = this._textarea;
    if (textarea.disabled || textarea.selectionStart !== textarea.selectionEnd || isAnyModalOpen()) {
      this.close();
      return;
    }

    const position = textarea.selectionStart;
    const before = textarea.value.slice(0, position);
    const lineStart = before.lastIndexOf('\n') + 1;
    const lines = textarea.value.split('\n');
    const lineIndex = before.split('\n').length - 1;

    const result = getCompletions({
      lines,
      lineIndex,
      column: position - lineStart,
      lineState: this._highlighter.getLineStartState(lineIndex),
      project: this._getProject(),
      nodeId: this._getNodeId(),
    });

    if (!result?.items.length || (!manual && result.query.length < result.minQuery)) {
      this.close();
      return;
    }

    // an exact single match has nothing left to complete
    if (!manual && result.items.length === 1 && result.items[0].insert === result.query) {
      this.close();
      return;
    }

    this._result = { ...result, start: lineStart + result.from, end: position };
    this._activeIndex = 0;
    // a list that opened by itself without typed text (e.g. after '{') or with snippets of normal
    // characters (e.g. '<') must not take Enter
    this._passEnter = !manual && (result.query.length === 0 || Boolean(result.passEnter));
    this._render();
    if (!this._panel.matches(':popover-open'))
      this._panel.showPopover();
    this._place();
  }

  close() {
    if (!this._result)
      return;
    this._result = null;
    this._panel.hidePopover();
  }

  destroy() {
    this._textarea.removeEventListener('input', this._onInput);
    this._textarea.removeEventListener('keydown', this._onKeyDown, true);
    this._textarea.removeEventListener('blur', this._onClose);
    this._textarea.removeEventListener('pointerdown', this._onClose);
    this._textarea.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onClose);
    eventBus.off('modal:open', this._onClose);
    this._panel.remove();
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _handleInput() {
    if (this._suppressNextInput) {
      this._suppressNextInput = false;
      this.close();
      return;
    }
    this.open();
  }

  _handleKeyDown(event) {
    if (event.key === ' ' && event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
      event.preventDefault();
      this.open(true);
      return;
    }

    if (!this._result)
      return;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        const count = this._result.items.length;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this._setActive((this._activeIndex + step + count) % count);
        this._passEnter = false;
        break;
      }
      case 'Enter':
      case 'Tab':
        if (event.shiftKey || event.ctrlKey || event.altKey)
          return this.close();
        // nothing typed and nothing chosen: Enter stays a line break (Tab still accepts)
        if (event.key === 'Enter' && this._passEnter)
          return this.close();
        this._accept(this._activeIndex);
        break;
      case 'Escape':
        this.close();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'Home':
      case 'End':
      case 'PageUp':
      case 'PageDown':
        this.close();
        return;
      default:
        return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  _accept(index) {
    const item = this._result?.items[index];
    if (!item)
      return;

    const { start, end } = this._result;
    const textarea = this._textarea;

    // language of a new code block: close it, the cursor goes into the empty line between the fences
    let text = item.insert;
    let cursor = null;
    let selectionEnd = null;
    if (item.fence && this._endsInOpenFence()) {
      const { indent, ticks } = item.fence;
      text += `\n${indent}\n${indent}${ticks}`;
      cursor = start + item.insert.length + 1 + indent.length;
    } else if (item.select) {
      // snippet placeholder (e.g. 'Title') selected, so typing replaces it
      cursor = start + item.select[0];
      selectionEnd = start + item.select[1];
    }

    textarea.focus();
    textarea.setSelectionRange(start, end);

    // values after 'name=' are suggested right away, everything else closes. With a cursor position
    // inside the inserted text (e.g. {#|}) the list reopens only after the cursor was moved there.
    const reopenAtCursor = Boolean(item.reopen) && cursor !== null;
    this._suppressNextInput = !item.reopen || reopenAtCursor;
    if (!document.execCommand('insertText', false, text)) {
      textarea.setRangeText(text, start, end, 'end');
      textarea.dispatchEvent(new Event('input'));
    }

    if (cursor !== null)
      textarea.setSelectionRange(cursor, selectionEnd ?? cursor);
    if (reopenAtCursor)
      this.open();
  }

  /**
   * True if the text ends inside a code block. An unclosed new fence turns the rest of the
   * text into code, so it is still open at the end.
   */
  _endsInOpenFence() {
    const lineCount = this._textarea.value.split('\n').length;
    return Boolean(this._highlighter.getLineStartState(lineCount).fence);
  }

  _render() {
    const fragment = document.createDocumentFragment();

    this._result.items.forEach((item, index) => {
      const element = document.createElement('div');
      element.className = 'editor-suggest__item';
      element.setAttribute('role', 'option');
      element.dataset.index = index;

      const label = document.createElement('span');
      label.className = 'editor-suggest__label';
      label.textContent = item.label;
      element.append(label);

      if (item.detail) {
        const detail = document.createElement('span');
        detail.className = 'editor-suggest__detail';
        detail.textContent = item.detail;
        element.append(detail);
      }

      fragment.append(element);
    });

    this._panel.replaceChildren(fragment);
    this._setActive(0);
  }

  _setActive(index) {
    this._activeIndex = index;
    Array.from(this._panel.children).forEach((element, i) => {
      element.classList.toggle('editor-suggest__item--active', i === index);
    });
    this._panel.children[index]?.scrollIntoView({ block: 'nearest' });
  }

  /** Below the cursor, above it if there is more room there. */
  _place() {
    const caret = this._highlighter.getCaretRect(this._textarea.selectionStart);
    const area = this._textarea.getBoundingClientRect();
    if (!caret || caret.bottom < area.top || caret.top > area.bottom) {
      this.close();
      return;
    }

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const { width, height } = this._panel.getBoundingClientRect();

    const spaceBelow = viewportHeight - VIEWPORT_MARGIN - caret.bottom - CARET_GAP;
    const spaceAbove = caret.top - VIEWPORT_MARGIN - CARET_GAP;
    const top = height <= spaceBelow || spaceBelow >= spaceAbove
      ? caret.bottom + CARET_GAP
      : caret.top - height - CARET_GAP;

    const left = Math.max(VIEWPORT_MARGIN, Math.min(caret.left, viewportWidth - width - VIEWPORT_MARGIN));
    this._panel.style.left = `${left}px`;
    this._panel.style.top = `${Math.max(VIEWPORT_MARGIN, top)}px`;
  }
}
