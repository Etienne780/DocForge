import { state } from '@core/State.js';

/**
 * Colors of the doc editor syntax highlighting.
 *
 * Defaults are the CSS variables `--editor-color-<id>` in the dark/light blocks of main.css.
 * User colors are stored per mode in state.editorColors ({ dark: { id: color }, light: { ... } })
 * and set as inline CSS variables on the editor element by applyEditorColors().
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
];

export const EDITOR_COLOR_MODES = ['dark', 'light'];

const TOKEN_IDS = new Set(EDITOR_COLOR_TOKENS.map(token => token.id));

/** @returns {string} CSS variable of a token, e.g. '--editor-color-heading' */
export function getEditorColorVar(id) {
  return `--editor-color-${id}`;
}

/**
 * @param {'dark'|'light'} [mode] - Defaults to the current app mode.
 * @returns {Object<string, string>} user colors of the mode (copy), tokens without one use the default
 */
export function getEditorColors(mode = null) {
  return { ...state.get('editorColors')?.[_resolveMode(mode)] };
}

/** @returns {string|null} user color of a token, null = default */
export function getEditorColor(id, mode = null) {
  return getEditorColors(mode)[id] ?? null;
}

/**
 * Sets the user color of a token. null or '' removes it (back to the default).
 * @param {string} id - Token id from EDITOR_COLOR_TOKENS.
 * @param {string|null} value - Any CSS color.
 * @param {'dark'|'light'} [mode] - Defaults to the current app mode.
 */
export function setEditorColor(id, value, mode = null) {
  if (!TOKEN_IDS.has(id))
    return;

  const resolved = _resolveMode(mode);
  const colors = state.get('editorColors');
  const next = { ...colors, [resolved]: { ...colors?.[resolved] } };

  if (value == null || value === '')
    delete next[resolved][id];
  else
    next[resolved][id] = value;

  state.set('editorColors', next);
}

/**
 * Removes all user colors of a mode, or of both modes.
 * @param {'dark'|'light'|null} [mode=null] - null resets both modes.
 */
export function resetEditorColors(mode = null) {
  const colors = state.get('editorColors');
  const next = mode
    ? { ...colors, [mode]: {} }
    : Object.fromEntries(EDITOR_COLOR_MODES.map(m => [m, {}]));

  state.set('editorColors', next);
}

/**
 * Sets the user colors of the current mode as CSS variables on `element`
 * and removes the ones without a user color (the defaults of main.css apply).
 * @param {HTMLElement} element
 */
export function applyEditorColors(element) {
  const colors = getEditorColors();
  for (const { id } of EDITOR_COLOR_TOKENS) {
    if (colors[id])
      element.style.setProperty(getEditorColorVar(id), colors[id]);
    else
      element.style.removeProperty(getEditorColorVar(id));
  }
}

function _resolveMode(mode) {
  if (EDITOR_COLOR_MODES.includes(mode))
    return mode;
  return state.get('isDarkMode') ? 'dark' : 'light';
}
