import { parsePropertyBlock } from '@core/MarkdownParser.js';

/**
 * EditorStructures - finds the editable structure at the cursor (table, code block, tree block,
 * [toc] or bullet list with the property block above it) and reads / writes its properties.
 *
 * @typedef {Object} EditorStructure
 * @property {'table'|'code'|'tree'|'toc'|'list'} type
 * @property {number} elementStart - first line of the table / the opening fence
 * @property {number} elementEnd   - last line of the table / the closing fence
 * @property {{ start: number, end: number }|null} props - lines of the property block above
 * @property {number} firstLine    - props.start or elementStart (where the edit button sits)
 * @property {{ indent: string, ticks: string, lang: string, rest: string }} [fence] - opening fence of a code block
 */

const TABLE_REGEX = /^[ \t]*\|/;
const TOC_REGEX = /^[ \t]*\[toc\][ \t]*$/i;
const LIST_REGEX = /^[ \t]*[-*] /;
const FENCE_REGEX = /^([ \t]*)(`{3,})([\w#+.-]+(?::[\w#+.-]+)?)?(.*)$/;
const PROPERTY_LINE_REGEX = /^[ \t]*\{(.*)\}[ \t]*$/;
const PROPERTY_OPEN_REGEX = /^[ \t]*\{[ \t]*$/;
const PROPERTY_CLOSE_REGEX = /^[ \t]*\}[ \t]*$/;
const BLANK_REGEX = /^[ \t]*$/;
const MAX_SINGLE_LINE = 80;

/**
 * @param {string[]} lines
 * @param {number} lineIndex - line of the cursor
 * @param {(lineIndex: number) => { fence: string|null, comment: boolean }} getLineState - state at the start of a line
 * @returns {EditorStructure|null}
 */
export function findStructureAt(lines, lineIndex, getLineState) {
  const inFence = i => i < lines.length && Boolean(getLineState(i).fence);

  // cursor in a property block: the element below it
  const block = _propertyBlockAt(lines, lineIndex, inFence);
  if (block)
    return _structureAt(lines, block.end + 1, inFence, block);

  return _structureAt(lines, lineIndex, inFence, null);
}

/**
 * Editable form of a property block.
 * @param {string[]} lines
 * @param {EditorStructure} structure
 * @returns {{ props: Object<string, string|true>, targets: Array<{ type: string, index: string, props: Object }> }}
 */
export function readStructureProperties(lines, structure) {
  const empty = { props: {}, targets: [] };
  if (!structure.props)
    return empty;

  const { start, end } = structure.props;
  const text = start === end
    ? lines[start].match(PROPERTY_LINE_REGEX)?.[1] ?? ''
    : lines.slice(start + 1, end).join('\n');

  const parsed = parsePropertyBlock(text);
  if (!parsed)
    return empty;

  return {
    props: { ...parsed.props },
    targets: parsed.targets.map(target => ({
      type: target.type,
      index: target.type === 'cell'
        ? `${_formatIndexList(target.rows)},${_formatIndexList(target.cols)}`
        : _formatIndexList(target.indices),
      props: { ...target.props },
    })),
  };
}

/**
 * Property block text for the properties ('' without any). Short blocks stay on one line.
 * @param {{ props: Object, targets: Array<{ type: string, index: string, props: Object }> }} properties
 * @param {string} [indent='']
 * @returns {string}
 */
export function formatStructureProperties({ props, targets }, indent = '') {
  const entries = [];
  const list = _formatPropertyList(props);
  if (list)
    entries.push(list);

  for (const target of targets) {
    const targetList = _formatPropertyList(target.props);
    const index = target.index.replace(/[ \t]/g, '');
    if (targetList && index)
      entries.push(`${target.type} ${index}: ${targetList}`);
  }

  if (!entries.length)
    return '';

  const single = `${indent}{${entries.join('; ')}}`;
  if (single.length <= MAX_SINGLE_LINE)
    return single;
  return [`${indent}{`, ...entries.map(entry => `${indent}  ${entry}`), `${indent}}`].join('\n');
}

/**
 * New text for the lines firstLine..elementStart (property block + first element line).
 * @param {EditorStructure} structure
 * @param {string[]} lines
 * @param {string} propertiesText - from formatStructureProperties()
 * @param {string|null} [lang] - new language of a code block (null keeps it)
 */
export function buildStructureHead(structure, lines, propertiesText, lang = null) {
  let elementLine = lines[structure.elementStart];
  if (structure.fence && lang !== null) {
    const { indent, ticks, rest } = structure.fence;
    elementLine = `${indent}${ticks}${lang.trim()}${rest}`;
  }
  return propertiesText ? `${propertiesText}\n${elementLine}` : elementLine;
}

/**
 * @typedef {Object} MarkdownTable
 * @property {string[]} header
 * @property {Array<'left'|'center'|'right'|null>} aligns - from the separator row, one per column
 * @property {string[][]} rows - body rows (property row index = body index + 1)
 */

/**
 * Reads the lines of a table. Rows are padded to the same column count.
 * @param {string[]} tableLines
 * @returns {MarkdownTable}
 */
export function parseMarkdownTable(tableLines) {
  // escaped pipes are shown as '|' in the grid, formatMarkdownTable() escapes them again
  const rows = tableLines.map(line => _splitTableRow(line).map(cell => cell.replace(/\\\|/g, '|')));
  const hasSeparator = rows.length > 1 && rows[1].length && rows[1].every(cell => /^:?-+:?$/.test(cell));
  const separator = hasSeparator ? rows[1] : [];
  const header = rows[0] ?? [];
  const body = rows.slice(hasSeparator ? 2 : 1);

  const columns = Math.max(1, header.length, ...body.map(row => row.length));
  const pad = row => Array.from({ length: columns }, (_, i) => row[i] ?? '');

  return {
    header: pad(header),
    aligns: Array.from({ length: columns }, (_, i) => {
      const cell = separator[i] ?? '';
      const left = cell.startsWith(':');
      const right = cell.endsWith(':') && cell.length > 1;
      return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
    }),
    rows: body.map(pad),
  };
}

/**
 * Markdown of a table with aligned columns.
 * @param {MarkdownTable} table
 * @param {string} [indent='']
 * @returns {string}
 */
export function formatMarkdownTable(table, indent = '') {
  const escape = cells => cells.map(cell => _escapeCell(cell.trim()));
  const header = escape(table.header);
  const rows = table.rows.map(escape);
  const aligns = table.aligns;
  const columns = header.length;
  const widths = Array.from({ length: columns }, (_, col) =>
    Math.max(3, header[col].length, ...rows.map(row => row[col].length)));

  const line = cells => `${indent}| ${cells.map((cell, col) => cell.padEnd(widths[col])).join(' | ')} |`;
  const separator = aligns.map((align, col) => {
    const dashes = '-'.repeat(widths[col] - (align === 'center' ? 2 : align ? 1 : 0));
    if (align === 'center')
      return `:${dashes}:`;
    if (align === 'right')
      return `${dashes}:`;
    return align === 'left' ? `:${dashes}` : dashes;
  });

  return [line(header), line(separator), ...rows.map(line)].join('\n');
}

// ─── Private ─────────────────────────────────────────────────────────────────

/**
 * Cells of a table line like the parser splits them: not at a '|' inside a [[slug|Text]] link
 * or inside inline code, and not at an escaped '\|'.
 */
function _splitTableRow(line) {
  let text = line.trim();
  if (text.startsWith('|'))
    text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|'))
    text = text.slice(0, -1);

  return _splitCells(text).map(cell => cell.trim());
}

/** A '|' typed into a grid cell would split it: escaped where the parser would split. */
function _escapeCell(cell) {
  return _splitCells(cell).join('\\|');
}

function _splitCells(text) {
  const cells = [];
  let cell = '';
  let ticks = '';
  let linkDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '\\' && text[i + 1] === '|') {
      cell += '\\|';
      i++;
    } else if (char === '`') {
      let run = '`';
      while (text[i + 1] === '`') {
        run += '`';
        i++;
      }
      // a code span closes with the same number of backticks
      if (!ticks && text.indexOf(run, i + 1) >= 0)
        ticks = run;
      else if (ticks === run)
        ticks = '';
      cell += run;
    } else if (!ticks && text.startsWith('[[', i)) {
      linkDepth++;
      cell += '[[';
      i++;
    } else if (!ticks && linkDepth && text.startsWith(']]', i)) {
      linkDepth--;
      cell += ']]';
      i++;
    } else if (char === '|' && !ticks && !linkDepth) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells;
}

function _structureAt(lines, lineIndex, inFence, knownProps) {
  if (lineIndex < 0 || lineIndex >= lines.length)
    return null;

  let structure = null;

  // code block: inside the fence, or its opening line
  if (inFence(lineIndex) || (inFence(lineIndex + 1) && FENCE_REGEX.test(lines[lineIndex]))) {
    let start = lineIndex;
    while (start > 0 && inFence(start))
      start--;
    let end = lineIndex;
    while (end + 1 < lines.length && inFence(end + 1))
      end++;

    const [, indent, ticks, lang = '', rest] = lines[start].match(FENCE_REGEX) ?? [];
    if (ticks) {
      const type = lang.toLowerCase() === 'tree' ? 'tree' : 'code';
      structure = { type, elementStart: start, elementEnd: end, fence: { indent, ticks, lang, rest } };
    }
  } else if (TABLE_REGEX.test(lines[lineIndex])) {
    let start = lineIndex;
    while (start > 0 && TABLE_REGEX.test(lines[start - 1]) && !inFence(start - 1))
      start--;
    let end = lineIndex;
    while (end + 1 < lines.length && TABLE_REGEX.test(lines[end + 1]))
      end++;
    structure = { type: 'table', elementStart: start, elementEnd: end };
  } else if (TOC_REGEX.test(lines[lineIndex])) {
    structure = { type: 'toc', elementStart: lineIndex, elementEnd: lineIndex };
  } else if (LIST_REGEX.test(lines[lineIndex])) {
    let start = lineIndex;
    while (start > 0 && LIST_REGEX.test(lines[start - 1]) && !inFence(start - 1))
      start--;
    let end = lineIndex;
    while (end + 1 < lines.length && LIST_REGEX.test(lines[end + 1]))
      end++;
    structure = { type: 'list', elementStart: start, elementEnd: end };
  }

  if (!structure)
    return null;

  structure.props = knownProps ?? _propertyBlockAbove(lines, structure.elementStart, inFence);
  structure.firstLine = structure.props?.start ?? structure.elementStart;
  return structure;
}

/** Property block that ends directly above `lineIndex`. */
function _propertyBlockAbove(lines, lineIndex, inFence) {
  const above = lineIndex - 1;
  if (above < 0 || inFence(above))
    return null;

  const single = lines[above].match(PROPERTY_LINE_REGEX);
  if (single && !single[1].trimStart().startsWith('#'))
    return { start: above, end: above };

  if (!PROPERTY_CLOSE_REGEX.test(lines[above]))
    return null;
  for (let i = above - 1; i >= 0; i--) {
    if (BLANK_REGEX.test(lines[i]))
      return null;
    if (PROPERTY_OPEN_REGEX.test(lines[i]))
      return { start: i, end: above };
  }
  return null;
}

/** Property block (single or multi-line) that contains `lineIndex`. */
function _propertyBlockAt(lines, lineIndex, inFence) {
  if (inFence(lineIndex))
    return null;

  const single = lines[lineIndex].match(PROPERTY_LINE_REGEX);
  if (single && !single[1].trimStart().startsWith('#'))
    return { start: lineIndex, end: lineIndex };

  let start = -1;
  for (let i = lineIndex; i >= 0; i--) {
    if (PROPERTY_OPEN_REGEX.test(lines[i])) {
      start = i;
      break;
    }
    if (BLANK_REGEX.test(lines[i]) || (i < lineIndex && PROPERTY_CLOSE_REGEX.test(lines[i])))
      return null;
  }
  if (start < 0)
    return null;

  for (let i = Math.max(lineIndex, start + 1); i < lines.length; i++) {
    if (PROPERTY_CLOSE_REGEX.test(lines[i]))
      return { start, end: i };
    if (BLANK_REGEX.test(lines[i]))
      return null;
  }
  return null;
}

/** [1, 3, 4, 5] -> '1,3-5' */
function _formatIndexList(indices) {
  const sorted = [...indices].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1)
      i++;
    parts.push(from === sorted[i] ? `${from}` : `${from}-${sorted[i]}`);
  }
  return parts.join(',');
}

/** { hl: true, width: '120', label: 'A B' } -> 'hl width=120 label="A B"' */
function _formatPropertyList(props) {
  return Object.entries(props)
    .filter(([, value]) => value !== false && value !== null && value !== undefined && value !== '')
    .map(([name, value]) => {
      if (value === true)
        return name;
      const text = String(value);
      return /^[^\s;"]+$/.test(text) ? `${name}=${text}` : `${name}="${text.replace(/"/g, '')}"`;
    })
    .join(' ');
}
