import { escapeHTML } from '@common/Common.js';

// ─── Tree (```tree) ───────────────────────────────────────────────────────────
// A folder structure, one entry per line, the level comes from the indentation
// (relative to the lines above, a tab counts as the project tab size). Drawing
// characters in front count as indentation, so `tree` output (├── │ └──, |-- `--)
// and |-|- prefixes work too.
//   src/            entry with children or a trailing / = folder
//     main.js  # x  text after ' #' = comment
//   + assets/       starts collapsed   ! dist/  never collapses   - lib/  starts open
// Properties: collapsible (folders toggle on click), collapsed (all folders start
// collapsed) / collapsed=N (only N levels open). <details> toggles without script.

const TREE_PREFIX_REGEX = /^(?:[ \t─-╿]|[|`](?:-+ ?)?)*/;
const TREE_MARKER_REGEX = /^([+!-]) (.*)$/;
const TREE_COMMENT_REGEX = /^(.*?)[ \t]+#[ \t]?(.*)$/;

const TREE_FOLDER_ICON = '<svg class="doc-tree__icon doc-tree__icon--folder" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 3.5a1 1 0 0 1 1-1h3.6l1.5 1.5h5.9a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/></svg>';
const TREE_FILE_ICON = '<svg class="doc-tree__icon doc-tree__icon--file" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 1.5h6l3 3v10h-9z M9.5 1.5v3h3"/></svg>';

export const isTreeBlock = block => !block.isDiff && block.langName?.toLowerCase() === 'tree';

/**
 * @typedef {Object} TreeEntry
 * @property {string} name
 * @property {string|null} comment
 * @property {'+'|'!'|'-'|null} marker
 * @property {boolean} folder - written with a trailing / (children make it a folder too)
 * @property {TreeEntry[]} children
 */

/**
 * Parses the lines of a tree block into nested entries.
 * @param {string} code
 * @returns {TreeEntry[]}
 */
function parseTreeEntries(code, tabSize) {
  const root = { children: [], width: -1 };
  const stack = [root];

  for (const line of code.split('\n')) {
    const prefix = line.match(TREE_PREFIX_REGEX)[0];
    let text = line.slice(prefix.length).trim();
    if (!text)
      continue;

    const width = prefix.replace(/\t/g, ' '.repeat(tabSize)).length;

    const marker = text.match(TREE_MARKER_REGEX);
    if (marker)
      text = marker[2].trim();

    const commented = text.match(TREE_COMMENT_REGEX);
    const name = (commented ? commented[1] : text).trim();
    const entry = {
      name: name.replace(/[/\\]$/, ''),
      comment: commented ? commented[2].trim() || null : null,
      marker: marker ? marker[1] : null,
      folder: /[/\\]$/.test(name),
      children: [],
      width,
    };

    while (stack[stack.length - 1].width >= width)
      stack.pop();
    stack[stack.length - 1].children.push(entry);
    stack.push(entry);
  }

  return root.children;
}

/**
 * Builds the html of a tree block.
 * @param {string} code
 * @param {Object<string, string|true>} props
 * @returns {string}
 */
export function buildTreeHTML(code, props, tabSize) {
  const entries = parseTreeEntries(code, tabSize);
  const collapsedLevels = props.collapsed === true ? 1 : parseInt(props.collapsed, 10);
  const allCollapsible = Boolean(props.collapsible) || props.collapsed !== undefined;

  const isCollapsible = entry => entry.children.length > 0 && entry.marker !== '!'
    && (allCollapsible || entry.marker === '+');
  const hasCollapsible = list => list.some(e => isCollapsible(e) || hasCollapsible(e.children));
  const chevrons = hasCollapsible(entries);

  const buildRow = (entry, isFolder) => {
    const chevron = chevrons ? '<span class="doc-tree__chevron" aria-hidden="true"></span>' : '';
    const comment = entry.comment ? `<span class="doc-tree__comment">${escapeHTML(entry.comment)}</span>` : '';
    return `${chevron}${isFolder ? TREE_FOLDER_ICON : TREE_FILE_ICON}`
      + `<span class="doc-tree__name">${escapeHTML(entry.name)}</span>${comment}`;
  };

  const buildList = (list, depth) => `<ul class="doc-tree__list">${list.map(entry => {
    const isFolder = entry.folder || entry.children.length > 0;
    const children = entry.children.length ? buildList(entry.children, depth + 1) : '';
    const cls = `doc-tree__item${isFolder ? ' doc-tree__item--folder' : ''}`;

    if (!isCollapsible(entry))
      return `<li class="${cls}"><div class="doc-tree__row">${buildRow(entry, isFolder)}</div>${children}</li>`;

    const closed = entry.marker === '+'
      || (entry.marker !== '-' && collapsedLevels > 0 && depth + 1 >= collapsedLevels);
    return `<li class="${cls}"><details class="doc-tree__details"${closed ? '' : ' open'}>`
      + `<summary class="doc-tree__row">${buildRow(entry, true)}</summary>${children}</details></li>`;
  }).join('')}</ul>`;

  if (!entries.length)
    return '<div class="doc-tree doc-tree--empty"><span class="doc-tree__comment">Empty tree</span></div>';
  return `<div class="doc-tree${chevrons ? ' doc-tree--collapsible' : ''}">${buildList(entries, 0)}</div>`;
}
