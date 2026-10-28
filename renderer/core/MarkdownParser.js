import { getPresetDocThemes, getLanguageStyleId } from '@data/DocThemeManager.js';
import { findSyntaxDefinitionByName } from '@data/SyntaxDefinitionManager.js';
import { HIGHLIGHTER_WORKER_POOL_SIZE } from '@core/syntaxHighlighter/Constants.js'
import { hashString, escapeHTML, normalizeLineEndings } from '@common/Common.js';
import {
  LINK_USAGE_REGEX,
  LINK_ANCHOR_REGEX,
  findLinkBySlug,
  getLinkStatus,
  getLinkAnchorElementId,
  findNodeInProject,
} from '@data/LinkManager.js';

/**
 * @typedef {Object} ParseContext
 * @property {string}   html         - Current HTML string being transformed
 * @property {string[]} codeBlocks   - Extracted fenced code block HTML strings
 * @property {{ code: string, langName: string|null }[]} inlineCodes - Extracted inline code spans
 * @property {Object|null} theme     - Optional DocTheme object for context-aware parsing
 * @property {number[]|null} lineMap - Source line of every line left after removing comments
 * @property {BlockProperties[]} properties - Property blocks of non-code elements
 */

/** @type {((options: { langId: string, styleId: string, text: string }) => Promise<{html: string}>)|null} */
let _codeHighlighter = null;

/** @type {((html: string) => string[])|null} */
let _htmlCodeLineSplitter = null;

/**
 * Injects the function used to syntax-highlight fenced code blocks.
 * @param {(options: { langId: string, styleId: string, text: string }) => Promise<{html: string}>} fn
 */
export function setCodeHighlighter(fn) {
  _codeHighlighter = fn;
}

/**
 * Removes the currently registered code highlighter, if any.
 */
export function clearCodeHighlighter() {
  _codeHighlighter = null;
}

/**
 * Injects the function used to split previously-highlighted HTML back into
 * per-line HTML strings (needed to reconstruct diff blocks).
 * @param {(html: string) => string[]} fn
 */
export function setHtmlCodeLineSplitter(fn) {
  _htmlCodeLineSplitter = fn;
}

export function clearHtmlCodeLineSplitter() {
  _htmlCodeLineSplitter = null;
}

/**
 * Creates a new parse context.
 * @param {string} source - Raw markdown source
 * @param {Object|null} theme - Optional DocTheme object
 * @returns {ParseContext}
 */
function createContext(source, theme = null, project = null, options = null) {
  const ctx = {
    html: normalizeLineEndings(source),
    codeBlocks: [], // { langName, code, placeholder }
    inlineCodes: [],
    theme: theme,
    project: project,
    lineMap: null,
    properties: [], // BlockProperties, referenced by \x03P<i>\x03 placeholder lines
  };

  const addOption = ({ field, defaultValue, validationFn, errorMsg }) => {
    const value = options?.[field] ?? null;
    if (value === null) {
      ctx[field] = defaultValue;
      return;
    }

    const isValid = validationFn(value);
    if (!isValid)
      console.warn(`[MarkdownParser::createContext]: ${errorMsg}`);

    ctx[field] = isValid ? value : defaultValue;
  };

  // map {key: langName, code -> createCodeCachEntry { used, htmlCodeBlock } }
  addOption({
    field: 'codeBlockCache',
    defaultValue: null,
    validationFn: value => value instanceof Map,
    errorMsg: 'codeBlockCache is not a Map. Using null.'
  });

  // id of the node being parsed - makes anchor ids unique on merged pages
  addOption({
    field: 'nodeId',
    defaultValue: null,
    validationFn: value => typeof value === 'string',
    errorMsg: 'nodeId is not a string. Using null.'
  });

  // adds data-line="<source line>" to every top-level block (preview scroll sync)
  addOption({
    field: 'lineAnchors',
    defaultValue: false,
    validationFn: value => typeof value === 'boolean',
    errorMsg: 'lineAnchors is not a boolean. Using false.'
  });

  return ctx;
}

function makeCacheKey(langName, styleId, isDiff, code) {
  // 'pre': entries hold only the <pre>, the wrapper is built per render
  return `pre\0${langName}\0${styleId}\0${isDiff}\0${code.length}\0${hashString(code)}`;
}


function createCodeCachEntry(html) {
  return { used: true, html: html };
}

export function cleanupCodeBlockCache(cache) {
  if (!cache) 
    return;
  
  const toDelete = [];
  cache.forEach((entry, key) => {
    if (entry.used) {
      entry.used = false;
    } else {
      toDelete.push(key);
    }
  });
  toDelete.forEach(key => cache.delete(key));
}

// ─── Transform Functions ──────────────────────────────────────────────────────

function buildLanguageTagHTML(langName, recognized) {
  const cls = recognized
    ? 'code-language-tag code-language-tag--recognized'
    : 'code-language-tag code-language-tag--unrecognized';
  return `<div class="${cls}">${escapeHTML(langName)}</div>`;
}

const CODE_COPY_HTML = '<div class="code-copy"><button type="button" class="code-copy-btn">Copy</button></div>';

const DIFF_GROUP_REGEX = /<div class="(code-block-diff-line[^"]*)">([\s\S]*?)<\/div>/g;

/**
 * Old/new line numbers like git for a diff block: removed lines only have
 * an old number, added lines only a new one.
 * @param {string} preHtml - from buildDiffBodyHtml (one div per group of lines)
 * @returns {string} one line per code line
 */
function getDiffLineNumbers(preHtml) {
  const groups = [...preHtml.matchAll(DIFF_GROUP_REGEX)].map(([, cls, content]) => ({
    isAdd: cls.includes('code-block-diff-add'),
    isRemoved: cls.includes('code-block-diff-removed'),
    lineCount: content.split('\n').length,
  }));

  const oldCount = groups.filter(g => !g.isAdd).reduce((sum, g) => sum + g.lineCount, 0);
  const newCount = groups.filter(g => !g.isRemoved).reduce((sum, g) => sum + g.lineCount, 0);
  const width = String(Math.max(oldCount, newCount, 1)).length;

  const numbers = [];
  let oldLine = 0;
  let newLine = 0;
  for (const { isAdd, isRemoved, lineCount } of groups) {
    for (let i = 0; i < lineCount; i++) {
      const oldNumber = isAdd ? '' : String(++oldLine);
      const newNumber = isRemoved ? '' : String(++newLine);
      numbers.push(`${oldNumber.padStart(width)} ${newNumber.padStart(width)}`);
    }
  }

  return numbers.join('\n');
}

/**
 * Wraps the rendered code (<pre>) with the language tag and the properties of
 * the block: copy (copy button), label="Text" / label=none (tag text), numbers.
 * Kept out of the highlight cache, so changing a property doesn't re-highlight.
 * @param {string} preHtml
 * @param {Object} block - entry of ctx.codeBlocks
 * @param {boolean|null} recognized - language known; null without a language
 * @returns {string}
 */
function buildCodeBlockHTML(preHtml, block, recognized) {
  const props = block.properties?.props ?? {};
  const label = typeof props.label === 'string' ? props.label : null;
  const tagText = label === 'none' ? null : (label ?? block.langName);

  const classes = ['code-block-wrapper'];
  if (!tagText)
    classes.push('code-block-wrapper--no-tag');

  // a column next to the <pre>, in the same grid column as the tag (equal width)
  let numbers = '';
  if (props.numbers) {
    classes.push('code-block-wrapper--numbered');
    const lines = block.isDiff
      ? getDiffLineNumbers(preHtml)
      : Array.from({ length: block.code.split('\n').length }, (_, i) => i + 1).join('\n');
    numbers = `<div class="code-line-numbers" aria-hidden="true">${lines}</div>`;
  }

  const copy = props.copy ? CODE_COPY_HTML : '';
  const tag = tagText ? buildLanguageTagHTML(tagText, recognized ?? true) : '';
  return `<div class="${classes.join(' ')}">${copy}${numbers}${preHtml}${tag}</div>`;
}

async function renderFencedCodeBlock(block, ctx) {
  const { html, recognized } = await renderCodeBlockBody(block, ctx);
  return buildCodeBlockHTML(html, block, recognized);
}

/**
 * Renders the <pre> of a fenced code block (highlighted if the language is known).
 * @returns {Promise<{ html: string, recognized: boolean|null }>}
 */
async function renderCodeBlockBody(block, ctx) {
  const {
    theme,
    project,
    codeBlockCache
  } = ctx;

  const {
    langName,
    code,
    isDiff
  } = block;

  const plainHtml = `<pre><code>${escapeHTML(code)}</code></pre>`;

  if (!langName) {
    if (isDiff) {
      const { lineTypes } = splitCodeblockDiff(code);
      const plainLines = buildPlainDiffLines(code);
      return { html: buildDiffBodyHtml(lineTypes, plainLines, plainLines), recognized: null };
    }

    return { html: plainHtml, recognized: null };
  }

  const langDef = findSyntaxDefinitionByName(langName, project?.languages);
  if (!langDef) {
    return { html: plainHtml, recognized: false };
  }

  // the style is part of the key, otherwise a style change reuses the old
  // html and the css for the new style is never generated
  const styleId = getLanguageStyleId(project, theme, langDef);
  const cacheKey = makeCacheKey(langName, styleId, isDiff, code);
  if (codeBlockCache && codeBlockCache.has(cacheKey)) {
    const data = codeBlockCache.get(cacheKey);
    data.used = true;
    return { html: data.html, recognized: true };
  }

  if (!_codeHighlighter) {
    return { html: plainHtml, recognized: true };
  }

  try {
    let bodyHtml = '';
    if (isDiff) {
      const {
        added,
        removed,
        lineTypes
      } = splitCodeblockDiff(code);

      const highlight = text => _codeHighlighter({
        project,
        langId: langDef.id,
        styleId: styleId,
        text,
      });

      const [addedResult, removedResult] = await Promise.all([
        highlight(added),
        highlight(removed)
      ]);

      const addedLines = _htmlCodeLineSplitter
        ? _htmlCodeLineSplitter(addedResult.html)
        : addedResult.html.split('\n');
      const removedLines = _htmlCodeLineSplitter
        ? _htmlCodeLineSplitter(removedResult.html)
        : removedResult.html.split('\n');

      bodyHtml = buildDiffBodyHtml(lineTypes, addedLines, removedLines);
    } else {
      const { html } = await _codeHighlighter({
        project,
        langId: langDef.id,
        styleId: styleId,
        text: code,
      });

      bodyHtml = html;
    }

    if (codeBlockCache) {
      codeBlockCache.set(cacheKey, createCodeCachEntry(bodyHtml));
    }

    return { html: bodyHtml, recognized: true };
  } catch (err) {
    console.warn(`Highlighting failed for ${langName}:`, err);

    if (codeBlockCache) {
      codeBlockCache.set(cacheKey, createCodeCachEntry(plainHtml));
    }

    return { html: plainHtml, recognized: true };
  }
}

/**
 * Renders inline code with a language ({lang=cpp}`code`) as highlighted <code>.
 * Unknown languages are rendered as plain inline code.
 * @param {string} langName
 * @param {string} code
 * @param {ParseContext} ctx
 * @returns {Promise<string>}
 */
async function renderInlineCode(langName, code, ctx) {
  const plainHtml = `<code>${escapeHTML(code)}</code>`;
  const { theme, project, codeBlockCache } = ctx;

  const langDef = findSyntaxDefinitionByName(langName, project?.languages);
  if (!langDef || !_codeHighlighter)
    return plainHtml;

  const styleId = getLanguageStyleId(project, theme, langDef);
  const cacheKey = `inline\0${makeCacheKey(langName, styleId, false, code)}`;
  if (codeBlockCache && codeBlockCache.has(cacheKey)) {
    const data = codeBlockCache.get(cacheKey);
    data.used = true;
    return data.html;
  }

  try {
    const { html } = await _codeHighlighter({ project, langId: langDef.id, styleId, text: code });
    // the highlighter returns a <pre>; inline only its tokens are needed
    const tokens = html
      .replace(/^\s*<pre[^>]*>/, '')
      .replace(/<\/pre>\s*$/, '')
      .replace(/ id="syntax-chunk-\d+"/g, '');
    const result = `<code class="syntax-definition-highlight code-inline-highlight">${tokens}</code>`;
    if (codeBlockCache)
      codeBlockCache.set(cacheKey, createCodeCachEntry(result));
    return result;
  } catch (err) {
    console.warn(`Highlighting failed for inline ${langName}:`, err);
    return plainHtml;
  }
}

function splitCodeblockDiff(code) {
  const added = [];
  const removed = [];
  const lineTypes = [];

  const lines = code.split('\n');

  for (const line of lines) {
    if (line.startsWith('+')) {
      added.push(line.slice(1).replace(/^ /, ''));
      removed.push('');
      lineTypes.push('+');
    } else if (line.startsWith('-')) {
      added.push('');
      removed.push(line.slice(1).replace(/^ /, ''));
      lineTypes.push('-');
    } else {
      added.push(line);
      removed.push(line);
      lineTypes.push('');
    }
  }

  return {
    added: added.join('\n'),
    removed: removed.join('\n'),
    lineTypes,
  };
}

function groupDiffLines(lineTypes) {
  const groups = [];
  let start = 0;

  for (let i = 1; i <= lineTypes.length; i++) {
    if (i === lineTypes.length || lineTypes[i] !== lineTypes[start]) {
      groups.push({ type: lineTypes[start], start, end: i });
      start = i;
    }
  }

  return groups;
}

function diffGroupClass(type) {
  if (type === '+')
    return 'code-block-diff-line code-block-diff-add';
  if (type === '-')
    return 'code-block-diff-line code-block-diff-removed';
  return 'code-block-diff-line code-block-diff-context';
}

function buildDiffBodyHtml(lineTypes, addedLines, removedLines) {
  const groups = groupDiffLines(lineTypes);

  const groupsHtml = groups.map(({ type, start, end }) => {
    const sourceLines = type === '-' ? removedLines : addedLines;
    const linesHtml = sourceLines
      .slice(start, end)
      .map(line => line === '' ? '\u00A0' : line)
      .join('\n');
    return `<div class="${diffGroupClass(type)}">${linesHtml}</div>`;
  }).join('');

  return `<pre class="syntax-definition-highlight code-block-diff">${groupsHtml}</pre>`;
}

function buildPlainDiffLines(code) {
  return code.split('\n').map(line => {
    const stripped = (line.startsWith('+') || line.startsWith('-'))
      ? line.slice(1).trim()
      : line;
    return escapeHTML(stripped);
  });
}

const FENCED_CODE_REGEX = /(?<!`)(`{3,})(?!`)([\w#+.-]+(?::[\w#+.-]+)?)?\n?([\s\S]*?)\n?(?<!`)\1(?!`)/g;

// fenced code | inline code | comment, so comments are only found outside of code
// (the inline code backreference is \4 because of the three fence groups)
const COMMENT_SCAN_REGEX = new RegExp(`${FENCED_CODE_REGEX.source}|(\`+)[^\\n]*?\\4(?!\`)|<!--[\\s\\S]*?-->`, 'g');

const isBlankLine = line => /^[ \t]*$/.test(line);

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
function parsePropertyBlock(text) {
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
function stripComments(ctx) {
  const { text, lineMap } = removeMeta(ctx.html);
  ctx.html = text;
  ctx.lineMap = lineMap;
  return ctx;
}

/**
 * Extracts fenced code blocks and replaces them with placeholders.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function extractFencedCode(ctx) {
  ctx.html = ctx.html.replace(
    FENCED_CODE_REGEX,
    (match, fence, langSpec, code) => {
      const i = ctx.codeBlocks.length;
      const [prefix, lang] = (langSpec ?? '').split(':');

      ctx.codeBlocks.push({
        isDiff: prefix === 'diff',
        langName: prefix === 'diff' ? (lang || null) : (langSpec || null),
        code: code,
        placeholder: `\x00CODEBLOCK_${i}\x00`,
        // source lines swallowed by the placeholder (for line anchors)
        lineBreaks: match.split('\n').length - 1,
        line: null,
        /** @type {BlockProperties|null} */
        properties: null,
      });

      return ctx.codeBlocks[i].placeholder;
    }
  );

  return ctx;
}

const LINE_MARKER_REGEX = /^\x01L(\d+)\x01$/;
const CODEBLOCK_PLACEHOLDER_REGEX = /\x00CODEBLOCK_(\d+)\x00/g;

/**
 * Puts a marker line (+ blank line) in front of every block that follows a
 * blank line. Being its own segment, the marker does not disturb the line based
 * regexes; parseParagraphs turns it into data-line on the next block.
 * Code blocks remember their source line and get data-line on restore.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function insertLineMarkers(ctx) {
  if (!ctx.lineAnchors)
    return ctx;

  // lines removed with comments are not counted in sourceLine
  const toSourceLine = line => ctx.lineMap?.[line] ?? line;
  const out = [];
  let sourceLine = 0;

  ctx.html.split('\n').forEach((line, i, lines) => {
    if (!isBlankLine(line) && (i === 0 || isBlankLine(lines[i - 1])))
      out.push(`\x01L${toSourceLine(sourceLine)}\x01`, '');
    out.push(line);

    let lineBreaks = 0;
    for (const [, index] of line.matchAll(CODEBLOCK_PLACEHOLDER_REGEX)) {
      const block = ctx.codeBlocks[index];
      block.line = toSourceLine(sourceLine + lineBreaks);
      lineBreaks += block.lineBreaks;
    }
    sourceLine += 1 + lineBreaks;
  });

  ctx.html = out.join('\n');
  return ctx;
}

const PROPERTIES_PLACEHOLDER_LINE_REGEX = /^\x03P(\d+)\x03\n/gm;

/**
 * Attaches property blocks to the element below. Code blocks get them as
 * codeBlocks[i].properties, everything else as a placeholder line
 * \x03P<i>\x03 (ctx.properties[i]) that the element's transform reads.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function extractPropertyBlocks(ctx) {
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
function removeUnusedProperties(ctx) {
  ctx.html = ctx.html.replace(PROPERTIES_PLACEHOLDER_LINE_REGEX, '');
  return ctx;
}

/**
 * Adds data-line to the first tag of an html string.
 * @param {string} html
 * @param {number} line
 * @returns {string}
 */
function addLineAttribute(html, line) {
  return html.replace(/^<([a-zA-Z][\w-]*)/, `<$1 data-line="${line}"`);
}

/**
 * Extracts inline code spans and replaces them with placeholders.
 * Properties directly in front ({lang=cpp}`code`) select the language;
 * a {...} that isn't valid property syntax stays text.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function extractInlineCode(ctx) {
  ctx.html = ctx.html.replace(/(\{[^{}\n]*\})?(`+)([^\n]*?)\2(?!`)/g, (_, propsText, ticks, code) => {
    const properties = propsText ? parsePropertyBlock(propsText.slice(1, -1)) : null;
    const langName = typeof properties?.props.lang === 'string' ? properties.props.lang : null;

    const i = ctx.inlineCodes.length;
    ctx.inlineCodes.push({ code, langName });
    return `${properties ? '' : propsText ?? ''}\x00INLINECODE${i}\x00`;
  });
  return ctx;
}

/**
 * Escapes HTML special characters.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function escapeHtmlChars(ctx) {
  ctx.html = ctx.html
    .replace(/&(?!amp;|lt;|gt;|quot;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return ctx;
}

async function restoreCodeBlocksAsync(ctx) {
  const CONCURRENCY = HIGHLIGHTER_WORKER_POOL_SIZE;
  const results = new Array(ctx.codeBlocks.length);

  for (let i = 0; i < ctx.codeBlocks.length; i += CONCURRENCY) {
    const batch = ctx.codeBlocks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(block => renderFencedCodeBlock(block, ctx))
    );

    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
    }
  }
  
  for (let idx = 0; idx < ctx.codeBlocks.length; idx++) {
    const block = ctx.codeBlocks[idx];
    const html = block.line !== null ? addLineAttribute(results[idx], block.line) : results[idx];
    ctx.html = ctx.html.split(block.placeholder).join(html);
  }

  const inlineResults = await Promise.all(ctx.inlineCodes.map(({ code, langName }) =>
    langName ? renderInlineCode(langName, code, ctx) : `<code>${escapeHTML(code)}</code>`));

  inlineResults.forEach((html, i) => {
    ctx.html = ctx.html.split(`\x00INLINECODE${i}\x00`).join(html);
  });

  return ctx;
}

// No style attributes: the app's CSP (style-src) blocks them in the preview.
// align/line become classes, width the html width attribute (px or %).
const TABLE_HOVER_TYPES = ['cell', 'row', 'col'];
const TABLE_ALIGNS = ['left', 'center', 'right'];
const TABLE_WIDTH_REGEX = /^(\d+)(?:px)?$|^(\d+%)$/;
export const MAX_TABLE_LINE_WIDTH = 10;

/** ':---' / '---:' / ':---:' of the separator row -> text-align */
function getSeparatorAlign(cell) {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right)
    return 'center';
  if (right)
    return 'right';
  return left ? 'left' : null;
}

/** line=3 -> 3 (px, 1 - MAX_TABLE_LINE_WIDTH), null if invalid */
function parseTableLineWidth(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1)
    return null;
  return Math.min(Number(value), MAX_TABLE_LINE_WIDTH);
}

/** width=120 / 120px / 20% -> value of the width attribute, null if invalid */
function parseTableWidth(value) {
  const match = typeof value === 'string' ? value.match(TABLE_WIDTH_REGEX) : null;
  return match ? (match[1] ?? match[2]) : null;
}

/**
 * Resolves the property targets of a table into per row/col/cell lookups.
 * Rows are counted from the header (row 0), cols from the left (col 0).
 * @param {BlockProperties|null} properties
 * @param {(string|null)[]} colAligns - from the separator row
 */
function createTableLayout(properties, colAligns) {
  const rowHl = new Set();
  const colHl = new Set();
  const cellHl = new Set();
  const rowLine = new Map();
  const colLine = new Map();
  const colWidth = new Map();
  const colAlign = new Map(colAligns.map((align, col) => [col, align]));
  const cellAlign = new Map();

  for (const { type, indices, rows, cols, props } of properties?.targets ?? []) {
    const line = parseTableLineWidth(props.line);
    const align = TABLE_ALIGNS.includes(props.align) ? props.align : null;

    if (type === 'row') {
      for (const row of indices) {
        if (props.hl) rowHl.add(row);
        if (line !== null) rowLine.set(row, line);
      }
    } else if (type === 'col') {
      const width = parseTableWidth(props.width);
      for (const col of indices) {
        if (props.hl) colHl.add(col);
        if (line !== null) colLine.set(col, line);
        if (width !== null) colWidth.set(col, width);
        if (align) colAlign.set(col, align);
      }
    } else {
      for (const row of rows) {
        for (const col of cols) {
          if (props.hl) cellHl.add(`${row},${col}`);
          if (align) cellAlign.set(`${row},${col}`, align);
        }
      }
    }
  }

  const hover = String(properties?.props.hover === true ? 'cell' : properties?.props.hover ?? '')
    .split(',')
    .map(h => h.trim())
    .filter(h => TABLE_HOVER_TYPES.includes(h));

  return {
    tableAttrs() {
      const attrs = [];
      if (properties?.props.striped)
        attrs.push(' class="tbl-striped"');
      if (hover.length)
        attrs.push(` data-hover="${hover.join(' ')}"`);
      return attrs.join('');
    },

    rowAttrs(row) {
      return rowHl.has(row) ? ' class="tbl-hl-row"' : '';
    },

    cellAttrs(row, col) {
      const classes = [];
      if (colHl.has(col)) classes.push('tbl-hl-col');
      if (cellHl.has(`${row},${col}`)) classes.push('tbl-hl-cell');

      const align = cellAlign.get(`${row},${col}`) ?? colAlign.get(col);
      if (align) classes.push(`tbl-align-${align}`);
      if (rowLine.has(row)) classes.push(`tbl-line-b-${rowLine.get(row)}`);
      if (colLine.has(col)) classes.push(`tbl-line-r-${colLine.get(col)}`);

      return (classes.length ? ` class="${classes.join(' ')}"` : '')
        + (row === 0 && colWidth.has(col) ? ` width="${colWidth.get(col)}"` : '');
    },
  };
}

/**
 * Parses markdown tables into HTML tables, with the property block above
 * (\x03P<i>\x03 placeholder line) if there is one.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseTables(ctx) {
  ctx.html = ctx.html.replace(
    /(?:^\x03P(\d+)\x03\n)?((?:\|[^\n]+\|\n)+\|[-| :]+\|\n(?:\|[^\n]+\|\n?)*)/gm,
    (match, propertiesIndex, table) => {
      const rows = table.trim().split('\n');
      if (rows.length < 3) return match;

      const parseRow = row => {
        // a '|' followed by ']]' without '[' in between belongs to a [[slug|Text]] link
        const cells = row.split(/\|(?![^[\n]*\]\])/).map(c => c.trim());

        const start = cells[0] === '' ? 1 : 0;
        const end = cells[cells.length - 1] === '' ? cells.length - 1 : cells.length;
        return cells.slice(start, end);
      };

      const properties = propertiesIndex !== undefined ? ctx.properties[propertiesIndex] : null;
      const layout = createTableLayout(properties, parseRow(rows[1]).map(getSeparatorAlign));

      const buildRow = (cells, row, tag) =>
        `<tr${layout.rowAttrs(row)}>${cells.map((c, col) => `<${tag}${layout.cellAttrs(row, col)}>${c}</${tag}>`).join('')}</tr>`;

      const headerHTML = buildRow(parseRow(rows[0]), 0, 'th');
      const bodyHTML = rows.slice(2)
        .map((row, i) => buildRow(parseRow(row), i + 1, 'td'))
        .join('');

      const trailingNewline = table.endsWith('\n') ? '\n' : '';
      return `<div class="table-wrapper"><table${layout.tableAttrs()}><thead>${headerHTML}</thead><tbody>${bodyHTML}</tbody></table></div>${trailingNewline}`;
    }
  );
  return ctx;
}
/**
 * Parses blockquotes.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseBlockquotes(ctx) {
  ctx.html = ctx.html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  return ctx;
}

/**
 * Parses horizontal rules.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseHorizontalRules(ctx) {
  ctx.html = ctx.html.replace(/^---$/gm, '<hr>');
  return ctx;
}

/**
 * Parses markdown headings (h1-h4).
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseHeadings(ctx) {
  ctx.html = ctx.html
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm,  '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,   '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,    '<h1>$1</h1>');
  return ctx;
}

/**
 * Parses unordered lists.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseUnorderedLists(ctx) {
  ctx.html = ctx.html.replace(
    /((?:^(?: {2,4})*[-*] .+$\n?)+)/gm,
    match => {
      const lines = match.trimEnd().split('\n');

      function buildList(startIndex, baseIndent) {
        let html = '<ul>';
        let i = startIndex;

        while (i < lines.length) {
          const line = lines[i];
          const match = line.match(/^(\s*)[-*] (.+)$/);

          if (!match) {
            break;
          }

          const indent = match[1].length;

          if (indent < baseIndent) {
            break;
          }

          if (indent > baseIndent) {
            const [nested, nextIndex] = buildList(i, indent);
            html += nested;
            i = nextIndex;
            continue;
          }

          html += `<li>${match[2]}`;

          if (i + 1 < lines.length) {
            const nextMatch = lines[i + 1].match(/^(\s*)[-*] (.+)$/);

            if (nextMatch && nextMatch[1].length > baseIndent) {
              const [nested, nextIndex] = buildList(i + 1, nextMatch[1].length);
              html += nested;
              i = nextIndex;
            } else {
              i++;
            }
          } else {
            i++;
          }

          html += '</li>';
        }

        html += '</ul>';
        return [html, i];
      }

      return buildList(0, lines[0].match(/^(\s*)/)[1].length)[0] + '\n';
    }
  );

  return ctx;
}

/**
 * Parses ordered lists.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseOrderedLists(ctx) {
  ctx.html = ctx.html.replace(
    /((?:^(?: {2,4})*\d+\. .+$\n?)+)/gm,
    match => {
      const lines = match.trimEnd().split('\n');

      function buildList(startIndex, baseIndent) {
        let html = '<ol>';
        let i = startIndex;

        while (i < lines.length) {
          const line = lines[i];
          const match = line.match(/^(\s*)\d+\. (.+)$/);

          if (!match) {
            break;
          }

          const indent = match[1].length;

          if (indent < baseIndent) {
            break;
          }

          if (indent > baseIndent) {
            const [nested, nextIndex] = buildList(i, indent);
            html += nested;
            i = nextIndex;
            continue;
          }

          html += `<li>${match[2]}`;

          if (i + 1 < lines.length) {
            const nextMatch = lines[i + 1].match(/^(\s*)\d+\. (.+)$/);

            if (nextMatch && nextMatch[1].length > baseIndent) {
              const [nested, nextIndex] = buildList(
                i + 1,
                nextMatch[1].length
              );

              html += nested;
              i = nextIndex;
            } else {
              i++;
            }
          } else {
            i++;
          }

          html += '</li>';
        }

        html += '</ol>';
        return [html, i];
      }

      return buildList(0, lines[0].match(/^(\s*)/)[1].length)[0] + '\n';
    }
  );

  return ctx;
}

/**
 * Parses inline formatting: bold, italic, bold+italic.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseInlineFormatting(ctx) {
  ctx.html = ctx.html
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
    .replace(/(?<![\w])_([^_\n]+?)_(?![\w])/g, '<em>$1</em>');

  return ctx;
}

/**
 * Parses markdown links.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseLinks(ctx) {
  ctx.html = ctx.html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );
  return ctx;
}

/**
 * Parses link anchors: {#name} -> empty span with a unique id.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseLinkAnchors(ctx) {
  ctx.html = ctx.html.replace(LINK_ANCHOR_REGEX, (_, anchor) =>
    `<span class="doc-anchor" id="${escapeHTML(getLinkAnchorElementId(ctx.nodeId ?? 'node', anchor))}"></span>`);
  return ctx;
}

/**
 * Parses reference links: [[slug]] / [[slug|Text]], resolved via project.links.
 * Broken or unknown links are rendered as non-clickable spans with the reason as title.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseReferenceLinks(ctx) {
  ctx.html = ctx.html.replace(LINK_USAGE_REGEX, (match, rawSlug, label) => {
    const slug = rawSlug.trim();
    const link = findLinkBySlug(ctx.project, slug);
    // label is already HTML-escaped by escape-html
    const text = label?.trim() || (link ? escapeHTML(link.name) : escapeHTML(match));

    if (!link)
      return `<span class="doc-ref doc-ref--broken" title="${escapeHTML(`Unknown link '${slug}'`)}">${text}</span>`;

    const status = getLinkStatus(ctx.project, link);
    if (!status.ok)
      return `<span class="doc-ref doc-ref--broken" title="${escapeHTML(status.reason)}">${text}</span>`;

    const nodeId = escapeHTML(link.target.nodeId);
    const anchorAttr = link.target.anchor
      ? ` data-ref-anchor="${escapeHTML(getLinkAnchorElementId(link.target.nodeId, link.target.anchor))}"`
      : '';
    // tooltip: the entry the link opens (+ anchor)
    const targetName = findNodeInProject(ctx.project, link.target.nodeId)?.node.name ?? '';
    const title = link.target.anchor ? `${targetName} #${link.target.anchor}` : targetName;
    return `<a class="doc-ref" href="#${nodeId}" data-ref-node="${nodeId}"${anchorAttr} title="${escapeHTML(title)}">${text}</a>`;
  });
  return ctx;
}

const EMPTY_LINE_HTML = '<div class="md-empty-line"></div>';

/**
 * Wraps text blocks into paragraphs.
 * The first blank line between two blocks only separates them; every
 * further blank line is kept as a visible empty line.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseParagraphs(ctx) {
  const wrapSegment = segment => {
    segment = segment.trim();

    if (!segment)
      return '';

    const isBlock = /^<(h[1-6]|ul|ol|blockquote|pre|div|table|hr|p)/.test(segment);
    const isCodeRef = /^\x00CODEBLOCK_\d+\x00$/.test(segment);

    if (isBlock || isCodeRef)
      return segment;

    return `<p>${segment.replace(/\n/g, '<br>')}</p>`;
  };

  const out = [];
  // source line from a marker of insertLineMarkers, applied to the next block
  let pendingLine = null;
  // Odd indices are the blank-line separators (captured)
  ctx.html.split(/(\n[ \t]*\n(?:[ \t]*\n)*)/).forEach((part, i) => {
    if (i % 2 === 1) {
      const extraEmptyLines = part.split('\n').length - 3;
      for (let n = 0; n < extraEmptyLines; n++)
        out.push(EMPTY_LINE_HTML);
      return;
    }

    const marker = part.trim().match(LINE_MARKER_REGEX);
    if (marker) {
      pendingLine = marker[1];
      return;
    }

    // A code block directly below text (no blank line) shares its segment,
    // so split it out and wrap the text around it separately.
    part.split(/(\x00CODEBLOCK_\d+\x00)/)
      .map(wrapSegment)
      .filter(Boolean)
      .forEach((html, n) => {
        // code blocks get their own line on restore
        const isCodeRef = /^\x00CODEBLOCK_\d+\x00$/.test(html);
        out.push(n === 0 && pendingLine !== null && !isCodeRef ? addLineAttribute(html, pendingLine) : html);
      });
    pendingLine = null;
  });

  // No empty lines at the very start or end of the document
  while (out[0] === EMPTY_LINE_HTML) out.shift();
  while (out[out.length - 1] === EMPTY_LINE_HTML) out.pop();

  ctx.html = out.join('\n');
  return ctx;
}

/**
 * Example: theme-dependent CSS classes for headings.
 * If the theme has a specific typography setting (e.g. 'typography-heading'),
 * an extra class is added to heading tags.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function applyThemeToHeadings(ctx) {
  if (!ctx.theme) 
    return ctx;

  const headingStyle = ctx.theme?.settings?.entries?.find(e => e.name === 'typography-heading')?.value;
  if (headingStyle && headingStyle !== 'system') {
    const cls = headingStyle === 'serif' ? 'heading-serif' : 'heading-mono';
    ctx.html = ctx.html.replace(/<(h[1-4])(?=[\s>])/g, (_, tag) => `<${tag} class="${cls}"`);
  }
  return ctx;
}

// ─── Transform Pipeline ───────────────────────────────────────────────────────

/**
 * Pipeline of transform functions executed in order.
 * @type {Array<{name: string, fn: function(ParseContext): ParseContext}>}
 */
const SYNC_TRANSFORM_PIPELINE  = [
  { name: 'comments',              fn: stripComments          },
  { name: 'extract-fenced-code',   fn: extractFencedCode      },
  { name: 'line-markers',          fn: insertLineMarkers      },
  { name: 'properties',            fn: extractPropertyBlocks  },
  { name: 'extract-inline-code',   fn: extractInlineCode      },
  { name: 'escape-html',           fn: escapeHtmlChars        },
  { name: 'tables',                fn: parseTables            },
  { name: 'blockquotes',           fn: parseBlockquotes       },
  { name: 'horizontal-rules',      fn: parseHorizontalRules   },
  { name: 'headings',              fn: parseHeadings          },
  { name: 'unordered-lists',       fn: parseUnorderedLists    },
  { name: 'ordered-lists',         fn: parseOrderedLists      },
  { name: 'inline-formatting',     fn: parseInlineFormatting  },
  { name: 'link-anchors',          fn: parseLinkAnchors       },
  { name: 'reference-links',       fn: parseReferenceLinks    },
  { name: 'links',                 fn: parseLinks             },
  { name: 'unused-properties',     fn: removeUnusedProperties },
  { name: 'paragraphs',            fn: parseParagraphs        },
  { name: 'theme-headings',        fn: applyThemeToHeadings   },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parses Markdown asynchronously and converts it to HTML.
 *
 * @param {string} source - The Markdown source to parse.
 * @param {Object|null} theme - The theme used for rendering.
 * @param {Object|null} project - The project context used for rendering.
 * @param {Object|null} [options] - Optional parser configuration.
 * @param {Map} [options.codeBlockCache] - Cache for rendered code blocks.
 * @param {string} [options.nodeId] - Node being parsed (unique link anchor ids).
 * @param {boolean} [options.lineAnchors] - Adds data-line (source line, 0-based) to every top-level block.
 * @returns {Promise<string>} The generated HTML.
 */
export async function parseMarkdownAsync(source, theme = null, project = null, options = null) {
  if (!source) 
    return '';

  const resolvedTheme = theme ?? getPresetDocThemes()?.[0];
  
  let ctx = createContext(source, resolvedTheme, project, options);
  for (const transform of SYNC_TRANSFORM_PIPELINE) {
    ctx = transform.fn(ctx);
  }

  ctx = await restoreCodeBlocksAsync(ctx);
  return ctx.html;
}

/**
 * Inserts a custom transform into the pipeline.
 *
 * @param {string}   name     - Unique name for the transform
 * @param {function} fn       - (ctx: ParseContext) => ParseContext
 * @param {object}   [pos]    - Positioning: { before?: string } or { after?: string }
 *
 * @example
 * // Add a transform that highlights ==marked== text, before paragraphs are wrapped
 * addTransform('highlight', ctx => {
 *   ctx.html = ctx.html.replace(/==(.+?)==/g, '<mark>$1</mark>');
 *   return ctx;
 * }, { before: 'paragraphs' });
 */
export function addTransform(name, fn, pos = {}) {
  const entry = { name, fn };

  if (pos.before) {
    const idx = SYNC_TRANSFORM_PIPELINE .findIndex(t => t.name === pos.before);
    if (idx !== -1) { SYNC_TRANSFORM_PIPELINE .splice(idx, 0, entry); return; }
  }

  if (pos.after) {
    const idx = SYNC_TRANSFORM_PIPELINE .findIndex(t => t.name === pos.after);
    if (idx !== -1) { SYNC_TRANSFORM_PIPELINE .splice(idx + 1, 0, entry); return; }
  }

  // Default: insert before restore so placeholders still work
  const restoreIdx = SYNC_TRANSFORM_PIPELINE .findIndex(t => t.name === 'restore-placeholders');
  SYNC_TRANSFORM_PIPELINE .splice(restoreIdx, 0, entry);
}

/**
 * Removes a transform from the pipeline by name.
 * @param {string} name
 */
export function removeTransform(name) {
  const idx = SYNC_TRANSFORM_PIPELINE .findIndex(t => t.name === name);
  if (idx !== -1) SYNC_TRANSFORM_PIPELINE .splice(idx, 1);
}

/**
 * Returns a snapshot of the current pipeline (names only).
 * Useful for debugging.
 * @returns {string[]}
 */
export function getPipelineNames() {
  return SYNC_TRANSFORM_PIPELINE .map(t => t.name);
}