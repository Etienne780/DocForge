// ─── Tables ───────────────────────────────────────────────────────────────────

// No style attributes: the app's CSP (style-src) blocks them in the preview.
// align/line become classes, width the html width attribute (px or %).
export const TABLE_HOVER_TYPES = ['cell', 'row', 'col'];
export const TABLE_STRIPE_TYPES = ['row', 'col'];
export const TABLE_ALIGNS = ['left', 'center', 'right'];
const TABLE_WIDTH_REGEX = /^(\d+)(?:px)?$|^(\d+%)$/;
export const MAX_TABLE_LINE_WIDTH = 10;

/** ':---' / '---:' / ':---:' of the separator row -> text-align */
function getSeparatorAlign(cell) {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right)
    return 'center';
  if (right)
    return 'right';
  return left ? 'left' : null;
}

/** line=3 -> 3 (px, 1 - MAX_TABLE_LINE_WIDTH), null if invalid */
function parseTableLineWidth(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1)
    return null;
  return Math.min(Number(value), MAX_TABLE_LINE_WIDTH);
}

/** width=120 / 120px / 20% -> value of the width attribute, null if invalid */
function parseTableWidth(value) {
  const match = typeof value === 'string' ? value.match(TABLE_WIDTH_REGEX) : null;
  return match ? (match[1] ?? match[2]) : null;
}

/**
 * Resolves the property targets of a table into per row/col/cell lookups.
 * Rows are counted from the header (row 0), cols from the left (col 0).
 * @param {BlockProperties|null} properties
 * @param {(string|null)[]} colAligns - from the separator row
 */
function createTableLayout(properties, colAligns) {
  const rowHl = new Set();
  const colHl = new Set();
  const cellHl = new Set();
  const rowLine = new Map();
  const colLine = new Map();
  const colWidth = new Map();
  const colAlign = new Map(colAligns.map((align, col) => [col, align]));
  const cellAlign = new Map();

  for (const { type, indices, rows, cols, props } of properties?.targets ?? []) {
    const line = parseTableLineWidth(props.line);
    const align = TABLE_ALIGNS.includes(props.align) ? props.align : null;

    if (type === 'row') {
      for (const row of indices) {
        if (props.hl) rowHl.add(row);
        if (line !== null) rowLine.set(row, line);
      }
    } else if (type === 'col') {
      const width = parseTableWidth(props.width);
      for (const col of indices) {
        if (props.hl) colHl.add(col);
        if (line !== null) colLine.set(col, line);
        if (width !== null) colWidth.set(col, width);
        if (align) colAlign.set(col, align);
      }
    } else {
      for (const row of rows) {
        for (const col of cols) {
          if (props.hl) cellHl.add(`${row},${col}`);
          if (align) cellAlign.set(`${row},${col}`, align);
        }
      }
    }
  }

  const hover = String(properties?.props.hover === true ? 'cell' : properties?.props.hover ?? '')
    .split(',')
    .map(h => h.trim())
    .filter(h => TABLE_HOVER_TYPES.includes(h));

  // `striped` alone stripes the rows
  const striped = String(properties?.props.striped === true ? 'row' : properties?.props.striped ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(s => TABLE_STRIPE_TYPES.includes(s));

  return {
    tableAttrs() {
      const attrs = [];
      if (striped.length)
        attrs.push(` data-striped="${striped.join(' ')}"`);
      if (hover.length)
        attrs.push(` data-hover="${hover.join(' ')}"`);
      return attrs.join('');
    },

    rowAttrs(row) {
      return rowHl.has(row) ? ' class="tbl-hl-row"' : '';
    },

    cellAttrs(row, col) {
      const classes = [];
      if (colHl.has(col)) classes.push('tbl-hl-col');
      if (cellHl.has(`${row},${col}`)) classes.push('tbl-hl-cell');

      const align = cellAlign.get(`${row},${col}`) ?? colAlign.get(col);
      if (align) classes.push(`tbl-align-${align}`);
      if (rowLine.has(row)) classes.push(`tbl-line-b-${rowLine.get(row)}`);
      if (colLine.has(col)) classes.push(`tbl-line-r-${colLine.get(col)}`);

      return (classes.length ? ` class="${classes.join(' ')}"` : '')
        + (row === 0 && colWidth.has(col) ? ` width="${colWidth.get(col)}"` : '');
    },
  };
}

/**
 * Parses markdown tables into HTML tables, with the property block above
 * (\x03P<i>\x03 placeholder line) if there is one.
 * @param {ParseContext} ctx
 * @returns {ParseContext}
 */
export function parseTables(ctx) {
  ctx.html = ctx.html.replace(
    /(?:^\x03P(\d+)\x03\n)?((?:\|[^\n]+\|\n)+\|[-| :]+\|\n(?:\|[^\n]+\|\n?)*)/gm,
    (match, propertiesIndex, table) => {
      const rows = table.trim().split('\n');
      if (rows.length < 3) return match;

      const parseRow = row => {
        // a '|' followed by ']]' without '[' in between belongs to a [[slug|Text]] link,
        // an escaped '\|' is a pipe inside the cell
        const cells = row.split(/(?<!\\)\|(?![^[\n]*\]\])/).map(c => c.trim().replace(/\\\|/g, '|'));

        const start = cells[0] === '' ? 1 : 0;
        const end = cells[cells.length - 1] === '' ? cells.length - 1 : cells.length;
        return cells.slice(start, end);
      };

      const properties = propertiesIndex !== undefined ? ctx.properties[propertiesIndex] : null;
      const layout = createTableLayout(properties, parseRow(rows[1]).map(getSeparatorAlign));

      const buildRow = (cells, row, tag) =>
        `<tr${layout.rowAttrs(row)}>${cells.map((c, col) => `<${tag}${layout.cellAttrs(row, col)}>${c}</${tag}>`).join('')}</tr>`;

      const headerHTML = buildRow(parseRow(rows[0]), 0, 'th');
      const bodyHTML = rows.slice(2)
        .map((row, i) => buildRow(parseRow(row), i + 1, 'td'))
        .join('');

      const trailingNewline = table.endsWith('\n') ? '\n' : '';
      return `<div class="table-wrapper"><table${layout.tableAttrs()}><thead>${headerHTML}</thead><tbody>${bodyHTML}</tbody></table></div>${trailingNewline}`;
    }
  );
  return ctx;
}
