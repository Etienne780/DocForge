import { getPresetDocThemes, getLanguageStyleId } from '@data/DocThemeManager.js';
import { findSyntaxDefinitionByName } from '@data/SyntaxDefinitionManager.js';
import { HIGHLIGHTER_WORKER_POOL_SIZE, hashString, escapeHTML } from './Common.js';

/**
 * @typedef {Object} ParseContext
 * @property {string}   html         - Current HTML string being transformed
 * @property {string[]} codeBlocks   - Extracted fenced code block HTML strings
 * @property {string[]} inlineCodes  - Extracted inline code HTML strings
 * @property {Object|null} theme     - Optional DocTheme object for context-aware parsing
 */

// ─── Code Highlighter Injection ────────────────────────────────────────────
// The markdown parser has no direct dependency on any concrete syntax
// highlighter implementation. Wire one up from the outside via
// setCodeHighlighter(), e.g.:
//
//   import { syntaxHighlighter } from '@core/syntaxHighlighter/SyntaxHighlighter.js';
//   setCodeHighlighter(({ langId, styleId, text }) =>
//     syntaxHighlighter.highlightTextAsHTML({ langId, styleId, text }));
//
// If no highlighter is registered, fenced code blocks simply fall back to
// plain (unhighlighted) <pre><code> output.

/** @type {((options: { langId: string, styleId: string, text: string }) => Promise<{html: string}>)|null} */
let _codeHighlighter = null;

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
 * Creates a new parse context.
 * @param {string} source - Raw markdown source
 * @param {Object|null} theme - Optional DocTheme object
 * @returns {ParseContext}
 */
function createContext(source, theme = null, project = null, codeBlockCache = null) {
  return {
    html: source,
    codeBlocks: [],// { langName, code, placeholder }
    inlineCodes: [],
    theme: theme,
    project: project,
    codeBlockCache: codeBlockCache,// map {key: langName, code -> createCodeCachEntry { used, htmlCodeBlock } }
  };
}

function makeCacheKey(langName, code) {
  return `${langName}\0${code.length}\0${hashString(code)}`;
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

async function renderFencedCodeBlock(langName, code, theme, project, codeBlockCache) {
  if (!langName) {
    return `<div class="code-block-wrapper code-block-wrapper--no-tag"><pre><code>${escapeHTML(code)}</code></pre></div>`;
  }

  const langDef = findSyntaxDefinitionByName(langName, project?.languages);
  if (!langDef) {
    return `<div class="code-block-wrapper"><pre><code>${escapeHTML(code)}</code></pre>${buildLanguageTagHTML(langName, false)}</div>`;
  }
  
  const cacheKey = makeCacheKey(langName, code);
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
    const { html } = await _codeHighlighter({
      project,
      langId: langDef.id,
      styleId: styleId,
      text: code,
    });
    const result = `<div class="code-block-wrapper">${html}${buildLanguageTagHTML(langName, true)}</div>`;
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

/**
 * Extracts fenced code blocks and replaces them with placeholders.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function extractFencedCode(ctx) {
  // Language identifier: letters/digits/underscore plus the handful of
  // characters real language names use (C#, C++, F#, Objective-C, ...).
  // Was `\w*` before, which silently cut '#'/'+' off and pushed it onto the
  // next line as part of the code body (e.g. ```c# → langName 'c', code
  // starting with a stray '#').
  //
  // (?<!`) / (?!`) on both the opening and closing ``` ensure the fence is
  // exactly 3 backticks, never a subset of a longer run. Without this, a
  // run of e.g. 21 backticks in a row got greedily consumed as multiple
  // empty fenced blocks (3+3, 3+3, ...) instead of being left alone -
  // corrupting the output and leaking stray CODEBLOCK placeholders into
  // later inline-code extraction.
  ctx.html = ctx.html.replace(/(?<!`)(`{3,})(?!`)([\w#+.-]*)\n?([\s\S]*?)\n?(?<!`)\1(?!`)/g, (_, fence, langName, code) => {
    const i = ctx.codeBlocks.length;
    ctx.codeBlocks.push({
      langName: langName || null,
      code: code.trimEnd(),
      placeholder: `\x00CODEBLOCK_${i}\x00`
    });
    return ctx.codeBlocks[i].placeholder;
  });
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
      batch.map(block => renderFencedCodeBlock(block.langName, block.code, ctx.theme, ctx.project, ctx.codeBlockCache))
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
  ctx.html = ctx.html.replace(/((?:^[-*] .+$\n?)+)/gm, match => {
    const items = match.trim().split('\n').filter(l => /^[-*] /.test(l));
    return `<ul>${items.map(l => `<li>${l.replace(/^[-*] /, '')}</li>`).join('')}</ul>\n`;
  });
  return ctx;
}

/**
 * Parses ordered lists.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function parseOrderedLists(ctx) {
  ctx.html = ctx.html.replace(/((?:^\d+\. .+$\n?)+)/gm, match => {
    const items = match.trim().split('\n').filter(l => /^\d+\. /.test(l));
    return `<ol>${items.map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('')}</ol>\n`;
  });
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
    .split(/\n\n+/)
    .map(segment => {
      segment = segment.trim();
      if (!segment) return '';

      const isBlock    = /^<(h[1-6]|ul|ol|blockquote|pre|div|table|hr|p)/.test(segment);
      const hasCodeRef = /\x00CODEBLOCK/.test(segment);

      if (isBlock || hasCodeRef) return segment;
      return `<p>${segment.replace(/\n/g, '<br>')}</p>`;
    })
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
 * Parses a Markdown string into HTML using the transform pipeline.
 * @param {string} source - Raw Markdown text
 * @param {Object|null} theme - Optional DocTheme object for context-aware parsing
 * @returns {string} HTML string
 */
export function parseMarkdownSync(source, theme = null, project = null) {
  if (!source) 
    return '';

  const resolvedTheme = theme ?? getPresetDocThemes()?.[0];
  
  let ctx = createContext(source, resolvedTheme, project);
  for (const transform of SYNC_TRANSFORM_PIPELINE) {
    ctx = transform.fn(ctx);
  }

  for (const block of ctx.codeBlocks) {
    const fallback = `<pre><code>${escapeHTML(block.code)}</code></pre>`;
    ctx.html = ctx.html.split(block.placeholder).join(fallback);
  }

  return ctx.html;
}

export async function parseMarkdownAsync(source, theme = null, project = null, codeBlockCache = null) {
  if (!source) 
    return '';
  
  const resolvedTheme = theme ?? getPresetDocThemes()?.[0];
  
  let ctx = createContext(source, resolvedTheme, project, codeBlockCache);
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