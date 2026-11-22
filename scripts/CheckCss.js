// CheckCss - finds duplicated CSS rules.
//
//   npm run check:css            checks the export CSS (also runs before `npm run build`)
//   node scripts/CheckCss.js --all   also checks every other CSS file of the renderer, each file on its own
//
// The files of a group are checked together (the export CSS files are joined into one
// stylesheet, see renderer/core/htmlBuilder/exportCss/ExportCss.js). Reported:
//   - a selector that has more than one rule block with real properties (same @media / @supports context)
//   - a custom property (--x) that is set more than once for the same selector
// Blocks that only set custom properties don't count as duplicates (e.g. the table layers:
// one rule builds the layers, the others only set their colors).
// `/* allow-duplicate */` right in front of a rule excludes it.
// Only prints warnings, the exit code is always 0.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RENDERER = join(ROOT, 'renderer');
const EXPORT_CSS_DIR = join(RENDERER, 'core', 'htmlBuilder', 'exportCss');
const IGNORED_DIRS = new Set(['dist', 'node_modules']);
const ALLOW_MARKER = '\u0001';

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Rules of a CSS file, nesting resolved.
 * @returns {{ selectors: string[], context: string, properties: string[], line: number, allowed: boolean }[]}
 */
function parseRules(source) {
  // comments -> spaces (keeps line numbers), the allow comment -> marker
  const text = source.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, comment =>
    /^\/\*\s*allow-duplicate\s*\*\/$/.test(comment)
      ? ALLOW_MARKER + comment.slice(1).replace(/[^\n]/g, ' ')
      : comment.replace(/[^\n]/g, ' '));

  const rules = [];
  let pos = 0;

  const lineAt = index => text.slice(0, index).split('\n').length;

  // reads a block body from pos (after `{`) up to its `}`
  function parseBlock(parentSelectors, context, rule) {
    let buffer = '';
    let bufferStart = pos;

    while (pos < text.length) {
      const char = text[pos];

      if (char === '"' || char === "'") {
        const end = text.indexOf(char, pos + 1);
        buffer += text.slice(pos, end + 1);
        pos = end + 1;
        continue;
      }

      if (char === ';') {
        addDeclaration(rule, buffer);
        buffer = '';
        bufferStart = ++pos;
        continue;
      }

      if (char === '}') {
        addDeclaration(rule, buffer);
        pos++;
        return;
      }

      if (char === '{') {
        const head = buffer.trim();
        const headStart = bufferStart + buffer.search(/\S/);
        pos++;

        if (head.startsWith('@')) {
          const name = head.match(/^@[\w-]+/)[0];
          if (['@media', '@supports', '@container', '@layer'].includes(name))
            parseBlock(parentSelectors, context ? `${context} > ${normalizeSpaces(head)}` : normalizeSpaces(head), rule);
          else
            parseBlock(null, context, null); // @keyframes, @font-face, ...: no selectors
        } else if (parentSelectors !== null) {
          const allowed = head.includes(ALLOW_MARKER);
          const selectors = resolveNesting(splitTopLevel(head.replace(ALLOW_MARKER, ''), ','), parentSelectors);
          const nested = { selectors, context, properties: [], line: lineAt(headStart), allowed };
          rules.push(nested);
          parseBlock(selectors, context, nested);
        } else {
          parseBlock(null, context, null);
        }

        buffer = '';
        bufferStart = pos;
        continue;
      }

      buffer += char;
      pos++;
    }
  }

  parseBlock([], '', null);
  return rules;
}

function addDeclaration(rule, text) {
  const match = rule && text.match(/^\s*(--[\w-]+|[a-zA-Z-]+)\s*:/);
  if (match)
    rule.properties.push(match[1]);
}

/** Splits at `separator` outside of (), [] and strings. */
function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let part = '';
  for (const char of text) {
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(' || char === '[') {
      depth++;
    } else if (char === ')' || char === ']') {
      depth--;
    } else if (char === separator && depth === 0) {
      parts.push(part);
      part = '';
      continue;
    }
    part += char;
  }
  parts.push(part);
  return parts.map(normalizeSelector).filter(Boolean);
}

function resolveNesting(selectors, parents) {
  if (!parents.length)
    return selectors;
  return parents.flatMap(parent => selectors.map(selector =>
    selector.includes('&') ? selector.replaceAll('&', parent) : `${parent} ${selector}`));
}

function normalizeSpaces(text) {
  return text.trim().replace(/\s+/g, ' ');
}

/** `tr> :nth-child` and `tr > :nth-child` are the same selector. */
function normalizeSelector(selector) {
  let out = '';
  let depth = 0;
  for (const char of normalizeSpaces(selector)) {
    if (char === '[' || char === '(') depth++;
    if (char === ']' || char === ')') depth--;
    if (depth === 0 && '>+~'.includes(char)) {
      out = out.trimEnd() + ` ${char} `;
      continue;
    }
    if (char === ' ' && out.endsWith(' '))
      continue;
    out += char;
  }
  return out.trim();
}

// ─── Check ────────────────────────────────────────────────────────────────────

/**
 * @param {string[]} files - checked together
 * @returns {string[]} warnings
 */
function checkGroup(files) {
  const bySelector = new Map(); // "context | selector" -> [{ where, properties }]

  for (const file of files) {
    const name = relative(ROOT, file).replaceAll('\\', '/');
    for (const rule of parseRules(readFileSync(file, 'utf8'))) {
      if (rule.allowed || !rule.properties.length)
        continue;
      for (const selector of rule.selectors) {
        const key = rule.context ? `${rule.context} | ${selector}` : selector;
        if (!bySelector.has(key))
          bySelector.set(key, []);
        bySelector.get(key).push({ where: `${name}:${rule.line}`, properties: rule.properties });
      }
    }
  }

  const warnings = [];
  for (const [key, blocks] of bySelector) {
    const withProperties = blocks.filter(block => block.properties.some(p => !p.startsWith('--')));
    if (withProperties.length > 1)
      warnings.push(`  ${key}\n      ${withProperties.map(block => block.where).join(', ')}`);

    const seen = new Map(); // custom property -> where
    for (const block of blocks) {
      for (const property of new Set(block.properties.filter(p => p.startsWith('--')))) {
        if (!seen.has(property))
          seen.set(property, []);
        seen.get(property).push(block.where);
      }
    }
    for (const [property, where] of seen) {
      if (where.length > 1)
        warnings.push(`  ${key} { ${property} }\n      ${where.join(', ')}`);
    }
  }
  return warnings;
}

function findCssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return IGNORED_DIRS.has(entry.name) ? [] : findCssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

/** Export CSS files in the order of ExportCss.js; files missing there are reported. */
function getExportCssFiles(warnings) {
  const list = readFileSync(join(EXPORT_CSS_DIR, 'ExportCss.js'), 'utf8');
  const listed = [...list.matchAll(/from '\.\/([\w-]+\.css)\?raw'/g)].map(match => match[1]);
  for (const file of readdirSync(EXPORT_CSS_DIR).filter(f => f.endsWith('.css') && !listed.includes(f)))
    warnings.push(`  ${file} is not loaded in ExportCss.js`);
  return listed.map(file => join(EXPORT_CSS_DIR, file));
}

// ─── Run ──────────────────────────────────────────────────────────────────────

let total = 0;
function report(title, warnings) {
  if (!warnings.length)
    return;
  total += warnings.length;
  console.warn(`\n[check:css] ${title}: ${warnings.length} duplicate(s)\n${warnings.join('\n')}`);
}

const exportWarnings = [];
const exportFiles = getExportCssFiles(exportWarnings);
report('export CSS (exportCss/, checked together)', [...exportWarnings, ...checkGroup(exportFiles)]);

if (process.argv.includes('--all')) {
  const others = findCssFiles(RENDERER).filter(file => !file.startsWith(EXPORT_CSS_DIR));
  for (const file of others)
    report(relative(ROOT, file).replaceAll('\\', '/'), checkGroup([file]));
}

console.log(total ? `\n[check:css] ${total} warning(s)` : '[check:css] no duplicates');
