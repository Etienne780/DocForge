import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { generateId } from '@common/Common.js';
import { revokeThemeCache } from '@common/HtmlBuilder.js';

export const DOC_THEME_BLOB_SECTION = 'doctheme';

const THEME_SCHEMA = _buildThemeSchema();

// ─── ID Generation ────────────────────────────────────────────────────────────

/**
 * Generates a short, collision-resistant unique ID for a Doc Theme.
 * @returns {string}
 */
export function generateDocThemeId() {
  return 'docTheme_' + generateId();
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Creates a new Doc Theme.
 * @param {string} name
 * @returns {Object} Doc Theme
 */
export function createDocTheme(name, entries = null) {
  return {
    id: generateDocThemeId(),
    name,
    builtIn: false,
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
    settings: {
      entries: (entries) ? entries : createDefaultDocThemeEntries(),
      mapping: []
    }
  };
}

export function createBuiltInTheme(name, overrides = {}) {
  const entries = createDefaultDocThemeEntries();

  for (const [key, value] of Object.entries(overrides)) {
    const entry = entries.find(e => e.name === key);
    if (entry) 
      entry.value = value;
  }
  
  const theme = createDocTheme(name, entries);
  theme.id = 'theme_' + name;
  theme.builtIn = true;
  theme.createdAt = new Date(0).getTime();
  return theme;
}

export function createLanguageMapping(languageId, styleId) {
  return { languageID: languageId, styleId: styleId };
}

export function createDefaultDocThemeEntries() {
  return THEME_SCHEMA.map(s => ({
    name: s.name,
    value: s.value,
    active: s.active,
  }));
}

export function _buildThemeSchema() {
  const e = (name, type, value, extra = {}) => ({
    name,
    type,
    value,
    active: true,
    ...extra
  });

  return [
    // ─── COLORS ─────────────────────────────────────────────

    e('background', 'color', '#0c0c12', { group: 'background' }),
    e('background-surface', 'color', '#13131c', { group: 'background' }),
    e('background-elevated', 'color', '#1a1a26', { group: 'background' }),

    e('text-primary', 'color', '#e0dbd0', { group: 'text' }),
    e('text-secondary', 'color', '#9898b0', { group: 'text' }),
    e('text-muted', 'color', '#7a7a95', { group: 'text' }),

    e('accent', 'color', '#22d4a8', { group: 'accent' }),
    e('accent-hover', 'color', '#1fb89a', { group: 'accent' }),

    e('link', 'color', '#78a8ff', { group: 'accent' }),
    e('link-underline', 'color', '#6286c8', { group: 'accent' }),

    e('border', 'color', '#252538', { group: 'border' }),

    e('code-background', 'color', '#07070f', { group: 'code' }),
    e('code-border', 'color', '#1c1c2a', { group: 'code' }),
    e('code-text', 'color', '#7a7a95', { group: 'code' }),

    e('code-tag-text', 'color', '#80d89a', {
      group: 'code',
      active: true,
    }),

    e('heading', 'color', '#f0ebe0', { group: 'heading' }),

    // ─── SPACING ─────────────────────────────────────────────

    e('gap-paragraph', 'number', 16, { min: 0, max: 64 }),
    e('gap-heading', 'number', 24, { min: 0, max: 64 }),
    e('code-block-gap', 'number', 32, { min: 0, max: 128 }),
    e('list-item-gap',           'number', 4,  { min: 0,  max: 32 }),
    e('table-cell-padding',      'number', 7,  { min: 0,  max: 24 }),
    e('blockquote-border-width', 'number', 3,  { min: 0,  max: 12 }),
    e('blockquote-radius',       'number', 5,  { min: 0,  max: 20 }),
    e('padding-content', 'number', 24, { min: 0, max: 80 }),
    e('scrollbar-size', 'number', 6, { min: 0, max: 16 }),

    // ─── BORDER ─────────────────────────────────────────────

    e('code-radius', 'number', 4, { min: 0, max: 20 }),

    // ─── TYPOGRAPHY ─────────────────────────────────────────

    e('font-size', 'number', 15, { min: 0, max: 28 }),
    e('font-size-code', 'number', 14, { min: 0, max: 28 }),

    e('heading-h1', 'number', 32, { min: 0, max: 72 }),
    e('heading-h2', 'number', 24, { min: 0, max: 64 }),
    e('heading-h3', 'number', 18, { min: 0, max: 48 }),
    e('heading-h4', 'number', 14, { min: 0, max: 32 }),

    e('line-height',       'number', 1.75, { min: 0.0, max: 3.0 }),
    e('code-line-height',  'number', 1.65, { min: 0.0, max: 2.5 }),


    // ─── BEHAVIOR (SELECT = FLAGS) ──────────────────────────

    e('header-show', 'select', 'top', {
      options: ['top', 'sidebar', 'never']
    }),

    e('header-style', 'select', 'solid', {
      options: ['solid', 'blur', 'transparent']
    }),

    e('header-height', 'number', 60, { min: 0, max: 120 }),

    e('toc-show', 'select', 'always', {
      options: ['always', 'desktop', 'never']
    }),

    e('toc-position', 'select', 'right', {
      options: ['left', 'right']
    }),

    e('content-max-width', 'number', 720, { min: 0, max: 1400 }),

    e('content-show-nav', 'select', 'always', {
      options: ['always', 'never']
    }),

    e('sidebar-width', 'number', 200, { min: 0, max: 400 }),
    e('toc-width',     'number', 200, { min: 0, max: 400 }),

    e('typography-heading', 'select', 'system', {
      options: ['system', 'serif', 'mono']
    }),

    e('typography-body', 'select', 'system', {
      options: ['system', 'serif', 'mono']
    })
  ];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Merges theme entries from a default schema with previously stored entries.
 *
 * The function uses the defaultEntries array as the authoritative schema source.
 * Only entries that exist in defaultEntries are preserved in the result.
 * Entries from oldEntries are merged into matching default entries by name.
 *
 * Behavior:
 * - Entries not present in defaultEntries are discarded
 * - Missing old entries fall back to defaults
 * - Existing entries are shallow-merged over defaults
 *
 * @param {Array<Object>} defaultEntries - The canonical list of theme entry definitions
 * @param {Array<Object>} oldEntries - Previously stored or user-modified entries
 * @returns {Array<Object>} Merged and schema-compliant entry list
 */
export function mergeDocThemeEntries(defaultEntries, oldEntries) {
  const oldMap = new Map();

  for (const entry of oldEntries) {
    oldMap.set(entry.name, entry);
  }

  return defaultEntries.map(def => {
    const old = oldMap.get(def.name);

    if (!old)
      return { ...def };

    return {
      ...def,
      ...old
    };
  });
}

/**
 * Removes internal runtime fields from a docTheme object
 * and returns a clean export-safe version.
 *
 * This function strips:
 * - internal IDs
 * - timestamps
 * - runtime-only flags such as builtIn
 *
 * @param {Object} docTheme - The theme object to clean
 * @returns {Object} Clean docTheme ready for export
 */
export function cleanDocTheme(docTheme) {
  const {
    id,
    builtIn,
    createdAt,
    lastOpenedAt,
    isPreset,
    ...rest
  } = docTheme;

  return {
    ...rest
  };
}

/**
 * Updates fields on a DocTheme.
 * @param {string} id
 * @param {Object} changes - partial object to merge
 * @returns {boolean}
 */
export function updateDocTheme(id, changes) {
  const theme = findDocTheme(id);
  if (!theme) 
    return false;

  Object.assign(theme, changes);
  state.set('docThemes', [...getDocThemes()]);
  return true;
}

function _validateValue(entry, value) {
  switch (entry.type) {
    case 'number': {
      let v = Number(value);
      if (Number.isNaN(v))
        v = entry.value;
      
      if (entry.min !== undefined)
        v = Math.max(entry.min, v);

      if (entry.max !== undefined)
        v = Math.min(entry.max, v);
      
      return v;
    }
    case 'select': {
      if (!entry.options?.includes(value))
        return entry.value;
      return value;
    }
    case 'color': {
      if (typeof value !== 'string')
        return entry.value;
      return value;
    }
    default:
      return value;
  }
}

export function modifyThemeValue(theme, key, { value: v = null, active: a = null}) {
  const stored = getStoredEntry(theme, key);
  if (!stored)
    return null;

  const schema = getSchemaEntry(key);
  if (!schema)
    return null;

  let parsed = stored.value;
  if (v != null) {
    parsed = _validateValue({ ...schema, ...stored }, v);
    stored.value = parsed;
  }

  if (typeof a === 'boolean')
    stored.active = a;

  return parsed;
}


function _resolveThemeValue(theme, key) {
  const entry = getEntry(theme, key);
  if (!entry)
    return null;

  if (entry.active != undefined && !entry.active) {
    return null;
  }
  
  return entry.value;
}

export function getThemeValue(theme, key) {
  return _resolveThemeValue(theme, key);
}

export function getStoredEntry(theme, key) {
  return theme?.settings?.entries?.find(e => e.name === key) ?? null;
}

export function getSchemaEntry(name) {
  return THEME_SCHEMA.find(s => s.name === name) ?? null;
}

export function getEntry(theme, key) {
  const stored = theme?.settings?.entries?.find(e => e.name === key);
  if (!stored) 
    return null;

  const schema = getSchemaEntry(key);
  if (!schema) 
    return null;

  return { ...schema, ...stored };
}

export function getThemeGroup(theme, group) {
  return theme?.settings?.entries?.filter(e => e.group === group) ?? [];
}

/**
 * Resets theme settings to their default values.
 * If resetParams is provided, only matching keys are reset.
 * @param {object} theme - Theme object containing settings
 * @param {string[]|null} [resetParams=null] - Optional list of setting keys to reset
 */
export function resetThemeSettings(theme, resetParams = null) {
  theme?.settings?.entries?.forEach(entry => {
    if (resetParams && !resetParams.includes(entry.name)) return;

    const schema = getSchemaEntry(entry.name);
    if (!schema) 
      return;

    entry.value = schema.value;
    entry.active = schema.active;
  });

  state.set('docThemes', [...getDocThemes()]);
}
// ─── Doc Theme  Accessors ─────────────────────────────────────────────

/**
 * Returns all languages from state.
 * @returns {Array}
 */
export function getDocThemes() {
  return state.get('docThemes') ?? [];
}

export function getPresetDocThemes() {
  return session.get('docThemePresets') ?? [];
}

/**
 * Finds a Doc Theme by ID.
 * @param {string} tabID
 * @returns {Object|null}
 */
export function findDocTheme(docThemeId, docThemeList) {
  const searchDocThemes = docThemeList ?? getDocThemes();
  if (!searchDocThemes)
    return null;
  return searchDocThemes.find(t => t.id === docThemeId) ?? null;
}

/**
 * Finds a Doc-theme by name (case-insensitive).
 * @param {string} name
 * @returns {Object|null}
 */
export function findSyntaxDefinitionByName(name, list) {
  const q = name.toLowerCase();
  return (list ?? getDocThemes()).find(l =>
    l.name.toLowerCase() === q
  ) ?? null;
}

/**
 * Adds a new Doc-theme to state.
 * @param {object} theme
 */
export function addDocTheme(theme) {
  let themes = getDocThemes();
  if(!themes)
    themes = [];

  const themesCopy = [...themes];
  themesCopy.push(theme);
  state.set('docThemes', themesCopy);
}

/**
 * Removes the Doc-theme with the specified ID. 
 * @param {string} docThemeId
 * @returns {boolean} true if the Doc-theme was found and removed, false otherwise. Emits state:change:docThemes
 */
export function removeDocThemeById(docThemeId) {
  let docThemeList = getDocThemes();
  let t = findDocTheme(docThemeId, docThemeList);
  if(!t)
    return false;

  // remove theme from all projects
  const projects = state.get('projects');
  projects.forEach(p => {
    if(p.docThemeId === docThemeId)
        p.docThemeId = null;
  });

  revokeThemeCache(docThemeId);
  // remove doc theme
  docThemeList.splice(docThemeList.indexOf(t), 1);
  
  // emit changed event
  state.set('docThemes', [...getDocThemes()]);
  return true;
}

/**
 * Returns true if the docTheme match the (lowercase) search query.
 * @param {Object} docTheme
 * @param {string} query - Should already be lowercased
 * @returns {boolean}
 */
export function docThemeMatchesSearch(docTheme, query) {
  if (!query) 
    return true;
  if((query === 'builtin' || query === 'built in') && docTheme.builtIn)
    return true;
  return docTheme.name.toLowerCase().includes(query);
}

export function openDocThemeEditor(theme) {
  if(!theme)
    return;

  updateDocTheme(theme.id, { lastOpenedAt: Date.now() });

  eventBus.emit('save:request:docThemes');
  eventBus.emit('navigate:themeEditor', { themeId: theme.id });
}