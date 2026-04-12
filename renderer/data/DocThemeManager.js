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
      header: [{ name: 'h1', size: 24 }],
      colors: createDefaultDocThemeColors(),
      spacing: [],
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
    // Background
    c('background',          '#0c0c12', 'background'),
    c('background-surface',  '#13131c', 'background'),
    c('background-elevated', '#1a1a26', 'background'),
 
    // Text
    c('text-primary',   '#e2e8f4', 'text'),
    c('text-secondary', '#8898b8', 'text'),
    c('text-muted',     '#46587a', 'text'),
 
    // Accent (links, active states, highlights)
    c('accent',        '#3ddc84', 'accent'),
    c('accent-hover',  '#2fca78', 'accent'),
    c('accent-subtle', '#1D9E7520', 'accent'),  // translucent for backgrounds
 
    // Borders
    c('border',         '#1e2a3c', 'border'),
    c('border-strong',  '#2a3a54', 'border'),
 
    // Code blocks
    c('code-background', '#0e1520', 'code'),
    c('code-border',     '#1c2a3c', 'code'),
    c('code-text',       '#cdd6f4', 'code'),
 
    // Headings (optional overrides)
    c('heading-h1', '#e2e8f4', 'heading'),
    c('heading-h2', '#c8d4ec', 'heading'),
    c('heading-h3', '#aabada', 'heading'),
 
    // Inline code / kbd
    c('inline-code-background', '#1a2234', 'inline-code'),
    c('inline-code-text',       '#89b4fa', 'inline-code'),
 
    // Table
    c('table-header-background', '#13131c', 'table'),
    c('table-row-alt',           '#0f0f18', 'table'),
    c('table-border',            '#1e2a3c', 'table'),
 
    // Blockquote / callout
    c('blockquote-border', '#3ddc84', 'blockquote'),
    c('blockquote-background', '#1D9E7510', 'blockquote'),
    c('blockquote-text', '#8898b8', 'blockquote'),
  ];
}

// ─── Color Helpers ─────────────────────────────────────────────────────────────
 
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