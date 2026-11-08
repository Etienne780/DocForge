/**
 * Colors of the doc editor syntax highlighting.
 *
 * Defaults are the CSS variables `--editor-color-<id>` in the dark/light blocks of main.css,
 * the active app theme overrides them on <html> (group "Doc editor highlighting" of
 * @data/AppThemeManager.js).
 */
export const EDITOR_COLOR_TOKENS = [
  { id: 'text',           name: 'Text' },
  { id: 'markup',         name: 'Markup characters' },
  { id: 'heading',        name: 'Heading' },
  { id: 'bold',           name: 'Bold' },
  { id: 'italic',         name: 'Italic' },
  { id: 'code',           name: 'Inline code' },
  { id: 'code-block',     name: 'Code block' },
  { id: 'link',           name: 'Link text' },
  { id: 'link-url',       name: 'Link URL' },
  { id: 'ref',            name: 'Reference link' },
  { id: 'ref-broken',     name: 'Broken reference link' },
  { id: 'anchor',         name: 'Anchor' },
  { id: 'property',       name: 'Property name' },
  { id: 'property-value', name: 'Property value' },
  { id: 'comment',        name: 'Comment' },
  { id: 'list',           name: 'List marker' },
  { id: 'quote',          name: 'Blockquote' },
  { id: 'table',          name: 'Table' },
  { id: 'selection',      name: 'Selection' },
  { id: 'search-match',   name: 'Search match' },
  { id: 'search-active',  name: 'Current search match' },
  { id: 'search-active-border', name: 'Current search match border' },
  { id: 'search-range',   name: 'Search range (selection)' },
];

/** @returns {string} CSS variable of a token, e.g. '--editor-color-heading' */
export function getEditorColorVar(id) {
  return `--editor-color-${id}`;
}

/**
 * Removes inline editor colors from `element`. Before app themes, user colors were set there;
 * now they come from the app theme on <html> (@data/AppThemeManager.js).
 * @param {HTMLElement} element
 */
export function applyEditorColors(element) {
  for (const { id } of EDITOR_COLOR_TOKENS)
    element.style.removeProperty(getEditorColorVar(id));
}
