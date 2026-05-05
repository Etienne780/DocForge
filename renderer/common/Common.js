import { getValidation } from './Validations.js';

/**
 * Generates a short, collision-resistant unique ID.
 * @returns {string}
 */
export function generateId() {
  const array = new Uint32Array(2);
  crypto.getRandomValues(array);

  return (
    Date.now().toString(36) +
    array[0].toString(36) +
    array[1].toString(36)
  );
}

export function normalizeFileName(name) {
  return name
    .trim()
    .replace(/\s+/g, '_') // spaces -> underscore
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ''); // remove illegal filename chars
}
/**
 * @brief Checks whether a name meets the minimum length requirement for a given entity type.
 *
 * @param {string} name    - The name value to validate.
 * @param {string} [type]  - Entity type key (e.g. 'PROJECT'). Defaults to 'PROJECT'. types are from Validations.js
 * @returns {boolean} True if the name is valid, false otherwise.
 */
export function isNameValid(name, type = 'PROJECT') {
  if (typeof name !== 'string') {
    console.error(`[Common] isNameValid() expects a string as 'name'. Received: ${typeof name}`);
    return false;
  }

  const minLength = getValidation(type, 'NAME_MIN_LENGTH');
  if (minLength === undefined) {
    return false;
  }

  return name.length >= minLength;
}

/**
 * Calculates a relevance score for a string match against a query.
 *
 * Scoring rules:
 * - 3: exact match
 * - 2: starts with query
 * - 1: contains query
 * - 0: no match
 *
 * Comparison is case-insensitive.
 *
 * @param {string} alias - The string to evaluate (e.g. name or tag)
 * @param {string} query - Search query to compare against
 * @returns {number} Match score (higher = better match)
 */
export function getMatchScore(alias, query) {
  if (!query)
    return 0;

  const a = String(alias).toLowerCase();
  const q = String(query).toLowerCase();

  if (a === q)
    return 3;

  if (a.startsWith(q))
    return 2;

  if (a.includes(q))
    return 1;

  return 0;
}

/**
 * Mapping of sort actions to their corresponding sort configurations.
 *
 * Each entry defines how a list should be sorted when a specific action
 * is selected (e.g. from UI controls).
 *
 * @type {Object.<string, {key: string, direction: 'asc'|'desc', type: 'string'|'number'|'date'}>}
 *
 * @property {'recent'}   lastOpenedAt Descending by date (most recently opened first)
 * @property {'oldest'}   lastOpenedAt Ascending by date (oldest first)
 * @property {'order-az'} name Ascending alphabetical order (A → Z)
 * @property {'order-za'} name Descending alphabetical order (Z → A)
 */
export const SORT_ACTION_MAP = {
  'none':     { key: 'none', direction: '', type: '' },
  'recent':   { key: 'lastOpenedAt', direction: 'desc', type: 'date' },
  'oldest':   { key: 'lastOpenedAt', direction: 'asc',  type: 'date' },
  'order-az': { key: 'name',         direction: 'asc',  type: 'string' },
  'order-za': { key: 'name',         direction: 'desc', type: 'string' },
};

/**
 * Sorts a list of objects by a given key and type.
 *
 * Supports string, number, and date comparisons.
 * Returns a new sorted array (non-mutating).
 *
 * @template T
 * @param {T[]} list - Array to sort
 * @param {Object} options - Sorting options
 * @param {string} options.key - Object key to sort by
 * @param {'asc'|'desc'} [options.direction='asc'] - Sort direction
 * @param {'string'|'number'|'date'} [options.type='string'] - Value type
 * @returns {T[]} Sorted array
 */
export function sortBy(list, {
  key = null,
  direction = 'asc', // 'asc' | 'desc'
  type = 'string'    // 'string' | 'date' | 'number' | 'none'
} = {})
{
  if (!Array.isArray(list) || !key || key === 'none')
    return list;

  const modifier = direction === 'desc' ? -1 : 1;
  return list.toSorted((a, b) => {
    let valA = a[key];
    let valB = b[key];

    if (type === 'date') {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    }
    else if (type === 'number') {
      valA = Number(valA);
      valB = Number(valB);
    }
    else {
      valA = String(valA);
      valB = String(valB);
      return valA.localeCompare(valB) * modifier;
    }

    return (valA - valB) * modifier;
  });
}

// Darkens a hex color by a given factor (0–1)
export function darkenColor(hex, factor = 0.1) {
  // Remove '#' if present
  hex = hex.replace('#', '');

  // Parse RGB
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  // Reduce each channel
  r = Math.max(0, Math.floor(r * (1 - factor)));
  g = Math.max(0, Math.floor(g * (1 - factor)));
  b = Math.max(0, Math.floor(b * (1 - factor)));

  // Convert back to hex
  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  );
}

export function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Escapes special HTML characters in a string.
 * @param {string} string
 * @returns {string}
 */
export function escapeHTML(string) {
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * CSP-safe alternative to setting innerHTML directly.
 * Inline styles in the HTML string are stripped from the attribute
 * and re-applied via the DOM style API, which is CSP-compliant.
 *
 * @param {Element} element - Target DOM element
 * @param {string}  html    - HTML string, may contain inline style attributes
 */
export function setHTML(element, html) {
  element.innerHTML = html;

  element.querySelectorAll('[style]').forEach(el => {
    const raw = el.getAttribute('style');
    el.removeAttribute('style');

    // Re-apply each declaration via the DOM API (not blocked by CSP)
    raw.split(';').forEach(declaration => {
      const colonIndex = declaration.indexOf(':');
      if (colonIndex === -1) 
        return;

      const property = declaration.slice(0, colonIndex).trim();
      const value = declaration.slice(colonIndex + 1).trim();

      if (property && value) {
        el.style.setProperty(property, value);
      }
    });
  });
}

/**
 * Sets the content of an iframe using a Blob URL and automatically cleans up
 * any previously assigned Blob URL to prevent memory leaks.
 *
 * This function generates a Blob from the provided HTML string, creates an
 * object URL, assigns it to the iframe's `src` attribute, and revokes any
 * existing Blob URL that was previously set on the same iframe.
 *
 * @param {HTMLIFrameElement} iframe - The target iframe element whose content
 *                                     will be replaced.
 * @param {string}            html   - The complete HTML string to render inside
 *                                     the iframe.
 *
 * @example
 * const previewFrame = document.getElementById('preview');
 * const docHtml = buildNodePreview(markdown, theme);
 * setIframeContent(previewFrame, docHtml);
 */
export function setIframeContent(iframe, html) {
  iframe.removeAttribute('srcdoc');

  const blob = new Blob([html], { type: 'text/html' });
  const newUrl = URL.createObjectURL(blob);

  if (iframe.src && iframe.src.startsWith('blob:')) {
    URL.revokeObjectURL(iframe.src);
  }

  iframe.src = newUrl;
}