import { buildStandardModal, openModal, closeModal, onModalClose } from '@core/ModalBuilder.js';
import { escapeHTML } from '@common/Common.js';
import { isCheckedBoxActive, toggleCheckBox } from '@common/UIUtils.js';
import { TABLE_ALIGNS } from '@core/MarkdownParser.js';
import { TableGridEditor } from './TableGridEditor.js';

const TARGET_TYPES = [
  { id: 'col',  name: 'Column', placeholder: '0,2-3' },
  { id: 'row',  name: 'Row',    placeholder: '1-4' },
  { id: 'cell', name: 'Cell',   placeholder: 'row,col e.g. 1,2' },
];
const INDEX_REGEX = {
  col:  /^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/,
  row:  /^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/,
  cell: /^\d+(?:-\d+)?,\d+(?:-\d+)?$/,
};
const HOVER_TYPES = [
  { id: 'cell', name: 'Cell' },
  { id: 'row',  name: 'Row' },
  { id: 'col',  name: 'Column' },
];

let modalCounter = 0;

/**
 * Edits the properties of a table or code block in a modal (the `{...}` block above it).
 * Properties the modal doesn't know are kept.
 *
 * @param {object} options
 * @param {'table'|'code'} options.type
 * @param {{ props: Object, targets: Array<{ type: string, index: string, props: Object }> }} options.properties
 * @param {string} [options.lang] - language of a code block
 * @param {string[]} [options.languages] - suggestions for the language field
 * @param {import('./EditorStructures.js').MarkdownTable} [options.table] - content of a table (edited in a grid)
 * @param {(result: { properties: Object, lang: string|null, table: Object|null }) => void} options.onApply
 *   - table is null if the grid wasn't changed
 */
export function openStructureEditModal({ type, properties, lang = '', languages = [], table = null, onApply }) {
  const overlayId = `structure-edit-${++modalCounter}`;
  let grid = null;

  const modal = buildStandardModal(overlayId, {
    title: type === 'table' ? 'Edit table' : 'Code block properties',
    bodyHTML: `<div class="structure-edit">${type === 'table'
      ? _tableHTML(properties)
      : _codeHTML(properties, lang, languages, overlayId)}</div>`,
    primaryLabel: 'Apply',
    wide: type === 'table' ? 'l' : 's',
    onPrimary: () => {
      const result = type === 'table' ? _readTable(modal, properties) : _readCode(modal, properties);
      if (!result)
        return;
      closeModal(modal);
      onApply({ ...result, table: grid?.isChanged() ? grid.getTable() : null });
    },
  });

  // the grid and the properties scroll on their own, the body doesn't (EditorArea.css)
  if (type === 'table')
    modal.querySelector('.modal')?.classList.add('structure-edit-modal--table');

  if (type === 'table' && table) {
    grid = new TableGridEditor(modal.querySelector('[data-table-grid]'), table, {
      onReorder: maps => _remapTargets(modal, maps),
    });
  }

  // a click on the text of a checkbox row toggles its checkbox
  modal.addEventListener('click', event => {
    const row = event.target.closest('.structure-edit__check');
    if (row && !event.target.closest('.checkbox-element'))
      toggleCheckBox(row.querySelector('.checkbox-element'));
  });

  if (type === 'table')
    _bindTable(modal);
  else
    _bindCode(modal);

  onModalClose(modal, () => setTimeout(() => modal.remove(), 300));
  openModal(modal);
}

// ─── Code block ──────────────────────────────────────────────────────────────

function _codeHTML({ props }, lang, languages, overlayId) {
  const label = typeof props.label === 'string' ? props.label : null;
  const tagMode = label === 'none' ? 'none' : label !== null ? 'custom' : 'language';

  return `
    <div class="form-group">
      <label class="form-label" for="${overlayId}-lang">Language</label>
      <input id="${overlayId}-lang" class="form-input" data-field="lang" list="${overlayId}-languages"
        value="${escapeHTML(lang)}" placeholder="e.g. js, cpp, diff:js" spellcheck="false" autocomplete="off">
      <datalist id="${overlayId}-languages">
        ${languages.map(name => `<option value="${escapeHTML(name)}"></option>`).join('')}
      </datalist>
    </div>

    <div class="structure-edit__section">Display</div>
    ${_check('copy', 'Copy button', props.copy)}
    ${_check('numbers', 'Line numbers', props.numbers)}

    <div class="form-group form-group--spaced">
      <label class="form-label">Language tag</label>
      <div class="structure-edit__row">
        <select class="structure-edit__select" data-field="tag-mode">
          <option value="language"${tagMode === 'language' ? ' selected' : ''}>Language name</option>
          <option value="custom"${tagMode === 'custom' ? ' selected' : ''}>Custom text</option>
          <option value="none"${tagMode === 'none' ? ' selected' : ''}>Hidden</option>
        </select>
        <input class="form-input${tagMode === 'custom' ? '' : ' hidden'}" data-field="label"
          value="${escapeHTML(tagMode === 'custom' ? label : '')}" placeholder="Tag text">
      </div>
    </div>`;
}

function _bindCode(modal) {
  const mode = modal.querySelector('[data-field="tag-mode"]');
  const label = modal.querySelector('[data-field="label"]');
  mode.addEventListener('change', () => {
    label.classList.toggle('hidden', mode.value !== 'custom');
    if (mode.value === 'custom')
      label.focus();
  });
}

function _readCode(modal, { props, targets }) {
  const next = { ...props };
  _setSwitch(next, 'copy', _isChecked(modal, 'copy'));
  _setSwitch(next, 'numbers', _isChecked(modal, 'numbers'));

  const mode = modal.querySelector('[data-field="tag-mode"]').value;
  const label = modal.querySelector('[data-field="label"]').value.trim();
  delete next.label;
  if (mode === 'none')
    next.label = 'none';
  else if (mode === 'custom' && label)
    next.label = label;

  const lang = modal.querySelector('[data-field="lang"]').value.trim();
  if (lang && !/^[\w#+.-]+(?::[\w#+.-]+)?$/.test(lang)) {
    _markInvalid(modal.querySelector('[data-field="lang"]'));
    return null;
  }

  return { properties: { props: next, targets }, lang };
}

// ─── Table ───────────────────────────────────────────────────────────────────

function _tableHTML({ props, targets }) {
  const hover = props.hover === true
    ? ['cell']
    : String(props.hover ?? '').split(',').map(h => h.trim()).filter(Boolean);

  return `
    <div class="structure-edit__section">Table</div>
    <div class="structure-edit__grid" data-table-grid></div>

    <div class="structure-edit__section">Properties</div>
    <!-- own scroll box: the grid above stays in view -->
    <div class="structure-edit__props">
      ${_check('striped', 'Striped rows', props.striped)}
      <div class="structure-edit__row structure-edit__row--wrap">
        <span class="structure-edit__label">Highlight on hover</span>
        ${HOVER_TYPES.map(h => _check(`hover-${h.id}`, h.name, hover.includes(h.id))).join('')}
      </div>

      <div class="structure-edit__subsection">Columns, rows and cells</div>
      <div class="structure-edit__hint">Counted from 0, row 0 is the header. Lists and ranges: 0,2-4. They follow moved rows and columns.</div>
      <div class="structure-edit__targets" data-targets>
        ${targets.map((target, i) => _targetHTML(target, i)).join('')}
      </div>
      <button class="button button--secondary structure-edit__add" data-add-target>+ Add</button>
    </div>`;
}

/**
 * Moves the indices of the col / row / cell targets with moved, inserted or deleted rows and columns.
 * Targets without an index left are removed; cells whose rows or columns are no longer
 * a single range are split into several targets.
 */
function _remapTargets(modal, maps) {
  for (const row of Array.from(modal.querySelectorAll('[data-target]'))) {
    const type = row.querySelector('[data-field="type"]').value;
    const input = row.querySelector('[data-field="index"]');
    const index = input.value.replace(/[ \t]/g, '');
    if (!INDEX_REGEX[type].test(index))
      continue;

    if (type !== 'cell') {
      const runs = _toRuns(_mapIndices(index, type === 'row' ? maps.row : maps.col));
      if (runs.length)
        input.value = runs.join(',');
      else
        row.remove();
      continue;
    }

    const [rows, cols] = index.split(',');
    const rowRuns = _toRuns(_mapIndices(rows, maps.row));
    const colRuns = _toRuns(_mapIndices(cols, maps.col));
    const combos = rowRuns.flatMap(r => colRuns.map(c => `${r},${c}`));
    if (!combos.length) {
      row.remove();
      continue;
    }

    input.value = combos[0];
    let previous = row;
    for (const combo of combos.slice(1)) {
      const clone = _cloneTarget(row);
      clone.querySelector('[data-field="index"]').value = combo;
      previous.after(clone);
      previous = clone;
    }
  }
}

/** '1,3-5' -> mapped, sorted indices without the deleted ones */
function _mapIndices(text, map) {
  const indices = new Set();
  for (const part of text.split(',')) {
    const [from, to = from] = part.split('-').map(Number);
    for (let i = from; i <= to; i++) {
      const mapped = map(i);
      if (mapped !== null)
        indices.add(mapped);
    }
  }
  return [...indices].sort((a, b) => a - b);
}

/** [1, 3, 4, 5] -> ['1', '3-5'] */
function _toRuns(indices) {
  const runs = [];
  for (let i = 0; i < indices.length; i++) {
    const from = indices[i];
    while (i + 1 < indices.length && indices[i + 1] === indices[i] + 1)
      i++;
    runs.push(from === indices[i] ? `${from}` : `${from}-${indices[i]}`);
  }
  return runs;
}

/** Copy of a target row with its current field values (cloneNode doesn't copy changed values). */
function _cloneTarget(row) {
  const clone = row.cloneNode(true);
  const fields = row.querySelectorAll('[data-field]');
  clone.querySelectorAll('[data-field]').forEach((field, i) => {
    field.value = fields[i].value;
  });
  return clone;
}

function _targetHTML(target, key) {
  const { type, index, props } = target;
  const align = TABLE_ALIGNS.includes(props.align) ? props.align : '';

  return `
    <div class="structure-edit__target" data-target="${key}" data-type="${type}">
      <select class="structure-edit__select" data-field="type">
        ${TARGET_TYPES.map(t => `<option value="${t.id}"${t.id === type ? ' selected' : ''}>${t.name}</option>`).join('')}
      </select>
      <input class="form-input structure-edit__index" data-field="index" value="${escapeHTML(index)}"
        placeholder="${TARGET_TYPES.find(t => t.id === type)?.placeholder ?? ''}" spellcheck="false" title="Index">
      ${_check('hl', 'Highlight', props.hl)}
      <select class="structure-edit__select" data-field="align" data-for="col cell" title="Alignment">
        <option value=""${align ? '' : ' selected'}>Align</option>
        ${TABLE_ALIGNS.map(a => `<option value="${a}"${a === align ? ' selected' : ''}>${a}</option>`).join('')}
      </select>
      <input class="form-input structure-edit__number" data-field="width" data-for="col"
        value="${escapeHTML(props.width ?? '')}" placeholder="Width" title="Width in px or %">
      <input class="form-input structure-edit__number" data-field="line" data-for="row col"
        value="${escapeHTML(props.line ?? '')}" placeholder="Line" title="Line width in px">
      <button class="icon-button icon-button--small" data-remove-target title="Remove" aria-label="Remove">✕</button>
    </div>`;
}

function _bindTable(modal) {
  const list = modal.querySelector('[data-targets]');
  let nextKey = list.children.length;

  const updateFields = row => {
    const type = row.querySelector('[data-field="type"]').value;
    row.dataset.type = type;
    row.querySelector('[data-field="index"]').placeholder = TARGET_TYPES.find(t => t.id === type).placeholder;
    row.querySelectorAll('[data-for]').forEach(field => {
      field.classList.toggle('hidden', !field.dataset.for.split(' ').includes(type));
    });
  };
  Array.from(list.children).forEach(updateFields);

  list.addEventListener('change', event => {
    if (event.target.matches('[data-field="type"]'))
      updateFields(event.target.closest('[data-target]'));
  });
  list.addEventListener('click', event => {
    if (event.target.closest('[data-remove-target]'))
      event.target.closest('[data-target]').remove();
  });

  modal.querySelector('[data-add-target]').addEventListener('click', () => {
    list.insertAdjacentHTML('beforeend', _targetHTML({ type: 'col', index: '', props: {} }, nextKey++));
    const row = list.lastElementChild;
    updateFields(row);
    row.querySelector('[data-field="index"]').focus();
  });
}

function _readTable(modal, { props, targets }) {
  const next = { ...props };
  _setSwitch(next, 'striped', _isChecked(modal, 'striped'));

  const hover = HOVER_TYPES.filter(h => _isChecked(modal, `hover-${h.id}`)).map(h => h.id);
  delete next.hover;
  if (hover.length)
    next.hover = hover.join(',');

  let valid = true;
  const nextTargets = [];
  for (const row of modal.querySelectorAll('[data-target]')) {
    const type = row.querySelector('[data-field="type"]').value;
    const indexInput = row.querySelector('[data-field="index"]');
    const index = indexInput.value.replace(/[ \t]/g, '');
    if (!INDEX_REGEX[type].test(index)) {
      _markInvalid(indexInput);
      valid = false;
      continue;
    }

    // unknown properties of an existing target stay
    const original = targets[Number(row.dataset.target)]?.props ?? {};
    const targetProps = { ...original };
    _setSwitch(targetProps, 'hl', _isChecked(row, 'hl'));
    for (const field of ['align', 'width', 'line']) {
      const input = row.querySelector(`[data-field="${field}"]`);
      const value = input.classList.contains('hidden') ? '' : input.value.trim();
      delete targetProps[field];
      if (value)
        targetProps[field] = value;
    }
    nextTargets.push({ type, index, props: targetProps });
  }

  return valid ? { properties: { props: next, targets: nextTargets }, lang: null } : null;
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function _check(name, label, checked) {
  return `
    <div class="structure-edit__check">
      <button class="checkbox-element" data-checkbox="${checked ? 'true' : 'false'}" data-check="${name}" aria-label="${escapeHTML(label)}"></button>
      <span>${escapeHTML(label)}</span>
    </div>`;
}

function _isChecked(container, name) {
  return isCheckedBoxActive(container.querySelector(`[data-check="${name}"]`));
}

function _setSwitch(props, name, on) {
  if (on)
    props[name] = true;
  else
    delete props[name];
}

function _markInvalid(input) {
  input.classList.add('structure-edit__invalid');
  input.addEventListener('input', () => input.classList.remove('structure-edit__invalid'), { once: true });
  input.focus();
}
