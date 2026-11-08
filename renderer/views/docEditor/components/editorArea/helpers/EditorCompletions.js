import { getProjectLinks, findNodeInProject } from '@data/LinkManager.js';
import { getLanguages, getPresetLanguages } from '@data/SyntaxDefinitionManager.js';
import { getFootnoteLabels } from './ToolbarHelper.js';
import { TABLE_HOVER_TYPES, TABLE_STRIPE_TYPES, TABLE_ALIGNS, TOC_STYLES, LIST_BULLETS } from '@core/MarkdownParser.js';
import { t } from '@core/i18n/I18n.js';

/**
 * EditorCompletions - finds the suggestions for the cursor position of the doc editor.
 *
 * Contexts (syntax of @core/MarkdownParser.js):
 *   [[slug          -> reference links of the project
 *   [^label         -> footnote labels of the entry (at the start of a line: as a definition)
 *   ```lang         -> languages (name and aliases), also after diff:
 *   {lang=          -> languages of inline code
 *   { ... } blocks  -> property names / values for the element below (table, code block, tree, [toc], list, ::: section)
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
    { name: 'hover',   values: TABLE_HOVER_TYPES, list: true, get detail() { return t('editorTools.completions.table.hover'); } },
    { name: 'striped', values: TABLE_STRIPE_TYPES, list: true, get detail() { return t('editorTools.completions.table.striped'); } },
  ],
  row: [
    { name: 'hl',   get detail() { return t('editorTools.completions.row.hl'); } },
    { name: 'line', hasValue: true, get detail() { return t('editorTools.completions.row.line'); } },
  ],
  col: [
    { name: 'hl',    get detail() { return t('editorTools.completions.col.hl'); } },
    { name: 'line',  hasValue: true, get detail() { return t('editorTools.completions.col.line'); } },
    { name: 'width', hasValue: true, get detail() { return t('editorTools.completions.col.width'); } },
    { name: 'align', values: TABLE_ALIGNS, get detail() { return t('editorTools.completions.col.align'); } },
  ],
  cell: [
    { name: 'hl',    get detail() { return t('editorTools.completions.cell.hl'); } },
    { name: 'align', values: TABLE_ALIGNS, get detail() { return t('editorTools.completions.cell.align'); } },
  ],
};

const CODE_PROPERTIES = [
  { name: 'copy',    get detail() { return t('editorTools.completions.code.copy'); } },
  { name: 'numbers', get detail() { return t('editorTools.completions.code.numbers'); } },
  { name: 'label',   values: ['none'], get detail() { return t('editorTools.completions.code.label'); } },
  { name: 'indent',  values: ['2', '4', 'tab'], get detail() { return t('editorTools.completions.code.indent'); } },
];

const TOC_PROPERTIES = [
  { name: 'depth',    values: ['1', '2', '3', '4'], get detail() { return t('editorTools.completions.toc.depth'); } },
  { name: 'title',    hasValue: true, get detail() { return t('editorTools.completions.toc.title'); } },
  { name: 'style',    values: TOC_STYLES, get detail() { return t('editorTools.completions.toc.style'); } },
  { name: 'numbered', get detail() { return t('editorTools.completions.toc.numbered'); } },
];

const TREE_PROPERTIES = [
  { name: 'collapsible', get detail() { return t('editorTools.completions.tree.collapsible'); } },
  { name: 'collapsed',   values: ['1', '2', '3'], get detail() { return t('editorTools.completions.tree.collapsed'); } },
];

const SECTION_PROPERTIES = [
  { name: 'open', get detail() { return t('editorTools.completions.section.open'); } },
];

const LIST_PROPERTIES = [
  { name: 'bullet', values: LIST_BULLETS, list: true, get detail() { return t('editorTools.completions.list.bullet'); } },
];

const TABLE_TARGETS = [
  { label: 'col',  insert: 'col ',  get detail() { return t('editorTools.completions.targets.col'); } },
  { label: 'row',  insert: 'row ',  get detail() { return t('editorTools.completions.targets.row'); } },
  { label: 'cell', insert: 'cell ', get detail() { return t('editorTools.completions.targets.cell'); } },
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

  // [^label
  const footnote = before.match(/\[\^([^\]\s]*)$/);
  if (footnote)
    return _result(column, footnote[1], 0, _footnoteItems(lines, lineIndex, before, after));

  // ```lang / ```diff:lang
  const fence = before.match(/^([ \t]*)(`{3,})((?:[\w#+.-]+:)?)([\w#+.-]*)$/);
  if (fence) {
    const [, indent, ticks, prefix, query] = fence;
    const items = _languageItems(project);
    if (!prefix) {
      items.unshift(
        { label: 'diff', insert: 'diff', detail: t('editorTools.completions.fences.diff') },
        { label: 'diff:', insert: 'diff:', detail: t('editorTools.completions.fences.diffLang'), reopen: true },
        { label: 'tree', insert: 'tree', detail: t('editorTools.completions.fences.tree') },
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

  // [toc] - right after '[' at the start of a line; anything else closes it again
  const block = before.match(/^[ \t]*\[([a-zA-Z]*)$/);
  if (block) {
    const close = after.startsWith(']') ? '' : ']';
    return _result(column, block[1], 0, [
      { label: 'toc', detail: t('editorTools.completions.toc_block'), insert: `toc${close}` },
    ]);
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
  if ((element === 'table' || element === null) && !targetType && !rest.slice(0, rest.length - query.length).trim())
    items.push(...TABLE_TARGETS);

  // a fresh position shows the list right away: after '{', ';' or a 'col 1:' target
  // (also an empty line of a multi-line block); elsewhere (e.g. after a space
  // between properties) a letter is needed, so it doesn't pop up while writing
  const beforeName = rest.slice(0, rest.length - query.length);
  const fresh = !beforeName.trim();
  return _result(column, query, fresh ? 0 : 1, items);
}

function _propertyDefinitions(element, targetType) {
  if (targetType)
    return TABLE_PROPERTIES[targetType];
  if (element === 'table')
    return TABLE_PROPERTIES.table;
  if (element === 'code')
    return CODE_PROPERTIES;
  if (element === 'toc')
    return TOC_PROPERTIES;
  if (element === 'tree')
    return TREE_PROPERTIES;
  if (element === 'list')
    return LIST_PROPERTIES;
  if (element === 'section')
    return SECTION_PROPERTIES;
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

/** @returns {'table'|'code'|'tree'|'toc'|'list'|'section'|null} */
function _elementType(line) {
  if (/^[ \t]*:::(?!:)[ \t]*\S/.test(line ?? ''))
    return 'section';
  if (/^[ \t]*\[toc\][ \t]*$/i.test(line ?? ''))
    return 'toc';
  if (/^[ \t]*`{3,}tree[ \t]*$/i.test(line ?? ''))
    return 'tree';
  if (/^[-*] /.test(line ?? ''))
    return 'list';
  if (/^[ \t]*\|/.test(line ?? ''))
    return 'table';
  if (/^[ \t]*`{3,}/.test(line ?? ''))
    return 'code';
  return null;
}

/**
 * Labels used or defined in the entry. At the start of a line the item writes a
 * definition (`label]: `) and labels without one come first; elsewhere a reference.
 */
function _footnoteItems(lines, lineIndex, before, after) {
  const asDefinition = /^\[\^[^\]\s]*$/.test(before);
  const { defined, used } = getFootnoteLabels(lines.filter((_, i) => i !== lineIndex));
  const close = after.startsWith(']') ? '' : ']';

  const items = [];
  const add = (label, detail) => items.push({
    label,
    detail,
    insert: asDefinition ? `${label}${close}${after.startsWith(']') ? '' : ': '}` : `${label}${close}`,
  });

  if (asDefinition) {
    for (const label of used)
      if (!defined.has(label))
        add(label, t('editorTools.completions.noDefinition'));
  }
  for (const [label, text] of defined)
    add(label, text);
  if (!asDefinition) {
    for (const label of used)
      if (!defined.has(label))
        add(label, t('editorTools.completions.noDefinition'));
  }
  return items;
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
