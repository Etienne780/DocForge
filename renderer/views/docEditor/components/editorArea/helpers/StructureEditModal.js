import { buildStandardModal, openModal, closeModal, onModalClose } from '@core/ModalBuilder.js';
import { escapeHTML } from '@common/Common.js';
import { isCheckedBoxActive, toggleCheckBox } from '@common/UIUtils.js';
import { TABLE_ALIGNS, TOC_STYLES, LIST_BULLETS } from '@core/MarkdownParser.js';
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

const STRIPE_TYPES = [
  { id: 'row', name: 'Rows' },
  { id: 'col', name: 'Columns' },
];

let modalCounter = 0;

/**
 * Edits the properties of a table, code block, tree, [toc], list or section in a modal (the `{...}` block above it).
 * Properties the modal doesn't know are kept.
 *
 * @param {object} options
 * @param {'table'|'code'|'tree'|'toc'|'list'|'section'} options.type
 * @param {{ props: Object, targets: Array<{ type: string, index: string, props: Object }> }} options.properties
 * @param {string} [options.lang] - language of a code block
 * @param {string} [options.title] - title of a section
 * @param {string[]} [options.languages] - suggestions for the language field
 * @param {import('./EditorStructures.js').MarkdownTable} [options.table] - content of a table (edited in a grid)
 * @param {(result: { properties: Object, lang: string|null, title?: string, table: Object|null }) => void} options.onApply
 *   - table is null if the grid wasn't changed
 */
export function openStructureEditModal({ type, properties, lang = '', title = '', languages = [], table = null, onApply }) {
  const overlayId = `structure-edit-${++modalCounter}`;
  let grid = null;

  const forms = {
    table: { title: 'Edit table',              html: () => _tableHTML(properties),                           read: _readTable },
    code:  { title: 'Code block properties',   html: () => _codeHTML(properties, lang, languages, overlayId), read: _readCode },
    toc:   { title: 'Table of contents',       html: () => _tocHTML(properties, overlayId),                  read: _readToc },
    tree:  { title: 'Tree',                    html: () => _treeHTML(properties, overlayId),                 read: _readTree },
    list:  { title: 'List',                    html: () => _listHTML(properties, overlayId),                 read: _readList },
    section: { title: 'Section',               html: () => _sectionHTML(properties, title, overlayId),        read: _readSection },
  };
  const form = forms[type];

  const modal = buildStandardModal(overlayId, {
    title: form.title,
    bodyHTML: `<div class="structure-edit">${form.html()}</div>`,
    primaryLabel: 'Apply',
    wide: type === 'table' ? 'l' : 's',
    onPrimary: () => {
      const result = form.read(modal, properties);
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
  else if (type === 'code')
    _bindCode(modal);

  onModalClose(modal, () => setTimeout(() => modal.remove(), 300));
  openModal(modal);
}

// ─── Table of contents ([toc]) ───────────────────────────────────────────────

const TOC_STYLE_INFO = {
  card:    'Card - border around, title as header',
  tree:    'Tree - guide line per level',
  outline: 'Outline - numbered 1, 1.1, 1.1.1',
  leader:  'Leader - dotted line to an arrow',
};

const TOC_DEPTHS = [
  { value: '1', label: 'Up to # (h1)' },
  { value: '2', label: 'Up to ## (h2)' },
  { value: '3', label: 'Up to ### (h3)' },
  { value: '4', label: 'All headings' },
];

function _tocHTML({ props }, overlayId) {
  const style = TOC_STYLES.includes(props.style) ? props.style : TOC_STYLES[0];
  const depth = TOC_DEPTHS.some(d => d.value === props.depth) ? props.depth : '4';
  const title = typeof props.title === 'string' ? props.title : '';

  return `
    <div class="form-group">
      <label class="form-label" for="${overlayId}-title">Title</label>
      <input id="${overlayId}-title" class="form-input" data-field="title" value="${escapeHTML(title)}"
        placeholder="No title" spellcheck="false" autocomplete="off">
    </div>

    <div class="form-group form-group--spaced">
      <label class="form-label" for="${overlayId}-style">Look</label>
      <select id="${overlayId}-style" class="structure-edit__select" data-field="style">
        ${TOC_STYLES.map(s => `<option value="${s}"${s === style ? ' selected' : ''}>${escapeHTML(TOC_STYLE_INFO[s] ?? s)}</option>`).join('')}
      </select>
    </div>

    <div class="form-group form-group--spaced">
      <label class="form-label" for="${overlayId}-depth">Headings</label>
      <select id="${overlayId}-depth" class="structure-edit__select" data-field="depth">
        ${TOC_DEPTHS.map(d => `<option value="${d.value}"${d.value === depth ? ' selected' : ''}>${escapeHTML(d.label)}</option>`).join('')}
      </select>
    </div>

    <div class="structure-edit__section">Display</div>
    ${_check('numbered', 'Numbers like 1.1 (always on in the outline look)', props.numbered)}`;
}

function _readToc(modal, { props, targets }) {
  const next = { ...props };

  const title = modal.querySelector('[data-field="title"]').value.trim();
  delete next.title;
  if (title)
    next.title = title;

  // defaults are left out: card, all headings
  const style = modal.querySelector('[data-field="style"]').value;
  delete next.style;
  if (style !== TOC_STYLES[0])
    next.style = style;

  const depth = modal.querySelector('[data-field="depth"]').value;
  delete next.depth;
  if (depth !== '4')
    next.depth = depth;

  _setSwitch(next, 'numbered', _isChecked(modal, 'numbered'));
  return { properties: { props: next, targets }, lang: null };
}

// ─── Tree (```tree) ──────────────────────────────────────────────────────────

const TREE_COLLAPSED = [
  { value: '',  label: 'All open' },
  { value: '1', label: 'Only the top level' },
  { value: '2', label: '2 levels open' },
  { value: '3', label: '3 levels open' },
];

function _treeHTML({ props }, overlayId) {
  const collapsed = props.collapsed === true ? '1' : String(props.collapsed ?? '');
  const selected = TREE_COLLAPSED.some(c => c.value === collapsed) ? collapsed : '';

  return `
    <div class="structure-edit__section">Behavior</div>
    ${_check('collapsible', 'Folders open / close on click', props.collapsible)}

    <div class="form-group form-group--spaced">
      <label class="form-label" for="${overlayId}-collapsed">At the start (makes the folders collapsible)</label>
      <select id="${overlayId}-collapsed" class="structure-edit__select" data-field="collapsed">
        ${TREE_COLLAPSED.map(c => `<option value="${c.value}"${c.value === selected ? ' selected' : ''}>${escapeHTML(c.label)}</option>`).join('')}
      </select>
    </div>

    <div class="structure-edit__hint">Per folder in the text: <code>+ name/</code> starts collapsed, <code>- name/</code> starts open, <code>! name/</code> never collapses. Text after <code> #</code> is a comment.</div>`;
}

function _readTree(modal, { props, targets }) {
  const next = { ...props };
  _setSwitch(next, 'collapsible', _isChecked(modal, 'collapsible'));

  const collapsed = modal.querySelector('[data-field="collapsed"]').value;
  delete next.collapsed;
  if (collapsed)
    next.collapsed = collapsed;

  return { properties: { props: next, targets }, lang: null };
}

// ─── Section (::: Title) ──────────────────────────────────────────────────────

function _sectionHTML({ props }, title, overlayId) {
  return `
    <div class="form-group">
      <label class="form-label" for="${overlayId}-section-title">Title</label>
      <input id="${overlayId}-section-title" class="form-input" data-field="section-title" value="${escapeHTML(title)}"
        placeholder="Title of the section" spellcheck="false" autocomplete="off">
    </div>

    <div class="structure-edit__section">Behavior</div>
    ${_check('open', 'Start open (sections start collapsed)', props.open)}

    <div class="structure-edit__hint">The section ends at the next <code>:::</code> on its own line. Everything in between can be any content, also other sections.</div>`;
}

function _readSection(modal, { props, targets }) {
  const input = modal.querySelector('[data-field="section-title"]');
  const title = input.value.trim();
  // without a title the line would close a section instead of opening one
  if (!title) {
    _markInvalid(input);
    return null;
  }

  const next = { ...props };
  _setSwitch(next, 'open', _isChecked(modal, 'open'));
  return { properties: { props: next, targets }, lang: null, title };
}

// ─── List (bullet style) ─────────────────────────────────────────────────────

const LIST_LEVELS = 3;
const DEFAULT_BULLETS = ['disc', 'circle', 'square'];

function _listHTML({ props }, overlayId) {
  const styles = typeof props.bullet === 'string' ? props.bullet.split(',') : [];

  const select = level => {
    const current = LIST_BULLETS.includes(styles[level]) ? styles[level] : '';
    const empty = level === 0 ? 'Default per level' : 'Like level 1';
    return `
      <div class="form-group${level ? ' form-group--spaced' : ''}">
        <label class="form-label" for="${overlayId}-bullet-${level}">Level ${level + 1}</label>
        <select id="${overlayId}-bullet-${level}" class="structure-edit__select" data-bullet-level="${level}">
          <option value=""${current ? '' : ' selected'}>${empty}</option>
          ${LIST_BULLETS.map(s => `<option value="${s}"${s === current ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>`;
  };

  return `
    <div class="structure-edit__section">Bullets</div>
    ${Array.from({ length: LIST_LEVELS }, (_, level) => select(level)).join('')}
    <div class="structure-edit__hint">Deeper levels repeat the styles from level 1.</div>`;
}

function _readList(modal, { props, targets }) {
  const next = { ...props };
  const chosen = [...modal.querySelectorAll('[data-bullet-level]')].map(s => s.value);
  delete next.bullet;

  // up to the last chosen level; levels in between without a choice get the default
  const last = chosen.findLastIndex(Boolean);
  if (last >= 0) {
    const first = chosen[0] || DEFAULT_BULLETS[0];
    const styles = chosen.slice(0, last + 1).map((s, level) => s || (chosen[0] ? first : DEFAULT_BULLETS[level]));
    next.bullet = styles.join(',');
  }

  return { properties: { props: next, targets }, lang: null };
}

// ─── Code block ──────────────────────────────────────────────────────────────

function _codeHTML({ props }, lang, languages, overlayId) {
  const label = typeof props.label === 'string' ? props.label : null;
  const tagMode = label === 'none' ? 'none' : label !== null ? 'custom' : 'language';
  const indent = props.indent === true ? '4' : props.indent;
  const indentMode = indent === 'tab' ? 'tab' : /^\d+$/.test(indent ?? '') ? 'spaces' : 'off';

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
    </div>

    <div class="form-group form-group--spaced">
      <label class="form-label">Indent guides</label>
      <div class="structure-edit__row">
        <select class="structure-edit__select" data-field="indent-mode">
          <option value="off"${indentMode === 'off' ? ' selected' : ''}>Off</option>
          <option value="spaces"${indentMode === 'spaces' ? ' selected' : ''}>Spaces per level</option>
          <option value="tab"${indentMode === 'tab' ? ' selected' : ''}>Tabs</option>
        </select>
        <input class="form-input${indentMode === 'spaces' ? '' : ' hidden'}" data-field="indent" type="number"
          min="1" max="16" value="${indentMode === 'spaces' ? escapeHTML(indent) : '4'}">
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

  const indentMode = modal.querySelector('[data-field="indent-mode"]');
  const indent = modal.querySelector('[data-field="indent"]');
  indentMode.addEventListener('change', () => {
    indent.classList.toggle('hidden', indentMode.value !== 'spaces');
    if (indentMode.value === 'spaces')
      indent.focus();
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

  const indentMode = modal.querySelector('[data-field="indent-mode"]').value;
  const indentInput = modal.querySelector('[data-field="indent"]');
  delete next.indent;
  if (indentMode === 'tab') {
    next.indent = 'tab';
  } else if (indentMode === 'spaces') {
    const width = indentInput.value.trim();
    if (!/^\d+$/.test(width) || Number(width) < 1 || Number(width) > 16) {
      _markInvalid(indentInput);
      return null;
    }
    next.indent = String(Number(width));
  }

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
  const striped = props.striped === true
    ? ['row']
    : String(props.striped ?? '').split(',').map(s => s.trim()).filter(Boolean);

  return `
    <div class="structure-edit__section">Table (Alt + arrow keys: move between cells)</div>
    <div class="structure-edit__grid" data-table-grid></div>

    <div class="structure-edit__section">Properties</div>
    <!-- own scroll box: the grid above stays in view -->
    <div class="structure-edit__props">
      <div class="structure-edit__row structure-edit__row--wrap">
        <span class="structure-edit__label">Striped</span>
        ${STRIPE_TYPES.map(s => _check(`striped-${s.id}`, s.name, striped.includes(s.id))).join('')}
      </div>
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
  // only rows: plain `striped` like before
  const striped = STRIPE_TYPES.filter(s => _isChecked(modal, `striped-${s.id}`)).map(s => s.id);
  delete next.striped;
  if (striped.length === 1 && striped[0] === 'row')
    next.striped = true;
  else if (striped.length)
    next.striped = striped.join(',');

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
