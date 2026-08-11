import { getThemeValue } from '@data/DocThemeManager.js';
import { findSyntaxDefinition, getHighlightStylesForLang } from '@data/SyntaxDefinitionManager.js';
import { darkenColor, escapeHTML, getMatchScore, sortBy, SORT_ACTION_MAP } from '@common/Common.js';
import { syntaxHighlighter } from '@core/syntaxHighlighter/SyntaxHighlighter.js';

export function setCardState(active, container, querys = []) {
  if(!container)
    return;
  
  let card = null;
  querys.find(q => {
    card = container.querySelector(q);
    return card;
  }); 
  if(!card)
    return;
  card.classList.toggle('theme-cards--active', active);
}

export function sortCardList(cards, action) {
  const config = SORT_ACTION_MAP[action];
  return config ? sortBy(cards, config) : cards;
}

export function createThemeCard({ dataSet = null, data, bodyHTML = '', footerHTML = '', extraClass = '' }) {
  const dataSetHTML = dataSet ? `data-${dataSet}="${data}"` : '';
  return `
  <div class="theme-cards ${extraClass}" ${dataSetHTML}>
    <div class="theme-cards_body">${bodyHTML}</div>
    <div class="theme-cards_footer">${footerHTML}</div>
  </div>`;
}

/**
 * Card body
 * Six color swatches side by side.
 * Colors are written to data-color attributes and applied via applyThemeCardColors().
 */
export function buildDocThemeCardBody(docTheme) {
  const keys = [
    'background',
    'background-surface',
    'background-elevated',
    'text-primary',
    'accent',
    'code-background',
  ];
  
  let replaceColor = '#ffffff';
  const swatches = keys
    .map(k => {
      let color = _safeColor(
        getThemeValue(docTheme, k), 
        darkenColor(replaceColor, 0.2)
      );

      replaceColor = color;
      return `<div class="theme-cards_swatch" data-color="${color}"></div>`;
    })
    .join('');
 
  return `<div class="theme-cards_palette">${swatches}</div>`;
}
 
/**
 * Card footer
 * Accent dot + name + mapping count.
 * Accent color written to data-accent, applied via applyThemeCardColors().
 */
export function buildDocThemeCardFooter(docTheme, { isActive = false, showDuplicate = false } = {}) {
  const accent = getThemeValue(docTheme, 'accent') ?? '#3ddc84';
  const builtIn = docTheme.builtIn ? '<span class="form-tag form-tag--small">Built In</span>' : '';

  const activateBtn = isActive
    ? `<span class="theme-cards_active-badge">✓ Active</span>`
    : `<button class="button button--tiny" data-activate-theme="${docTheme.id}">Use theme</button>`;

  const dupBtn = showDuplicate
    ? `<button class="icon-button icon-button--small" data-duplicate-theme="${docTheme.id}" title="Duplicate" aria-label="Duplicate theme">⧉</button>`
    : '';

  return `
    <div class="theme-cards_footer-inner">
      <div class="theme-cards_footer-row">
        <span class="theme-cards_accent-dot" data-accent="${accent}"></span>
        <span class="theme-cards_name">${escapeHTML(docTheme.name)}</span>
        ${builtIn}
      </div>
      <div class="theme-cards_footer-actions">
        ${activateBtn}
        ${dupBtn}
      </div>
    </div>
  `;
}

function _safeColor(value, fallback) {
  if (!value || typeof value !== 'string')
    return fallback;

  return value;
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
 * Card body
 * Six color swatches side by side.
 * Colors are written to data-color attributes and applied via applyThemeCardColors().
 */
export async function buildLanguageCardBody(project, lang) {
  const VISIBLE_LINES = 3;
  const fullCode = lang.exampleCode?.trim() || '// no example';
  const code = fullCode.split('\n').slice(0, VISIBLE_LINES).join('\n');
  let codeHTML = `<pre><code>${escapeHTML(code)}</code></pre>`;

  const styles = getHighlightStylesForLang(project, lang.id);
  if (styles.length) {
    try {
      const { html } = await syntaxHighlighter.highlightTextAsHTML({
        project, langId: lang.id, styleId: styles[0].id, text: code,
      });
      codeHTML = html;
    } catch (err) {
      console.warn(`Highlighting failed for language card '${lang.name}':`, err);
    }
  }

  return `<div class="theme-cards_code">${codeHTML}</div>`;
}

/**
 * Card footer
 * Accent dot + name + rule count.
 * Accent color written to data-accent, applied via applyThemeCardColors().
 */
export function buildLanguageCardFooter(lang, searchQuery) {
  const ruleCount = lang.states?.reduce((acc, a) => acc + (a.rules?.length ?? 0), 0) ?? 0;
  const ruleLabel = `${ruleCount} ${ruleCount === 1 ? 'rule' : 'rules'}`;

  const visibleAliases = _getTopMatchingLangAliases(lang.nameAliases, searchQuery);

  const builtIn = lang.builtIn ? '<span class="form-tag form-tag--small">Built In</span>': '';

  const tagHTML = visibleAliases
    .map(alias => `<span class="form-tag form--accent form-tag--small">${escapeHTML(alias)}</span>`)
    .join('');

  return `
    <div class="theme-cards_footer-inner">
      <div class="theme-cards_footer-row">
        <span class="theme-cards_name">${escapeHTML(lang.name)}</span>
        ${builtIn}
        ${tagHTML}
      </div>
      <div class="theme-cards_meta">
        ${escapeHTML(ruleLabel)}
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

/**
 * Card body — 40% height (~50px)
 * Highlights the owning language's example code using this specific style.
 */
export async function buildLanguageStyleCardBody(project, style) {
  const VISIBLE_LINES = 3;
  const langDef = findSyntaxDefinition(style.langId, project?.languages);
  const fullCode = langDef?.exampleCode?.trim() || '// no example';
  const code = fullCode.split('\n').slice(0, VISIBLE_LINES).join('\n');
  let codeHTML = `<pre><code>${escapeHTML(code)}</code></pre>`;

  try {
    const { html } = await syntaxHighlighter.highlightTextAsHTML({
      project, langId: style.langId, styleId: style.id, text: code,
    });
    codeHTML = html;
  } catch (err) {
    console.warn(`Highlighting failed for style card '${style.name}':`, err);
  }

  return `<div class="theme-cards_code">${codeHTML}</div>`;
}

export function buildLanguageStyleCardFooter(style, builtIn) {
  const builtInTag = builtIn ? '<span class="form-tag form-tag--small">Built In</span>' : '';
  return `
    <div class="theme-cards_footer-inner">
      <div class="theme-cards_footer-row">
        <span class="theme-cards_name">${escapeHTML(style.name)}</span>
        ${builtInTag}
      </div>
    </div>
  `;
}