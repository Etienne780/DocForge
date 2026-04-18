/**
 * Toolbar helper functions for the Markdown editor textarea.
 * All functions operate directly on a textarea element and fire an onChange callback.
 *
 * Usage:
 *   import { insertLinePrefix, wrapSelection } from './helpers/ToolbarHelper.js';
 *
 *   insertLinePrefix(textarea, '## ', content => node.content = content);
 */

/**
 * Inserts a prefix at the beginning of the current line (e.g. '# ' for headings).
 * @param {HTMLTextAreaElement} textarea
 * @param {string} prefix
 * @param {Function} onChange - called with the updated textarea value
 */
export function insertLinePrefix(textarea, prefix, onChange) {
  const cursorPosition = textarea.selectionStart;
  const lineStart = textarea.value.lastIndexOf('\n', cursorPosition - 1) + 1;
  textarea.value =
    textarea.value.slice(0, lineStart) + prefix + textarea.value.slice(lineStart);
  textarea.selectionStart = textarea.selectionEnd = cursorPosition + prefix.length;
  textarea.focus();
  onChange(textarea.value);
}

/**
 * Wraps the selected text (or a placeholder word) with before/after strings.
 * Used for bold (**), italic (*), inline code (`), etc.
 * @param {HTMLTextAreaElement} textarea
 * @param {string} before - e.g. '**'
 * @param {string} after  - e.g. '**'
 * @param {Function} onChange
 */
export function wrapSelection(textarea, before, after, onChange) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || 'text';
  textarea.value =
    textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end);
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = start + before.length + selected.length;
  textarea.focus();
  onChange(textarea.value);
}

/**
 * Inserts a fenced code block snippet at the cursor position.
 * @param {HTMLTextAreaElement} textarea
 * @param {Function} onChange
 */
export function insertCodeBlock(textarea, onChange) {
  const start = textarea.selectionStart;
  const snippet = '```javascript\n// code here\n```\n';
  textarea.value =
    textarea.value.slice(0, start) + snippet + textarea.value.slice(start);
  textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
  textarea.focus();
  onChange(textarea.value);
}

/**
 * Inserts a Markdown table template at the cursor position.
 * @param {HTMLTextAreaElement} textarea
 * @param {Function} onChange
 */
export function insertTable(textarea, onChange) {
  const start = textarea.selectionStart;
  const snippet =
    '\n| Column 1 | Column 2 | Column 3 |\n' +
    '|----------|----------|----------|\n' +
    '| Value    | Value    | Value    |\n\n';
  textarea.value =
    textarea.value.slice(0, start) + snippet + textarea.value.slice(start);
  textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
  textarea.focus();
  onChange(textarea.value);
}

/**
 * Inserts a Markdown link at the cursor position.
 * @param {HTMLTextAreaElement} textarea
 * @param {string} text - Display text for the link
 * @param {string} url  - Link URL
 * @param {Function} onChange
 */
export function insertLink(textarea, text, url, onChange) {
  const start = textarea.selectionStart;
  const snippet = `[${text}](${url})`;
  textarea.value =
    textarea.value.slice(0, start) + snippet + textarea.value.slice(start);
  textarea.selectionStart = textarea.selectionEnd = start + snippet.length;
  textarea.focus();
  onChange(textarea.value);
}

/**
 * Returns the selected text from a textarea (empty string if no selection).
 * @param {HTMLTextAreaElement} textarea
 * @returns {string}
 */
export function getSelectedText(textarea) {
  return textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
}

/**
 * Synchronizes the scroll position of the preview pane to match the editor.
 * @param {HTMLTextAreaElement} editorElement
 * @param {HTMLElement} previewIframe
 */
export function syncScrollPosition(editorElement, previewIframe) {
  const iframeDoc = previewIframe.contentDocument;
  if(!iframeDoc)
    return;

  const scrollContainer =
    iframeDoc.scrollingElement || iframeDoc.documentElement;

  if(!scrollContainer)
    return;

  const editorScrollHeight =
    editorElement.scrollHeight - editorElement.clientHeight;

  const previewScrollHeight =
    scrollContainer.scrollHeight - scrollContainer.clientHeight;

  const scrollRatio =
    editorElement.scrollTop / (editorScrollHeight || 1);

  scrollContainer.scrollTop =
    scrollRatio * (previewScrollHeight || 0);
}