import { getProjectLinks, findNodeInProject, findAnchorsInContent, slugifyLinkName, isLinkAnchorValid } from '@data/LinkManager.js';
import { getLanguages, getPresetLanguages } from '@data/SyntaxDefinitionManager.js';
import { getFootnoteLabels } from './ToolbarHelper.js';
import { TABLE_HOVER_TYPES, TABLE_STRIPE_TYPES, TABLE_ALIGNS, TOC_STYLES, LIST_BULLETS } from '@core/markdownParser/MarkdownParser.js';
import { t } from '@core/i18n/I18n.js';

/**
 * EditorCompletions - finds the suggestions for the cursor position of the doc editor.
 *
 * Contexts (syntax of @core/markdownParser/MarkdownParser.js):
 *   [[slug          -> reference links of the project
 *   [^label         -> footnote labels of the entry (at the start of a line: as a definition)
 *   ```lang         -> languages (name and aliases), also after diff:
 *   [               -> snippets: [text](url), [[ reference link, [^ footnote, [toc] at the start of a line,
 *                      check marks after a list marker
 *   <               -> snippets: <!-- comment --> (multi-line at the start of a line)
 *   :::             -> snippet: collapsible section (when no section is open above)
 *   - / 1.          -> check marks for the first item of a list
 *   {#              -> anchor names: slug of the heading of the line, anchors that links point to but that are missing
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
 * @property {[number, number]} [select] - start / end offset in `insert` selected after inserting
 *   (a placeholder like 'Title'; equal offsets only place the cursor)
 */

/**
 * @typedef {Object} CompletionResult
 * @property {number} from - column where the replaced text starts (the cursor is the end)
 * @property {string} query
 * @property {number} minQuery - characters needed before the list opens by itself
 * @property {boolean} [passEnter] - a list that opened by itself lets Enter through until an item is chosen
 *   with the arrow keys, even with a typed query (snippets of characters that are also normal text, like '<')
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
const LIST_ITEM_REGEX = /^[ \t]*(?:[-*]|\d+\.|n\.) /;
const SECTION_LINE_REGEX = /^[ \t]*:::(?!:)(.*)$/;
const FENCE_LINE_REGEX = /^[ \t]*`{3,}/;

/**
 * @param {object} context
 * @param {string[]} context.lines
 * @param {number} context.lineIndex
 * @param {number} context.column
 * @param {import('./EditorTokenizer.js').LineState} context.lineState - state at the start of the line
 * @param {Object} context.project
 * @param {string|null} [context.nodeId] - entry being edited (anchors that links point to)
 * @returns {CompletionResult|null}
 */
export function getCompletions({ lines, lineIndex, column, lineState, project, nodeId = null }) {
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

  // the snippets below are no syntax inside inline code or after a backslash (escape)
  const inCode = _inInlineCode(before);

  // '[': [toc] at the start of a line (letters filter it, anything else closes it again);
  // right after '[' also check marks (after a list marker) and the link snippets
  const bracket = before.match(/(?<!\\)\[([a-zA-Z]*)$/);
  if (bracket && !inCode) {
    const query = bracket[1];
    const head = before.slice(0, before.length - query.length - 1);
    const close = after.startsWith(']') ? '' : ']';
    const items = [];
    if (BLANK_REGEX.test(head))
      items.push({ label: 'toc', detail: t('editorTools.completions.toc_block'), insert: `toc${close}` });
    if (!query) {
      if (/^[ \t]*(?:[-*]|\d+\.|n\.) $/.test(head))
        items.push(..._checkMarkItems(close ? '] ' : ''));
      items.push(..._linkSnippetItems(close));
    }
    return items.length ? _result(column, query, 0, items) : null;
  }

  // '<' -> <!-- comment -->
  const comment = before.match(/(?<!\\)<(?:!-{0,2})?$/);
  if (comment && !inCode)
    return _result(column, comment[0], 0, _commentItems(before.slice(0, comment.index), after), { passEnter: true });

  // '::: ' at the start of a line -> collapsible section, unless it closes an open one
  const section = before.match(/^([ \t]*):::$/);
  if (section && !after.trim() && !_isSectionOpen(lines, lineIndex))
    return _result(column, ':::', 0, _sectionItems(section[1]), { passEnter: true });

  // first item of a list ('- ' / '1. ' / 'n. ') -> check marks
  if (/^[ \t]*(?:[-*]|\d+\.|n\.) $/.test(before) && !after.trim() && !LIST_ITEM_REGEX.test(lines[lineIndex - 1] ?? ''))
    return _result(column, '', 0, _checkMarkItems('] ', '['));

  // {#anchor
  const anchor = before.match(/(?<!\\)\{#([a-z0-9-]*)$/);
  if (anchor && !inCode) {
    const close = after.startsWith('}') ? '' : '}';
    return _result(column, anchor[1], 0, _anchorItems(lines, lineIndex, before.slice(0, anchor.index), project, nodeId, close));
  }

  // {lang=cpp}`code`
  const inlineLang = before.match(/\{lang=([\w#+.-]*)$/);
  if (inlineLang)
    return _result(column, inlineLang[1], 0, _languageItems(project));

  // property blocks
  if (lineState.props)
    return _propertyCompletion(column, before, _elementBelowBlock(lines, lineIndex));

  // '{' at the start of a line: properties of the element directly below; right after '{' also '#'
  // for an anchor {#name} (the only item when no element is below)
  const single = before.match(/^[ \t]*\{([^{}]*)$/);
  if (single && !single[1].startsWith('#')) {
    const element = _elementType(lines[lineIndex + 1]);
    // closes the block: {#|} with the cursor before the '}'
    const anchorItem = single[1] === ''
      ? { label: '#', detail: t('editorTools.completions.snippets.anchor'), insert: after.startsWith('}') ? '#' : '#}', select: [1, 1], reopen: true }
      : null;

    if (!element)
      return anchorItem ? _result(column, '', 0, [anchorItem]) : null;

    const result = _propertyCompletion(column, single[1], element);
    if (result && anchorItem)
      result.items.push(anchorItem);
    return result;
  }

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

/** True if the end of `before` is inside an inline code span (odd number of backticks). */
function _inInlineCode(before) {
  return ((before.match(/`/g)?.length ?? 0) % 2) === 1;
}

/** `[ ]` / `[x]`: `open` is inserted in front ('[' after a bare list marker), `close` behind (e.g. '] '). */
function _checkMarkItems(close, open = '') {
  return [
    { label: '[ ]', detail: t('editorTools.completions.snippets.checkOpen'), insert: `${open} ${close}` },
    { label: '[x]', detail: t('editorTools.completions.snippets.checkDone'), insert: `${open}x${close}` },
  ];
}

/** Right after '[': external link (text selected), reference link and footnote (both open their own list). */
function _linkSnippetItems(close) {
  const text = t('editorTools.completions.snippets.linkText');
  const items = [];
  // with a ']' behind the cursor the link is already being written
  if (close)
    items.push({ label: '[text](url)', detail: t('editorTools.completions.snippets.link'), insert: `${text}](url)`, select: [0, text.length] });
  items.push(
    { label: '[[slug]]', detail: t('editorTools.completions.snippets.refLink'), insert: '[', reopen: true },
    { label: '[^label]', detail: t('editorTools.completions.snippets.footnote'), insert: '^', reopen: true },
  );
  return items;
}

/** `<!-- -->` with the cursor inside; at the start of an empty line also a multi-line comment. */
function _commentItems(head, after) {
  const items = [
    { label: '<!-- -->', detail: t('editorTools.completions.snippets.comment'), insert: '<!--  -->', select: [5, 5] },
  ];
  if (BLANK_REGEX.test(head) && !after.trim()) {
    const indent = head;
    const insert = `<!--\n${indent}\n${indent}-->`;
    const cursor = 5 + indent.length;
    items.push({ label: '<!-- ↵ -->', detail: t('editorTools.completions.snippets.commentBlock'), insert, select: [cursor, cursor] });
  }
  return items;
}

/** `::: Title` + empty line + `:::`, the title selected; also with `{open}` above. */
function _sectionItems(indent) {
  const title = t('editorTools.completions.snippets.sectionTitle');
  const body = `::: ${title}\n${indent}\n${indent}:::`;
  const open = `{open}\n${indent}`;
  return [
    { label: `::: ${title}`, detail: t('editorTools.completions.snippets.section'), insert: body, select: [4, 4 + title.length] },
    {
      label: `::: ${title} {open}`,
      detail: t('editorTools.completions.snippets.sectionOpen'),
      insert: open + body,
      select: [open.length + 4, open.length + 4 + title.length],
    },
  ];
}

/** True if a `::: Title` above `lineIndex` (outside of code fences) has no closing `:::` yet. */
function _isSectionOpen(lines, lineIndex) {
  let depth = 0;
  let inFence = false;
  for (let i = 0; i < lineIndex; i++) {
    if (FENCE_LINE_REGEX.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (inFence)
      continue;
    const section = lines[i].match(SECTION_LINE_REGEX);
    if (section && section[1].trim())
      depth++;
    else if (section && depth > 0)
      depth--;
  }
  return depth > 0;
}

/**
 * Anchor names for `{#`: the slug of the heading of the line and the anchors that links point to
 * in this entry but that don't exist yet. Names already used in the entry are left out.
 */
function _anchorItems(lines, lineIndex, head, project, nodeId, close) {
  const defined = new Set(findAnchorsInContent(lines.filter((_, i) => i !== lineIndex).join('\n')));
  const items = [];
  const seen = new Set();
  const add = (name, detail) => {
    if (!isLinkAnchorValid(name) || defined.has(name) || seen.has(name))
      return;
    seen.add(name);
    items.push({ label: name, detail, insert: `${name}${close}` });
  };

  const heading = head.match(/^#{1,4} (.+)$/);
  if (heading)
    add(slugifyLinkName(heading[1].replace(/\{#[^}]*\}/g, '')), t('editorTools.completions.snippets.anchorHeading'));

  if (nodeId) {
    for (const link of getProjectLinks(project)) {
      if (link.target?.nodeId === nodeId && link.target.anchor)
        add(link.target.anchor, t('editorTools.completions.snippets.anchorLink', { name: link.name }));
    }
  }
  return items;
}

/** Filters by the query (prefix matches first) and caps the list. */
function _result(column, query, minQuery, items, { passEnter = false } = {}) {
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
    passEnter,
    items: scored.slice(0, MAX_ITEMS).map(s => s.item),
  };
}
