import { eventBus } from '@core/EventBus.js';
import { getLanguages, getPresetLanguages } from '@data/SyntaxDefinitionManager.js';
import { getEditIcon } from '@ui/Icon.js';
import {
  findStructureAt,
  readStructureProperties,
  formatStructureProperties,
  buildStructureHead,
  parseMarkdownTable,
  formatMarkdownTable,
} from './EditorStructures.js';
import { openStructureEditModal } from './StructureEditModal.js';

/**
 * EditorStructureEdit - edit button at the left edge of the doc editor.
 *
 * While the cursor is in a table or code block (or the property block above it), a button sits
 * next to its first line. It (or the Edit:structure shortcut -> open()) opens the modal (properties,
 * for tables also a grid of the content); the result replaces the property block and the opening
 * fence (or the whole table) in one undo step.
 */
export class EditorStructureEdit {
  /**
   * @param {HTMLTextAreaElement} textarea
   * @param {import('./EditorHighlighter.js').EditorHighlighter} highlighter
   * @param {HTMLElement} container - positioned parent of the textarea, gets the button
   * @param {{ getProject: () => Object, closeAutocomplete?: () => void }} options
   */
  constructor(textarea, highlighter, container, { getProject, closeAutocomplete = () => {} }) {
    this._textarea = textarea;
    this._highlighter = highlighter;
    this._getProject = getProject;
    this._closeAutocomplete = closeAutocomplete;
    this._structure = null;

    this._button = document.createElement('button');
    this._button.className = 'editor-structure-edit hidden';
    this._button.innerHTML = getEditIcon();
    this._button.dataset.shortcutLabel = 'Edit:structure';
    this._button.dataset.shortcutContext = 'docEditor';
    this._button.dataset.shortcutTarget = 'title';
    this._button.dataset.shortcutTitle = 'Edit properties';
    this._button.setAttribute('aria-label', 'Edit properties');
    container.append(this._button);

    // keep the cursor in the textarea
    this._button.addEventListener('mousedown', event => event.preventDefault());
    this._button.addEventListener('click', () => this.open());

    this._onChange = () => this.update();
    this._onScroll = () => this._place();
    this._onSelectionChange = () => {
      if (document.activeElement === textarea)
        this.update();
    };
    textarea.addEventListener('input', this._onChange);
    textarea.addEventListener('focus', this._onChange);
    textarea.addEventListener('scroll', this._onScroll);
    document.addEventListener('selectionchange', this._onSelectionChange);
  }

  /** Shows the button for the structure at the cursor. */
  update() {
    this._structure = this._textarea.disabled ? null : this._findAtCursor();
    this._button.classList.toggle('hidden', !this._structure);
    this._button.classList.toggle('editor-structure-edit--code', this._structure?.type === 'code' || this._structure?.type === 'tree');
    this._place();
  }

  /** Opens the property modal for the structure at the cursor. */
  open() {
    const structure = this._findAtCursor();
    if (!structure) {
      eventBus.emit('toast:show', { message: 'Place the cursor in a table, code block, list, section or [toc]', type: 'info' });
      return;
    }

    const lines = this._textarea.value.split('\n');
    openStructureEditModal({
      type: structure.type,
      properties: readStructureProperties(lines, structure),
      lang: structure.fence?.lang ?? '',
      title: structure.section?.title ?? '',
      languages: this._languageNames(),
      table: structure.type === 'table'
        ? parseMarkdownTable(lines.slice(structure.elementStart, structure.elementEnd + 1))
        : null,
      onApply: result => this._apply(structure, lines, result),
    });
  }

  destroy() {
    this._textarea.removeEventListener('input', this._onChange);
    this._textarea.removeEventListener('focus', this._onChange);
    this._textarea.removeEventListener('scroll', this._onScroll);
    document.removeEventListener('selectionchange', this._onSelectionChange);
    this._button.remove();
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _findAtCursor() {
    const { value, selectionStart } = this._textarea;
    const lineIndex = value.slice(0, selectionStart).split('\n').length - 1;
    return findStructureAt(value.split('\n'), lineIndex, i => this._highlighter.getLineStartState(i));
  }

  _place() {
    if (!this._structure)
      return;

    const box = this._highlighter.getLineBox(this._structure.firstLine);
    const visible = box && box.top + box.height > 0 && box.top < this._textarea.clientHeight;
    this._button.classList.toggle('hidden', !visible);
    if (!visible)
      return;

    this._button.style.top = `${box.top}px`;
    this._button.style.height = `${box.height}px`;
  }

  /**
   * Replaces the property block and the first element line, or with a changed table grid
   * the property block and the whole table, in one undo step.
   */
  _apply(structure, lines, { properties, lang, title = null, table }) {
    const textarea = this._textarea;
    // the text may have changed while the modal was open
    if (textarea.value !== lines.join('\n'))
      return eventBus.emit('toast:show', { message: 'The entry changed, the changes were not applied', type: 'warning' });

    const indent = lines[structure.elementStart].match(/^[ \t]*/)[0];
    const propertiesText = formatStructureProperties(properties, indent);
    const lastLine = table ? structure.elementEnd : structure.elementStart;
    let text = table
      ? [propertiesText, formatMarkdownTable(table, indent)].filter(Boolean).join('\n')
      : buildStructureHead(structure, lines, propertiesText, lang, title);

    // code / tree block: the cursor goes into its first line, an empty block gets one
    const isFence = Boolean(structure.fence) && !table;
    const emptyFence = isFence && !this._hasFenceContent(structure, lines);
    if (emptyFence)
      text += `\n${indent}`;

    const start = lines.slice(0, structure.firstLine).reduce((sum, line) => sum + line.length + 1, 0);
    const end = lines.slice(0, lastLine + 1).reduce((sum, line) => sum + line.length + 1, 0) - 1;

    textarea.focus({ preventScroll: true });
    if (textarea.value.slice(start, end) !== text) {
      textarea.setSelectionRange(start, end);
      if (!document.execCommand('insertText', false, text)) {
        textarea.setRangeText(text, start, end, 'end');
        textarea.dispatchEvent(new Event('input'));
      }
    }

    if (isFence) {
      // empty block: the cursor already is in the added line; otherwise the line after the fence
      const position = emptyFence ? start + text.length : start + text.length + 1;
      textarea.setSelectionRange(position, position);
      // the input above opened the suggestions for the fence line
      this._closeAutocomplete();
      this.update();
    }
  }

  /**
   * @returns {boolean} the code block has at least one line between its fences
   * (an unclosed block: after its opening fence)
   */
  _hasFenceContent(structure, lines) {
    const { elementStart, elementEnd, fence } = structure;
    const closing = new RegExp(`^[ \\t]*\`{${fence.ticks.length},}[ \\t]*$`);
    const closed = elementEnd > elementStart && closing.test(lines[elementEnd]);
    return (closed ? elementEnd - 1 : elementEnd) > elementStart;
  }

  _languageNames() {
    const names = new Set();
    for (const language of [...getLanguages(this._getProject()), ...getPresetLanguages()]) {
      for (const name of [...(language.aliases ?? []), language.name]) {
        if (name && /^[\w#+.-]+$/.test(name))
          names.add(name);
      }
    }
    return [...names];
  }
}
