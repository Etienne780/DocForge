import { getProjectLinks, findNodeInProject } from '@data/LinkManager.js';
import { getLanguages, getPresetLanguages } from '@data/SyntaxDefinitionManager.js';
import { TABLE_HOVER_TYPES, TABLE_ALIGNS } from '@core/MarkdownParser.js';

/**
 * EditorCompletions - finds the suggestions for the cursor position of the doc editor.
 *
 * Contexts (syntax of @core/MarkdownParser.js):
 *   [[slug          -> reference links of the project
 *   ```lang         -> languages (name and aliases), also after diff:
 *   {lang=          -> languages of inline code
 *   { ... } blocks  -> property names / values for the element below (table or code block)
 */

/**
 * @typedef {Object} CompletionItem
 * @property {string} label
 * @property {string} [detail]  - shown muted next to the label
 * @property {string} insert    - replaces the text from `from` to the cursor
 * @property {boolean} [reopen] - suggest again after inserting (e.g. values after 'name=')
 * @property {{ indent: string, ticks: string }} [fence] - language of an opening code fence: the editor closes
 *   the block if it is still open, with an empty line for the cursor
 */

/**
 * @typedef {Object} CompletionResult
 * @property {number} from - column where the replaced text starts (the cursor is the end)
 * @property {string} query
 * @property {number} minQuery - characters needed before the list opens by itself
 * @property {CompletionItem[]} items
 */

const MAX_ITEMS = 50;

// property definitions: values = suggested values, hasValue = 'name=' without suggestions, list = comma separated
const TABLE_PROPERTIES = {
  table: [
    { name: 'hover',   values: TABLE_HOVER_TYPES, list: true, detail: 'Highlight under the mouse' },
    { name: 'striped', detail: 'Every second row brighter' },
  ],
  row: [
    { name: 'hl',   detail: 'Highlight' },
    { name: 'line', hasValue: true, detail: 'Line below in px' },
  ],
  col: [
    { name: 'hl',    detail: 'Highlight' },
    { name: 'line',  hasValue: true, detail: 'Line to the right in px' },
    { name: 'width', hasValue: true, detail: 'Width in px or %' },
    { name: 'align', values: TABLE_ALIGNS, detail: 'Text alignment' },
  ],
  cell: [
    { name: 'hl',    detail: 'Highlight' },
    { name: 'align', values: TABLE_ALIGNS, detail: 'Text alignment' },
  ],
};

const CODE_PROPERTIES = [
  { name: 'copy',    detail: 'Copy button' },
  { name: 'numbers', detail: 'Line numbers' },
  { name: 'label',   values: ['none'], detail: 'Text of the language tag' },
  { name: 'indent',  values: ['2', '4', 'tab'], detail: 'Indent guides, spaces per level or tab (Tab key width)' },
];

const TABLE_TARGETS = [
  { label: 'col',  insert: 'col ',  detail: 'Properties of columns, e.g. col 0,2:' },
  { label: 'row',  insert: 'row ',  detail: 'Properties of rows, e.g. row 1-3:' },
  { label: 'cell', insert: 'cell ', detail: 'Properties of cells, e.g. cell 1,2:' },
];

const PROPERTY_CLOSE_REGEX = /^[ \t]*\}[ \t]*$/;
const BLANK_REGEX = /^[ \t]*$/;

/**
 * @param {object} context
 * @param {string[]} context.lines
 * @param {number} context.lineIndex
 * @param {number} context.column
 * @param {import('./EditorTokenizer.js').LineState} context.lineState - state at the start of the line
 * @param {Object} context.project
 * @returns {CompletionResult|null}
 */
export function getCompletions({ lines, lineIndex, column, lineState, project }) {
  if (lineState.fence || lineState.comment)
    return null;

  const line = lines[lineIndex];
  const before = line.slice(0, column);
  const after = line.slice(column);

  // [[slug
  const ref = before.match(/\[\[([^\]|\n]*)$/);
  if (ref) {
    const close = after.startsWith(']]') || after.startsWith('|') ? '' : ']]';
    return _result(column, ref[1], 0, _linkItems(project, close));
  }

  // ```lang / ```diff:lang
  const fence = before.match(/^([ \t]*)(`{3,})((?:[\w#+.-]+:)?)([\w#+.-]*)$/);
  if (fence) {
    const [, indent, ticks, prefix, query] = fence;
    const items = _languageItems(project);
    if (!prefix) {
      items.unshift(
        { label: 'diff', insert: 'diff', detail: 'Added / removed lines' },
        { label: 'diff:', insert: 'diff:', detail: 'Diff highlighted as a language', reopen: true },
      );
    }
    // a final choice can close the block (only with nothing behind the cursor)
    if (!after.trim()) {
      for (const item of items) {
        if (!item.reopen)
          item.fence = { indent, ticks };
      }
    }
    // after 'diff:' the languages are suggested right away
    return _result(column, query, prefix ? 0 : 1, items);
  }

  // {lang=cpp}`code`
  const inlineLang = before.match(/\{lang=([\w#+.-]*)$/);
  if (inlineLang)
    return _result(column, inlineLang[1], 0, _languageItems(project));

  // property blocks
  if (lineState.props)
    return _propertyCompletion(column, before, _elementBelowBlock(lines, lineIndex));

  const single = before.match(/^[ \t]*\{([^{}]*)$/);
  if (single && !single[1].startsWith('#'))
    return _propertyCompletion(column, single[1], _elementType(lines[lineIndex + 1]));

  return null;
}

function _propertyCompletion(column, text, element) {
  // the current entry (entries are separated by ';')
  const entry = text.slice(text.lastIndexOf(';') + 1);
  const target = entry.match(/^[ \t]*(col|row|cell)[ \t]+[\d ,-]*:[ \t]*/);
  const targetType = target?.[1] ?? null;
  const rest = target ? entry.slice(target[0].length) : entry;

  const definitions = _propertyDefinitions(element, targetType);

  // name=value
  const value = rest.match(/([a-zA-Z][\w-]*)="?([^\s;"]*)$/);
  if (value) {
    const definition = definitions.find(d => d.name === value[1]);
    if (!definition?.values)
      return null;

    const query = definition.list ? value[2].slice(value[2].lastIndexOf(',') + 1) : value[2];
    const used = definition.list ? value[2].split(',').slice(0, -1) : [];
    const items = definition.values
      .filter(v => !used.includes(v))
      .map(v => ({ label: v, insert: v }));
    return _result(column, query, 0, items);
  }

  // name
  const name = rest.match(/(?:^|[ \t])([a-zA-Z][\w-]*)?$/);
  if (!name)
    return null;

  const used = new Set([...rest.matchAll(/([a-zA-Z][\w-]*)/g)].map(m => m[1]));
  const query = name[1] ?? '';
  used.delete(query);

  const items = definitions
    .filter(d => !used.has(d.name))
    .map(d => ({
      label: d.name,
      detail: d.detail,
      insert: d.values || d.hasValue ? `${d.name}=` : d.name,
      reopen: Boolean(d.values),
    }));

  // targets only at the start of an entry of a table block
  if (element !== 'code' && !targetType && !rest.slice(0, rest.length - query.length).trim())
    items.push(...TABLE_TARGETS);

  return _result(column, query, 1, items);
}

function _propertyDefinitions(element, targetType) {
  if (targetType)
    return TABLE_PROPERTIES[targetType];
  if (element === 'table')
    return TABLE_PROPERTIES.table;
  if (element === 'code')
    return CODE_PROPERTIES;
  return [...TABLE_PROPERTIES.table, ...CODE_PROPERTIES];
}

/** Element below a multi-line property block that contains `lineIndex`. */
function _elementBelowBlock(lines, lineIndex) {
  for (let i = lineIndex; i < lines.length; i++) {
    if (PROPERTY_CLOSE_REGEX.test(lines[i]))
      return _elementType(lines[i + 1]);
    if (i > lineIndex && BLANK_REGEX.test(lines[i]))
      return null;
  }
  return null;
}

/** @returns {'table'|'code'|null} */
function _elementType(line) {
  if (/^[ \t]*\|/.test(line ?? ''))
    return 'table';
  if (/^[ \t]*`{3,}/.test(line ?? ''))
    return 'code';
  return null;
}

function _linkItems(project, close) {
  return getProjectLinks(project).map(link => {
    const target = findNodeInProject(project, link.target?.nodeId)?.node?.name ?? '';
    const anchor = link.target?.anchor ? ` #${link.target.anchor}` : '';
    return {
      label: link.slug,
      detail: `${link.name}${target ? ` → ${target}${anchor}` : ''}`,
      search: `${link.slug} ${link.name}`,
      insert: link.slug + close,
    };
  });
}

function _languageItems(project) {
  const items = [];
  const seen = new Set();

  for (const language of [...getLanguages(project), ...getPresetLanguages()]) {
    for (const label of [language.name, ...(language.aliases ?? [])]) {
      const key = label?.toLowerCase();
      if (!key || seen.has(key) || !/^[\w#+.-]+$/.test(label))
        continue;
      seen.add(key);
      items.push({ label, detail: label === language.name ? '' : language.name, insert: label });
    }
  }

  return items;
}

/** Filters by the query (prefix matches first) and caps the list. */
function _result(column, query, minQuery, items) {
  const lower = query.toLowerCase();
  const scored = [];

  for (const item of items) {
    const label = item.label.toLowerCase();
    const search = (item.search ?? item.label).toLowerCase();
    const score = label.startsWith(lower) ? 0 : search.includes(lower) ? 1 : -1;
    if (score >= 0)
      scored.push({ item, score });
  }

  scored.sort((a, b) => a.score - b.score);
  return {
    from: column - query.length,
    query,
    minQuery,
    items: scored.slice(0, MAX_ITEMS).map(s => s.item),
  };
}
