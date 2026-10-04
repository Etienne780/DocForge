import { DOC_THEME_PRESETS, DOC_THEME_PRESET_LANG_STYLES } from '@core/presets/DocThemePresets.js';
import { LANGUAGE_PRESETS } from '@core/presets/LanguagePresets/LanguagePresets';
import { session } from '@core/SessionState.js';
import { isDevelopment } from '@core/Platform.js';

export function registerPresets() {
  registerLanguagePresets();
  registerDocThemesPresets();
}

export function registerDocThemesPresets() {
  const presets = DOC_THEME_PRESETS
    .map(fn => fn())
    .filter(theme => {
      if (theme?.devOnly === true) {
        return isDevelopment();
      }

      return true;
    })
    .map(theme => {
      _assignPresetLangStyles(theme, DOC_THEME_PRESET_LANG_STYLES[theme.id]);
      return Object.freeze({
        ...theme,
        builtIn: true,
      });
    });

  session.set('docThemePresets', presets);
}

/**
 * Maps every built-in language to the first of `styleNames` it has.
 * Needs the language presets to be registered first.
 * @param {Object} theme
 * @param {string[]} [styleNames]
 */
function _assignPresetLangStyles(theme, styleNames) {
  if (!styleNames?.length)
    return;

  const styles = session.get('languageStylePresets') ?? [];
  theme.settings.langStyleIds ??= {};

  (session.get('languagePresets') ?? []).forEach(lang => {
    const langStyles = styles.filter(s => s.langId === lang.id);
    const style = styleNames
      .map(name => langStyles.find(s => s.name === name))
      .find(Boolean);

    if (style)
      theme.settings.langStyleIds[lang.id] = { id: style.id, isBuiltIn: true };
  });
}

export function registerLanguagePresets() {
  const languages = [];
  const styles = [];

  LANGUAGE_PRESETS.forEach(({ createLanguage, createStyles }) => {
    const def = createLanguage();
    if (def?.devOnly === true && !isDevelopment())
      return;

    const idMap = _createStablePresetIds(def);
    _replaceIds(def, idMap);

    languages.push(Object.freeze({ ...def, builtIn: true }));

    const defStyles = (createStyles(def) ?? []).map(s => _replaceIds(s, idMap));
    _assignStableStyleIds(def, defStyles);
    defStyles.forEach(s => styles.push(Object.freeze({ ...s, langId: def.id, builtIn: true })));
  });

  session.set('languagePresets', languages);
  session.set('languageStylePresets', styles);
}

/**
 * Built-in languages are rebuilt on every start, so their state/rule ids
 * would be new random ids each time and user styles referencing them would
 * break. Derives stable ids from the language id and the state/rule names.
 * @param {Object} def
 * @returns {Map<string, string>} old id -> stable id
 */
function _createStablePresetIds(def) {
  const idMap = new Map();

  const unique = (base, used) => {
    let id = base;
    for (let i = 2; used.has(id); i++)
      id = `${base}_${i}`;
    used.add(id);
    return id;
  };

  const usedStateIds = new Set();
  def.states?.forEach(state => {
    const stateId = unique(`syntaxState_${_safeId(def.id)}_${_safeId(state.name)}`, usedStateIds);
    idMap.set(state.id, stateId);

    const usedRuleIds = new Set();
    state.rules?.forEach(rule => {
      idMap.set(rule.id, unique(`syntaxStateRule_${_safeId(def.id)}_${_safeId(state.name)}_${_safeId(rule.name)}`, usedRuleIds));
    });
  });

  return idMap;
}

/**
 * Same as _createStablePresetIds for the preset styles, themes store the
 * selected style by id (theme.settings.langStyleIds).
 * @param {Object} def
 * @param {Object[]} defStyles
 */
function _assignStableStyleIds(def, defStyles) {
  const used = new Set();
  defStyles.forEach(style => {
    let id = `highlightStyle_${_safeId(def.id)}_${_safeId(style.name)}`;
    for (let i = 2; used.has(id); i++)
      id = `highlightStyle_${_safeId(def.id)}_${_safeId(style.name)}_${i}`;
    used.add(id);
    style.id = id;
  });
}

function _safeId(value) {
  return String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * Replaces every string value that is a key of `idMap` (deep, in place).
 * @param {*} value
 * @param {Map<string, string>} idMap
 * @returns {*} the same value
 */
function _replaceIds(value, idMap) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      if (typeof item === 'string' && idMap.has(item))
        value[i] = idMap.get(item);
      else
        _replaceIds(item, idMap);
    });
  } else if (value && typeof value === 'object') {
    Object.keys(value).forEach(key => {
      const item = value[key];
      if (typeof item === 'string' && idMap.has(item))
        value[key] = idMap.get(item);
      else
        _replaceIds(item, idMap);
    });
  }

  return value;
}