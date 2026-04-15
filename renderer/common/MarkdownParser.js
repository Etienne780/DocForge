import { escapeHTML } from './Common.js';

/**
 * @typedef {Object} ParseContext
 * @property {string}   html         - Current HTML string being transformed
 * @property {string[]} codeBlocks   - Extracted fenced code block HTML strings
 * @property {string[]} inlineCodes  - Extracted inline code HTML strings
 * @property {Object|null} theme     - Optional DocTheme object for context-aware parsing
 */

/**
 * Creates a new parse context.
 * @param {string} source - Raw markdown source
 * @param {Object|null} theme - Optional DocTheme object
 * @returns {ParseContext}
 */
function createContext(source, theme = null) {
  return {
    html: source,
    codeBlocks: [],
    inlineCodes: [],
    theme: theme,
  };
}


// ─── Transform Functions ──────────────────────────────────────────────────────

/**
 * Extracts fenced code blocks and replaces them with placeholders.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function extractFencedCode(ctx) {
  ctx.html = ctx.html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const i = ctx.codeBlocks.length;
    const escapedCode = escapeHTML(code.trimEnd());
    const langTag = lang
      ? `<div class="code-language-tag">${escapeHTML(lang)}</div>`
      : '';
    ctx.codeBlocks.push(
      `<div class="code-block-wrapper"><pre><code>${escapedCode}</code></pre>${langTag}</div>`
    );
    return `\x00CODEBLOCK${i}\x00`;
  });
  return ctx;
}

/**
 * Extracts inline code spans and replaces them with placeholders.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function extractInlineCode(ctx) {
  ctx.html = ctx.html.replace(/`([^`\n]+)`/g, (_, code) => {
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

      const parseRow = row =>
        row.split('|').map(c => c.trim()).filter(Boolean);

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
    .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g,    '<em>$1</em>')
    .replace(/_([^_\n]+?)_/g,      '<em>$1</em>');
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
  if (!ctx.theme) return ctx;

  // Example: read a theme value (e.g. 'typography-heading')
  // In practice you would import getThemeValue from DocThemeManager
  const headingStyle = ctx.theme?.settings?.entries?.find(e => e.name === 'typography-heading')?.value;
  if (headingStyle && headingStyle !== 'system') {
    // Add a class to all h1-h4
    ctx.html = ctx.html.replace(/<(h[1-4])>/g, `<${headingStyle === 'serif' ? '<$1 class="heading-serif"' : '<$1 class="heading-mono"'}`);
  }
  return ctx;
}

/**
 * Restores code block and inline code placeholders with their actual HTML.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
function restorePlaceholders(ctx) {
  ctx.codeBlocks.forEach((block, i) => {
    ctx.html = ctx.html.split(`\x00CODEBLOCK${i}\x00`).join(block);
  });
  ctx.inlineCodes.forEach((code, i) => {
    ctx.html = ctx.html.split(`\x00INLINECODE${i}\x00`).join(code);
  });
  return ctx;
}


// ─── Transform Pipeline ───────────────────────────────────────────────────────

/**
 * Pipeline of transform functions executed in order.
 * @type {Array<{name: string, fn: function(ParseContext): ParseContext}>}
 */
const TRANSFORM_PIPELINE = [
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
  { name: 'restore-placeholders',  fn: restorePlaceholders    },
];


// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parses a Markdown string into HTML using the transform pipeline.
 * @param {string} source - Raw Markdown text
 * @param {Object|null} theme - Optional DocTheme object for context-aware parsing
 * @returns {string} HTML string
 */
export function parseMarkdown(source, theme = null) {
  if (!source) return '';

  let ctx = createContext(source, theme);
  for (const transform of TRANSFORM_PIPELINE) {
    ctx = transform.fn(ctx);
  }
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
    const idx = TRANSFORM_PIPELINE.findIndex(t => t.name === pos.before);
    if (idx !== -1) { TRANSFORM_PIPELINE.splice(idx, 0, entry); return; }
  }

  if (pos.after) {
    const idx = TRANSFORM_PIPELINE.findIndex(t => t.name === pos.after);
    if (idx !== -1) { TRANSFORM_PIPELINE.splice(idx + 1, 0, entry); return; }
  }

  // Default: insert before restore so placeholders still work
  const restoreIdx = TRANSFORM_PIPELINE.findIndex(t => t.name === 'restore-placeholders');
  TRANSFORM_PIPELINE.splice(restoreIdx, 0, entry);
}

/**
 * Removes a transform from the pipeline by name.
 * @param {string} name
 */
export function removeTransform(name) {
  const idx = TRANSFORM_PIPELINE.findIndex(t => t.name === name);
  if (idx !== -1) TRANSFORM_PIPELINE.splice(idx, 1);
}

/**
 * Returns a snapshot of the current pipeline (names only).
 * Useful for debugging.
 * @returns {string[]}
 */
export function getPipelineNames() {
  return TRANSFORM_PIPELINE.map(t => t.name);
}