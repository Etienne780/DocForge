import { state } from '@core/State.js';
import { generateId } from '@common/Common.js';

// ─── ID Generation ────────────────────────────────────────────────────────────

/** @returns {string} */
export function generateSyntaxDefinitionId() {
  return 'syntaxDefinition_' + generateId();
}

/** @returns {string} */
export function generateHighlightAreaId() {
  return 'highlightArea_' + generateId();
}

/** @returns {string} */
export function generateHighlightRuleId() {
  return 'highlightRule_' + generateId();
}

/** @returns {string} */
export function generateHighlightStyleId() {
  return 'highlightStyle_' + generateId();
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Creates a new SyntaxDefinition (language).
 * @param {string} name
 * @returns {Object}
 */
export function createSyntaxDefinition(name) {
  return {
    id: generateSyntaxDefinitionId(),
    name,
    nameAliases: [],
    builtIn: false,
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
    exampleCode: '',
    areas: [createDefaultHighlightArea()],
    styles: [],
  };
}

/** @returns {Object} */
export function createDefaultHighlightArea() {
  return createHighlightArea('default');
}

/**
 * Creates a new HighlightArea.
 * @param {string} name
 * @returns {Object}
 */
export function createHighlightArea(name) {
  return {
    id: generateHighlightAreaId(),
    name,
    priority: 0,
    allowSelfNesting: true,
    mode: 'regex', // 'regex' | 'line'
    color: '#ffffff',
    startPattern: null,
    endPattern: null,
    rules: [],
    subAreas: [],
  };
}

/**
 * Creates a SubArea reference.
 * Set either areaId (reference to existing) or area (inline definition), not both.
 * @returns {Object}
 */
export function createSubHighlightArea() {
  return {
    startPattern: null,
    endPattern: null,
    areaId: null,  // reference to existing HighlightArea
    area: null,    // inline HighlightArea definition
  };
}

/**
 * Creates a new HighlightRule.
 * @param {string} name
 * @returns {Object}
 */
export function createHighlightRule(name) {
  return {
    id: generateHighlightRuleId(),
    name,
    type: 'keyword', // 'keyword' | 'word' | 'regex'
    pattern: '',
    priority: 0,
    nextState: null,
    context: {
      after:     null,
      before:    null,
      notAfter:  null,
      notBefore: null,
    },
  };
}

/**
 * Creates a new HighlightStyle.
 * @param {string} name
 * @returns {Object}
 */
export function createHighlightStyle(name) {
  return {
    id: generateHighlightStyleId(),
    name,
    colors: [],
    overrideRules: [],
  };
}

/**
 * Creates a color entry for a HighlightStyle.
 * @param {string} areaId
 * @param {string|null} ruleId  - null = applies to the whole area
 * @param {string} color        - hex color string
 * @returns {Object}
 */
export function createHighlightStyleColor(areaId, ruleId, color) {
  return { areaId, ruleId, color };
}

// ─── SyntaxDefinition Accessors ───────────────────────────────────────────────

/**
 * Returns all languages from state.
 * @returns {Array}
 */
export function getLanguages() {
  return state.get('languages') ?? [];
}

/**
 * Returns true if the Syntax-definition match the (lowercase) search query.
 * @param {Object} lang
 * @param {string} query - Should already be lowercased
 * @returns {boolean}
 */
export function docThemeMatchesSearch(lang, query) {
  if (!query) 
    return true;
  return lang.name.toLowerCase().includes(query);
}

/**
 * Finds a SyntaxDefinition by ID.
 * @param {string} id
 * @param {Array|null} [list]
 * @returns {Object|null}
 */
export function findSyntaxDefinition(id, list = null) {
  return (list ?? getLanguages()).find(l => l.id === id) ?? null;
}

/**
 * Finds a SyntaxDefinition by name or alias (case-insensitive).
 * @param {string} name
 * @param {Array|null} list
 * @returns {Object|null}
 */
export function findSyntaxDefinitionByName(name, list = null) {
  const q = name.toLowerCase();
  return (list ?? getLanguages()).find(l =>
    l.name.toLowerCase() === q ||
    l.nameAliases.some(a => a.toLowerCase() === q)
  ) ?? null;
}

/**
 * Adds a new SyntaxDefinition to state.
 * @param {string} name
 * @returns {Object} the created definition
 */
export function addSyntaxDefinition(name) {
  const def = createSyntaxDefinition(name);
  const langs = getLanguages();
  state.set('languages', [...langs, def]);
  return def;
}

/**
 * Removes a SyntaxDefinition by ID.
 * @param {string} id
 * @param {Array|null} list
 * @returns {boolean}
 */
export function removeSyntaxDefinition(id, list = null) {
  const langs = list ?? getLanguages();
  const def = findSyntaxDefinition(id, langs);
  if (!def) 
    return false;

  langs.splice(langs.indexOf(def), 1);
  state.set('languages', [...langs]);
  return true;
}

/**
 * Updates fields on a SyntaxDefinition.
 * @param {string} id
 * @param {Object} changes - partial object to merge
 * @returns {boolean}
 */
export function updateSyntaxDefinition(id, changes) {
  const def = findSyntaxDefinition(id);
  if (!def) 
    return false;

  Object.assign(def, changes);
  state.set('languages', [...getLanguages()]);
  return true;
}

/**
 * Returns true if the language name or any alias matches the query.
 * @param {Object} def
 * @param {string} query
 * @returns {boolean}
 */
export function syntaxDefinitionMatchesSearch(def, query) {
  if (!query) 
    return true;

  const q = query.toLowerCase();
  return def.name.toLowerCase().includes(q) ||
    def.nameAliases.some(a => a.toLowerCase().includes(q));
}

// ─── HighlightArea Accessors ──────────────────────────────────────────────────

/**
 * Finds a HighlightArea within a SyntaxDefinition.
 * @param {Object} def
 * @param {string} areaId
 * @returns {Object|null}
 */
export function findHighlightArea(def, areaId) {
  return def?.areas?.find(a => a.id === areaId) ?? null;
}

/**
 * Adds a new HighlightArea to a SyntaxDefinition.
 * @param {string} defId
 * @param {string} name
 * @returns {Object|null} the created area
 */
export function addHighlightArea(defId, name) {
  const def = findSyntaxDefinition(defId);
  if (!def)
    return null;

  const area = createHighlightArea(name);
  def.areas.push(area);
  state.set('languages', [...getLanguages()]);
  return area;
}

/**
 * Removes a HighlightArea from a SyntaxDefinition.
 * Does not remove the default area.
 * @param {string} defId
 * @param {string} areaId
 * @returns {boolean}
 */
export function removeHighlightArea(defId, areaId) {
  const def = findSyntaxDefinition(defId);
  const area = findHighlightArea(def, areaId);
  if (!area || area.name === 'default') 
    return false;

  def.areas.splice(def.areas.indexOf(area), 1);
  state.set('languages', [...getLanguages()]);
  return true;
}

// ─── HighlightRule Accessors ──────────────────────────────────────────────────

/**
 * Finds a HighlightRule within an area.
 * @param {Object} area
 * @param {string} ruleId
 * @returns {Object|null}
 */
export function findHighlightRule(area, ruleId) {
  return area?.rules?.find(r => r.id === ruleId) ?? null;
}

/**
 * Adds a new HighlightRule to an area.
 * @param {string} defId
 * @param {string} areaId
 * @param {string} name
 * @returns {Object|null} the created rule
 */
export function addHighlightRule(defId, areaId, name) {
  const def = findSyntaxDefinition(defId);
  const area = findHighlightArea(def, areaId);
  if (!area) 
    return null;

  const rule = createHighlightRule(name);
  area.rules.push(rule);
  state.set('languages', [...getLanguages()]);
  return rule;
}

/**
 * Removes a HighlightRule from an area.
 * @param {string} defId
 * @param {string} areaId
 * @param {string} ruleId
 * @returns {boolean}
 */
export function removeHighlightRule(defId, areaId, ruleId) {
  const def = findSyntaxDefinition(defId);
  const area = findHighlightArea(def, areaId);
  const rule = findHighlightRule(area, ruleId);
  if (!rule) 
    return false;

  area.rules.splice(area.rules.indexOf(rule), 1);
  state.set('languages', [...getLanguages()]);
  return true;
}

/**
 * Updates fields on a HighlightRule.
 * @param {string} defId
 * @param {string} areaId
 * @param {string} ruleId
 * @param {Object} changes
 * @returns {boolean}
 */
export function updateHighlightRule(defId, areaId, ruleId, changes) {
  const def = findSyntaxDefinition(defId);
  const area = findHighlightArea(def, areaId);
  const rule = findHighlightRule(area, ruleId);
  if (!rule) 
    return false;
  
  Object.assign(rule, changes);
  state.set('languages', [...getLanguages()]);
  return true;
}

// ─── HighlightStyle Accessors ─────────────────────────────────────────────────

/**
 * Finds a HighlightStyle within a SyntaxDefinition.
 * @param {Object} def
 * @param {string} styleId
 * @returns {Object|null}
 */
export function findHighlightStyle(def, styleId) {
  return def?.styles?.find(s => s.id === styleId) ?? null;
}

/**
 * Adds a new HighlightStyle to a SyntaxDefinition.
 * @param {string} defId
 * @param {string} name
 * @returns {Object|null} the created style
 */
export function addHighlightStyle(defId, name) {
  const def = findSyntaxDefinition(defId);
  if (!def) 
    return null;

  const style = createHighlightStyle(name);
  def.styles.push(style);
  state.set('languages', [...getLanguages()]);
  return style;
}

/**
 * Removes a HighlightStyle from a SyntaxDefinition.
 * @param {string} defId
 * @param {string} styleId
 * @returns {boolean}
 */
export function removeHighlightStyle(defId, styleId) {
  const def = findSyntaxDefinition(defId);
  const style = findHighlightStyle(def, styleId);
  if (!style) 
    return false;

  def.styles.splice(def.styles.indexOf(style), 1);
  state.set('languages', [...getLanguages()]);
  return true;
}

/**
 * Sets or updates the color for a specific area+rule combination in a style.
 * If ruleId is null, the color applies to the whole area.
 * @param {string} defId
 * @param {string} styleId
 * @param {string} areaId
 * @param {string|null} ruleId
 * @param {string} color
 * @returns {boolean}
 */
export function setHighlightStyleColor(defId, styleId, areaId, ruleId, color) {
  const def = findSyntaxDefinition(defId);
  const style = findHighlightStyle(def, styleId);
  if (!style) 
    return false;

  const existing = style.colors.find(
    c => c.areaId === areaId && c.ruleId === ruleId
  );

  if (existing) {
    existing.color = color;
  } else {
    style.colors.push(createHighlightStyleColor(areaId, ruleId, color));
  }

  state.set('languages', [...getLanguages()]);
  return true;
}

/**
 * Removes the color entry for a specific area+rule combination.
 * @param {string} defId
 * @param {string} styleId
 * @param {string} areaId
 * @param {string|null} ruleId
 * @returns {boolean}
 */
export function removeHighlightStyleColor(defId, styleId, areaId, ruleId) {
  const def = findSyntaxDefinition(defId);
  const style = findHighlightStyle(def, styleId);
  if (!style) 
    return false;

  const idx = style.colors.findIndex(
    c => c.areaId === areaId && c.ruleId === ruleId
  );
  if (idx === -1) 
    return false;

  style.colors.splice(idx, 1);
  state.set('languages', [...getLanguages()]);
  return true;
}