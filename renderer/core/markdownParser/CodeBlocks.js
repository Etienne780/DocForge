import { getLanguageStyleId } from '@data/DocThemeManager.js';
import { findSyntaxDefinitionByName } from '@data/SyntaxDefinitionManager.js';
import { HIGHLIGHTER_WORKER_POOL_SIZE } from '@core/syntaxHighlighter/Constants.js'
import { hashString, escapeHTML } from '@common/Common.js';
import { FENCED_CODE_REGEX, addLineAttribute } from './ParserUtils.js';
import { parsePropertyBlock } from './Properties.js';
import { getDiffLineNumbers, splitCodeblockDiff, buildDiffBodyHtml, buildPlainDiffLines } from './CodeDiff.js';
import { isTreeBlock, buildTreeHTML } from './CodeTree.js';
import { parseIndentProperty, addIndentGuides } from './CodeIndentGuides.js';

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

// ─── Code blocks ──────────────────────────────────────────────────────────────

function buildLanguageTagHTML(langName, recognized) {
  const cls = recognized
    ? 'code-language-tag code-language-tag--recognized'
    : 'code-language-tag code-language-tag--unrecognized';
  return `<div class="${cls}">${escapeHTML(langName)}</div>`;
}

const CODE_COPY_HTML = '<div class="code-copy"><button type="button" class="code-copy-btn">Copy</button></div>';

/**
 * Wraps the rendered code (<pre>) with the language tag and the properties of
 * the block: copy (copy button), label="Text" / label=none (tag text), numbers,
 * indent=4 / indent=tab (indent guides).
 * Kept out of the highlight cache, so changing a property doesn't re-highlight.
 * @param {string} preHtml
 * @param {Object} block - entry of ctx.codeBlocks
 * @param {boolean|null} recognized - language known; null without a language
 * @param {number} tabSize - project tab size (code-tab-N class, indent=tab)
 * @returns {string}
 */
function buildCodeBlockHTML(preHtml, block, recognized, tabSize) {
  const props = block.properties?.props ?? {};
  const label = typeof props.label === 'string' ? props.label : null;
  const tagText = label === 'none' ? null : (label ?? block.langName);

  // width of a tab character in the <pre> (rules in buildBaseCSS)
  const classes = ['code-block-wrapper', `code-tab-${tabSize}`];
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

  const indentUnit = parseIndentProperty(props.indent, tabSize);
  const body = indentUnit ? addIndentGuides(preHtml, indentUnit) : preHtml;

  const copy = props.copy ? CODE_COPY_HTML : '';
  const tag = tagText ? buildLanguageTagHTML(tagText, recognized ?? true) : '';
  return `<div class="${classes.join(' ')}">${copy}${numbers}${body}${tag}</div>`;
}

async function renderFencedCodeBlock(block, ctx) {
  if (isTreeBlock(block))
    return buildTreeHTML(block.code, block.properties?.props ?? {}, ctx.tabSize);

  const { html, recognized } = await renderCodeBlockBody(block, ctx);
  return buildCodeBlockHTML(html, block, recognized, ctx.tabSize);
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

/**
 * Extracts fenced code blocks and replaces them with placeholders.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function extractFencedCode(ctx) {
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

/**
 * Extracts inline code spans and replaces them with placeholders.
 * Properties directly in front ({lang=cpp}`code`) select the language;
 * a {...} that isn't valid property syntax stays text.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function extractInlineCode(ctx) {
  ctx.html = ctx.html.replace(/(\{[^{}\n]*\})?(`+)([^\n]*?)\2(?!`)/g, (_, propsText, ticks, code) => {
    const properties = propsText ? parsePropertyBlock(propsText.slice(1, -1)) : null;
    const langName = typeof properties?.props.lang === 'string' ? properties.props.lang : null;

    const i = ctx.inlineCodes.length;
    ctx.inlineCodes.push({ code, langName });
    return `${properties ? '' : propsText ?? ''}\x00INLINECODE${i}\x00`;
  });
  return ctx;
}

export async function restoreCodeBlocksAsync(ctx) {
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
