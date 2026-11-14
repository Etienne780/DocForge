import { escapeHTML } from '@common/Common.js';
import { FENCED_CODE_REGEX, ESCAPE_REGEX } from './ParserUtils.js';

// Backslash escapes: `\*` shows a `*` that starts no formatting, `\#` at the line
// start no heading, `\<!--` no comment, `\|` no table cell, `\{` no property block, ...
//
// `escapes` runs right after `comments` (before any other syntax is found) and
// replaces every escape outside of code by \x07 + a private use character
// (U+E000 + char code). The placeholder is no letter, digit, whitespace or Markdown
// syntax, so no transform reacts to it and heading ids skip it. `restore-escapes`
// turns it back into the HTML-escaped character as the last transform.

const PLACEHOLDER_OFFSET = 0xE000;
const ESCAPE_PLACEHOLDER_REGEX = /\x07([-])/g;

// fenced code | inline code | escape, so escapes are only found outside of code
// (the inline code backreference is \4 because of the three fence groups)
const ESCAPE_SCAN_REGEX = new RegExp(`${FENCED_CODE_REGEX.source}|(\`+)[^\\n]*?\\4(?!\`)|${ESCAPE_REGEX.source}`, 'g');

/**
 * Replaces backslash escapes outside of code by placeholders.
 * @param {import('./MarkdownParser.js').ParseContext} ctx
 * @returns {import('./MarkdownParser.js').ParseContext}
 */
export function extractEscapes(ctx) {
  if (!ctx.html.includes('\\'))
    return ctx;

  ctx.html = ctx.html.replace(ESCAPE_SCAN_REGEX, (match, fence, lang, code, ticks, escaped) =>
    escaped === undefined ? match : `\x07${String.fromCharCode(PLACEHOLDER_OFFSET + escaped.charCodeAt(0))}`);
  return ctx;
}

/**
 * Turns the escape placeholders back into their (HTML-escaped) characters.
 * @param {import('./MarkdownParser.js').ParseContext} ctx
 * @returns {import('./MarkdownParser.js').ParseContext}
 */
export function restoreEscapes(ctx) {
  ctx.html = ctx.html.replace(ESCAPE_PLACEHOLDER_REGEX, (_, char) =>
    escapeHTML(String.fromCharCode(char.charCodeAt(0) - PLACEHOLDER_OFFSET)));
  return ctx;
}
