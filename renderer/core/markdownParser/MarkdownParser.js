import { getPresetDocThemes } from '@data/DocThemeManager.js';
import { normalizeLineEndings, getProjectTabSize } from '@common/Common.js';
import { isBlankLine, LINE_MARKER_REGEX, CODEBLOCK_PLACEHOLDER_REGEX, addLineAttribute } from './ParserUtils.js';
import { stripComments, extractPropertyBlocks, removeUnusedProperties } from './Properties.js';
import { extractFencedCode, extractInlineCode, restoreCodeBlocksAsync } from './CodeBlocks.js';
import { parseTables } from './Tables.js';
import { parseUnorderedLists, parseOrderedLists } from './Lists.js';
import { SECTION_CLOSE_HTML, extractSections, buildSections } from './Sections.js';
import { extractTocs, buildTocs } from './Toc.js';
import { extractFootnoteDefinitions, buildFootnotes, appendFootnotes } from './Footnotes.js';
import { parseInlineFormatting, parseLinks, parseLinkAnchors, parseReferenceLinks } from './Inline.js';

// Entry point of the parser: context, pipeline and public API. The transforms
// are split by element into the other modules of this folder.
export {
  setCodeHighlighter, clearCodeHighlighter, setHtmlCodeLineSplitter, clearHtmlCodeLineSplitter,
  cleanupCodeBlockCache
} from './CodeBlocks.js';
export { parsePropertyBlock, removeMarkdownMeta } from './Properties.js';
export { TABLE_HOVER_TYPES, TABLE_STRIPE_TYPES, TABLE_ALIGNS, MAX_TABLE_LINE_WIDTH } from './Tables.js';
export { TOC_STYLES } from './Toc.js';
export { LIST_BULLETS } from './Lists.js';

/**
 * @typedef {Object} ParseContext
 * @property {string}   html         - Current HTML string being transformed
 * @property {string[]} codeBlocks   - Extracted fenced code block HTML strings
 * @property {{ code: string, langName: string|null }[]} inlineCodes - Extracted inline code spans
 * @property {Object|null} theme     - Optional DocTheme object for context-aware parsing
 * @property {number[]|null} lineMap - Source line of every line left after removing comments
 * @property {BlockProperties[]} properties - Property blocks of non-code elements
 */

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
    tabSize: getProjectTabSize(project), // project.settings.tabSize
    lineMap: null,
    properties: [], // BlockProperties, referenced by \x03P<i>\x03 placeholder lines
    tocs: [],       // BlockProperties|null of [toc] blocks, referenced by \x04TOC<i>\x04 placeholder lines
    footnoteLabels: [], // labels of [^label]: definitions, referenced by \x05FN<i>\x05 line prefixes
    footnotesHTML: '',  // list of the used footnotes, appended after the paragraphs
    sections: [],       // { open } of ::: sections, referenced by \x06S<i>\x06 placeholder lines
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

// ─── Block Transforms ─────────────────────────────────────────────────────────

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

    const isBlock = /^<(h[1-6]|ul|ol|blockquote|pre|div|table|hr|p|details)/.test(segment) || segment === SECTION_CLOSE_HTML;
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

    // A code block, heading or list directly next to text (no blank line) shares
    // its segment, so split it out and wrap the text around it separately.
    // section tags (buildSections) are always their own segment
    part.split(/(\x00CODEBLOCK_\d+\x00|^<h[1-6][ >].*<\/h[1-6]>$|^<ul[ >].*<\/ul>$|^<ol>.*<\/ol>$|^<div class="doc-toc[^"]*">.*<\/div>$|^<details class="doc-section".*$|^<\/div><\/details>$)/m)
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
  { name: 'tocs',                  fn: extractTocs            },
  { name: 'sections',              fn: extractSections        },
  { name: 'footnote-definitions',  fn: extractFootnoteDefinitions },
  { name: 'extract-inline-code',   fn: extractInlineCode      },
  { name: 'escape-html',           fn: escapeHtmlChars        },
  { name: 'section-tags',          fn: buildSections          },
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
  { name: 'footnotes',             fn: buildFootnotes         },
  { name: 'heading-ids-and-tocs',  fn: buildTocs              },
  { name: 'unused-properties',     fn: removeUnusedProperties },
  { name: 'paragraphs',            fn: parseParagraphs        },
  { name: 'footnote-list',         fn: appendFootnotes        },
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
