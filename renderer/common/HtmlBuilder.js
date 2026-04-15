import { getThemeValue } from '@data/DocThemeManager.js';
import { parseMarkdown } from './MarkdownParser.js';
import { escapeHTML } from './Common.js';
import { APP_NAME, APP_VERSION } from './AppMeta.js';


// ─── Theme → CSS ──────────────────────────────────────────────────────────────

/**
 * Maps DocTheme entry keys to CSS custom property names.
 * Extend this map when new theme color/border entries are added.
 * @type {Record<string, string>}
 */
const THEME_COLOR_MAP = {
  'background':          '--bg',
  'background-surface':  '--bg1',
  'background-elevated': '--bg2',
  'border':              '--brd',
  'text-primary':        '--text',
  'text-secondary':      '--text2',
  'text-muted':          '--muted',
  'accent':              '--accent',
  'accent-hover':        '--accent-hover',
  'link':                '--link',
  'link-underline':      '--link-ul',
  'code-background':     '--cbg',
  'code-border':         '--cbrd',
  'code-text':           '--ctext',
  'heading':             '--heading-color',
};

/**
 * Generates the CSS :root block from a DocTheme.
 * All sizing values become CSS custom properties so every rule below
 * can reference them — no hardcoded pixel values in the stylesheet.
 * @param {Object} theme
 * @returns {string}
 */
export function buildThemeCSS(theme) {
  const tv = key => getThemeValue(theme, key);

  const colors = Object.entries(THEME_COLOR_MAP)
    .map(([k, v]) => `  ${v}:${tv(k)};`)
    .join('\n');

  const sizes = [
    `  --font-size:${tv('font-size')}px;`,
    `  --font-size-code:${tv('font-size-code')}px;`,
    `  --h1:${tv('heading-h1')}px;`,
    `  --h2:${tv('heading-h2')}px;`,
    `  --h3:${tv('heading-h3')}px;`,
    `  --h4:${tv('heading-h4')}px;`,
    `  --max-width:${tv('content-max-width')}px;`,
    `  --padding:${tv('padding-content')}px;`,
    `  --code-radius:${tv('code-radius')}px;`,
    `  --gap-p:${tv('gap-paragraph')}px;`,
    `  --gap-h:${tv('gap-heading')}px;`,
    `  --gap-code:${tv('code-block-gap')}px;`,
  ].join('\n');

  return `:root {\n${colors}\n${sizes}\n}`;
}

/**
 * Returns the base stylesheet for the exported document.
 * Every value is a CSS custom property — nothing is hardcoded.
 *
 * To change styling, add a new THEME_COLOR_MAP entry + custom property,
 * then reference it here. Do NOT put raw values in these rules.
 *
 * @returns {string}
 */
export function buildBaseCSS() {
  return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,serif;background:var(--bg);color:var(--text);font-size:var(--font-size);line-height:1.8}

/* ── Layout ─────────────────────────────────────────────────────────────── */
.layout{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
.content-col{display:flex;flex-direction:column;min-width:0}

/* ── Sidebar ────────────────────────────────────────────────────────────── */
.nav{background:var(--bg1);border-right:1px solid var(--brd);padding:20px 0;position:sticky;top:0;height:100vh;overflow-y:auto;flex-shrink:0}
.nav-brand{padding:0 16px 16px;font-size:18px;color:var(--accent);font-family:Georgia,serif;font-style:italic;border-bottom:1px solid var(--brd);margin-bottom:8px}
.nav-brand small{display:block;font-size:11px;color:var(--muted);margin-top:3px;font-style:normal}

/* Sidebar tab sections — only the active one is visible */
.sidebar-section{display:none}
.sidebar-section.active{display:block}

/* Nav rows: both <a> links and group header rows share this */
.nav-row{display:flex;align-items:center;gap:4px;padding:3px 0;padding-left:var(--indent,16px);color:var(--muted);font-family:monospace;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .15s;text-decoration:none}
.nav-row:hover{color:var(--accent)}
.nav-row--parent{color:var(--text2);font-weight:600;margin-top:6px}
.nav-row--parent .nav-link{color:inherit;text-decoration:none;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.nav-row--parent .nav-link:hover{color:var(--accent)}

/* Chevron toggle button inside parent rows */
.nav-chevron-btn{flex-shrink:0;background:none;border:none;cursor:pointer;color:var(--muted);font-size:9px;padding:0 4px;line-height:1;transition:color .15s, transform .2s}
.nav-chevron-btn:hover{color:var(--accent)}

/* Collapsible children wrapper */
.nav-children{overflow:hidden;transition:max-height .2s ease, opacity .15s ease;max-height:2000px;opacity:1}
.nav-group.collapsed .nav-children{max-height:0;opacity:0}
.nav-group.collapsed .nav-chevron-btn{transform:rotate(-90deg)}

/* ── Tab navigation bar ─────────────────────────────────────────────────── */
.tab-nav{display:flex;align-items:stretch;gap:0;background:var(--bg1);border-bottom:2px solid var(--brd);padding:0 var(--padding);position:sticky;top:0;z-index:20;flex-shrink:0}
.tab-nav.hidden{display:none}
.tab-btn{background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;padding:12px 18px;cursor:pointer;font-family:monospace;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);transition:color .15s, border-color .15s}
.tab-btn:hover{color:var(--text)}
.tab-btn.active{color:var(--accent);border-bottom-color:var(--accent)}

/* ── Tab panels ─────────────────────────────────────────────────────────── */
.tab-panel{display:none}
.tab-panel.active{display:block}

/* ── Main content area ───────────────────────────────────────────────────── */
.main{padding:40px var(--padding);max-width:var(--max-width)}
h1{font-size:var(--h1);font-weight:600;margin:0 0 18px;border-bottom:1px solid var(--brd);padding-bottom:12px;color:var(--heading-color)}
h2{font-size:var(--h2);font-weight:600;margin:var(--gap-h) 0 10px;color:var(--heading-color)}
h3{font-family:monospace;font-size:var(--h3);font-weight:700;color:var(--accent);margin:22px 0 8px;text-transform:uppercase;letter-spacing:.08em}
h4{font-family:monospace;font-size:var(--h4);color:var(--muted);margin:18px 0 6px}
p{margin:0 0 var(--gap-p)}
a{color:var(--link);text-decoration:none;border-bottom:1px solid var(--link-ul);transition:border-color .15s}
a:hover{border-color:var(--link)}
strong{font-weight:600}
em{color:#ffad45;font-style:italic}

/* ── Code ───────────────────────────────────────────────────────────────── */
code{font-family:monospace;font-size:var(--font-size-code);background:var(--cbg);color:var(--ctext);padding:2px 6px;border-radius:3px;border:1px solid var(--cbrd)}
.code-block-wrapper{position:relative;margin:var(--gap-code) 0}
.code-block-wrapper pre{margin:0;background:var(--cbg);border:1px solid var(--cbrd);border-radius:var(--code-radius);padding:14px 16px;overflow-x:auto}
.code-block-wrapper pre code{background:none;border:none;padding:0;line-height:1.65}
.code-language-tag{position:absolute;top:8px;right:10px;font-family:monospace;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}

/* ── Lists ──────────────────────────────────────────────────────────────── */
ul,ol{padding-left:22px;margin:8px 0 var(--gap-p)}
li{margin:3px 0}

/* ── Misc block elements ────────────────────────────────────────────────── */
blockquote{border-left:3px solid var(--accent);margin:12px 0;padding:8px 14px;background:rgba(34,212,168,.08);color:var(--muted);border-radius:0 5px 5px 0}
hr{border:none;border-top:1px solid var(--brd);margin:22px 0}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
th{background:var(--bg2);border:1px solid var(--brd);padding:7px 11px;text-align:left;font-family:monospace;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
td{border:1px solid var(--brd);padding:7px 11px}

/* ── Section layout ─────────────────────────────────────────────────────── */
.export-section{margin-bottom:48px;padding-bottom:48px;border-bottom:2px solid var(--brd)}
.export-section:last-child{border-bottom:none}
.export-section--child{margin-left:24px;padding-left:20px;border-left:2px solid var(--brd);border-bottom:1px solid var(--brd);margin-bottom:32px;padding-bottom:32px}
.export-section__body{max-width:680px}
`.trim();
}


// ─── <head> Builder ───────────────────────────────────────────────────────────

/**
 * Builds the <head> block.
 * @param {{ title: string, themeCSS: string, baseCSS: string }} options
 * @returns {string}
 */
export function buildHead({ title, themeCSS, baseCSS }) {
  return `
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)}</title>
<style>
${themeCSS}
${baseCSS}
</style>`.trim();
}


// ─── Sidebar Builder ──────────────────────────────────────────────────────────

/**
 * Builds the sidebar <nav> containing per-tab node trees.
 * Only the first tab's section starts as active; JS handles switching.
 *
 * @param {Array}  tabs    - Tabs with at least one node (pre-filtered)
 * @param {Object} project - Project object (for the brand name)
 * @returns {string}
 */
export function buildSidebar(tabs, project) {
  const sections = tabs.map((tab, i) =>
    `<div class="sidebar-section${i === 0 ? ' active' : ''}" data-tab="${tab.id}">
  ${buildNavTree(tab.nodes)}
</div>`
  ).join('\n');

  return `
<nav class="nav">
  <div class="nav-brand">${escapeHTML(project.name)}<small>Documentation</small></div>
  ${sections}
</nav>`.trim();
}

/**
 * Recursively builds the collapsible nav tree for a list of nodes.
 *
 * Parent nodes (those with children) render as a group:
 *   • A clickable link that navigates to the section
 *   • A chevron button that toggles the children
 *
 * Leaf nodes render as plain anchor links.
 *
 * @param {Array}  nodes
 * @param {number} [depth=0]
 * @returns {string}
 */
export function buildNavTree(nodes, depth = 0) {
  const indent = 16 + depth * 14;

  return nodes.map(node => {
    if (node.children.length > 0) {
      return `<div class="nav-group" id="navg-${node.id}">
  <div class="nav-row nav-row--parent" style="--indent:${indent}px">
    <a class="nav-link" href="#${node.id}">${escapeHTML(node.name)}</a>
    <button class="nav-chevron-btn" onclick="toggleNavGroup('navg-${node.id}')" aria-label="toggle section">▾</button>
  </div>
  <div class="nav-children">
    ${buildNavTree(node.children, depth + 1)}
  </div>
</div>`;
    }

    return `<a class="nav-row" style="--indent:${indent}px" href="#${node.id}">${escapeHTML(node.name)}</a>`;
  }).join('\n');
}

/**
 * @deprecated Use buildSidebar(tabs, project) for multi-tab exports.
 * Kept for backward compatibility with single-tab preview callers.
 */
export function buildNavLinks(nodes, depth = 0) {
  return buildNavTree(nodes, depth);
}


// ─── Tab Navigation Bar ───────────────────────────────────────────────────────

/**
 * Builds the horizontal tab navigation bar.
 * Hidden via the "hidden" class when only one tab is present — JS and CSS
 * both respect this so the bar never occupies space for single-tab exports.
 *
 * @param {Array} tabs - Tabs with at least one node (pre-filtered)
 * @returns {string}
 */
export function buildTabNav(tabs) {
  const hiddenClass = tabs.length <= 1 ? ' hidden' : '';

  const buttons = tabs.map((tab, i) =>
    `<button class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${tab.id}">
      ${escapeHTML(tab.name)}
    </button>`
  ).join('\n');

  return `<div class="tab-nav${hiddenClass}" id="tabNav">${buttons}</div>`;
}


// ─── Content Builders ─────────────────────────────────────────────────────────

/**
 * Builds all tab panels.
 * Only the first panel is active on load; switchTab() handles the rest.
 *
 * @param {Array}       tabs  - Tabs with at least one node (pre-filtered)
 * @param {Object|null} theme - DocTheme for markdown parsing
 * @returns {string}
 */
export function buildAllTabContent(tabs, theme = null) {
  return tabs.map((tab, i) =>
    `<div class="tab-panel${i === 0 ? ' active' : ''}" id="panel-${tab.id}">
  <div class="main">
    ${buildContent(tab.nodes, theme)}
  </div>
</div>`
  ).join('\n');
}

/**
 * Recursively builds the main content sections for a node list.
 *
 * @param {Array}       nodes
 * @param {Object|null} theme - DocTheme for context-aware markdown parsing
 * @param {number}      [depth=0]
 * @returns {string}
 */
export function buildContent(nodes, theme = null, depth = 0) {
  return nodes.map(node => {
    const content    = (node.content || '').trim();
    const hasHeading = /^#{1,6}\s/.test(content);
    const heading    = hasHeading ? '' : `<h1>${escapeHTML(node.name)}</h1>\n`;
    const childClass = depth > 0 ? ' export-section--child' : '';
    const children   = node.children.length
      ? buildContent(node.children, theme, depth + 1)
      : '';

    return (
      `<section id="${node.id}" class="export-section${childClass}">` +
        heading +
        `<div class="export-section__body">${parseMarkdown(content, theme)}</div>` +
      `</section>` +
      children
    );
  }).join('');
}


// ─── Inline Script Builder ────────────────────────────────────────────────────

/**
 * Builds the inline <script> block for the exported document.
 *
 * Provides:
 *   switchTab(tabId)        — shows the matching panel + sidebar section
 *   toggleNavGroup(groupId) — collapses/expands a nav group
 *
 * On load the first tab is activated. If the user had previously opened the
 * export and sessionStorage contains a valid tab ID, that tab is restored.
 *
 * @param {Array} tabs - Tabs with at least one node (pre-filtered)
 * @returns {string}
 */
export function buildScript(tabs) {
  // Serialize just the IDs we need — no project data leaks into the script
  const tabIds = JSON.stringify(tabs.map(t => t.id));

  return `
(function () {
  var TAB_IDS = ${tabIds};

  // ── Tab switching ──────────────────────────────────────────────────────────
  function switchTab(tabId) {
    if (!TAB_IDS.includes(tabId)) return;

    // Panels
    document.querySelectorAll('.tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + tabId);
    });

    // Sidebar sections
    document.querySelectorAll('.sidebar-section').forEach(function (s) {
      s.classList.toggle('active', s.dataset.tab === tabId);
    });

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });

    try { sessionStorage.setItem('_docActiveTab', tabId); } catch (e) {}
  }

  // ── Nav group toggle ───────────────────────────────────────────────────────
  function toggleNavGroup(groupId) {
    var group = document.getElementById(groupId);
    if (!group) return;
    group.classList.toggle('collapsed');
  }

  // ── Tab button click delegation ────────────────────────────────────────────
  var tabNav = document.getElementById('tabNav');
  if (tabNav) {
    tabNav.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (btn && btn.dataset.tab) switchTab(btn.dataset.tab);
    });
  }

  // ── Initialise ─────────────────────────────────────────────────────────────
  var saved   = null;
  try { saved = sessionStorage.getItem('_docActiveTab'); } catch (e) {}

  var initial = (saved && TAB_IDS.includes(saved)) ? saved : TAB_IDS[0];
  if (initial) switchTab(initial);

  // Expose globally so onclick handlers in nav can call these
  window.switchTab      = switchTab;
  window.toggleNavGroup = toggleNavGroup;
})();
`.trim();
}


// ─── Document Assembly ────────────────────────────────────────────────────────

/**
 * Assembles the final HTML document from its parts.
 *
 * The `parts` object is the single place to add new page regions.
 * Adding a search overlay, for example, means adding parts.searchOverlay
 * and referencing it in the template below.
 *
 * @param {{ head: string, sidebar: string, tabNav: string, main: string, script: string }} parts
 * @returns {string}
 */
export function assembleDocument(parts) {
  return `<!-- Generated with ${APP_NAME} v${APP_VERSION} – https://github.com/Etienne780/DocForge -->
<!DOCTYPE html>
<html lang="en">
<head>
${parts.head}
</head>
<body>
<div class="layout">
  ${parts.sidebar}
  <div class="content-col">
    ${parts.tabNav}
    ${parts.main}
  </div>
</div>
<script>
${parts.script}
</script>
</body>
</html>`;
}