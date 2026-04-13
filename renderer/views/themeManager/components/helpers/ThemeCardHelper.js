import { getThemeColor } from '@data/DocThemeManager.js';
import { darkenColor, escapeHTML, getMatchScore, sortBy, SORT_ACTION_MAP } from '@common/Common.js';

export function sortCardList(cards, action) {
  const config = SORT_ACTION_MAP[action];
  return config ? sortBy(cards, config) : cards;
}

export function createThemeCard({ dataSet = null, data, bodyHTML = '', footerHTML = '' }) {
  const dataSetHTML = dataSet ? `data-${dataSet}="${data}"` : '';
  
  return `
  <div class="theme-cards" ${dataSetHTML}">
    <div class="theme-cards_body">${bodyHTML}</div>
    <div class="theme-cards_footer">${footerHTML}</div>
  </div>`;
}

/**
 * Card body — 40% height (~50px)
 * Six color swatches side by side.
 * Colors are written to data-color attributes and applied via applyThemeCardColors().
 */
export function buildDocThemeCardBody(docTheme) {
  const keys = [
    'background',
    'background-surface',
    'text-primary',
    'accent',
    'code-background',
    'inline-code-text',
  ];
  
  let replaceColor = '#ffffff';
  const swatches = keys
    .map(k => {
      let color = getThemeColor(docTheme, k);
      if (!color) {
        // use darker version of previous color if missing
        color = darkenColor(replaceColor, 0.2);
      }

      replaceColor = color;
      return `<div class="theme-cards_swatch" data-color="${color}"></div>`;
    })
    .join('');
 
  return `<div class="theme-cards_palette">${swatches}</div>`;
}
 
/**
 * Card footer — 60% height (~75px)
 * Accent dot + name + mapping count.
 * Accent color written to data-accent, applied via applyThemeCardColors().
 */
export function buildDocThemeCardFooter(docTheme) {
  const accent = getThemeColor(docTheme, 'accent') ?? '#3ddc84';
  const mapCount = docTheme?.settings?.mapping?.length ?? 0;
  const mapLabel = mapCount > 0
    ? `${mapCount} ${mapCount === 1 ? 'mapping' : 'mappings'}`
    : 'no mappings';
 
  return `
    <div class="theme-cards_footer-inner">
      <div class="theme-cards_footer-row">
        <span class="theme-cards_accent-dot" data-accent="${accent}"></span>
        <span class="theme-cards_name">${escapeHTML(docTheme.name)}</span>
      </div>
      <span class="theme-cards_meta">${escapeHTML(mapLabel)}</span>
    </div>
  `;
}
 
/**
 * After inserting card HTML into the DOM, call this to apply
 * the theme colors from data-attributes to backgroundColor.
 * This avoids inline styles (CSP) while still allowing dynamic colors.
 * 
 * @param {HTMLElement} container - the element containing the rendered cards
 */
export function applyDocThemeCardColors(container) {
  container.querySelectorAll('.theme-cards_swatch[data-color]').forEach(el => {
    el.style.backgroundColor = el.dataset.color;
  });
 
  container.querySelectorAll('.theme-cards_accent-dot[data-accent]').forEach(el => {
    el.style.backgroundColor = el.dataset.accent;
  });
}

/**
 * Card body — 40% height (~50px)
 * Six color swatches side by side.
 * Colors are written to data-color attributes and applied via applyThemeCardColors().
 */
export function buildLanguageCardBody(lang) {
  const code = lang.exampleCode?.trim() || '// no example';

  return `
    <div class="theme-cards_code">
      <pre><code>${escapeHTML(code)}</code></pre>
    </div>
  `;
}

/**
 * Card footer — 60% height (~75px)
 * Accent dot + name.
 * Accent color written to data-accent, applied via applyThemeCardColors().
 */
export function buildLanguageCardFooter(lang, searchQuery) {
  const areaCount = lang.areas?.length ?? 0;
  const ruleCount = lang.areas?.reduce((acc, a) => acc + (a.rules?.length ?? 0), 0);

  const visibleAliases = _getTopMatchingLangAliases(lang.nameAliases, searchQuery);

  const tagHTML = visibleAliases
    .map(alias => `<span class="form-tag form-tag--small">${escapeHTML(alias)}</span>`)
    .join('');

  return `
    <div class="theme-cards_footer-inner">
      <div class="theme-cards_footer-row">
        <span class="theme-cards_name">${escapeHTML(lang.name)}</span>
        ${tagHTML}
      </div>
      <div class="theme-cards_meta">
        ${escapeHTML(areaCount.toString())} areas • ${escapeHTML(ruleCount.toString())} rules
      </div>
    </div>
  `;
}

/**
 * Returns the top matching aliases sorted by relevance.
 *
 * Ranking:
 * 1. exact match
 * 2. prefix match
 * 3. includes match
 * 4. alphabetical fallback
 *
 * @param {string[]} nameAliases
 * @param {string} query
 * @param {number} limit
 * @returns {string[]}
 */
function _getTopMatchingLangAliases(nameAliases, query, limit = 3) {
  if (!Array.isArray(nameAliases) || nameAliases.length === 0)
    return [];

  const q = query?.toLowerCase() || '';

  return nameAliases
    .filter(alias => {
      if (!q)
        return true;

      return alias.toLowerCase().includes(q);
    })
    .toSorted((a, b) => {
      const scoreA = getMatchScore(a, q);
      const scoreB = getMatchScore(b, q);

      if (scoreA !== scoreB)
        return scoreB - scoreA;

      return a.localeCompare(b);
    })
    .slice(0, limit);
}