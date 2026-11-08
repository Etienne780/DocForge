import { escapeHTML } from '@common/Common.js';

// ─── Footnotes ([^label]) ─────────────────────────────────────────────────────
// [^label] in the text, [^label]: text as its own line anywhere in the entry.
// Numbered 1, 2, 3 in the order of first use; the list of used footnotes is
// appended at the end. Unused definitions are not shown, references without a
// definition are marked. The text of a footnote is formatted like the rest
// (it stays in the html until the inline transforms ran).

const FOOTNOTE_DEF_REGEX = /^\[\^([^\]\s]+)\]:[ \t]*(.*)$/gm;
// the definition line (with the line marker in front and one blank line after it)
const FOOTNOTE_LINE_REGEX = /^(?:\x01L\d+\x01\n\n)?\x05FN(\d+)\x05(.*)(?:\n(?:[ \t]*\n)?|$)/gm;
const FOOTNOTE_REF_REGEX = /\[\^([^\]\s]+)\](?!:)/g;
export const FOOTNOTE_REF_HTML_REGEX = /<sup class="fn-ref[^"]*"[^>]*>[\s\S]*?<\/sup>/g;

/**
 * Marks the definition lines with a \x05FN<i>\x05 prefix (label in ctx.footnoteLabels).
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function extractFootnoteDefinitions(ctx) {
  if (!ctx.html.includes('[^'))
    return ctx;

  ctx.html = ctx.html.replace(FOOTNOTE_DEF_REGEX, (_, label, text) => {
    ctx.footnoteLabels.push(label);
    return `\x05FN${ctx.footnoteLabels.length - 1}\x05${text}`;
  });
  return ctx;
}

/**
 * Removes the definition lines and replaces the references by numbers.
 * The list goes into ctx.footnotesHTML (appendFootnotes).
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function buildFootnotes(ctx) {
  if (!ctx.html.includes('[^') && !ctx.footnoteLabels.length)
    return ctx;

  // label -> html of the text, the first definition wins
  const texts = new Map();
  ctx.html = ctx.html.replace(FOOTNOTE_LINE_REGEX, (_, index, text) => {
    const label = ctx.footnoteLabels[Number(index)];
    if (!texts.has(label))
      texts.set(label, text.trim());
    return '';
  });

  const prefix = `fn-${ctx.nodeId ?? 'node'}-`;
  const idOf = label => prefix + label.replace(/[^\w-]/g, '-');
  // plain text for the tooltip: no tags, inline code as its text
  const tooltipOf = html => html
    .replace(/\x00INLINECODE(\d+)\x00/g, (_, i) => escapeHTML(ctx.inlineCodes[i]?.code ?? ''))
    .replace(/<[^>]*>/g, '')
    .replace(/"/g, '&quot;');

  const order = [];
  ctx.html = ctx.html.replace(FOOTNOTE_REF_REGEX, (match, label) => {
    if (!texts.has(label))
      return `<sup class="fn-ref fn-ref--missing" title="No definition [^${label.replace(/"/g, '&quot;')}]: found">${match}</sup>`;

    let number = order.indexOf(label) + 1;
    const first = number === 0;
    if (first) {
      order.push(label);
      number = order.length;
    }
    const id = idOf(label);
    return `<sup class="fn-ref"${first ? ` id="${id}-ref"` : ''}>`
      + `<a class="fn-ref__link" href="#${id}" data-toc-target="${id}" data-fn-text="${tooltipOf(texts.get(label))}">${number}</a></sup>`;
  });

  if (order.length) {
    const items = order.map(label => {
      const id = idOf(label);
      return `<li id="${id}">${texts.get(label)}`
        + `<a class="doc-footnotes__back" href="#${id}-ref" data-toc-target="${id}-ref" aria-label="Back to the text">↩</a></li>`;
    });
    ctx.footnotesHTML = `<section class="doc-footnotes"><ol class="doc-footnotes__list">${items.join('')}</ol></section>`;
  }
  return ctx;
}

/**
 * Appends the footnote list at the end of the entry.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function appendFootnotes(ctx) {
  if (ctx.footnotesHTML)
    ctx.html += `\n${ctx.footnotesHTML}`;
  return ctx;
}
