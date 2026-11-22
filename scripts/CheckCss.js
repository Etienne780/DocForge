// CheckCss - finds duplicated CSS rules.
//
//   npm run check:css   (also runs before `npm run build`)
//
// Two groups, the files of a group are checked together:
//   - export CSS: renderer/core/htmlBuilder/exportCss/*.css, joined into one stylesheet (ExportCss.js)
//   - global CSS: every renderer/**/*.global.css (main.global.css, styles/*, the unscoped CSS of views /
//     components). The other view / component CSS is scoped to its component (@scope, core/ScopedCss.js),
//     so its classes only have to be unique within the file and it is not checked.
// Reported (same @media / @supports context):
//   - export CSS: a selector with more than one rule block with real properties
//   - global CSS: a selector that stands alone in more than one rule block with real properties, or the
//     same selector list in more than one block. A shared list first and single rules after it
//     (`.a, .b { ... }` then `.a { ... }`, also overriding a property) is fine.
//   - both: a custom property (--x) that is set more than once for the same selector
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

const COMMENT_REGEX = /\/\*[\s\S]*?\*\//g;
const ALLOW_COMMENT_REGEX = /^\/\*\s*allow-duplicate\s*\*\/$/;

/**
 * Replaces every comment with spaces, so the parser skips it but the line numbers stay the same
 * (line breaks inside a comment are kept). An `/* allow-duplicate *\/` comment starts with
 * ALLOW_MARKER instead, so the rule after it can see that it is excluded.
 * @param {string} css
 * @returns {string} as long as `css`
 */
function blankOutComments(css) {
  return css.replace(COMMENT_REGEX, comment => {
    const blank = comment.replace(/[^\n]/g, ' ');

    if (!ALLOW_COMMENT_REGEX.test(comment))
      return blank;
    
    return ALLOW_MARKER + blank.slice(1);
  });
}

/**
 * Rules of a CSS file, nesting resolved.
 * @returns {{ selectors: string[], context: string, properties: string[], line: number, allowed: boolean }[]}
 */
function parseRules(source) {
  const text = blankOutComments(source.replace(/\r\n/g, '\n'));

  const rules = [];
  let pos = 0;

  const lineAt = (index) => { return  text.slice(0, index).split('\n').length; };

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
 * @param {{ lists?: boolean }} [options] - lists: a selector in a shared list (`.a, .b`) and alone
 *        again is fine unless a real property is set twice (global CSS)
 * @returns {string[]} warnings
 */
function checkGroup(files, { lists = false } = {}) {
  const bySelector = new Map(); // "context | selector" -> [{ where, properties, alone }]
  const byList = new Map();     // "context | sorted selector list" -> [where]

  for (const file of files) {
    const name = relative(ROOT, file).replaceAll('\\', '/');
    for (const rule of parseRules(readFileSync(file, 'utf8'))) {
      if (rule.allowed || !rule.properties.length)
        continue;

      for (const selector of rule.selectors) {
        const key = rule.context ? `${rule.context} | ${selector}` : selector;
        
        if (!bySelector.has(key))
          bySelector.set(key, []);

        bySelector.get(key).push({ where: `${name}:${rule.line}`, properties: rule.properties, alone: rule.selectors.length === 1 });
      }

      // the same selector list again (global CSS: lists are compared as a whole)
      if (lists && rule.selectors.length > 1 && rule.properties.some(p => !p.startsWith('--'))) {
        const key = `${rule.context ? `${rule.context} | ` : ''}${[...rule.selectors].sort().join(', ')}`;
        
        if (!byList.has(key))
          byList.set(key, []);

        byList.get(key).push(`${name}:${rule.line}`);
      }
    }
  }

  const warnings = [];
  for (const [key, where] of byList) {
    if (where.length > 1)
      warnings.push(`  ${key}\n      ${where.join(', ')}`);
  }

  for (const [key, blocks] of bySelector) {
    const withProperties = blocks.filter(block => block.properties.some(p => !p.startsWith('--')));
  
    if (!lists) {
      if (withProperties.length > 1)
        warnings.push(`  ${key}\n      ${withProperties.map(block => block.where).join(', ')}`);
    } else {
      const alone = withProperties.filter(block => block.alone);
  
      if (alone.length > 1)
        warnings.push(`  ${key}\n      ${alone.map(block => block.where).join(', ')}`);
    }

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

/** All *.global.css of the renderer (main.global.css first, then by path). */
function findGlobalCssFiles(dir) {
  const found = readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return IGNORED_DIRS.has(entry.name) ? [] : findGlobalCssFiles(path);
    return entry.name.endsWith('.global.css') ? [path] : [];
  });
  return found.sort((a, b) => (b.endsWith('main.global.css') - a.endsWith('main.global.css')) || a.localeCompare(b));
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

report('global CSS (*.global.css, checked together)', checkGroup(findGlobalCssFiles(RENDERER), { lists: true }));

console.log(total ? `\n[check:css] ${total} warning(s)` : '[check:css] no duplicates');
