import { eventBus } from '@core/EventBus.js';
import { strings } from './strings/index.js';
import { UI_LANGUAGE_IDS, FALLBACK_UI_LANGUAGE, UI_LANGUAGE_AUTO } from './Languages.js';

/**
 * Texts of the app UI.
 *
 * An entry in core/i18n/strings has one text per language (Languages.js):
 *
 *   title: {
 *     en: 'Recent projects',
 *     de: 'Zuletzt geöffnet'
 *   },
 *
 *   lastOpened: {
 *     vars: ['name'],                 // every {placeholder} of the texts, can be left out if there are none
 *     en: '{name} was opened',
 *     de: '{name} wurde geöffnet'
 *   },
 *
 *   count: {
 *     vars: ['count'],
 *     plural: 'count',                // the var that picks the form (Intl.PluralRules)
 *     en: { one: '{count} project', other: '{count} projects' },
 *     de: { one: '{count} Projekt', other: '{count} Projekte' }
 *   },
 *
 * Dev builds check all entries on start (I18nValidator.js, AppLoaderView).
 *
 * Few imports on purpose: almost every module uses t(), also the ones the syntax highlight
 * worker loads (no State, Platform or Common here).
 */

/** Matches {name} placeholders. */
export const PLACEHOLDER_REGEX = /\{([A-Za-z_$][\w$]*)\}/g;

let _language = FALLBACK_UI_LANGUAGE;
const _pluralRules = new Map();
const _warned = new Set();

/**
 * True for an object that holds the texts of one entry (and not a group of entries).
 * @param {*} value
 */
export function isStringEntry(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && (UI_LANGUAGE_IDS.some(id => id in value) || 'vars' in value || 'plural' in value);
}

/**
 * Language that is used for a value of state.uiLanguage.
 * @param {string} setting - 'auto' or a language id
 * @returns {string} language id
 */
export function resolveUiLanguage(setting) {
  if (UI_LANGUAGE_IDS.includes(setting))
    return setting;

  if (setting === UI_LANGUAGE_AUTO) {
    const systemLanguages = typeof navigator !== 'undefined'
      ? (navigator.languages?.length ? navigator.languages : [navigator.language])
      : [];
    for (const tag of systemLanguages) {
      const id = String(tag ?? '').toLowerCase().split('-')[0];
      if (UI_LANGUAGE_IDS.includes(id))
        return id;
    }
  }
  return FALLBACK_UI_LANGUAGE;
}

/**
 * Sets the language from state.uiLanguage and follows its changes.
 * Call once after the state is loaded. A change emits 'i18n:change' { language }.
 * @param {{ get: (key: string) => * }} state - @core/State.js (passed in, see the imports above)
 */
export function initI18n(state) {
  _setLanguage(resolveUiLanguage(state.get('uiLanguage')));

  eventBus.on('state:change:uiLanguage', ({ value }) => {
    const language = resolveUiLanguage(value);
    if (language === _language)
      return;
    _setLanguage(language);
    eventBus.emit('i18n:change', { language });
  });
}

function _setLanguage(language) {
  _language = language;
  if (typeof document !== 'undefined')
    document.documentElement.setAttribute('lang', language);
}

/** @returns {string} id of the current UI language */
export function getUiLanguage() {
  return _language;
}

/**
 * Entry of a key ('preferences.settings.isDarkMode.label'), null if there is none.
 * @param {string} key
 */
export function getStringEntry(key) {
  let value = strings;
  for (const part of String(key).split('.')) {
    if (!value || typeof value !== 'object' || !(part in value))
      return null;
    value = value[part];
  }
  return isStringEntry(value) ? value : null;
}

/** @param {string} key */
export function hasString(key) {
  return getStringEntry(key) !== null;
}

/**
 * Text of a key in the current language, with its placeholders replaced.
 * Missing text -> English text, missing entry -> the key itself.
 *
 * @param {string} key - e.g. 'preferences.title'
 * @param {Object<string, *>} [vars] - values of the placeholders, e.g. { count: 3 }
 * @returns {string}
 */
export function t(key, vars = {}) {
  const entry = getStringEntry(key);
  if (!entry) {
    _devWarn(`missing:${key}`, `[i18n] ${key}: no entry with this key`);
    return key;
  }

  let text = entry[_language] ?? entry[FALLBACK_UI_LANGUAGE];
  if (entry.plural) {
    const count = Number(vars[entry.plural]);
    const form = _getPluralRules(_language).select(Number.isFinite(count) ? count : 0);
    text = text?.[form] ?? text?.other;
  }

  if (typeof text !== 'string') {
    _devWarn(`invalid:${key}:${_language}`, `[i18n] ${key} (${_language}): no text`);
    return key;
  }

  return text.replace(PLACEHOLDER_REGEX, (match, name) => {
    if (vars[name] === undefined || vars[name] === null) {
      _devWarn(`var:${key}:${name}`, `[i18n] ${key}: no value for {${name}}`);
      return match;
    }
    return String(vars[name]);
  });
}

/**
 * Replaces {{t:key}} in an HTML template with the escaped text (also inside attributes).
 * Used for the templates of views (BaseView) and components (ComponentLoader).
 * @param {string} html
 * @returns {string}
 */
export function translateTemplate(html) {
  return String(html).replace(/\{\{t:([^}]+)\}\}/g, (_, key) => _escapeHTML(t(key.trim())));
}

/** Same as escapeHTML() of @common/Common.js (not imported, see the imports above). */
function _escapeHTML(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _getPluralRules(language) {
  if (!_pluralRules.has(language))
    _pluralRules.set(language, new Intl.PluralRules(language));
  return _pluralRules.get(language);
}

function _devWarn(id, message) {
  if (!import.meta.env?.DEV || _warned.has(id))
    return;
  _warned.add(id);
  console.warn(message);
}
