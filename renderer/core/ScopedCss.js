/**
 * ScopedCss - scopes the CSS of a view / component to its own element tree (native CSS @scope).
 *
 * ComponentLoader and BaseView load `X.css` as text, wrap it with scopeCss() and add it as a
 * blob stylesheet (the CSP allows blob:). The container of every view / component gets
 * `data-css-scope="<css key>"`, so a rule of `X.css` only matches inside the container of X and
 * stops at nested views / components: the container of a nested one still belongs to the outer
 * one (it is its element), everything inside it does not.
 *
 * Rules for elements outside the container (modals, menus, popups in document.body) belong in
 * `X.global.css` next to it, which is loaded unscoped.
 */

/** Attribute on every view / component container, value: the key of its CSS file. */
export const CSS_SCOPE_ATTRIBUTE = 'data-css-scope';

// top-level at-rules that don't work (or make no sense) inside @scope: they stay outside
const HOISTED_AT_RULES = ['@keyframes', '@font-face', '@property', '@import', '@charset', '@counter-style'];

/**
 * Wraps the CSS in an @scope block for the container with the given scope key.
 * @param {string} css
 * @param {string} scopeKey - value of CSS_SCOPE_ATTRIBUTE of the containers
 * @returns {string}
 */
export function scopeCss(css, scopeKey) {
  const { hoisted, rest } = splitHoistedRules(css);
  const key = scopeKey.replace(/["\\]/g, '\\$&');
  const root = `[${CSS_SCOPE_ATTRIBUTE}="${key}"]`;
  const limit = `:scope [${CSS_SCOPE_ATTRIBUTE}] > *`;
  return `${hoisted.join('\n')}\n@scope (${root}) to (${limit}) {\n${rest}\n}\n`;
}

/**
 * Takes the top-level HOISTED_AT_RULES out of the CSS (with their block or up to their `;`).
 * @param {string} css
 * @returns {{ hoisted: string[], rest: string }}
 */
function splitHoistedRules(css) {
  const hoisted = [];
  let rest = '';
  let depth = 0;
  let i = 0;

  while (i < css.length) {
    const char = css[i];

    // comments and strings are copied as they are
    if (char === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end < 0 ? css.length : end + 2;
      rest += css.slice(i, stop);
      i = stop;
      continue;
    }
    if (char === '"' || char === "'") {
      const stop = _stringEnd(css, i);
      rest += css.slice(i, stop);
      i = stop;
      continue;
    }

    if (depth === 0 && char === '@') {
      const name = css.slice(i).match(/^@[\w-]+/)?.[0]?.toLowerCase();
      if (HOISTED_AT_RULES.includes(name)) {
        const stop = _atRuleEnd(css, i);
        hoisted.push(css.slice(i, stop));
        i = stop;
        continue;
      }
    }

    if (char === '{')
      depth++;
    else if (char === '}')
      depth--;
    rest += char;
    i++;
  }

  return { hoisted, rest };
}

/** Index after the at-rule starting at `start`: after its `;` or its block. */
function _atRuleEnd(css, start) {
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    const char = css[i];
    if (char === '"' || char === "'") {
      i = _stringEnd(css, i) - 1;
    } else if (char === ';' && depth === 0) {
      return i + 1;
    } else if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0)
        return i + 1;
    }
  }
  return css.length;
}

/** Index after the string starting at `start` (backslash escapes skipped). */
function _stringEnd(css, start) {
  const quote = css[start];
  for (let i = start + 1; i < css.length; i++) {
    if (css[i] === '\\')
      i++;
    else if (css[i] === quote)
      return i + 1;
  }
  return css.length;
}

/**
 * Adds CSS text as a blob stylesheet to <head>.
 * @param {string} css
 * @param {string} [id] - id of the <link>
 * @returns {Promise<void>} resolves when it is loaded (or failed)
 */
export function addStyleSheet(css, id = null) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  if (id)
    link.id = id;
  link.href = URL.createObjectURL(new Blob([css], { type: 'text/css' }));
  return new Promise(resolve => {
    link.onload = resolve;
    link.onerror = () => {
      console.warn(`[ScopedCss] stylesheet failed to load${id ? `: ${id}` : ''}`);
      resolve();
    };
    document.head.appendChild(link);
  });
}

/**
 * Adds a stylesheet by URL (unscoped `X.global.css`) to <head>.
 * @param {string} url
 * @returns {Promise<void>}
 */
export function addStyleSheetUrl(url) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  return new Promise(resolve => {
    link.onload = resolve;
    link.onerror = () => {
      console.warn(`[ScopedCss] stylesheet failed to load: ${url}`);
      resolve();
    };
    document.head.appendChild(link);
  });
}
