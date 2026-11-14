import { normalizeLineEndings } from '@common/Common.js';
import { FENCED_CODE_REGEX, ESCAPE_REGEX, isBlankLine } from './ParserUtils.js';

// ─── Property blocks ──────────────────────────────────────────────────────────
// {hover=row,col; col 1,3-5: hl width=120px} on its own line(s) directly above an
// element, also as <!-- {...} --> or spread over several lines:
//   {
//     hover=row,col
//     cell 2,1: hl
//   }

/**
 * @typedef {Object} PropertyTarget
 * @property {'col'|'row'|'cell'} type
 * @property {number[]} [indices] - col / row indices (0-based)
 * @property {number[]} [rows]    - cell rows
 * @property {number[]} [cols]    - cell cols
 * @property {Object<string, string|true>} props
 */

/**
 * @typedef {Object} BlockProperties
 * @property {Object<string, string|true>} props - properties without target (whole element)
 * @property {PropertyTarget[]} targets
 */

const PROPERTY_NAME = '[a-zA-Z][\\w-]*';
const PROPERTY_VALUE = '(?:"[^"\\n]*"|[^\\s;"]+)';
const PROPERTY_REGEX = new RegExp(`(${PROPERTY_NAME})(?:=(${PROPERTY_VALUE}))?`, 'g');
const PROPERTY_LIST_REGEX = new RegExp(`^(?:${PROPERTY_NAME}(?:=${PROPERTY_VALUE})?(?:[ \\t]+|$))+$`);
const PROPERTY_TARGET_REGEX = /^(col|row|cell)[ \t]+([\d ,-]+?)[ \t]*:[ \t]*(.*)$/;
const PROPERTY_ENTRY_REGEX = /(?:"[^"\n]*"|[^;\n"])+/g;
const MAX_PROPERTY_INDEX = 1000;

/**
 * '1,3-5' -> [1, 3, 4, 5]
 * @param {string} text
 * @returns {number[]|null} null if invalid
 */
function parseIndexList(text) {
  const compact = text.replace(/[ \t]/g, '');
  if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(compact))
    return null;

  const indices = new Set();
  for (const part of compact.split(',')) {
    const [from, to = from] = part.split('-').map(Number);
    for (let i = from; i <= Math.min(to, MAX_PROPERTY_INDEX); i++)
      indices.add(i);
  }
  return [...indices];
}

/**
 * 'hl width=120px label="A B"' -> { hl: true, width: '120px', label: 'A B' }
 * @param {string} text
 * @returns {Object<string, string|true>}
 */
function parsePropertyList(text) {
  const props = {};
  for (const [, name, value] of text.matchAll(PROPERTY_REGEX))
    props[name] = value === undefined ? true : value.replace(/^"|"$/g, '');
  return props;
}

/**
 * Parses the content of a property block (without the braces).
 * @param {string} text
 * @returns {BlockProperties|null} null if it is not valid property syntax
 */
export function parsePropertyBlock(text) {
  const result = { props: {}, targets: [] };
  const entries = (text.match(PROPERTY_ENTRY_REGEX) ?? []).map(e => e.trim()).filter(Boolean);
  if (!entries.length)
    return null;

  for (const entry of entries) {
    const target = entry.match(PROPERTY_TARGET_REGEX);
    const list = target ? target[3] : entry;
    if (!PROPERTY_LIST_REGEX.test(list))
      return null;

    const props = parsePropertyList(list);
    if (!target) {
      Object.assign(result.props, props);
      continue;
    }

    const [, type, indexText] = target;
    if (type === 'cell') {
      const parts = indexText.split(',');
      const rows = parts.length === 2 ? parseIndexList(parts[0]) : null;
      const cols = parts.length === 2 ? parseIndexList(parts[1]) : null;
      if (!rows || !cols)
        return null;
      result.targets.push({ type, rows, cols, props });
    } else {
      const indices = parseIndexList(indexText);
      if (!indices)
        return null;
      result.targets.push({ type, indices, props });
    }
  }

  return result;
}

/**
 * Finds a property block starting at lines[start].
 * @param {string[]} lines
 * @param {number} start
 * @returns {{ end: number, properties: BlockProperties }|null} end: last line of the block
 */
function matchPropertyBlock(lines, start) {
  const single = lines[start].match(/^[ \t]*\{(.*)\}[ \t]*$/);
  if (single) {
    const properties = parsePropertyBlock(single[1]);
    return properties && { end: start, properties };
  }

  if (!/^[ \t]*\{[ \t]*$/.test(lines[start]))
    return null;

  for (let end = start + 1; end < lines.length; end++) {
    if (isBlankLine(lines[end]))
      return null;
    if (/^[ \t]*\}[ \t]*$/.test(lines[end])) {
      const properties = parsePropertyBlock(lines.slice(start + 1, end).join('\n'));
      return properties && { end, properties };
    }
  }
  return null;
}

/** A property block is attached when the next line holds the element. */
const isAttachedPropertyBlock = (lines, block) =>
  block.end + 1 < lines.length && !isBlankLine(lines[block.end + 1]);

/**
 * Indices of all lines inside fenced code.
 * @param {string} text
 * @returns {Set<number>}
 */
function getFencedCodeLines(text) {
  const codeLines = new Set();
  for (const match of text.matchAll(FENCED_CODE_REGEX)) {
    const first = text.slice(0, match.index).split('\n').length - 1;
    const count = match[0].split('\n').length;
    for (let line = first; line < first + count; line++)
      codeLines.add(line);
  }
  return codeLines;
}

/**
 * Marks a comment for removal. <!-- {...} --> on its own lines becomes a
 * property block instead. Keeps the line structure: removed lines become \x02.
 * @param {string} comment
 * @param {string} source
 * @param {number} offset
 * @returns {string}
 */
function markComment(comment, source, offset) {
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
  const lineEndIndex = source.indexOf('\n', offset + comment.length);
  const lineEnd = lineEndIndex === -1 ? source.length : lineEndIndex;
  const ownLines = isBlankLine(source.slice(lineStart, offset))
    && isBlankLine(source.slice(offset + comment.length, lineEnd));

  const inner = comment.slice(4, -3);
  const trimmed = inner.trim();
  if (ownLines && trimmed.startsWith('{') && trimmed.endsWith('}')
    && parsePropertyBlock(trimmed.slice(1, -1))) {
    return inner.split('\n').map(line => isBlankLine(line) ? '\x02' : line.trim()).join('\n');
  }

  return comment.split('\n').map(() => '\x02').join('\n');
}

/**
 * Removes <!-- comments --> and property blocks without an element below
 * (outside of code). Lines that only held them are dropped completely (plus one
 * blank line if they stood between two), so they never show up as empty lines.
 * @param {string} source - Markdown with normalized line endings
 * @param {Object} [options]
 * @param {boolean} [options.allProperties] - also removes attached property blocks
 * @returns {{ text: string, lineMap: number[]|null }} lineMap: source line of every remaining line
 */
function removeMeta(source, { allProperties = false } = {}) {
  if (!source.includes('<!--') && !source.includes('{'))
    return { text: source, lineMap: null };

  const marked = source.replace(COMMENT_SCAN_REGEX, (match, ...args) =>
    match.startsWith('<!--') ? markComment(match, args[args.length - 1], args[args.length - 2]) : match);

  const markedLines = marked.split('\n');
  const codeLines = getFencedCodeLines(marked);
  for (let i = 0; i < markedLines.length; i++) {
    if (codeLines.has(i))
      continue;
    const block = matchPropertyBlock(markedLines, i);
    if (!block)
      continue;
    if (allProperties || !isAttachedPropertyBlock(markedLines, block)) {
      for (let line = i; line <= block.end; line++)
        markedLines[line] = '\x02';
    }
    i = block.end;
  }

  const lines = [];
  const lineMap = [];
  let droppedLine = false;

  markedLines.forEach((line, i) => {
    if (line.includes('\x02') && /^[ \t\x02]*$/.test(line)) {
      droppedLine = true;
      return;
    }

    line = line.replace(/\x02/g, '');
    const afterBlankLine = lines.length > 0 && isBlankLine(lines[lines.length - 1]);
    if (droppedLine && afterBlankLine && isBlankLine(line)) {
      droppedLine = false;
      return;
    }

    droppedLine = false;
    lines.push(line);
    lineMap.push(i);
  });

  return { text: lines.join('\n'), lineMap };
}

/**
 * Removes <!-- comments --> and property blocks outside of code, e.g. for the
 * export search index.
 * @param {string} markdown
 * @returns {string}
 */
export function removeMarkdownMeta(markdown) {
  return removeMeta(normalizeLineEndings(markdown ?? ''), { allProperties: true }).text;
}

/**
 * Removes comments and unattached property blocks before anything else is parsed.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function stripComments(ctx) {
  const { text, lineMap } = removeMeta(ctx.html);
  ctx.html = text;
  ctx.lineMap = lineMap;
  return ctx;
}

// fenced code | inline code | escape | comment, so comments are only found outside of code
// and an escaped `\<!--` starts none (the inline code backreference is \4 because of the three fence groups)
const COMMENT_SCAN_REGEX = new RegExp(`${FENCED_CODE_REGEX.source}|(\`+)[^\\n]*?\\4(?!\`)|${ESCAPE_REGEX.source}|<!--[\\s\\S]*?-->`, 'g');

const PROPERTIES_PLACEHOLDER_LINE_REGEX = /^\x03P(\d+)\x03\n/gm;

/**
 * Attaches property blocks to the element below. Code blocks get them as
 * codeBlocks[i].properties, everything else as a placeholder line
 * \x03P<i>\x03 (ctx.properties[i]) that the element's transform reads.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function extractPropertyBlocks(ctx) {
  if (!ctx.html.includes('{'))
    return ctx;

  const lines = ctx.html.split('\n');
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const block = matchPropertyBlock(lines, i);
    if (!block || !isAttachedPropertyBlock(lines, block)) {
      out.push(lines[i]);
      continue;
    }

    const codeBlock = lines[block.end + 1].trim().match(/^\x00CODEBLOCK_(\d+)\x00$/);
    if (codeBlock) {
      ctx.codeBlocks[codeBlock[1]].properties = block.properties;
    } else {
      out.push(`\x03P${ctx.properties.length}\x03`);
      ctx.properties.push(block.properties);
    }
    i = block.end;
  }

  ctx.html = out.join('\n');
  return ctx;
}

/**
 * Removes property placeholders that no transform used.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function removeUnusedProperties(ctx) {
  ctx.html = ctx.html.replace(PROPERTIES_PLACEHOLDER_LINE_REGEX, '');
  return ctx;
}
