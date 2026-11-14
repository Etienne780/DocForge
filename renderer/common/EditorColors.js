import { t } from '@core/i18n/I18n.js';

/**
 * Colors of the doc editor syntax highlighting.
 *
 * Defaults are the CSS variables `--editor-color-<id>` in the dark/light blocks of main.css,
 * the active app theme overrides them on <html> (group "Doc editor highlighting" of
 * @data/AppThemeManager.js).
 */
export const EDITOR_COLOR_TOKENS = [
  'text',
  'markup',
  'heading',
  'bold',
  'italic',
  'code',
  'code-block',
  'link',
  'link-url',
  'ref',
  'ref-broken',
  'anchor',
  'escape',
  'property',
  'property-value',
  'comment',
  'list',
  'quote',
  'table',
  'selection',
  'search-match',
  'search-active',
  'search-active-border',
  'search-range',
].map(id => ({ id, get name() { return t(`appTheme.editorTokens.${id}`); } }));

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
