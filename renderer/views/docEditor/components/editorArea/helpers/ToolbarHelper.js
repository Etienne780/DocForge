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
 * Inserts a tree block template (```tree) at the cursor position, on its own lines.
 * @param {HTMLTextAreaElement} textarea
 * @param {Function} onChange
 */
export function insertTree(textarea, onChange) {
  const start = textarea.selectionStart;
  const before = textarea.value.slice(0, start);
  const lead = before === '' || before.endsWith('\n') ? '' : '\n';
  const snippet = `${lead}\`\`\`tree\nfolder/\n  file.txt\n\`\`\`\n`;
  textarea.value = before + snippet + textarea.value.slice(start);
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
 * Comments the selected lines (or the current line) out with <!-- -->,
 * or removes the comment if the lines already are one.
 * @param {HTMLTextAreaElement} textarea
 * @param {Function} onChange
 */
export function toggleComment(textarea, onChange) {
  const value = textarea.value;
  const lineStart = value.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
  // a selection ending at the start of a line doesn't include that line
  const selectionEnd = textarea.selectionEnd > textarea.selectionStart && value[textarea.selectionEnd - 1] === '\n'
    ? textarea.selectionEnd - 1
    : textarea.selectionEnd;
  const lineEndIndex = value.indexOf('\n', selectionEnd);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

  const lines = value.slice(lineStart, lineEnd);
  const indent = lines.match(/^[ \t]*/)[0];
  const body = lines.slice(indent.length);
  const comment = body.match(/^<!--[ \t]?([\s\S]*?)[ \t]?-->[ \t]*$/);

  const replacement = comment
    ? indent + comment[1]
    : `${indent}<!-- ${body} -->`;

  textarea.setRangeText(replacement, lineStart, lineEnd, 'select');
  textarea.focus();
  onChange(textarea.value);
}

const LIST_ITEM_REGEX = /^([ \t]*)([-*]|\d+\.|n\.) /;
const CHECK_MARK_REGEX = /^([ \t]*(?:[-*]|\d+\.|n\.) )\[([ xX])\](?= |$)/;
const LIST_CONTINUE_REGEX = /^([ \t]*)([-*]|\d+\.|n\.) (\[[ xX]\] )?/;
const FENCE_LINE_REGEX = /^[ \t]*`{3,}/;

/**
 * Enter in a list item starts the next item: same marker, the next number
 * after a written number (`n.` stays `n.`), an open check mark after a check
 * mark. Enter in an empty item removes its marker and ends the list.
 * Not inside code blocks or with a selection.
 * @param {HTMLTextAreaElement} textarea
 * @returns {boolean} true if the Enter was handled
 */
export function continueListOnEnter(textarea) {
  const { value, selectionStart, selectionEnd } = textarea;
  if (selectionStart !== selectionEnd)
    return false;

  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const lineEndIndex = value.indexOf('\n', selectionStart);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const line = value.slice(lineStart, lineEnd);

  const list = line.match(LIST_CONTINUE_REGEX);
  if (!list || selectionStart - lineStart < list[0].length)
    return false;

  const fencesBefore = value.slice(0, lineStart).split('\n').filter(l => FENCE_LINE_REGEX.test(l)).length;
  if (fencesBefore % 2 === 1)
    return false;

  // empty item: end the list
  if (!line.slice(list[0].length).trim()) {
    textarea.setRangeText('', lineStart, lineEnd, 'end');
    textarea.dispatchEvent(new Event('input'));
    return true;
  }

  const [, indent, marker, check] = list;
  const nextMarker = /^\d+\.$/.test(marker) ? `${parseInt(marker, 10) + 1}.` : marker;
  const insert = `\n${indent}${nextMarker} ${check ? '[ ] ' : ''}`;
  textarea.setRangeText(insert, selectionStart, selectionEnd, 'end');
  textarea.dispatchEvent(new Event('input'));
  return true;
}

/**
 * Adds check marks to the selected lines (or the current line):
 * list items get `[ ] ` after their marker, other lines `- [ ] `.
 * If all lines already are check marks, they are toggled instead
 * (all checked if one is open, otherwise all unchecked).
 * @param {HTMLTextAreaElement} textarea
 * @param {Function} onChange
 */
export function toggleCheckMark(textarea, onChange) {
  const value = textarea.value;
  const { selectionStart, selectionEnd } = textarea;
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  // a selection ending at the start of a line doesn't include that line
  const lastPos = selectionEnd > selectionStart && value[selectionEnd - 1] === '\n'
    ? selectionEnd - 1
    : selectionEnd;
  const lineEndIndex = value.indexOf('\n', lastPos);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

  const lines = value.slice(lineStart, lineEnd).split('\n');
  const isBlank = line => !line.trim();
  const toggle = lines.every(line => isBlank(line) || CHECK_MARK_REGEX.test(line))
    && lines.some(line => !isBlank(line));

  let newLines;
  if (toggle) {
    const check = lines.some(line => CHECK_MARK_REGEX.exec(line)?.[2] === ' ');
    newLines = lines.map(line => line.replace(CHECK_MARK_REGEX, (_, marker) => `${marker}[${check ? 'x' : ' '}]`));
  } else {
    newLines = lines.map(line => {
      if (lines.length > 1 && isBlank(line))
        return line;
      if (CHECK_MARK_REGEX.test(line))
        return line;
      const list = line.match(LIST_ITEM_REGEX);
      if (list)
        return list[0] + '[ ] ' + line.slice(list[0].length);
      const indent = line.match(/^[ \t]*/)[0];
      return `${indent}- [ ] ${line.slice(indent.length)}`;
    });
  }

  const replacement = newLines.join('\n');
  if (lines.length === 1 && selectionStart === selectionEnd) {
    // keep the cursor at the same text, behind the inserted marker
    const offset = selectionStart - lineStart;
    const added = replacement.length - lines[0].length;
    textarea.setRangeText(replacement, lineStart, lineEnd, 'preserve');
    textarea.selectionStart = textarea.selectionEnd = lineStart + Math.min(offset + added, replacement.length);
  } else {
    textarea.setRangeText(replacement, lineStart, lineEnd, 'select');
  }
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
 *
 * A reference line of the editor is aligned with its block in the preview, at
 * the same relative height in both panes:
 * - the cursor line, if it is visible in the editor
 * - otherwise a line that moves from the top of the editor viewport (scrolled
 *   to the start) to its bottom (scrolled to the end), so both ends line up
 *
 * @param {HTMLTextAreaElement} editorElement
 * @param {HTMLIFrameElement} previewIframe
 * @returns {boolean} false if the preview could not be synced
 */
export function syncScrollPosition(editorElement, previewIframe) {
  const docPreview = previewIframe.contentWindow?.docPreview;

  if (!docPreview)
    return false;

  const { scrollTop, scrollHeight, clientHeight } = editorElement;
  const editorMaxScroll = scrollHeight - clientHeight;
  const anchors = docPreview.getLineAnchors?.() ?? [];

  if (!anchors.length) {
    // editor can't scroll yet: the preview keeps its own position
    if (editorMaxScroll <= 0)
      return false;
    docPreview.setScrollPosition({ ratio: scrollTop / editorMaxScroll });
    return true;
  }

  const { tops: lineTops, height: textHeight } = getEditorLineTops(editorElement);
  const preview = docPreview.getScrollPosition();

  // reference position in the editor content and its offset in the viewport
  let editorPos;
  const cursorLine = getLineIndex(editorElement.value, editorElement.selectionStart);
  const cursorTop = lineTops[cursorLine];
  if (cursorTop != null && cursorTop >= scrollTop && cursorTop < scrollTop + clientHeight) {
    editorPos = cursorTop;
  } else {
    const sweep = editorMaxScroll > 0 ? scrollTop / editorMaxScroll : 0;
    editorPos = scrollTop + sweep * clientHeight;
  }
  const viewportRatio = clientHeight > 0 ? (editorPos - scrollTop) / clientHeight : 0;

  // the end of the text, not the scroll height: a short text leaves empty space below it
  const previewPos = mapEditorToPreview(editorPos, anchors, lineTops, textHeight, preview.scrollHeight);
  const previewMaxScroll = Math.max(preview.scrollHeight - preview.clientHeight, 0);
  const target = previewPos - viewportRatio * preview.clientHeight;
  docPreview.setScrollPosition(Math.min(Math.max(target, 0), previewMaxScroll));
  return true;
}

/**
 * Maps a position in the editor content to the matching position in the
 * preview content, interpolated between the block anchors.
 * @param {number} editorPos
 * @param {{ line: number, top: number }[]} anchors
 * @param {number[]} lineTops
 * @param {number} editorHeight  height of the editor text
 * @param {number} previewHeight scroll height of the preview content
 * @returns {number}
 */
function mapEditorToPreview(editorPos, anchors, lineTops, editorHeight, previewHeight) {
  // matching positions, ascending on both sides, framed by start and end of the content
  const points = [{ editor: 0, preview: 0 }];
  for (const { line, top } of anchors) {
    const editor = lineTops[line];
    const last = points[points.length - 1];
    if (editor == null || editor <= last.editor || top < last.preview)
      continue;
    if (editor >= editorHeight || top >= previewHeight)
      break;
    points.push({ editor, preview: top });
  }
  points.push({ editor: editorHeight, preview: previewHeight });

  let i = 1;
  while (i < points.length - 1 && points[i].editor <= editorPos)
    i++;

  const from = points[i - 1];
  const to = points[i];
  const fraction = (editorPos - from.editor) / ((to.editor - from.editor) || 1);
  return from.preview + Math.min(Math.max(fraction, 0), 1) * (to.preview - from.preview);
}

/** Returns the 0-based line index of a text offset. */
function getLineIndex(text, offset) {
  let line = 0;
  for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1))
    line++;
  return line;
}

const MIRROR_STYLE_PROPS = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'wordSpacing',
  'lineHeight', 'tabSize', 'textTransform', 'textIndent', 'whiteSpace', 'wordBreak',
  'overflowWrap', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
];

/** @type {WeakMap<HTMLTextAreaElement, { key: string, value: string, result: { tops: number[], height: number } }>} */
const lineTopsCache = new WeakMap();

/**
 * Returns the top of every source line inside the textarea's scroll content
 * and the height of the whole text (with padding).
 * Lines can wrap, so they are measured in a hidden copy with the same styles.
 * @param {HTMLTextAreaElement} textarea
 * @returns {{ tops: number[], height: number }}
 */
function getEditorLineTops(textarea) {
  const style = getComputedStyle(textarea);
  const key = [textarea.clientWidth, ...MIRROR_STYLE_PROPS.map(prop => style[prop])].join('\0');
  const cached = lineTopsCache.get(textarea);
  if (cached && cached.key === key && cached.value === textarea.value)
    return cached.result;

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
    // the global div rule in main.css sets font-size and line-height
    lineEl.style.font = 'inherit';
    lineEl.textContent = line + '​';
    mirror.appendChild(lineEl);
  });

  document.body.appendChild(mirror);
  const result = {
    tops: Array.from(mirror.children, lineEl => lineEl.offsetTop),
    height: mirror.offsetHeight,
  };
  mirror.remove();

  lineTopsCache.set(textarea, { key, value: textarea.value, result });
  return result;
}