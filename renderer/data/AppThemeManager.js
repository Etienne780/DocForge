import { APP_THEME_SCHEMA_VERSION, FILE_EXTENSION_APP_THEME } from '@core/AppMeta.js';
import { state } from '@core/State.js';
import { eventBus } from '@core/EventBus.js';
import { wrapEntity, unwrapEntity } from '@core/Envelope.js';
import { isPlatformWeb, getUserDataPath, pickImportFile, exportWithSaveDialog } from '@core/Platform.js';
import { APP_THEME_PRESETS, DEFAULT_APP_THEME_ID } from '@core/presets/AppThemePresets.js';
import { migrateAppTheme } from '@migration/AppThemeMigration.js';
import { EDITOR_COLOR_TOKENS } from '@common/EditorColors.js';
import { generateId } from '@common/Common.js';

/**
 * AppThemeManager - colors of the app UI (not the doc themes of a project).
 *
 * A theme has a dark and a light variant: `{ id, name, builtIn?, baseId?, colors: { dark, light } }`,
 * colors = { '<css variable without -->': value }. The variant follows state.isDarkMode, the
 * theme state.appThemeId. The colors of the active variant are set as inline CSS variables on
 * <html>; a color the theme doesn't have falls back to its base theme and finally to the DocForge
 * value of main.css ([data-theme] blocks, read from a hidden probe element).
 *
 * Built-in themes (@core/presets/AppThemePresets.js) can't be changed, duplicateAppTheme() makes an
 * editable copy (with every color, baseId = the source for "reset").
 * Custom themes: desktop = one file per theme in <userData>/app-themes/<id>.dfapptheme, written
 * on every change; web = not stored (only for the session, export them to keep them).
 */

const THEMES_DIR = 'app-themes';
const WRITE_DELAY_MS = 400;

export const APP_THEME_MODES = ['dark', 'light'];

/** Color groups shown in the theme editor, `var` without '--'. */
export const APP_THEME_GROUPS = [
  {
    id: 'backgrounds', name: 'Backgrounds',
    colors: [
      { var: 'background',          name: 'Window background' },
      { var: 'background-elevated', name: 'Sidebars and panels' },
      { var: 'background-surface',  name: 'Surfaces' },
      { var: 'background-raised',   name: 'Inputs and cards' },
      { var: 'background-overlay',  name: 'Overlays' },
      { var: 'background-dark',     name: 'Darkest background' },
    ],
  },
  {
    id: 'text', name: 'Text',
    colors: [
      { var: 'text-primary', name: 'Text' },
      { var: 'text-muted',   name: 'Muted text' },
      { var: 'text-warning', name: 'Warnings' },
    ],
  },
  {
    id: 'accent', name: 'Accent',
    colors: [
      { var: 'accent-color',      name: 'Accent' },
      { var: 'accent-bg',         name: 'Accent background (hover, selection)' },
      { var: 'accent-bg-lighter', name: 'Accent background, lighter' },
      { var: 'accent-bg-darker',  name: 'Accent background, darker' },
      { var: 'focus-ring',        name: 'Focus ring' },
    ],
  },
  {
    id: 'borders', name: 'Borders and handles',
    colors: [
      { var: 'border-color',               name: 'Borders' },
      { var: 'border-color-secondary',     name: 'Strong borders' },
      { var: 'resize-handle-color',        name: 'Resize handles' },
      { var: 'resize-handle-hover-color',  name: 'Resize handles (hover)' },
    ],
  },
  {
    id: 'danger', name: 'Danger',
    colors: [
      { var: 'background-danger',         name: 'Danger' },
      { var: 'background-danger-lighter', name: 'Danger, variant 1' },
      { var: 'background-danger-darker',  name: 'Danger, variant 2' },
    ],
  },
  {
    id: 'links-code', name: 'Links and code',
    colors: [
      { var: 'link-color',      name: 'Links' },
      { var: 'link-underline',  name: 'Link underline' },
      { var: 'code-background', name: 'Code background' },
      { var: 'code-text',       name: 'Code text' },
    ],
  },
  {
    id: 'scrollbars', name: 'Scrollbars and shadows',
    colors: [
      { var: 'scrollbar-thumb',        name: 'Scrollbar' },
      { var: 'scrollbar-thumb-raised', name: 'Scrollbar on raised surfaces' },
      { var: 'scrollbar-track',        name: 'Scrollbar track' },
      { var: 'popup-shadow-color',     name: 'Popup shadow' },
    ],
  },
  {
    id: 'color-picker', name: 'Color picker',
    colors: [
      { var: 'color-picker-checker-light', name: 'Transparency checker, light' },
      { var: 'color-picker-checker-dark',  name: 'Transparency checker, dark' },
      { var: 'color-picker-thumb',         name: 'Handles' },
      { var: 'color-picker-thumb-shadow',  name: 'Handle shadow' },
      { var: 'color-picker-shadow',        name: 'Panel shadow' },
    ],
  },
  {
    id: 'editor', name: 'Doc editor highlighting',
    colors: EDITOR_COLOR_TOKENS.map(token => ({ var: `editor-color-${token.id}`, name: token.name })),
  },
];

const ALL_VARS = APP_THEME_GROUPS.flatMap(group => group.colors.map(color => color.var));

/** @type {Object[]} */
let _customThemes = [];
let _appliedVars = [];
let _probe = null;
const _writeTimers = new Map();

// ─── Setup ────────────────────────────────────────────────────────────────────

/**
 * Loads the custom themes (desktop), takes over old editor colors and applies the active
 * theme. Re-applies it when the theme or the dark mode changes.
 */
export async function initAppThemes() {
  _customThemes = await _loadCustomThemes();
  _migrateEditorColors();

  if (!getAppTheme(state.get('appThemeId')))
    state.set('appThemeId', DEFAULT_APP_THEME_ID);

  applyAppTheme();
  eventBus.on('state:change:appThemeId', () => applyAppTheme());
  eventBus.on('state:change:isDarkMode', () => applyAppTheme());
}

/** Sets the colors of the active theme and mode on <html>. */
export function applyAppTheme() {
  const root = document.documentElement;
  _appliedVars.forEach(name => root.style.removeProperty(`--${name}`));
  _appliedVars = [];

  const theme = getActiveAppTheme();
  if (!theme || theme.id === DEFAULT_APP_THEME_ID)
    return;

  const mode = getCurrentMode();
  for (const name of ALL_VARS) {
    const value = _ownValue(theme, mode, name);
    if (value == null)
      continue;
    root.style.setProperty(`--${name}`, value);
    _appliedVars.push(name);
  }
}

export function getCurrentMode() {
  return state.get('isDarkMode') ? 'dark' : 'light';
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** @returns {Object[]} built-in themes first, then the custom ones */
export function getAppThemes() {
  return [...APP_THEME_PRESETS, ..._customThemes];
}

export function getAppTheme(id) {
  return getAppThemes().find(theme => theme.id === id) ?? null;
}

export function getActiveAppTheme() {
  return getAppTheme(state.get('appThemeId')) ?? getAppTheme(DEFAULT_APP_THEME_ID);
}

export function setActiveAppTheme(id) {
  if (getAppTheme(id))
    state.set('appThemeId', id);
}

export function isAppThemeBuiltIn(id) {
  return APP_THEME_PRESETS.some(theme => theme.id === id);
}

/**
 * Color of a theme, with the fallbacks (base theme, DocForge).
 * @param {Object|string} themeOrId
 * @param {'dark'|'light'} mode
 * @param {string} name - variable without '--'
 * @returns {string}
 */
export function getAppThemeColor(themeOrId, mode, name) {
  const theme = typeof themeOrId === 'string' ? getAppTheme(themeOrId) : themeOrId;
  return (theme && _ownValue(theme, mode, name)) ?? getDefaultAppThemeColor(mode, name);
}

/** Value of a color for "reset": the base theme of a copy, otherwise DocForge. */
export function getAppThemeBaseColor(themeOrId, mode, name) {
  const theme = typeof themeOrId === 'string' ? getAppTheme(themeOrId) : themeOrId;
  const base = theme?.baseId ? getAppTheme(theme.baseId) : null;
  return base ? getAppThemeColor(base, mode, name) : getDefaultAppThemeColor(mode, name);
}

/** DocForge value of a color (main.css). */
export function getDefaultAppThemeColor(mode, name) {
  if (!_probe) {
    _probe = document.createElement('div');
    _probe.setAttribute('aria-hidden', 'true');
    _probe.className = 'app-theme-probe';
    document.body.append(_probe);
  }
  _probe.setAttribute('data-theme', mode);
  return getComputedStyle(_probe).getPropertyValue(`--${name}`).trim();
}

/** Own value, else the base theme's (a copy keeps working if a color is added later). */
function _ownValue(theme, mode, name, depth = 0) {
  const own = theme.colors?.[mode]?.[name];
  if (own != null && own !== '')
    return own;
  const base = theme.baseId && depth < 5 ? getAppTheme(theme.baseId) : null;
  return base ? _ownValue(base, mode, name, depth + 1) : null;
}

// ─── Custom themes ────────────────────────────────────────────────────────────

/**
 * Editable copy of a theme with every color of both modes.
 * @param {string} sourceId
 * @param {string} [name]
 * @returns {Object} the new theme
 */
export function duplicateAppTheme(sourceId, name = null) {
  const source = getAppTheme(sourceId);
  if (!source)
    return null;

  const colors = {};
  for (const mode of APP_THEME_MODES)
    colors[mode] = Object.fromEntries(ALL_VARS.map(v => [v, getAppThemeColor(source, mode, v)]));

  const theme = {
    id: `apptheme_${generateId()}`,
    name: _uniqueName(name ?? `${source.name} copy`),
    baseId: source.builtIn ? source.id : (source.baseId ?? null),
    colors,
  };
  _customThemes.push(theme);
  _save(theme);
  _emitChange();
  return theme;
}

export function renameAppTheme(id, name) {
  const theme = _custom(id);
  const trimmed = name?.trim();
  if (!theme || !trimmed)
    return false;
  theme.name = _uniqueName(trimmed, id);
  _save(theme);
  _emitChange();
  return true;
}

export async function deleteAppTheme(id) {
  const theme = _custom(id);
  if (!theme)
    return false;
  _customThemes = _customThemes.filter(t => t.id !== id);
  if (state.get('appThemeId') === id)
    state.set('appThemeId', theme.baseId && getAppTheme(theme.baseId) ? theme.baseId : DEFAULT_APP_THEME_ID);
  await _removeFile(id);
  _emitChange();
  return true;
}

/**
 * Sets one color of a custom theme. null resets it to the base value.
 * @param {string} id
 * @param {'dark'|'light'} mode
 * @param {string} name
 * @param {string|null} value
 */
export function setAppThemeColor(id, mode, name, value) {
  const theme = _custom(id);
  if (!theme || !ALL_VARS.includes(name))
    return;
  theme.colors[mode] ??= {};
  theme.colors[mode][name] = value == null ? getAppThemeBaseColor(theme, mode, name) : value;
  _afterColorChange(theme);
}

/**
 * Copies colors from another theme (e.g. a whole group).
 * @param {string} targetId - custom theme
 * @param {'dark'|'light'} targetMode
 * @param {string} sourceId
 * @param {'dark'|'light'} sourceMode
 * @param {string[]} names
 */
export function copyAppThemeColors(targetId, targetMode, sourceId, sourceMode, names) {
  const theme = _custom(targetId);
  const source = getAppTheme(sourceId);
  if (!theme || !source)
    return;
  theme.colors[targetMode] ??= {};
  for (const name of names.filter(n => ALL_VARS.includes(n)))
    theme.colors[targetMode][name] = getAppThemeColor(source, sourceMode, name);
  _afterColorChange(theme);
}

function _afterColorChange(theme) {
  if (state.get('appThemeId') === theme.id)
    applyAppTheme();
  _save(theme);
  _emitChange();
}

function _custom(id) {
  return _customThemes.find(theme => theme.id === id) ?? null;
}

function _uniqueName(name, exceptId = null) {
  const taken = new Set(getAppThemes().filter(t => t.id !== exceptId).map(t => t.name.toLowerCase()));
  if (!taken.has(name.toLowerCase()))
    return name;
  for (let i = 2; ; i++) {
    const candidate = `${name} ${i}`;
    if (!taken.has(candidate.toLowerCase()))
      return candidate;
  }
}

function _emitChange() {
  eventBus.emit('appThemes:change');
}

// ─── Export / import ──────────────────────────────────────────────────────────

/** Saves a theme (also a built-in one, with all its colors) as a .dfapptheme file. */
export async function exportAppTheme(id) {
  const theme = getAppTheme(id);
  if (!theme)
    return false;

  const colors = {};
  for (const mode of APP_THEME_MODES)
    colors[mode] = Object.fromEntries(ALL_VARS.map(v => [v, getAppThemeColor(theme, mode, v)]));

  const data = { id: theme.id, name: theme.name, colors };
  const content = JSON.stringify(wrapEntity('appTheme', APP_THEME_SCHEMA_VERSION, data), null, 2);
  return exportWithSaveDialog(content, theme.name, FILE_EXTENSION_APP_THEME, 'application/json');
}

/**
 * Lets the user pick a .dfapptheme file and adds it as a custom theme (new id).
 * @returns {Promise<Object|null>} the imported theme
 */
export async function importAppTheme() {
  const result = await pickImportFile([FILE_EXTENSION_APP_THEME.slice(1)]);
  if (result.canceled || !result.data)
    return null;
  return importAppThemeFromText(result.data);
}

/**
 * Adds a theme from file content.
 * @param {string} text
 * @returns {Object|null} the imported theme, null if the content is not an app theme
 */
export function importAppThemeFromText(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (raw?.kind && raw.kind !== 'appTheme')
    return null;

  const data = unwrapEntity(raw, migrateAppTheme, APP_THEME_SCHEMA_VERSION);
  if (!data)
    return null;

  const theme = {
    ...data,
    id: `apptheme_${generateId()}`,
    name: _uniqueName(data.name || 'Imported theme'),
    baseId: data.baseId && getAppTheme(data.baseId) ? data.baseId : null,
  };
  delete theme.builtIn;
  _customThemes.push(theme);
  _save(theme);
  _emitChange();
  return theme;
}

// ─── Storage (desktop) ────────────────────────────────────────────────────────

async function _themesDir() {
  const userData = await getUserDataPath();
  return userData ? window.electronAPI.joinPath(userData, THEMES_DIR) : null;
}

async function _loadCustomThemes() {
  if (isPlatformWeb())
    return [];

  try {
    const dir = await _themesDir();
    const listing = dir ? await window.electronAPI.readDir(dir) : null;
    if (!listing?.ok)
      return [];

    const themes = [];
    for (const entry of listing.entries) {
      if (entry.isDirectory || !entry.name.endsWith(FILE_EXTENSION_APP_THEME))
        continue;
      const file = await window.electronAPI.readFile(await window.electronAPI.joinPath(dir, entry.name));
      if (!file.ok)
        continue;
      try {
        const data = unwrapEntity(JSON.parse(file.data), migrateAppTheme, APP_THEME_SCHEMA_VERSION);
        if (data?.id && !isAppThemeBuiltIn(data.id))
          themes.push({ ...data, builtIn: undefined });
      } catch (error) {
        console.warn(`[AppThemeManager] skipped invalid theme file '${entry.name}':`, error);
      }
    }
    return themes.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('[AppThemeManager] failed to load the custom themes:', error);
    return [];
  }
}

/** Writes a custom theme shortly after the last change (desktop). */
function _save(theme) {
  if (isPlatformWeb())
    return;
  clearTimeout(_writeTimers.get(theme.id));
  _writeTimers.set(theme.id, setTimeout(() => {
    _writeTimers.delete(theme.id);
    _writeFile(theme).catch(error => console.error('[AppThemeManager] failed to save a theme:', error));
  }, WRITE_DELAY_MS));
}

async function _writeFile(theme) {
  if (!_custom(theme.id))
    return;
  const dir = await _themesDir();
  if (!dir)
    return;
  await window.electronAPI.mkdir(dir);
  const { builtIn, ...data } = theme;
  const content = JSON.stringify(wrapEntity('appTheme', APP_THEME_SCHEMA_VERSION, data), null, 2);
  const result = await window.electronAPI.writeFile(await window.electronAPI.joinPath(dir, `${theme.id}${FILE_EXTENSION_APP_THEME}`), content);
  if (!result?.ok)
    eventBus.emit('toast:show', { message: `Could not save the theme "${theme.name}"`, type: 'error' });
}

async function _removeFile(id) {
  clearTimeout(_writeTimers.get(id));
  _writeTimers.delete(id);
  if (isPlatformWeb())
    return;
  const dir = await _themesDir();
  if (dir)
    await window.electronAPI.removePath(await window.electronAPI.joinPath(dir, `${id}${FILE_EXTENSION_APP_THEME}`));
}

// ─── Old editor colors ────────────────────────────────────────────────────────

/**
 * Before app themes, the doc editor colors were stored in state.editorColors. If there are
 * any, they become a custom theme "My editor colors" (DocForge + those colors), which is selected.
 */
function _migrateEditorColors() {
  const old = state.get('editorColors');
  const hasColors = APP_THEME_MODES.some(mode => Object.keys(old?.[mode] ?? {}).length);
  if (!hasColors)
    return;

  const theme = duplicateAppTheme(DEFAULT_APP_THEME_ID, 'My editor colors');
  for (const mode of APP_THEME_MODES) {
    for (const [id, value] of Object.entries(old[mode] ?? {}))
      if (value)
        theme.colors[mode][`editor-color-${id}`] = value;
  }
  _save(theme);
  state.set('appThemeId', theme.id);
  state.set('editorColors', { dark: {}, light: {} });
}
