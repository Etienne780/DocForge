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
