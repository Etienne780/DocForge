import { getPresetDocThemes, getLanguageStyleId } from '@data/DocThemeManager.js';
import { findSyntaxDefinitionByName } from '@data/SyntaxDefinitionManager.js';
import { HIGHLIGHTER_WORKER_POOL_SIZE } from '@core/syntaxHighlighter/Constants.js'
import { hashString, escapeHTML } from '@common/Common.js';

/**
 * @typedef {Object} ParseContext
 * @property {string}   html         - Current HTML string being transformed
 * @property {string[]} codeBlocks   - Extracted fenced code block HTML strings
 * @property {string[]} inlineCodes  - Extracted inline code HTML strings
 * @property {Object|null} theme     - Optional DocTheme object for context-aware parsing
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
    html: source,
    codeBlocks: [], // { langName, code, placeholder }
    inlineCodes: [],
    theme: theme,
    project: project,
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

  return ctx;
}

function makeCacheKey(langName, isDiff, code) {
  return `${langName}\0${isDiff}\0${code.length}\0${hashString(code)}`;
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

async function renderFencedCodeBlock(block, ctx) {
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

  if (!langName) {
    if (isDiff) {
      const { lineTypes } = splitCodeblockDiff(code);
      const plainLines = buildPlainDiffLines(code);
      return `<div class="code-block-wrapper code-block-wrapper--no-tag">${buildDiffBodyHtml(lineTypes, plainLines, plainLines)}</div>`;
    }

    return `<div class="code-block-wrapper code-block-wrapper--no-tag"><pre><code>${escapeHTML(code)}</code></pre></div>`;
  }

  const langDef = findSyntaxDefinitionByName(langName, project?.languages);
  if (!langDef) {
    return `<div class="code-block-wrapper"><pre><code>${escapeHTML(code)}</code></pre>${buildLanguageTagHTML(langName, false)}</div>`;
  }
  
  const cacheKey = makeCacheKey(langName, isDiff, code);
  if (codeBlockCache && codeBlockCache.has(cacheKey)) {
    const data = codeBlockCache.get(cacheKey);
    data.used = true;
    return data.html;
  }

  if (!_codeHighlighter) {
    return `<div class="code-block-wrapper"><pre><code>${escapeHTML(code)}</code></pre>${buildLanguageTagHTML(langName, true)}</div>`;
  }

  const styleId = getLanguageStyleId(project, theme, langDef);
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

    const result = `<div class="code-block-wrapper">${bodyHtml}${buildLanguageTagHTML(langName, true)}</div>`;
    if (codeBlockCache) {
      codeBlockCache.set(cacheKey, createCodeCachEntry(result));
    }

    return result; 
  } catch (err) {
    console.warn(`Highlighting failed for ${langName}:`, err);
    
    const fallback = `<div class="code-block-wrapper"><pre><code>${escapeHTML(code)}</code></pre>${buildLanguageTagHTML(langName, true)}</div>`;
    if (codeBlockCache) {
      codeBlockCache.set(cacheKey, createCodeCachEntry(fallback));
    }

    return fallback;
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

/**
 * Extracts fenced code blocks and replaces them with placeholders.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function extractFencedCode(ctx) {
  ctx.html = ctx.html.replace(
    /(?<!`)(`{3,})(?!`)([\w#+.-]+(?::[\w#+.-]+)?)\n?([\s\S]*?)\n?(?<!`)\1(?!`)/g,
    (_, fence, langSpec, code) => {
      const i = ctx.codeBlocks.length;
      const [prefix, lang] = langSpec.split(':');
    
      ctx.codeBlocks.push({
        isDiff: prefix === 'diff',
        langName: prefix === 'diff' ? (lang || null) : langSpec,
        code: code,
        placeholder: `\x00CODEBLOCK_${i}\x00`
      });
    
      return ctx.codeBlocks[i].placeholder;
    }
  );
  return ctx;
}
/**
 * Extracts inline code spans and replaces them with placeholders.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function extractInlineCode(ctx) {
  ctx.html = ctx.html.replace(/(`+)([^\n]*?)\1(?!`)/g, (_, ticks, code) => {
    const i = ctx.inlineCodes.length;
    ctx.inlineCodes.push(`<code>${escapeHTML(code)}</code>`);
    return `\x00INLINECODE${i}\x00`;
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
    ctx.html = ctx.html.split(block.placeholder).join(results[idx]);
  }

  ctx.inlineCodes.forEach((code, i) => {
    ctx.html = ctx.html.split(`\x00INLINECODE${i}\x00`).join(code);
  });

  return ctx;
}

/**
 * Parses markdown tables into HTML tables.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseTables(ctx) {
  ctx.html = ctx.html.replace(
    /((?:\|[^\n]+\|\n)+\|[-| :]+\|\n(?:\|[^\n]+\|\n?)*)/g,
    match => {
      const rows = match.trim().split('\n');
      if (rows.length < 3) return match;

      const parseRow = row => {
        const cells = row.split('|').map(c => c.trim());
       
        const start = cells[0] === '' ? 1 : 0;
        const end = cells[cells.length - 1] === '' ? cells.length - 1 : cells.length;
        return cells.slice(start, end);
      };

      const headerHTML = parseRow(rows[0]).map(c => `<th>${c}</th>`).join('');
      const bodyHTML = rows.slice(2)
        .map(parseRow)
        .map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`)
        .join('');

      return `<table><thead><tr>${headerHTML}</tr></thead><tbody>${bodyHTML}</tbody></table>`;
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
 * Wraps text blocks into paragraphs.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseParagraphs(ctx) {
  ctx.html = ctx.html
    .split(/\n{2,}/)
    .map(segment => {
      segment = segment.trim();

      if (!segment)
        return '';

      const isBlock = /^<(h[1-6]|ul|ol|blockquote|pre|div|table|hr|p)/.test(segment);
      const hasCodeRef = /\x00CODEBLOCK/.test(segment);

      if (isBlock || hasCodeRef)
        return segment;

      return `<p>${segment.replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

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
    ctx.html = ctx.html.replace(/<(h[1-4])>/g, (_, tag) => `<${tag} class="${cls}">`);
  }
  return ctx;
}

// ─── Transform Pipeline ───────────────────────────────────────────────────────

/**
 * Pipeline of transform functions executed in order.
 * @type {Array<{name: string, fn: function(ParseContext): ParseContext}>}
 */
const SYNC_TRANSFORM_PIPELINE  = [
  { name: 'extract-fenced-code',   fn: extractFencedCode      },
  { name: 'extract-inline-code',   fn: extractInlineCode      },
  { name: 'escape-html',           fn: escapeHtmlChars        },
  { name: 'tables',                fn: parseTables            },
  { name: 'blockquotes',           fn: parseBlockquotes       },
  { name: 'horizontal-rules',      fn: parseHorizontalRules   },
  { name: 'headings',              fn: parseHeadings          },
  { name: 'unordered-lists',       fn: parseUnorderedLists    },
  { name: 'ordered-lists',         fn: parseOrderedLists      },
  { name: 'inline-formatting',     fn: parseInlineFormatting  },
  { name: 'links',                 fn: parseLinks             },
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