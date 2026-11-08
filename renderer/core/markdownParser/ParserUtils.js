// Helpers shared by the transforms of the Markdown parser.

export const FENCED_CODE_REGEX = /(?<!`)(`{3,})(?!`)([\w#+.-]+(?::[\w#+.-]+)?)?\n?([\s\S]*?)\n?(?<!`)\1(?!`)/g;

export const isBlankLine = line => /^[ \t]*$/.test(line);

export const LINE_MARKER_REGEX = /^\x01L(\d+)\x01$/;
export const CODEBLOCK_PLACEHOLDER_REGEX = /\x00CODEBLOCK_(\d+)\x00/g;

/**
 * Adds data-line to the first tag of an html string.
 * @param {string} html
 * @param {number} line
 * @returns {string}
 */
export function addLineAttribute(html, line) {
  return html.replace(/^<([a-zA-Z][\w-]*)/, `<$1 data-line="${line}"`);
}
