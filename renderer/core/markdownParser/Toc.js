import { escapeHTML } from '@common/Common.js';
import { FOOTNOTE_REF_HTML_REGEX } from './Footnotes.js';

// ─── Table of contents ([toc]) ─────────────────────────────────────────────────

const TOC_LINE_REGEX = /^(?:\x03P(\d+)\x03\n)?[ \t]*\[toc\][ \t]*$/gim;
const TOC_PLACEHOLDER_REGEX = /^\x04TOC(\d+)\x04$/gm;
export const TOC_STYLES = ['card', 'tree', 'outline', 'leader'];
const HEADING_TAG_REGEX = /<(h[1-4])>([\s\S]*?)<\/\1>/g;

/**
 * Replaces a `[toc]` line (with its property block) by a placeholder line,
 * resolved by buildTocs once the headings are rendered.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function extractTocs(ctx) {
  ctx.html = ctx.html.replace(TOC_LINE_REGEX, (_, propertiesIndex) => {
    ctx.tocs.push(propertiesIndex !== undefined ? ctx.properties[propertiesIndex] : null);
    return `\x04TOC${ctx.tocs.length - 1}\x04`;
  });
  return ctx;
}

/**
 * Gives every heading an id (`h-<nodeId>-<slug>`, unique per entry) and
 * builds the [toc] blocks: the headings after the block, nested by level.
 * Properties: depth=N (up to hN), title="Text", numbered.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function buildTocs(ctx) {
  const used = new Map();
  const headings = [];

  // offsets refer to the html before the ids are added
  const source = ctx.html;
  ctx.html = source.replace(HEADING_TAG_REGEX, (match, tag, inner, offset) => {
    const text = inner.replace(FOOTNOTE_REF_HTML_REGEX, '').replace(/<[^>]*>/g, '').trim();
    const slug = text.toLowerCase().replace(/&[a-z#0-9]+;/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'heading';
    const count = used.get(slug) ?? 0;
    used.set(slug, count + 1);
    const id = `h-${ctx.nodeId ?? 'node'}-${slug}${count ? `-${count + 1}` : ''}`;
    headings.push({ level: Number(tag[1]), html: text, id, offset });
    return `<${tag} id="${id}">${inner}</${tag}>`;
  });

  if (!ctx.tocs.length)
    return ctx;

  ctx.html = ctx.html.replace(TOC_PLACEHOLDER_REGEX, (_, index) => {
    const props = ctx.tocs[Number(index)]?.props ?? {};
    const position = source.indexOf(`\x04TOC${index}\x04`);
    const depth = Math.min(Math.max(parseInt(props.depth, 10) || 4, 1), 4);
    const items = headings.filter(h => h.offset > position && h.level <= depth);
    return buildTocHTML(items, {
      title: typeof props.title === 'string' ? props.title : null,
      numbered: Boolean(props.numbered),
      style: TOC_STYLES.includes(props.style) ? props.style : TOC_STYLES[0],
    });
  });

  return ctx;
}

/**
 * Nested list of the headings (levels relative to the highest one), on one line.
 * Every style is a .doc-toc--<style> class (CSS in HtmlBuilder); 'outline' and
 * `numbered` show the numbers (1, 1.1, 1.1.1), 'leader' a dotted line + arrow.
 * @param {{ level: number, html: string, id: string }[]} items
 * @param {{ title: string|null, numbered: boolean, style: string }} options
 * @returns {string}
 */
function buildTocHTML(items, { title, numbered, style }) {
  const showNumbers = numbered || style === 'outline';
  const classes = `doc-toc doc-toc--${style}${showNumbers ? ' doc-toc--numbered' : ''}`;
  const titleHTML = title ? `<div class="doc-toc__title">${escapeHTML(title)}</div>` : '';
  if (!items.length)
    return `<div class="${classes} doc-toc--empty">${titleHTML}<span class="doc-toc__empty">No headings below.</span></div>`;

  const base = Math.min(...items.map(h => h.level));
  const counters = [];
  let html = '';
  let depth = 0;     // open lists
  let open = false;  // open <li> at the current depth

  for (const { level, html: text, id } of items) {
    const target = level - base + 1;
    while (depth < target) {
      html += '<ul class="doc-toc__list">';
      depth++;
      open = false;
    }
    while (depth > target) {
      html += '</li></ul>';
      depth--;
      open = true;
    }
    if (open)
      html += '</li>';

    counters.length = depth;
    counters[depth - 1] = (counters[depth - 1] ?? 0) + 1;
    const number = showNumbers ? `<span class="doc-toc__num">${counters.map(n => n ?? 1).join('.')}</span>` : '';
    const leader = style === 'leader' ? '<span class="doc-toc__leader"></span><span class="doc-toc__arrow">→</span>' : '';
    html += `<li><a class="doc-toc__link" href="#${id}" data-toc-target="${id}">${number}<span class="doc-toc__text">${text}</span>${leader}</a>`;
    open = true;
  }
  while (depth > 0) {
    html += '</li></ul>';
    depth--;
  }

  return `<div class="${classes}">${titleHTML}${html}</div>`;
}
