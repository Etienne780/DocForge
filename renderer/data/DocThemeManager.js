import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { generateId, isQueryMatchesBuiltIn } from '@common/Common.js';
import { revokeThemeCache } from '@common/HtmlBuilder.js';
import { notifyProjectChange } from '@data/ProjectManager.js';

import { findSyntaxDefinitionByName, getHighlightStylesForLang } from './SyntaxDefinitionManager.js';

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
      langStyleIds: {},// langId -> styleId
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

    e('gap-paragraph',  'number', 16, { min: 0, max: 64 }),
    e('gap-heading',    'number', 24, { min: 0, max: 64 }),
    e('code-block-gap', 'number', 32, { min: 0, max: 128 }),
    e('list-item-gap',           'number', 4,  { min: 0,  max: 32 }),
    e('table-cell-padding',      'number', 7,  { min: 0,  max: 24 }),
    e('blockquote-border-width', 'number', 3,  { min: 0,  max: 12 }),
    e('blockquote-radius',       'number', 5,  { min: 0,  max: 20 }),
    e('padding-content',  'number', 24, { min: 0, max: 80 }),
    e('scrollbar-size',   'number', 6, { min: 0, max: 16 }),

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

    e('sidebar-width-type', 'select', 'pixels', { 
      options: ['pixels', 'fit-content', 'percent']
    }),

    e('sidebar-width-px',   'number', 200, { min: 0, max: 500 }),
    e('sidebar-width-per',  'number', 20, { min: 0, max: 100 }),
    e('sidebar-min-width',  'number', 0, { min: 0, max: 500 }),

    e('toc-width-type', 'select', 'pixels', { 
      options: ['pixels', 'fit-content', 'percent']
    }),

    e('toc-width-px',   'number', 200, { min: 0, max: 500 }),
    e('toc-width-per',  'number', 20, { min: 0, max: 100 }),
    e('toc-min-width',  'number', 0, { min: 0, max: 500 }),

    e('search-enabled',   'toggle', true),
    e('search-position',  'select', 'header', { 
      options: ['header', 'tab-nav' ]
    }),
    e('search-show-in-tab',  'toggle', false),

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
 * @param {Object} docTheme
 * @returns {Object}
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
 * Updates fields on a DocTheme that belongs to the given project.
 * @param {Object} project
 * @param {string} id
 * @param {Object} changes - partial object to merge
 * @returns {boolean}
 */
export function updateDocTheme(project, id, changes) {
  const theme = findDocTheme(id, project?.themes);
  if (!theme || !!theme.builtIn)
    return false;

  notifyProjectChange(p => {
    Object.assign(findDocTheme(id, p.themes), changes);
  }, 'themes');
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

/**
 * Modifies a single entry's value/active flag on a theme object.
 * Does NOT persist by itself - the theme object lives inside project.themes,
 * so mutating it in place is enough as long as you wrap the call site in
 * notifyProjectChange() (or it already runs inside one).
 */
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

export function getLanguageStyleByLangName(project, theme, langName) {
  if (!project || !theme || !langName)
    return;

  const def = findSyntaxDefinitionByName(langName, project.languages);
  if (!def)
    return null;

  return getLanguageStyle(project, theme, def);
}

export function getLanguageStyle(project, theme, languageDefinition) {
  if (!project || !theme || !languageDefinition)
    return null;

  const stored = theme.settings?.langStyleIds?.[languageDefinition.id];
  const styles = getHighlightStylesForLang(project, languageDefinition.id);

  if (stored && styles.some(s => s.id === stored))
    return stored;

  return styles[0] ?? null;
}

export function getLanguageStyleIdByLangName(project, theme, langName) {
  if (!project || !theme || !langName)
    return;

  const def = findSyntaxDefinitionByName(langName, project.languages);
  if (!def)
    return null;

  return getLanguageStyleId(project, theme, def);
}

export function getLanguageStyleId(project, theme, languageDefinition) {
  if (!project || !theme || !languageDefinition)
    return null;

  const stored = theme.settings?.langStyleIds?.[languageDefinition.id];
  const styles = getHighlightStylesForLang(project, languageDefinition.id);

  if (stored && styles.some(s => s.id === stored))
    return stored;

  return styles[0]?.id ?? null;
}

/**
 * @param {Object} project
 * @param {Object} theme - must be a theme instance from project.themes
 * @param {string} langId
 * @param {string} styleId
 */
export function setLanguageStyleId(project, theme, langId, styleId) {
  if (!theme || !langId)
    return;

  notifyProjectChange(() => {
    theme.settings.langStyleIds ??= {};
    theme.settings.langStyleIds[langId] = styleId;
  }, 'themes');
}

/**
 * Resets theme settings to their default values.
 * @param {Object} project
 * @param {Object} theme
 * @param {string[]|null} [resetParams=null]
 */
export function resetThemeSettings(project, theme, resetParams = null) {
  notifyProjectChange(() => {
    theme?.settings?.entries?.forEach(entry => {
      if (resetParams && !resetParams.includes(entry.name)) return;

      const schema = getSchemaEntry(entry.name);
      if (!schema) 
        return;

      entry.value = schema.value;
      entry.active = schema.active;
    });
  }, 'themes');
}

// ─── Doc Theme  Accessors ─────────────────────────────────────────────

/**
 * Returns all custom Doc Themes belonging to a project.
 * @param {Object} project
 * @returns {Array}
 */
export function getDocThemes(project) {
  return project?.themes ?? [];
}

export function getPresetDocThemes() {
  return session.get('docThemePresets') ?? [];
}

/**
 * Finds a Doc Theme by ID within the given list (project.themes, or a preset list).
 * @param {string} docThemeId
 * @param {Array|null} [docThemeList]
 * @returns {Object|null}
 */
export function findDocTheme(docThemeId, docThemeList) {
  const outList = docThemeList ?? [];
  const result = outList.find(l => l.id === docThemeId) ?? null;
  if (result)
    return result;

  const presets = getPresetDocThemes();
  return presets.find(l => l.id === docThemeId) ?? null;
}

/**
 * Finds a Doc-theme by name (case-insensitive).
 * @param {string} name
 * @param {Array} list
 * @returns {Object|null}
 */
export function findDocThemeByName(name, list) {
  const q = name.toLowerCase();
  const outList = list ?? [];
  const result = outList.find(l => l.name.toLowerCase() === q) ?? null;
  if (result)
    return result;

  const presets = getPresetDocThemes();
  return presets.find(l => l.name.toLowerCase() === q) ?? null;
}

/**
 * Adds a new Doc-theme to a project.
 * @param {Object} project
 * @param {Object} theme
 */
export function addDocTheme(project, theme) {
  notifyProjectChange(p => {
    p.themes ??= [];
    p.themes.push(theme);
  }, 'themes');
}

/**
 * Removes the Doc-theme with the specified ID from a project.
 * Also clears project.settings.currentThemeId if it pointed at this theme,
 * and revokes its render cache.
 * @param {Object} project
 * @param {string} docThemeId
 * @returns {boolean} true if the Doc-theme was found and removed, false otherwise. Emits session:change:openProject:themes
 */
export function removeDocThemeById(project, docThemeId) {
  const t = findDocTheme(docThemeId, project?.themes);
  if(!t || !!t.builtIn)
    return false;

  revokeThemeCache(docThemeId);

  notifyProjectChange(p => {
    p.themes.splice(p.themes.indexOf(t), 1);
    if (p.settings.currentThemeId === docThemeId) {
      p.settings.currentThemeId = null;
      p.settings.isThemePreset = false;
    }
  }, 'themes');

  return true;
}

export function dublicateDocThemeById(project, id, nameFactory = null) {
  const source = findDocTheme(id, project.themes);
  if (!source) {
    eventBus.emit('toast:show', {
      message: 'Failed to duplicate theme.',
      type: 'error'
    });
    return;
  }

  const copy = JSON.parse(JSON.stringify(source));
  delete copy.id;

  const newName = nameFactory?.(source) ?? `${source.name} Copy`;

  let created = createDocTheme(
    newName,
    copy.settings.entries
  );

  created = {
    ...created,
    ...copy,
    name: newName
  };

  created.builtIn = false;
  addDocTheme(project, created);

  eventBus.emit('save:request');
  eventBus.emit('toast:show', {
    message: 'Theme duplicated.',
    type: 'success'
  });
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
  if(isQueryMatchesBuiltIn(query) && docTheme.builtIn)
    return true;
  return docTheme.name.toLowerCase().includes(query);
}

// ─── Current Theme (project.settings) ─────────────────────────────────────

/**
 * Returns the theme currently active for this project - looks in the
 * project's own themes first, then in the built-in presets.
 * @param {Object} project
 * @returns {Object|null}
 */
export function getCurrentTheme(project) {
  const id = project?.settings?.currentThemeId;
  if (!id)
    return null;

  return project.settings.isThemePreset
    ? findDocTheme(id, getPresetDocThemes())
    : findDocTheme(id, project.themes);
}

/**
 * Marks a theme (own or preset) as the active one for this project.
 * @param {Object} project
 * @param {string} themeId
 * @param {boolean} isPreset
 */
export function setCurrentTheme(project, themeId, isPreset) {
  notifyProjectChange(p => {
    p.settings.currentThemeId = themeId;
    p.settings.isThemePreset = isPreset;
  }, 'settings');
}

export function openDocThemeEditor(project, theme) {
  if(!theme)
    return;

  updateDocTheme(project, theme.id, { lastOpenedAt: Date.now() });

  eventBus.emit('save:request');
  eventBus.emit('navigate:themeEditor', { themeId: theme.id });
}