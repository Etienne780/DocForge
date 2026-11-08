import { strings } from './strings/index.js';
import { isStringEntry, PLACEHOLDER_REGEX } from './I18n.js';
import { UI_LANGUAGE_IDS } from './Languages.js';

/**
 * Dev-only check of all UI texts (core/i18n/strings), run by AppLoaderView on start.
 * Writes every problem to the console:
 *
 *   error   a text uses a {var} that is not in `vars`
 *   error   a language is missing or empty
 *   error   a key exists twice in the same object (checked in the source, JS keeps only the last one)
 *   error   `plural` is not one of the `vars`, or a plural text is not { one, other }
 *   error   `vars` is not a list of names, a text is not a string
 *   warning a var of `vars` is not used in a text of a language
 *   warning an entry has an unknown property (e.g. a typo in a language id)
 */

const ENTRY_PROPERTIES = new Set(['vars', 'plural', ...UI_LANGUAGE_IDS]);
const PLURAL_FORMS = ['one', 'other'];

/** Sources of the string files, only loaded when the check runs. */
const STRING_SOURCES = import.meta.glob('./strings/*.js', { query: '?raw', import: 'default' });

/**
 * Checks all texts and logs the result.
 * @returns {Promise<{ errors: number, warnings: number }>}
 */
export async function validateStrings() {
  const result = { errors: 0, warnings: 0 };
  const error = message => { result.errors++; console.error(`[i18n] ${message}`); };
  const warn = message => { result.warnings++; console.warn(`[i18n] ${message}`); };

  _validateGroup(strings, '', { error, warn });

  for (const [path, load] of Object.entries(STRING_SOURCES)) {
    try {
      const source = await load();
      for (const duplicate of findDuplicateKeys(source))
        error(`${path.replace('./strings/', '')}:${duplicate.line}: key "${duplicate.key}" exists twice in ${duplicate.path || 'the top level'}`);
    } catch (e) {
      error(`${path}: source could not be read to check for duplicate keys (${e.message})`);
    }
  }

  const style = result.errors ? 'color: #e85b5b; font-weight: bold;' : result.warnings ? 'color: #e8b45b; font-weight: bold;' : 'color: #70e85b; font-weight: bold;';
  console.info(`%c[i18n] texts checked: ${result.errors} errors, ${result.warnings} warnings`, style);
  return result;
}

function _validateGroup(group, prefix, log) {
  for (const [name, value] of Object.entries(group)) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (isStringEntry(value))
      _validateEntry(value, key, log);
    else if (value && typeof value === 'object' && !Array.isArray(value))
      _validateGroup(value, key, log);
    else
      log.error(`${key}: is neither an entry ({ ${UI_LANGUAGE_IDS.join(', ')} }) nor a group of entries`);
  }
}

function _validateEntry(entry, key, { error, warn }) {
  for (const property of Object.keys(entry)) {
    if (!ENTRY_PROPERTIES.has(property))
      warn(`${key}: unknown property "${property}"`);
  }

  // vars can be left out when no text has a placeholder
  let vars = [];
  if (entry.vars !== undefined) {
    if (!Array.isArray(entry.vars) || entry.vars.some(name => typeof name !== 'string' || !name)) {
      error(`${key}: vars must be a list of names`);
    } else {
      vars = entry.vars;
      const seen = new Set();
      for (const name of vars) {
        if (seen.has(name))
          error(`${key}: var "${name}" is defined twice`);
        seen.add(name);
      }
    }
  }

  const isPlural = entry.plural !== undefined;
  if (isPlural && (typeof entry.plural !== 'string' || !vars.includes(entry.plural)))
    error(`${key}: plural "${entry.plural}" is not one of the vars`);

  for (const language of UI_LANGUAGE_IDS) {
    const value = entry[language];
    const where = `${key} (${language})`;

    if (value === undefined || value === null || value === '') {
      error(`${where}: missing text`);
      continue;
    }

    let texts;
    if (isPlural) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        error(`${where}: a plural text must be { one, other }`);
        continue;
      }
      texts = [];
      for (const form of PLURAL_FORMS) {
        if (typeof value[form] !== 'string' || !value[form])
          error(`${where}: missing plural form "${form}"`);
        else
          texts.push(value[form]);
      }
      for (const form of Object.keys(value)) {
        if (!PLURAL_FORMS.includes(form))
          warn(`${where}: unknown plural form "${form}"`);
      }
    } else {
      if (typeof value !== 'string') {
        error(`${where}: text must be a string (set plural for { one, other })`);
        continue;
      }
      texts = [value];
    }

    const used = new Set();
    for (const text of texts) {
      for (const [, name] of text.matchAll(PLACEHOLDER_REGEX))
        used.add(name);
    }

    for (const name of used) {
      if (!vars.includes(name))
        error(`${where}: uses {${name}}, which is not in vars`);
    }
    for (const name of vars) {
      if (!used.has(name))
        warn(`${where}: var "${name}" is not used in the text`);
    }
  }
}

// ─── Duplicate keys (source text) ──────────────────────────────────────────────

/**
 * Finds keys that exist twice in the same object literal of a JS source.
 * Handles comments, strings, template literals (without nested ${}) and arrays.
 *
 * @param {string} source
 * @returns {{ key: string, path: string, line: number }[]}
 */
export function findDuplicateKeys(source) {
  const tokens = _tokenize(source);
  const duplicates = [];
  // one frame per open bracket: { type, keys: Map, path }
  const stack = [];
  let pendingKey = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'punct' && (token.value === '{' || token.value === '[' || token.value === '(')) {
      const parent = stack.at(-1);
      const childPath = pendingKey && parent ? [parent.path, pendingKey].filter(Boolean).join('.') : (parent?.path ?? '');
      stack.push({ type: token.value, keys: new Map(), path: childPath });
      pendingKey = null;
      continue;
    }
    if (token.type === 'punct' && (token.value === '}' || token.value === ']' || token.value === ')')) {
      stack.pop();
      pendingKey = null;
      continue;
    }

    const frame = stack.at(-1);
    const previous = tokens[i - 1];
    const next = tokens[i + 1];
    const isKey = frame?.type === '{'
      && (token.type === 'ident' || token.type === 'string')
      && next?.type === 'punct' && next.value === ':'
      && previous?.type === 'punct' && (previous.value === '{' || previous.value === ',');

    if (isKey) {
      if (frame.keys.has(token.value))
        duplicates.push({ key: token.value, path: frame.path, line: token.line });
      else
        frame.keys.set(token.value, token.line);
      pendingKey = token.value;
      i++; // skip ':'
    } else if (token.type === 'punct' && token.value === ',') {
      pendingKey = null;
    }
  }

  return duplicates;
}

function _tokenize(source) {
  const tokens = [];
  let line = 1;
  let i = 0;

  while (i < source.length) {
    const char = source[i];

    if (char === '\n') { line++; i++; continue; }
    if (/\s/.test(char)) { i++; continue; }

    // comments
    if (char === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (char === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }

    // strings and template literals
    if (char === '\'' || char === '"' || char === '`') {
      const startLine = line;
      let value = '';
      i++;
      while (i < source.length && source[i] !== char) {
        if (source[i] === '\\') {
          value += source[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (source[i] === '\n') line++;
        value += source[i];
        i++;
      }
      i++;
      tokens.push({ type: 'string', value, line: startLine });
      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      let value = '';
      while (i < source.length && /[\w$]/.test(source[i])) value += source[i++];
      tokens.push({ type: 'ident', value, line });
      continue;
    }

    tokens.push({ type: 'punct', value: char, line });
    i++;
  }

  return tokens;
}
