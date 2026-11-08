import { escapeHTML } from '@common/Common.js';
import {
  LINK_USAGE_REGEX,
  LINK_ANCHOR_REGEX,
  findLinkBySlug,
  getLinkStatus,
  getLinkAnchorElementId,
  findNodeInProject,
} from '@data/LinkManager.js';

// ─── Inline formatting & links ────────────────────────────────────────────────

/**
 * Parses inline formatting: bold, italic, bold+italic.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function parseInlineFormatting(ctx) {
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
export function parseLinks(ctx) {
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
export function parseLinkAnchors(ctx) {
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
export function parseReferenceLinks(ctx) {
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
