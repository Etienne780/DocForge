import { state } from '@core/State.js';
import { generateId } from '@common/Common.js';

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
export function createDocTheme(name) {
  return {
    id: generateDocThemeId(),
    name,
    builtIn: false,
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
    settings: {
      colors: createDefaultDocThemeColors(),
      borderRadius: createDefaultDocThemeBorderRadius(),
      spacing: createDefaultDocThemeSpacing(),
      fontSizes: createDefaultDocThemeFontSizes(),
      mapping: []
    }
  };
}

export function createLanguageMapping(languageId, styleId) {
  return { languageID: languageId, styleId: styleId };
}

/**
 * Returns the full set of colors a Doc Theme needs.
 * Structure: array of { name, color, group }
 * 
 * Groups:
 *  background  — page/surface/elevated layers
 *  text        — readable content
 *  border      — dividers, outlines
 *  accent      — interactive highlights, links, active states
 *  code        — code block chrome (background, border)
 *  heading     — h1–h3 overrides (optional, falls back to text.primary)
 */
export function createDefaultDocThemeColors() {
  const c = (name, color, group) => ({ name, color, group });

  return [
    // Backgrounds
    c('background', '#0c0c12', 'background'),
    c('background-surface', '#13131c', 'background'),
    c('background-elevated', '#1a1a26', 'background'),

    // Text
    c('text-primary', '#e0dbd0', 'text'),
    c('text-secondary', '#9898b0', 'text'),
    c('text-muted', '#7a7a95', 'text'),

    // Accent
    c('accent', '#22d4a8', 'accent'),
    c('accent-hover', '#1fb89a', 'accent'),
    c('accent-subtle', 'rgba(34, 212, 168, 0.09)', 'accent'),

    // Links
    c('link', '#78a8ff', 'accent'),
    c('link-underline', 'rgba(120, 168, 255, 0.3)', 'accent'),

    // Borders
    c('border', '#252538', 'border'),

    // Code
    c('code-background', '#07070f', 'code'),
    c('code-border', '#1c1c2a', 'code'),
    c('code-text', '#80d89a', 'code'),

    // Headings
    c('heading', '#f0ebe0', 'heading'),
  ];
}

/**
 * Returns the full set of border radius a Doc Theme needs.
 * Structure: array of { name, value }
 */
export function createDefaultDocThemeBorderRadius() {
  return [
    { name: 'code-radius', value: 4 },
  ];
}

/**
 * Returns the full set of spacings a Doc Theme needs.
 * Structure: array of { name, value }
 */
export function createDefaultDocThemeSpacing() {
  return [
    { name: 'gap-paragraph', value: 16 },
    { name: 'gap-heading', value: 24 },
    { name: 'code-block-gap', value: 16 },

    { name: 'padding-content', value: 24 },
  ];
}

/**
 * Returns the full set of fonts a Doc Theme needs.
 * Structure: array of { name, size }
 */
export function createDefaultDocThemeFontSizes() {
  return [
    // Base font sizes
    { name: 'font-size', size: 15 },
    { name: 'font-size-code', size: 14 },

    // Heading sizes
    { name: 'heading-h1', size: 32 },
    { name: 'heading-h2', size: 24 },
    { name: 'heading-h3', size: 18 },
    { name: 'heading-h4', size: 14 },
  ];
}

// ─── Helpers ─────────────────────────────────────────────────────────────
 
/**
 * Gets a single color value from a theme's color array by name.
 * @param {Object} docTheme
 * @param {string} name
 * @returns {string|null}
 */
export function getThemeColor(docTheme, name) {
  return docTheme?.settings?.colors?.find(c => c.name === name)?.color ?? null;
}
 
/**
 * Gets all colors belonging to a specific group.
 * @param {Object} docTheme
 * @param {string} group
 * @returns {Array}
 */
export function getThemeColorGroup(docTheme, group) {
  return docTheme?.settings?.colors?.filter(c => c.group === group) ?? [];
}

/**
 * Gets a single border radius value from a theme's borderRadius array by name.
 * @param {Object} docTheme
 * @param {string} name
 * @returns {number|null}
 */
export function getThemeBorderRadius(docTheme, name) {
  return docTheme?.settings?.borderRadius?.find(c => c.name === name)?.value ?? null;
}

/**
 * Gets a single spacing value from a theme's spacing array by name.
 * @param {Object} docTheme
 * @param {string} name
 * @returns {number|null}
 */
export function getThemeSpacing(docTheme, name) {
  return docTheme?.settings?.spacing?.find(c => c.name === name)?.value ?? null;
}

/**
 * Gets a single font size value from a theme's fontSizes array by name.
 * @param {Object} docTheme
 * @param {string} name
 * @returns {number|null}
 */
export function getThemeFontSize(docTheme, name) {
  return docTheme?.settings?.fontSizes?.find(c => c.name === name)?.size ?? null;
}

/**
 * Resets theme settings to their default values.
 * If resetParams is provided, only matching keys are reset.
 * @param {object} theme - Theme object containing settings
 * @param {string[]|null} [resetParams=null] - Optional list of setting keys to reset
 */
export function resetThemeSettings(theme, resetParams = null) {
  if (!theme)
    return;

  const defaults = {
    colors: createDefaultDocThemeColors(),
    borderRadius: createDefaultDocThemeBorderRadius(),
    spacing: createDefaultDocThemeSpacing(),
    fontSizes: createDefaultDocThemeFontSizes()
  };

  const s = theme.settings;
  let changed = false;

  const resetGroup = (targetArray, defaultArray) => {
    targetArray?.forEach((item) => {
      if (resetParams && !resetParams.includes(item.name))
        return;

      const def = defaultArray.find(d => d.name === item.name);
      if (def && item.value !== def.value) {
        item.value = def.value;
        changed = true;
      }
    });
  }

  resetGroup(s.colors, defaults.colors);
  resetGroup(s.borderRadius, defaults.borderRadius);
  resetGroup(s.spacing, defaults.spacing);
  resetGroup(s.fontSizes, defaults.fontSizes);

  if(changed) {
    state.set('docThemes', [...getDocThemes()]);
  }
}

// ─── Doc Theme  Accessors ─────────────────────────────────────────────

/**
 * Returns all languages from state.
 * @returns {Array}
 */
export function getDocThemes() {
  return state.get('docThemes') ?? [];
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
 * @param {string} name
 * @returns {Object} the created theme
 */
export function addDocTheme(name) {
  const t = createDocTheme(name);
  const themes = getDocThemes();
  state.set('docThemes', [...themes, t]);
  return t;
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
  return docTheme.name.toLowerCase().includes(query);
}