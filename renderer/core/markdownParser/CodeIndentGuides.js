// ─── Indent guides ({indent=4} / {indent=tab}) ────────────────────────────────

const MAX_INDENT_WIDTH = 16;

// tag | entity | text | stray '<' / '&' (kept as text)
const HTML_PART_REGEX = /<[^>]*>|&[^;\s<&]*;|[^<&]+|[<&]/g;

/**
 * Width of one indent level in spaces. `indent` alone = 4, `indent=tab` = the
 * project tab size (spaces the Tab key inserts in the editor). A real tab is
 * always one level.
 * @param {string|true|undefined} value
 * @returns {number|null} null when off or invalid
 */
export function parseIndentProperty(value, tabSize) {
  if (value === true)
    return 4;
  if (value === 'tab')
    return tabSize;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const width = Number(value);
    if (width >= 1 && width <= MAX_INDENT_WIDTH)
      return width;
  }
  return null;
}

/**
 * Offsets of the first character of every complete indent level in the leading
 * whitespace of a line. A tab is always one level.
 * @param {string} ws - leading spaces / tabs
 * @param {number} unit - spaces per level
 * @returns {{ starts: number[], complete: boolean }} complete: no partial level at the end
 */
function getIndentLevelStarts(ws, unit) {
  const starts = [];
  let spaces = 0;
  let levelStart = 0;

  for (let i = 0; i < ws.length; i++) {
    if (ws[i] === '\t') {
      // a tab after a partial level: the columns no longer match the levels
      if (spaces > 0)
        break;
      starts.push(i);
      continue;
    }

    if (spaces === 0)
      levelStart = i;
    if (++spaces === unit) {
      starts.push(levelStart);
      spaces = 0;
    }
  }

  return { starts, complete: spaces === 0 };
}

/**
 * Leading whitespace of every displayed line of a rendered <pre>. Lines end at
 * '\n' and between the line groups (<div>) of diff blocks.
 * @param {string} preHtml
 * @returns {{ ws: string, blank: boolean }[]}
 */
function scanCodeLines(preHtml) {
  const lines = [{ ws: '', blank: true }];
  let inWs = true;
  let groupSeen = false;

  const newLine = () => {
    lines.push({ ws: '', blank: true });
    inWs = true;
  };

  for (const [part] of preHtml.matchAll(HTML_PART_REGEX)) {
    const line = () => lines[lines.length - 1];

    if (part[0] === '<') {
      if (/^<div\b/.test(part)) {
        if (groupSeen)
          newLine();
        groupSeen = true;
      }
      continue;
    }

    if (part[0] === '&') {
      // &nbsp; is the placeholder of empty diff lines
      if (part !== '&nbsp;')
        line().blank = false;
      inWs = false;
      continue;
    }

    for (const ch of part) {
      if (ch === '\n') {
        newLine();
      } else if (ch === ' ' || ch === '\t') {
        if (inWs)
          line().ws += ch;
      } else {
        inWs = false;
        if (ch !== ' ')
          line().blank = false;
      }
    }
  }

  return lines;
}

/**
 * Guides per line: offsets of real whitespace characters that get a guide and
 * the whitespace of the guides without characters on blank lines.
 * A blank line shows its own indentation. Missing levels are added like the
 * deeper neighbour line, but at most one level deeper than the line below when
 * the line above is deeper (end of a block). They take the whitespace of that
 * neighbour, so tabs and spaces line up like there.
 */
function computeIndentGuides(lines, unit) {
  const info = lines.map(line => getIndentLevelStarts(line.ws, unit));
  // whitespace of every level of a non-blank line
  const levelTexts = lines.map((line, i) => {
    const { starts } = info[i];
    return starts.map((start, k) =>
      line.ws.slice(start, starts[k + 1] ?? start + (line.ws[start] === '\t' ? 1 : unit)));
  });

  const nextContent = new Array(lines.length).fill(null);
  let next = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    nextContent[i] = next;
    if (!lines[i].blank)
      next = i;
  }

  let prev = null;
  return lines.map((line, i) => {
    const { starts, complete } = info[i];
    if (!line.blank) {
      prev = i;
      return { starts: new Set(starts), virtual: [] };
    }

    const above = prev === null ? [] : levelTexts[prev];
    const below = nextContent[i] === null ? [] : levelTexts[nextContent[i]];
    const source = above.length < below.length ? below : above;
    const target = Math.min(source.length, below.length + 1);
    const virtual = complete ? source.slice(starts.length, target) : [];
    return { starts: new Set(starts), virtual };
  });
}

/**
 * Wraps the first whitespace character of every indent level in a
 * .code-indent-guide span (vertical line on its left edge). Blank lines get empty
 * guide spans that show the whitespace through ::before (not part of the text).
 * @param {string} preHtml
 * @param {number} unit - spaces per level
 * @returns {string}
 */
export function addIndentGuides(preHtml, unit) {
  const guides = computeIndentGuides(scanCodeLines(preHtml), unit);
  const guideOpen = '<span class="code-indent-guide">';
  const virtualHtml = ws => `<span class="code-indent-guide code-indent-guide--virtual" data-ws="${ws}"></span>`;

  const out = [];
  let lineIndex = 0;
  let column = 0;
  let inWs = true;
  let groupSeen = false;
  let virtualDone = false;

  const endLine = () => {
    if (!virtualDone && guides[lineIndex]?.virtual.length)
      out.push(guides[lineIndex].virtual.map(virtualHtml).join(''));
    virtualDone = true;
  };
  const newLine = () => {
    lineIndex++;
    column = 0;
    inWs = true;
    virtualDone = false;
  };

  for (const [part] of preHtml.matchAll(HTML_PART_REGEX)) {
    if (part[0] === '<') {
      if (/^<div\b/.test(part)) {
        if (groupSeen)
          newLine();
        groupSeen = true;
      } else if (/^<\/(div|pre|code)\b/.test(part)) {
        endLine();
      }
      out.push(part);
      continue;
    }

    if (part[0] === '&') {
      // the guides of an empty diff line go in front of its &nbsp;
      if (part === '&nbsp;')
        endLine();
      inWs = false;
      out.push(part);
      continue;
    }

    let text = '';
    for (const ch of part) {
      if (ch === '\n') {
        out.push(text);
        text = '';
        endLine();
        out.push(ch);
        newLine();
        continue;
      }

      if (inWs && (ch === ' ' || ch === '\t')) {
        if (guides[lineIndex]?.starts.has(column)) {
          text += `${guideOpen}${ch}</span>`;
        } else {
          text += ch;
        }
        column++;
        continue;
      }

      if (ch === ' ') {
        out.push(text);
        text = '';
        endLine();
      }
      inWs = false;
      text += ch;
    }
    out.push(text);
  }

  return out.join('');
}
