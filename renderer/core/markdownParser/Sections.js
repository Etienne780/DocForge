// ─── Sections (::: Title ... :::) ───────────────────────────────────────────────
// A collapsible area around any other elements. `::: Title` opens it, `:::` alone
// closes the innermost open one; sections can be nested, open ones are closed at
// the end of the entry. Starts collapsed, the property `open` starts it open.
// Rendered as <details>, so it toggles without script (preview and export).

const SECTION_LINE_REGEX = /^[ \t]*:::(?!:)[ \t]*(.*?)[ \t]*$/;
const SECTION_OPEN_PLACEHOLDER_REGEX = /^\x06S(\d+)\x06(.*)$/gm;
const SECTION_CLOSE_PLACEHOLDER_REGEX = /^\x06E\x06$/gm;
export const SECTION_CLOSE_HTML = '</div></details>';

/**
 * Replaces the section lines by placeholder lines (title kept as text, so the
 * later transforms escape and format it). A `:::` without an open section stays text.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function extractSections(ctx) {
  if (!ctx.html.includes(':::'))
    return ctx;

  const out = [];
  let depth = 0;

  for (const line of ctx.html.split('\n')) {
    const match = line.match(SECTION_LINE_REGEX);
    if (!match) {
      out.push(line);
      continue;
    }

    if (match[1]) {
      // property block directly above (placeholder line of extractPropertyBlocks)
      const properties = out.length ? out[out.length - 1].match(/^\x03P(\d+)\x03$/) : null;
      if (properties)
        out.pop();
      const props = properties ? ctx.properties[properties[1]]?.props ?? {} : {};
      ctx.sections.push({ open: Boolean(props.open) });
      out.push(`\x06S${ctx.sections.length - 1}\x06${match[1]}`);
      depth++;
    } else if (depth > 0) {
      out.push('\x06E\x06');
      depth--;
    } else {
      out.push(line);
    }
  }

  for (; depth > 0; depth--)
    out.push('\x06E\x06');

  ctx.html = out.join('\n');
  return ctx;
}

/**
 * Turns the section placeholders into <details> (after escape-html, the title
 * is formatted by the inline transforms). Opening and closing tags stay on their
 * own lines, parseParagraphs keeps them out of paragraphs.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function buildSections(ctx) {
  if (!ctx.sections.length)
    return ctx;

  ctx.html = ctx.html
    .replace(SECTION_OPEN_PLACEHOLDER_REGEX, (_, index, title) =>
      `<details class="doc-section"${ctx.sections[Number(index)]?.open ? ' open' : ''}>`
      + `<summary class="doc-section__title">${title}</summary><div class="doc-section__body">`)
    .replace(SECTION_CLOSE_PLACEHOLDER_REGEX, SECTION_CLOSE_HTML);
  return ctx;
}
