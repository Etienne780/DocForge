/**
 * TextSearch - find and replace in plain text (used by the doc editor search).
 *
 * @typedef {Object} SearchOptions
 * @property {string}  query
 * @property {boolean} [matchCase=false]
 * @property {boolean} [wholeWord=false]
 * @property {boolean} [useRegex=false]
 * @property {boolean} [preserveCase=false] - replacement takes over the case of the match (UPPER, lower, Capital)
 *
 * @typedef {Object} TextMatch
 * @property {number} start
 * @property {number} end
 * @property {string} text
 * @property {string[]} groups - capture groups ($1, $2, ...)
 * @property {Object<string, string>} [named] - named groups ($<name>)
 */

export const MAX_MATCHES_PER_TEXT = 10000;

const WORD_CHAR = '[\\p{L}\\p{N}_]';

/**
 * @param {SearchOptions} options
 * @returns {{ regex: RegExp|null, error: string|null }} regex is null for an empty query or an invalid pattern
 */
export function createSearchRegex({ query, matchCase = false, wholeWord = false, useRegex = false }) {
  if (!query)
    return { regex: null, error: null };

  let source = useRegex ? query : escapeRegex(query);
  if (wholeWord)
    source = `(?<!${WORD_CHAR})(?:${source})(?!${WORD_CHAR})`;

  try {
    return { regex: new RegExp(source, `gmu${matchCase ? '' : 'i'}`), error: null };
  } catch (error) {
    return { regex: null, error: error.message };
  }
}

/**
 * All non-empty matches in text (or in [from, to)).
 * @param {string} text
 * @param {RegExp} regex - from createSearchRegex()
 * @param {{ from?: number, to?: number, limit?: number }} [range]
 * @returns {TextMatch[]}
 */
export function findMatches(text, regex, { from = 0, to = text.length, limit = MAX_MATCHES_PER_TEXT } = {}) {
  const matches = [];
  if (!regex || !text)
    return matches;

  regex.lastIndex = from;
  let match;
  while (matches.length < limit && (match = regex.exec(text))) {
    if (match[0] === '') {
      regex.lastIndex++;
      continue;
    }
    if (match.index + match[0].length > to)
      break;

    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      groups: match.slice(1),
      named: match.groups,
    });
  }

  return matches;
}

/**
 * Replacement text for one match. With useRegex, $1 / $<name> / $& / $$ in the template are expanded.
 * @param {TextMatch} match
 * @param {string} template
 * @param {SearchOptions} options
 * @returns {string}
 */
export function getReplacement(match, template, { useRegex = false, preserveCase = false } = {}) {
  let text = useRegex ? _expandTemplate(template, match) : template;
  if (preserveCase)
    text = _applyCase(match.text, text);
  return text;
}

/**
 * Replaces the given matches (not overlapping) in text.
 * @param {string} text
 * @param {Array<{ start: number, end: number, replacement: string }>} replacements
 * @returns {string}
 */
export function applyReplacements(text, replacements) {
  let result = '';
  let last = 0;
  for (const { start, end, replacement } of [...replacements].sort((a, b) => a.start - b.start)) {
    if (start < last)
      continue;
    result += text.slice(last, start) + replacement;
    last = end;
  }
  return result + text.slice(last);
}

/**
 * Lines around a match for previews. Blank lines are skipped, so before/after are the
 * nearest lines with content.
 * @param {string} text
 * @param {{ start: number, end: number }} match
 * @returns {{
 *   line: { number: number, text: string, start: number },
 *   before: { number: number, text: string }|null,
 *   after:  { number: number, text: string }|null,
 * }} numbers are 1-based, line.text holds all lines the match touches
 */
export function getMatchContext(text, { start, end }) {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const breakAt = text.indexOf('\n', Math.max(end - 1, start));
  const lineEnd = breakAt < 0 ? text.length : breakAt;
  const number = _countBreaks(text.slice(0, lineStart)) + 1;
  const lastNumber = number + _countBreaks(text.slice(lineStart, lineEnd));

  let before = null;
  for (let to = lineStart - 1, n = number - 1; to >= 0; n--) {
    const from = text.lastIndexOf('\n', to - 1) + 1;
    const lineText = text.slice(from, to);
    if (lineText.trim()) {
      before = { number: n, text: lineText };
      break;
    }
    to = from - 1;
  }

  let after = null;
  for (let from = lineEnd + 1, n = lastNumber + 1; lineEnd < text.length && from <= text.length; n++) {
    const next = text.indexOf('\n', from);
    const to = next < 0 ? text.length : next;
    const lineText = text.slice(from, to);
    if (lineText.trim()) {
      after = { number: n, text: lineText };
      break;
    }
    if (next < 0)
      break;
    from = next + 1;
  }

  return { line: { number, text: text.slice(lineStart, lineEnd), start: lineStart }, before, after };
}

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Private ─────────────────────────────────────────────────────────────────

function _countBreaks(text) {
  let count = 0;
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1))
    count++;
  return count;
}

function _expandTemplate(template, match) {
  return template.replace(/\$(\$|&|<([^>]+)>|(\d{1,2}))/g, (whole, token, name, digits) => {
    if (token === '$')
      return '$';
    if (token === '&')
      return match.text;
    if (name !== undefined)
      return match.named?.[name] ?? whole;

    const index = Number(digits);
    if (index >= 1 && index <= match.groups.length)
      return match.groups[index - 1] ?? '';
    // $12 with only one group: $1 followed by '2'
    const first = Number(digits[0]);
    if (digits.length === 2 && first >= 1 && first <= match.groups.length)
      return (match.groups[first - 1] ?? '') + digits[1];
    return whole;
  });
}

function _applyCase(source, text) {
  const letters = source.replace(/[^\p{L}]/gu, '');
  if (!letters)
    return text;
  if (letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase())
    return text.toUpperCase();
  if (letters === letters.toLowerCase())
    return text.toLowerCase();
  if (letters[0] === letters[0].toUpperCase())
    return text.charAt(0).toUpperCase() + text.slice(1);
  return text;
}
