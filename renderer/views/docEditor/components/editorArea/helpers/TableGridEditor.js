import { escapeHTML } from '@common/Common.js';

const ALIGN_CYCLE = [null, 'left', 'center', 'right'];
const ALIGN_LABEL = { left: 'L', center: 'C', right: 'R' };
const ARROW_STEPS = {
  ArrowUp:    { row: -1, col: 0 },
  ArrowDown:  { row: 1,  col: 0 },
  ArrowLeft:  { row: 0,  col: -1 },
  ArrowRight: { row: 0,  col: 1 },
};

/**
 * TableGridEditor - edits a Markdown table as a grid of inputs (inside the table property modal).
 *
 * Body rows can be moved, inserted and deleted, columns moved, inserted, deleted and aligned.
 * The grid scrolls inside its own box; after a change the scroll position stays and the
 * affected row / column is scrolled into view.
 *
 * Every change of the structure calls onReorder({ row, col }) with index maps of the property
 * indices (row 0 = header, body row b = b + 1; null = deleted), so row / col / cell targets can follow.
 */
export class TableGridEditor {
  /**
   * @param {HTMLElement} container
   * @param {import('./EditorStructures.js').MarkdownTable} table
   * @param {{ onReorder?: (maps: { row: (index: number) => number|null, col: (index: number) => number|null }) => void }} [options]
   */
  constructor(container, table, { onReorder = () => {} } = {}) {
    this._container = container;
    this._onReorder = onReorder;
    this._header = [...table.header];
    this._aligns = [...table.aligns];
    this._rows = table.rows.map(row => [...row]);
    this._changed = false;

    container.innerHTML = `
      <div class="table-grid__scroll" data-grid-scroll></div>
      <div class="table-grid__toolbar">
        <button class="button button--secondary" data-grid-action="row-append">+ Row</button>
        <button class="button button--secondary" data-grid-action="col-append">+ Column</button>
        <span class="table-grid__size" data-grid-size></span>
      </div>`;
    this._scroll = container.querySelector('[data-grid-scroll]');

    container.addEventListener('click', event => {
      const button = event.target.closest('[data-grid-action]');
      if (button)
        this._handleAction(button.dataset.gridAction, Number(button.dataset.row), Number(button.dataset.col));
    });

    container.addEventListener('input', event => {
      const cell = event.target.closest('[data-cell]');
      if (!cell)
        return;
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      if (row < 0)
        this._header[col] = cell.value;
      else
        this._rows[row][col] = cell.value;
      this._changed = true;
    });

    // Alt + arrow keys: move to the neighbouring cell (header row = -1)
    container.addEventListener('keydown', event => {
      const cell = event.target.closest('[data-cell]');
      const step = ARROW_STEPS[event.key];
      if (!cell || !step || !event.altKey || event.ctrlKey || event.shiftKey || event.metaKey)
        return;
      event.preventDefault();
      event.stopPropagation();

      const row = Number(cell.dataset.row) + step.row;
      const col = Number(cell.dataset.col) + step.col;
      const target = this._scroll.querySelector(`[data-cell][data-row="${row}"][data-col="${col}"]`);
      if (!target)
        return;
      target.focus({ preventScroll: true });
      target.setSelectionRange(target.value.length, target.value.length);
      this._scrollCellIntoView(target.closest('td'));
    });

    this._render();
  }

  /** @returns {import('./EditorStructures.js').MarkdownTable} */
  getTable() {
    return { header: [...this._header], aligns: [...this._aligns], rows: this._rows.map(row => [...row]) };
  }

  /** @returns {boolean} true if anything in the grid was changed */
  isChanged() {
    return this._changed;
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  _handleAction(action, row, col) {
    const columns = this._header.length;
    const identity = index => index;
    let rowMap = identity;
    let colMap = identity;
    let focus = null;

    switch (action) {
      case 'row-up':
      case 'row-down': {
        const target = action === 'row-up' ? row - 1 : row + 1;
        if (target < 0 || target >= this._rows.length)
          return;
        [this._rows[row], this._rows[target]] = [this._rows[target], this._rows[row]];
        // property rows are body index + 1
        rowMap = index => index === row + 1 ? target + 1 : index === target + 1 ? row + 1 : index;
        focus = { row: target, col: 0 };
        break;
      }
      case 'row-insert':
      case 'row-append': {
        const at = action === 'row-append' ? this._rows.length : row + 1;
        this._rows.splice(at, 0, Array(columns).fill(''));
        rowMap = index => index >= at + 1 ? index + 1 : index;
        focus = { row: at, col: 0 };
        break;
      }
      case 'row-delete':
        this._rows.splice(row, 1);
        rowMap = index => index === row + 1 ? null : index > row + 1 ? index - 1 : index;
        focus = this._rows.length ? { row: Math.min(row, this._rows.length - 1), col: 0 } : null;
        break;

      case 'col-left':
      case 'col-right': {
        const target = action === 'col-left' ? col - 1 : col + 1;
        if (target < 0 || target >= columns)
          return;
        for (const cells of [this._header, this._aligns, ...this._rows])
          [cells[col], cells[target]] = [cells[target], cells[col]];
        colMap = index => index === col ? target : index === target ? col : index;
        focus = { row: -1, col: target };
        break;
      }
      case 'col-insert':
      case 'col-append': {
        const at = action === 'col-append' ? columns : col + 1;
        this._header.splice(at, 0, '');
        this._aligns.splice(at, 0, null);
        this._rows.forEach(cells => cells.splice(at, 0, ''));
        colMap = index => index >= at ? index + 1 : index;
        focus = { row: -1, col: at };
        break;
      }
      case 'col-delete':
        if (columns <= 1)
          return;
        for (const cells of [this._header, this._aligns, ...this._rows])
          cells.splice(col, 1);
        colMap = index => index === col ? null : index > col ? index - 1 : index;
        focus = { row: -1, col: Math.min(col, columns - 2) };
        break;

      case 'col-align':
        this._aligns[col] = ALIGN_CYCLE[(ALIGN_CYCLE.indexOf(this._aligns[col]) + 1) % ALIGN_CYCLE.length];
        focus = { row: -1, col };
        break;

      default:
        return;
    }

    this._changed = true;
    this._render(focus);
    if (rowMap !== identity || colMap !== identity)
      this._onReorder({ row: rowMap, col: colMap });
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  /** Renders the grid, keeps the scroll position and scrolls `focus` into view. */
  _render(focus = null) {
    const { scrollTop, scrollLeft } = this._scroll;
    const columns = this._header.length;
    const button = (action, label, title, data) =>
      `<button class="table-grid__button" data-grid-action="${action}" ${data} title="${title}" aria-label="${title}">${label}</button>`;

    const columnHeads = this._header.map((_, col) => {
      const data = `data-col="${col}"`;
      const align = this._aligns[col];
      return `
        <th class="table-grid__col-head">
          ${button('col-left', '‹', 'Move column left', data)}
          ${button('col-align', ALIGN_LABEL[align] ?? '–', `Alignment: ${align ?? 'default'} (click to change)`, data)}
          ${button('col-right', '›', 'Move column right', data)}
          ${button('col-insert', '+', 'Insert column to the right', data)}
          ${columns > 1 ? button('col-delete', '✕', 'Delete column', data) : ''}
        </th>`;
    }).join('');

    const cells = (values, row) => values.map((value, col) => `
      <td><input class="table-grid__cell${row < 0 ? ' table-grid__cell--header' : ''} table-grid__cell--${this._aligns[col] ?? 'default'}"
        data-cell data-row="${row}" data-col="${col}" value="${escapeHTML(value)}" spellcheck="false"></td>`).join('');

    const bodyRows = this._rows.map((values, row) => {
      const data = `data-row="${row}"`;
      return `
        <tr>
          <td class="table-grid__row-head">
            ${button('row-up', '↑', 'Move row up', data)}
            ${button('row-down', '↓', 'Move row down', data)}
            ${button('row-insert', '+', 'Insert row below', data)}
            ${button('row-delete', '✕', 'Delete row', data)}
          </td>
          ${cells(values, row)}
        </tr>`;
    }).join('');

    this._scroll.innerHTML = `
      <table class="table-grid">
        <thead><tr><th class="table-grid__corner"></th>${columnHeads}</tr></thead>
        <tbody>
          <tr class="table-grid__header-row">
            <td class="table-grid__row-head">${button('row-insert', '+', 'Insert row below the header', 'data-row="-1"')}</td>
            ${cells(this._header, -1)}
          </tr>
          ${bodyRows}
        </tbody>
      </table>`;

    this._scroll.scrollTop = scrollTop;
    this._scroll.scrollLeft = scrollLeft;
    this._container.querySelector('[data-grid-size]').textContent =
      `${this._rows.length} ${this._rows.length === 1 ? 'row' : 'rows'} × ${columns} ${columns === 1 ? 'column' : 'columns'}`;

    if (focus) {
      const input = this._scroll.querySelector(`[data-cell][data-row="${focus.row}"][data-col="${focus.col}"]`);
      if (input) {
        this._scrollCellIntoView(input.closest('td'));
        input.focus({ preventScroll: true });
      }
    }
  }

  /**
   * Scrolls a cell fully into view, not behind the sticky control row,
   * header row and control column.
   * @param {HTMLTableCellElement} td
   */
  _scrollCellIntoView(td) {
    const scroll = this._scroll;
    const table = td.closest('table');
    const isHeaderRow = td.parentElement.classList.contains('table-grid__header-row');

    // natural sizes: offsetTop of sticky cells moves with the scroll position
    const theadHeight = table.tHead?.offsetHeight ?? 0;
    const headerRowHeight = table.querySelector('.table-grid__header-row')?.offsetHeight ?? 0;
    const stickyTop = theadHeight + (isHeaderRow ? 0 : headerRowHeight);
    const stickyLeft = td.parentElement.querySelector('.table-grid__row-head')?.offsetWidth ?? 0;

    const left = td.offsetLeft;
    const right = left + td.offsetWidth;
    if (left < scroll.scrollLeft + stickyLeft)
      scroll.scrollLeft = left - stickyLeft;
    else if (right > scroll.scrollLeft + scroll.clientWidth)
      scroll.scrollLeft = right - scroll.clientWidth;

    // the header row is sticky itself and always visible
    if (isHeaderRow)
      return;
    const top = td.offsetTop;
    const bottom = top + td.offsetHeight;
    if (top < scroll.scrollTop + stickyTop)
      scroll.scrollTop = top - stickyTop;
    else if (bottom > scroll.scrollTop + scroll.clientHeight)
      scroll.scrollTop = bottom - scroll.clientHeight;
  }
}
