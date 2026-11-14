import { escapeHTML } from '@common/Common.js';

// ─── Diff blocks (```diff / ```diff:lang) ─────────────────────────────────────

const DIFF_GROUP_REGEX = /<div class="(code-block-diff-line[^"]*)">([\s\S]*?)<\/div>/g;

/**
 * Old/new line numbers like git for a diff block: removed lines only have
 * an old number, added lines only a new one.
 * @param {string} preHtml - from buildDiffBodyHtml (one div per group of lines)
 * @returns {string} one line per code line
 */
export function getDiffLineNumbers(preHtml) {
  const groups = [...preHtml.matchAll(DIFF_GROUP_REGEX)].map(([, cls, content]) => ({
    isAdd: cls.includes('code-block-diff-add'),
    isRemoved: cls.includes('code-block-diff-removed'),
    lineCount: content.split('\n').length,
  }));

  const oldCount = groups.filter(g => !g.isAdd).reduce((sum, g) => sum + g.lineCount, 0);
  const newCount = groups.filter(g => !g.isRemoved).reduce((sum, g) => sum + g.lineCount, 0);
  const width = String(Math.max(oldCount, newCount, 1)).length;

  const numbers = [];
  let oldLine = 0;
  let newLine = 0;
  for (const { isAdd, isRemoved, lineCount } of groups) {
    for (let i = 0; i < lineCount; i++) {
      const oldNumber = isAdd ? '' : String(++oldLine);
      const newNumber = isRemoved ? '' : String(++newLine);
      numbers.push(`${oldNumber.padStart(width)} ${newNumber.padStart(width)}`);
    }
  }

  return numbers.join('\n');
}

/**
 * Splits the lines of a diff block into their type ('+', '-', '') and text.
 * - git format (every non-empty context line starts with a space): the first
 *   character of every line is the marker column and is removed.
 * - otherwise: "+x" -> "x"; "+ x" -> "  x" (the marker becomes a space, so the
 *   text keeps the column it has in the editor); context lines stay as they are.
 * @param {string} code
 * @returns {{ type: '+'|'-'|'', text: string }[]}
 */
function parseDiffLines(code) {
  const lines = code.split('\n');
  const typeOf = line => (line[0] === '+' || line[0] === '-') ? line[0] : '';

  const context = lines.filter(line => !typeOf(line) && line !== '');
  const gitFormat = context.length > 0 && context.every(line => line[0] === ' ');

  return lines.map(line => {
    const type = typeOf(line);
    if (gitFormat)
      return { type, text: line.slice(1) };
    if (!type)
      return { type, text: line };
    const rest = line.slice(1);
    return { type, text: /^[ \t]/.test(rest) ? ' ' + rest : rest };
  });
}

export function splitCodeblockDiff(code) {
  const added = [];
  const removed = [];
  const lineTypes = [];

  for (const { type, text } of parseDiffLines(code)) {
    added.push(type === '-' ? '' : text);
    removed.push(type === '+' ? '' : text);
    lineTypes.push(type);
  }

  return {
    added: added.join('\n'),
    removed: removed.join('\n'),
    lineTypes,
  };
}

function groupDiffLines(lineTypes) {
  const groups = [];
  let start = 0;

  for (let i = 1; i <= lineTypes.length; i++) {
    if (i === lineTypes.length || lineTypes[i] !== lineTypes[start]) {
      groups.push({ type: lineTypes[start], start, end: i });
      start = i;
    }
  }

  return groups;
}

function diffGroupClass(type) {
  if (type === '+')
    return 'code-block-diff-line code-block-diff-add';
  if (type === '-')
    return 'code-block-diff-line code-block-diff-removed';
  return 'code-block-diff-line code-block-diff-context';
}

export function buildDiffBodyHtml(lineTypes, addedLines, removedLines) {
  const groups = groupDiffLines(lineTypes);

  const groupsHtml = groups.map(({ type, start, end }) => {
    const sourceLines = type === '-' ? removedLines : addedLines;
    const linesHtml = sourceLines
      .slice(start, end)
      .map(line => line === '' ? '\u00A0' : line)
      .join('\n');
    return `<div class="${diffGroupClass(type)}">${linesHtml}</div>`;
  }).join('');

  return `<pre class="syntax-definition-highlight code-block-diff">${groupsHtml}</pre>`;
}

export function buildPlainDiffLines(code) {
  return parseDiffLines(code).map(({ text }) => escapeHTML(text));
}
