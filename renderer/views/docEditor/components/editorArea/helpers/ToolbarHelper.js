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
/**
 * Synchronizes the scroll position of the preview pane to match the editor.
 *
 * Uses the correct scroll container inside the iframe. In some layouts the
 * <body> is the active scroll container instead of documentElement.
 *
 * @param {HTMLTextAreaElement} editorElement
 * @param {HTMLIFrameElement} previewIframe
 */
export function syncScrollPosition(editorElement, previewIframe) {
  const docPreview = previewIframe.contentWindow?.docPreview;

  if (!docPreview)
    return false;

  const editorScrollHeight =
    editorElement.scrollHeight - editorElement.clientHeight;

  // editor can't scroll yet: the preview keeps its own position
  if (editorScrollHeight <= 0)
    return false;

  const anchors = docPreview.getLineAnchors?.() ?? [];
  if (!anchors.length) {
    const scrollRatio = editorElement.scrollTop / editorScrollHeight;

    docPreview.setScrollPosition({ ratio: scrollRatio });
    return true;
  }

  const { scrollHeight, clientHeight } = docPreview.getScrollPosition();
  const previewScrollHeight = Math.max(scrollHeight - clientHeight, 0);
  const lineTops = getEditorLineTops(editorElement);

  // matching positions, ascending on both sides, framed by start and end
  const points = [{ editor: 0, preview: 0 }];
  for (const { line, top } of anchors) {
    const editor = lineTops[line];
    const last = points[points.length - 1];
    if (editor == null || editor <= last.editor || top < last.preview)
      continue;
    if (editor >= editorScrollHeight || top >= previewScrollHeight)
      break;
    points.push({ editor, preview: top });
  }
  points.push({ editor: editorScrollHeight, preview: previewScrollHeight });

  const scrollTop = editorElement.scrollTop;
  let i = 1;
  while (i < points.length - 1 && points[i].editor <= scrollTop)
    i++;

  const from = points[i - 1];
  const to = points[i];
  const fraction = (scrollTop - from.editor) / ((to.editor - from.editor) || 1);
  docPreview.setScrollPosition(from.preview + fraction * (to.preview - from.preview));
  return true;
}

const MIRROR_STYLE_PROPS = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'wordSpacing',
  'lineHeight', 'tabSize', 'textTransform', 'textIndent', 'whiteSpace', 'wordBreak',
  'overflowWrap', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
];

/** @type {WeakMap<HTMLTextAreaElement, { key: string, value: string, tops: number[] }>} */
const lineTopsCache = new WeakMap();

/**
 * Returns the top of every source line inside the textarea's scroll content.
 * Lines can wrap, so they are measured in a hidden copy with the same styles.
 * @param {HTMLTextAreaElement} textarea
 * @returns {number[]}
 */
function getEditorLineTops(textarea) {
  const style = getComputedStyle(textarea);
  const key = [textarea.clientWidth, ...MIRROR_STYLE_PROPS.map(prop => style[prop])].join('\0');
  const cached = lineTopsCache.get(textarea);
  if (cached && cached.key === key && cached.value === textarea.value)
    return cached.tops;

  const mirror = document.createElement('div');
  MIRROR_STYLE_PROPS.forEach(prop => mirror.style[prop] = style[prop]);
  Object.assign(mirror.style, {
    position: 'absolute',
    visibility: 'hidden',
    top: '0',
    left: '-99999px',
    boxSizing: 'border-box',
    border: '0',
    width: `${textarea.clientWidth}px`,
  });

  // the zero width space keeps empty lines one line high
  textarea.value.split('\n').forEach(line => {
    const lineEl = document.createElement('div');
    lineEl.textContent = line + '​';
    mirror.appendChild(lineEl);
  });

  document.body.appendChild(mirror);
  const tops = Array.from(mirror.children, lineEl => lineEl.offsetTop);
  mirror.remove();

  lineTopsCache.set(textarea, { key, value: textarea.value, tops });
  return tops;
}