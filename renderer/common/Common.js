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

/**
 * Checks if the namen has at least a length of 3
 * @param {String} name 
 * @returns true when name length greater equals 3
 */
export function isNameValid(name) {
  return (name) ? name.length >= 3 : false;
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