import { session } from '@core/SessionState.js';
import { blobManager } from '@core/BlobManager.js';
import { DOC_THEME_BLOB_SECTION, findDocTheme, getPresetDocThemes } from '@data/DocThemeManager.js';
import { getThemeValue } from '@data/DocThemeManager.js';
import { parseMarkdown } from './MarkdownParser.js';
import { escapeHTML } from './Common.js';
import { APP_NAME, APP_VERSION } from '@core/AppMeta.js';

// ─── Theme → CSS ──────────────────────────────────────────────────────────────

const FONT_STACKS = {
  system: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  serif:  `Georgia, 'Times New Roman', serif`,
  mono:   `ui-monospace, 'Cascadia Code', 'Fira Code', monospace`,
};

const FONT_MONO_STACK = `ui-monospace, 'Cascadia Code', 'Fira Code', monospace`;

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
  'code-tag-text':       '--ctag-text',
  'heading':             '--heading-color',
};

export function buildThemeCSS(theme) {
  const tv = key => getThemeValue(theme, key);

  const colors = Object.entries(THEME_COLOR_MAP)
    .map(([k, v]) => `  ${v}: ${tv(k)};`)
    .join('\n');

  const codeSize    = tv('font-size-code') ?? 14;
  const bodyTypo    = tv('typography-body')    ?? 'system';
  const headingTypo = tv('typography-heading') ?? 'system';

  const sizes = [
    `  --header-height: ${tv('header-height')}px;`,
    `  --font-size:          ${tv('font-size')}px;`,
    `  --font-size-code:     ${codeSize}px;`,
    `  --font-size-code-tag: ${Math.max(10, codeSize - 1)}px;`,
    `  --h1:         ${tv('heading-h1')}px;`,
    `  --h2:         ${tv('heading-h2')}px;`,
    `  --h3:         ${tv('heading-h3')}px;`,
    `  --h4:         ${tv('heading-h4')}px;`,
    `  --max-width:  ${tv('content-max-width')}px;`,
    `  --padding:    ${tv('padding-content')}px;`,
    `  --code-radius:${tv('code-radius')}px;`,
    `  --gap-p:      ${tv('gap-paragraph')}px;`,
    `  --gap-h:      ${tv('gap-heading')}px;`,
    `  --gap-code:   ${tv('code-block-gap')}px;`,
  ].join('\n');

  const fonts = [
    `  --font-body:    ${FONT_STACKS[bodyTypo]    ?? FONT_STACKS.system};`,
    `  --font-heading: ${FONT_STACKS[headingTypo] ?? FONT_STACKS.system};`,
    `  --font-mono:    ${FONT_MONO_STACK};`,
  ].join('\n');

  return `:root {\n${colors}\n${sizes}\n${fonts}\n}`;
}

export function buildBaseCSS() {
  return `
/* ── Reset ──────────────────────────────────────────────────────────────── */
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Spacing scale (static — not theme-controlled) ──────────────────────── */
:root {
  --indent-spacing: 16px;
  --scrollbar-size: 6px;
  --sp-xxs: 4px;
  --sp-xs:  8px;
  --sp-s:   12px;
  --sp-m:   16px;
  --sp-l:   20px;
  --sp-xl:  24px;
  --sp-xxl:  28px;
}

/* ── Base ───────────────────────────────────────────────────────────────── */
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
}

body {
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--text);
  font-size: var(--font-size);
  line-height: 1.8;
}

.document {
  width: 100%;
  height: 100%;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  z-index: 9999;
}

:focus:not(:focus-visible) {
  outline: none;
}

/* ── Scrollbars ─────────────────────────────────────────────── */
::-webkit-scrollbar {
  width: var(--scrollbar-size);
  height: var(--scrollbar-size);
}
::-webkit-scrollbar-track {
  background: var(--bg);
}
::-webkit-scrollbar-thumb {
  background: var(--bg1);
  border-radius: 1px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--bg2);
}
::-webkit-scrollbar-corner {
  background: var(.bg);
}

/* ── Layout ─────────────────────────────────────────────────────────────── */
.layout { display: flex; width: 100%; height: 100%; }
.content-col { display: flex; flex-direction: column; flex: 1; min-width: 0; }

/* ── Header ──────────────────────────────────────────────────────────── */
.doc-header {
  z-index: 30;
  height: var(--header-height);
  display: flex;
  align-items: center;
  padding: 0 var(--padding);
  flex-shrink: 0;
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.doc-header.header-style-solid {
  background: var(--bg1);
  border-bottom: 1px solid var(--brd);
}
.doc-header.header-style-blur {
  backdrop-filter: blur(12px);
  background: color-mix(in srgb, var(--bg1) 75%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--brd) 60%, transparent);
}
.doc-header.header-style-transparent {
  background: transparent;
}
.doc-header.hidden-scrolled {
  transform: translateY(-100%);
  opacity: 0;
  pointer-events: none;
}
.doc-header .header-title {
  font-family: var(--font-heading);
  font-size: 15px;
  color: var(--text2);
  font-weight: 600;
}
/* header-show:never */
.doc-header.header-never { display: none; }


/* ── TOC ─────────────────────────────────────────────────────────────── */
.toc {
  width: 200px;
  flex-shrink: 0;
  padding: 40px 0 40px 16px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  border-left: 1px solid var(--brd);
}
.toc.toc-left {
  border-left: none;
  border-right: 1px solid var(--brd);
  padding: 40px 16px 40px 0;
  order: -1;
}
.toc.toc-hidden { display: none; }
@media (max-width: 1100px) { .toc.toc-desktop { display: none; } }
.toc-title {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  margin-bottom: 10px;
  padding-left: 8px;
}
.toc-link {
  display: block;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  padding: 3px 8px;
  border-radius: 3px;
  text-decoration: none;
  border-bottom: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color .15s, background .15s;
}
.toc-link:hover { color: var(--accent-hover); background: color-mix(in srgb, var(--accent) 8%, transparent); border-bottom: none; }
.toc-link.active { color: var(--accent); }
.toc-link[data-level="2"] { padding-left: 16px; }
.toc-link[data-level="3"] { padding-left: 26px; font-size: 10px; }
.toc-link[data-level="4"] { padding-left: 36px; font-size: 10px; }

/* Nav verstecken via content-show-nav:never */
.nav.nav-hidden { display: none; }

/* ── Sidebar ────────────────────────────────────────────────────────────── */
.nav { width: 200px; background: var(--bg1); border-right: 1px solid var(--brd); padding: 20px 0; position: sticky; top: 0; height: 100vh; overflow-y: auto; flex-shrink: 0; }
.nav-brand { padding: 0 16px 16px; font-size: 18px; color: var(--accent); font-family: var(--font-heading); font-style: italic; border-bottom: 1px solid var(--brd); margin-bottom: 8px; }
.nav-brand small { display: block; font-size: 11px; color: var(--muted); margin-top: 3px; font-style: normal; }
.sidebar-section { display: none; }
.sidebar-section.active { display: block; }
.nav-row { display: flex; align-items: center; gap: 4px; padding: 3px 0; padding-left: var(--indent, 16px); border-bottom: unset; color: var(--muted); font-family: var(--font-mono); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color .15s; text-decoration: none; cursor: pointer; }
.nav-row:hover { color: var(--accent); }
.nav-row--parent { color: var(--text2); font-weight: 600; margin-top: 6px; border-bottom: unset; }
.nav-row--parent .nav-link { color: inherit; text-decoration: none; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; border-bottom: unset; }
.nav-row--parent .nav-link:hover { color: var(--accent); }
.nav-chevron-btn { flex-shrink: 0; background: none; border: none; cursor: pointer; color: var(--muted); font-size: 20px; padding: 0 4px; line-height: 1; transition: color .15s, transform .2s; }
.nav-chevron-btn:hover { color: var(--accent); }
.nav-children { overflow: hidden; transition: max-height .2s ease, opacity .15s ease; max-height: 2000px; opacity: 1; }
.nav-group.collapsed .nav-children { max-height: 0; opacity: 0; }
.nav-group.collapsed .nav-chevron-btn { transform: rotate(-90deg); }

/* Active node highlighting in sidebar */
.nav-row.active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border-left: 3px solid var(--accent);
  margin-left: -3px;
}

/* ── Tab navigation bar ─────────────────────────────────────────────────── */
.tab-nav { display: flex; align-items: stretch; background: var(--bg1); border-bottom: 2px solid var(--brd); overflow-x: auto; scrollbar-gutter: stable; padding: 0 var(--padding); position: sticky; top: 0; z-index: 20; flex-shrink: 0; }
.tab-nav.hidden { display: none; }
.tab-btn { background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: 0px; padding: 12px 18px; cursor: pointer; font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); transition: color .15s, border-color .15s; }
.tab-btn:hover { color: var(--text); }
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }

/* ── Dynamic content area with crossfade ─────────────────────────────────── */
.content-stage {
  display: flex;
  justify-content: center;
  position: relative;
  min-height: 300px;
  overflow: hidden;
}
.dynamic-content {
  padding: 40px var(--padding);
  max-width: var(--max-width);
  transition: opacity 0.2s ease-in-out;
  opacity: 1;
  flex: 1;
  overflow-y: auto;
}
.dynamic-content.fade-out {
  opacity: 0;
}
.preview-root {
  padding: var(--padding);
  max-width: var(--max-width);
  margin: 0 auto;
}

/* ── Hidden templates container ──────────────────────────────────────────── */
.node-templates {
  display: none;
}

/* ── Headings ────────────────────────────────────────────────────────────── */
h1 { font-family: var(--font-heading); font-size: var(--h1); font-weight: 600; letter-spacing: -0.02em; margin: 0 0 var(--sp-m); color: var(--heading-color); line-height: 1.3; }
h2 { font-family: var(--font-heading); font-size: var(--h2); font-weight: 600; margin: var(--gap-h) 0 10px; color: var(--heading-color); }
h3 { font-family: var(--font-mono); font-size: var(--h3); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--heading-color); margin: 24px 0 8px; }
h4 { font-family: var(--font-mono); font-size: var(--h4); color: var(--heading-color); margin: 18px 0 6px; }

/* ── Body text ───────────────────────────────────────────────────────────── */
p { font-family: var(--font-body); margin: 0 0 var(--gap-p); line-height: 1.75; color: var(--text); }
a { color: var(--link); text-decoration: none; border-bottom: 1px solid var(--link-ul); transition: border-color .12s; }
a:hover { border-color: var(--link); }
strong { font-weight: 600; color: var(--text); }
em { font-style: italic; color: var(--accent); }

/* ── Inline code ─────────────────────────────────────────────────────────── */
code { font-family: var(--font-mono); font-size: var(--font-size-code); background: var(--cbg); color: var(--ctext); padding: var(--sp-xxs) var(--sp-xs); border-radius: 3px; border: 2px solid var(--brd); }

/* ── Code blocks ─────────────────────────────────────────────────────────── */
pre { position: relative; background: var(--cbg); border: 2px solid var(--cbrd); border-radius: var(--code-radius); padding: var(--sp-s) var(--sp-m); margin: 0 0 var(--sp-s); overflow-x: auto; }
pre code { background: none; border: none; padding: 0; font-size: var(--font-size-code); line-height: 1.65; color: var(--ctext); }
.code-block-wrapper { min-width: 250px; margin-top: var(--gap-code); position: relative; display: flex; flex-direction: column; width: 100%; }
.code-block-wrapper pre { margin: 0 0 var(--sp-xs); border-radius: 0 6px 6px 6px; }
.code-language-tag { position: absolute; display: flex; align-items: center; justify-content: center; height: calc(var(--font-size-code-tag) + var(--sp-xs) + 2px); top: calc(-1 * (var(--font-size-code-tag) + var(--sp-xs))); width: fit-content; padding: 0 var(--sp-xs); border: 2px solid var(--cbrd); border-bottom: none; border-radius: 4px 4px 0 0; background: var(--cbg); font-family: var(--font-mono); font-size: var(--font-size-code-tag); color: var(--ctag-text); text-transform: uppercase; letter-spacing: 0.08em; }

/* ── Lists ──────────────────────────────────────────────────────────────── */
ul, ol { padding-left: 24px; margin: 8px 0 var(--gap-p); font-family: var(--font-body); color: var(--text); }
li { margin: 4px 0; line-height: 1.7; }

/* ── Blockquote ──────────────────────────────────────────────────────────── */
blockquote { border-left: 3px solid var(--accent); margin: 14px 0; padding: 8px 14px; background: color-mix(in srgb, var(--accent) 8%, transparent); color: var(--muted); border-radius: 0 5px 5px 0; font-style: italic; font-family: var(--font-body); }

/* ── Misc ───────────────────────────────────────────────────────────────── */
hr { border: none; border-top: 1px solid var(--brd); margin: 24px 0; }

/* ── Tables ─────────────────────────────────────────────────────────────── */
table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: var(--font-size); }
th { background: var(--bg2); border: 1px solid var(--brd); padding: 7px 12px; text-align: left; font-family: var(--font-mono); font-size: var(--font-size); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
td { border: 1px solid var(--brd); padding: 7px 12px; font-family: var(--font-body); color: var(--text); }

.nav-row:hover { color: var(--accent-hover); }
.tab-btn:hover { color: var(--accent-hover); }
a:hover { border-color: var(--accent-hover); color: var(--accent-hover); }

.indent-0 { --indent: calc(var(--indent-spacing) * 1) }
.indent-1 { --indent: calc(var(--indent-spacing) * 2) }
.indent-2 { --indent: calc(var(--indent-spacing) * 3) }
.indent-3 { --indent: calc(var(--indent-spacing) * 4) }
.indent-4 { --indent: calc(var(--indent-spacing) * 5) }
`.trim();
}

function buildCombinedCSS(theme) {
  const resolvedTheme = (theme && typeof theme === 'object') ? theme : {};
  return buildThemeCSS(resolvedTheme) + '\n' + buildBaseCSS();
}

function getCachedThemeStyleEntry(theme) {
  const resolvedTheme = (theme && typeof theme === 'object') ? theme : {};
  const themeId = resolvedTheme.id ?? '__default__';

  const entry = blobManager.get(DOC_THEME_BLOB_SECTION, themeId);
  if (entry)
    return entry;

  const css = buildCombinedCSS(resolvedTheme);
  const newEntry = blobManager.add(DOC_THEME_BLOB_SECTION, themeId, { 
    data: css, 
    type: 'text/css',
  });
  return newEntry;
}

export function getCachedThemeStyleUrl(theme) {
  return getCachedThemeStyleEntry(theme).url;
}

export function getCachedThemeStyleContent(theme) {
  return getCachedThemeStyleEntry(theme).data;
}

export function revokeThemeCache(id) {
  if(id) {
    blobManager.remove(DOC_THEME_BLOB_SECTION, id);
  } else {
    blobManager.removeSection(DOC_THEME_BLOB_SECTION);
  }
}

// ─── <head> Builder ───────────────────────────────────────────────────────────

export function buildHead({ title, theme }) {
  const styleUrl = getCachedThemeStyleUrl(theme);
  return `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHTML(title)}</title>
  <link rel="stylesheet" href="${styleUrl}">`.trim();
}

export function buildHeader(projectName, headerShow, headerStyle) {
  if (headerShow !== 'top') 
    return '';

  return `
  <header class="doc-header header-style-${headerStyle}" id="docHeader">
    <span class="header-title">${escapeHTML(projectName)}</span>
  </header>`;
}

export function buildToc(tocShow, tocPosition) {
  if (tocShow === 'never') 
    return '';

  const desktopClass = tocShow === 'desktop' ? ' toc-desktop' : '';
  const posClass = tocPosition === 'left' ? ' toc-left' : '';

  return `
  <aside class="toc${posClass}${desktopClass}" id="tocSidebar">
    <div class="toc-title">On this page</div>
    <nav id="tocLinks"></nav>
  </aside>`;
}

// ─── Sidebar Builder (unchanged but nav-row gets data-node-id) ────────────────

export function buildSidebar(tabs, project, theme, headerShow) {
  const showNav = getThemeValue(theme, 'content-show-nav') ?? 'always';
  const hiddenClass = showNav === 'never' ? ' nav-hidden' : '';

  const sections = tabs.map((tab, i) =>
  `<div class="sidebar-section${i === 0 ? ' active' : ''}" data-tab="${tab.id}">
    ${buildNavTree(tab.nodes, tab.id)}
  </div>`
  ).join('\n');

  const h = (headerShow === 'sidebar') ? 
    `<div class="nav-brand">${escapeHTML(project.name)}</div>` : 
    '';

  return `
  <nav class="nav${hiddenClass}">
    ${h}
    ${sections}
  </nav>`.trim();
}

function buildNavTree(nodes, tabId, depth = 0) {
  const indentClass = `indent-${depth}`;

  return nodes.map(node => {
    if (node.children.length > 0) {
      return `
      <div class="nav-group" id="navg-${node.id}">
        <div class="nav-row nav-row--parent ${indentClass}" data-node-id="${node.id}" data-tab-id="${tabId}">
          <a class="nav-link" href="#${node.id}">${escapeHTML(node.name)}</a>
          <button class="nav-chevron-btn" data-toggle-group="navg-${node.id}" aria-label="toggle section">▾</button>
        </div>
        <div class="nav-children">
          ${buildNavTree(node.children, tabId, depth + 1)}
        </div>
      </div>`;
    }

    return `<a class="nav-row ${indentClass}" data-node-id="${node.id}" data-tab-id="${tabId}" href="#${node.id}">${escapeHTML(node.name)}</a>`;
  }).join('\n');
}

// ─── Tab Navigation Bar ───────────────────────────────────────────────────────

export function buildTabNav(tabs) {
  const hiddenClass = tabs.length <= 1 ? ' hidden' : '';
  const buttons = tabs.map((tab, i) =>
    `<button class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${tab.id}">
      ${escapeHTML(tab.name)}
    </button>`
  ).join('\n');
  return `<div class="tab-nav${hiddenClass}" id="tabNav">${buttons}</div>`;
}

// ─── Dynamic Content & Templates ─────────────────────────────────────────────

/**
 * Builds the container for dynamic content (where the selected node will appear)
 * and the hidden templates container that holds every node's rendered HTML.
 */
export function buildDynamicContentAndTemplates(tabs, theme, tocHtml = '') {
  const templates = [];
  const collectNodes = (nodes, tabId) => {
    for (const node of nodes) {
      templates.push(buildNodeTemplate(node, tabId, theme));
      if (node.children.length) 
        collectNodes(node.children, tabId);
    }
  };
  for (const tab of tabs) 
    collectNodes(tab.nodes, tab.id);

  return `
  <div class="content-stage">
    <div id="dynamicContent" class="dynamic-content">
      <!-- Initial content will be filled by JS -->
    </div>
    ${tocHtml}
  </div>
  <div class="node-templates">
    ${templates.join('\n')}
  </div>`;
}

function buildNodeTemplate(node, tabId, theme) {
  const contentHtml = buildNodeContentHtml(node, theme);
  return `<template id="tmpl-${node.id}">
  <div class="main" data-node-id="${node.id}" data-tab-id="${tabId}">
    ${contentHtml}
  </div>
</template>`;
}

/**
 * Renders a single node's content (without children sections).
 * For a single‑node view we do NOT render children recursively – only the node itself.
 */
function buildNodeContentHtml(node, theme) {
  const rawContent = (node.content || '').trim();
  const hasHeading = /^#{1,6}\s/.test(rawContent);
  const heading = hasHeading ? '' : `<h1>${escapeHTML(node.name)}</h1>\n`;
  const body = parseMarkdown(rawContent, theme);
  return `<section id="${node.id}" class="export-section">
    ${heading}
    <div class="export-section__body">${body}</div>
  </section>`;
}

// ─── Inline Script Builder (completely rewritten) ────────────────────────────

export function createTabId(tabs) {
  if (!tabs || tabs.length === 0)
    return '__default__';

  const combined = tabs
    .map(t => t.id)
    .filter(Boolean)
    .join('|');

  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }

  return `tab_${Math.abs(hash)}`;
}

export function createScript(tabs) {
  // Build a flat list of all nodes with their tab id for quick lookup
  const allNodes = [];
  const collect = (nodes, tabId) => {
    for (const node of nodes) {
      allNodes.push({ id: node.id, tabId });
      if (node.children.length) collect(node.children, tabId);
    }
  };
  for (const tab of tabs) {
    collect(tab.nodes, tab.id);
  }
  const firstNode = allNodes[0] || null;

  return `(function () {
  // ── Data ────────────────────────────────────────────────────────────────
  var allNodes = ${JSON.stringify(allNodes)};
  var firstNode = ${JSON.stringify(firstNode)};
  var currentTabId = null;
  var currentNodeId = null;
  var isTransitioning = false;
  var dynamicContent = document.getElementById('dynamicContent');

  // ── Helper: find node's tab ────────────────────────────────────────────
  function getNodeTabId(nodeId) {
    var node = allNodes.find(function(n) { return n.id === nodeId; });
    return node ? node.tabId : null;
  }

  // ── Header scroll-hide behaviour ──────────────────────────────────────
  var docHeader = document.getElementById('docHeader');
  if (docHeader && docHeader.classList.contains('header-scroll-hide')) {
    var lastScrollY = 0;
    var scrollTarget = document.querySelector('.dynamic-content') || window;
    var onScroll = function() {
      var y = (scrollTarget === window) ? window.scrollY : scrollTarget.scrollTop;
      if (y > lastScrollY && y > 60) {
        docHeader.classList.add('hidden-scrolled');
      } else {
        docHeader.classList.remove('hidden-scrolled');
      }
      lastScrollY = y;
    };
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
  }

  // ── TOC builder ────────────────────────────────────────────────────────
  var tocLinks = document.getElementById('tocLinks');
  function buildToc() {
    if (!tocLinks) return;
    var headings = dynamicContent.querySelectorAll('h1,h2,h3,h4');
    tocLinks.innerHTML = '';
    headings.forEach(function(h) {
      if (!h.id) h.id = 'h-' + Math.random().toString(36).slice(2, 7);
      var a = document.createElement('a');
      a.className = 'toc-link';
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      a.dataset.level = h.tagName[1];
      a.addEventListener('click', function(e) {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'smooth' });
      });
      tocLinks.appendChild(a);
    });
  }

  // ── Load node content from template with crossfade ─────────────────────
  function loadNode(nodeId, updateUrl) {
    if (isTransitioning) return;
    if (nodeId === currentNodeId) return;

    var template = document.getElementById('tmpl-' + nodeId);
    if (!template) {
      console.warn('Template not found for node', nodeId);
      return;
    }

    var newTabId = getNodeTabId(nodeId);
    if (!newTabId) return;

    // Tab muss aktiv sein (sonst wechsle zuerst den Tab)
    var activeTabSection = document.querySelector('.sidebar-section.active');
    if (activeTabSection && activeTabSection.dataset.tab !== newTabId) {
      // Tab wechseln, dann diesen Node laden
      switchTab(newTabId, function() {
        loadNode(nodeId, updateUrl);
      });
      return;
    }

    isTransitioning = true;

    // Crossfade: ausblenden
    dynamicContent.classList.add('fade-out');

    setTimeout(function () {
      // Inhalt austauschen
      var clone = document.importNode(template.content, true);
      dynamicContent.innerHTML = '';
      dynamicContent.appendChild(clone);
      buildToc();

      // Aktive Klasse in Sidebar aktualisieren
      document.querySelectorAll('.nav-row').forEach(function(row) {
        row.classList.remove('active');
      });
      document.querySelectorAll('.nav-row[data-node-id="' + nodeId + '"]').forEach(function(row) {
        row.classList.add('active');
      });

      currentNodeId = nodeId;
      currentTabId = newTabId;

      // URL-Hash aktualisieren (ohne History-Eintrag wenn nicht gewünscht)
      if (updateUrl !== false && window.location.hash !== '#' + nodeId) {
        history.pushState(null, '', '#' + nodeId);
      }

      // Einblenden
      dynamicContent.classList.remove('fade-out');
      setTimeout(function () {
        isTransitioning = false;
      }, 50);
    }, 150);
  }

  // ── Tab switching (erweitert: lädt ersten Node des neuen Tabs) ──────────
  function switchTab(tabId, callback) {
    // Panels existieren nicht mehr, wir steuern nur Sidebar und Buttons
    document.querySelectorAll('.sidebar-section').forEach(function (s) {
      s.classList.toggle('active', s.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });

    // Ersten Node dieses Tabs finden
    var firstNodeInTab = allNodes.find(function(n) { return n.tabId === tabId; });
    if (firstNodeInTab) {
      loadNode(firstNodeInTab.id, true);
    } else {
      dynamicContent.innerHTML = '<div class="main"><p>No content in this tab.</p></div>';
      currentNodeId = null;
      currentTabId = tabId;
      if (callback) callback();
    }
    if (callback) callback();
    try { sessionStorage.setItem('_docActiveTab', tabId); } catch (e) {}
  }

  // ── Nav group toggle (unverändert) ─────────────────────────────────────
  function toggleNavGroup(groupId) {
    var group = document.getElementById(groupId);
    if (!group) return;
    group.classList.toggle('collapsed');
  }

  // ── Event handling ─────────────────────────────────────────────────────
  // Sidebar-Klicks (Delegation)
  document.body.addEventListener('click', function(e) {
    var link = e.target.closest('.nav-row[data-node-id]');
    if (link && link.getAttribute('data-node-id')) {
      e.preventDefault();
      var nodeId = link.getAttribute('data-node-id');
      loadNode(nodeId, true);
    }
  });

  // Chevron-Klicks (statt inline onclick)
  document.body.addEventListener('click', function(e) {
    var btn = e.target.closest('.nav-chevron-btn');
    if (btn && btn.dataset.toggleGroup) {
      e.preventDefault();
      toggleNavGroup(btn.dataset.toggleGroup);
      return;
    }

    var link = e.target.closest('.nav-row[data-node-id]');
    if (link && link.getAttribute('data-node-id')) {
      e.preventDefault();
      loadNode(link.getAttribute('data-node-id'), true);
    }
  });

  // Tab-Klicks
  var tabNav = document.getElementById('tabNav');
  if (tabNav) {
    tabNav.addEventListener('click', function (e) {
      var btn = e.target.closest('.tab-btn');
      if (btn && btn.dataset.tab) {
        switchTab(btn.dataset.tab);
      }
    });
  }

  // Hash-Änderungen (z. B. Browser Zurück/Vorwärts)
  window.addEventListener('hashchange', function() {
    var hash = window.location.hash.slice(1);
    if (hash && allNodes.some(function(n) { return n.id === hash; })) {
      loadNode(hash, false);
    } else if (firstNode) {
      loadNode(firstNode.id, true);
    }
  });

  // ── Initialisierung (wie gehabt) ───────────────────────────────────────
  var savedTab = null;
  try { savedTab = sessionStorage.getItem('_docActiveTab'); } catch (e) {}
  var initialTab = (savedTab && allNodes.some(function(n) { return n.tabId === savedTab; })) ? savedTab : (firstNode ? firstNode.tabId : null);
  
  var hashNodeId = window.location.hash.slice(1);
  var initialNodeId = null;
  if (hashNodeId && allNodes.some(function(n) { return n.id === hashNodeId; })) {
    initialNodeId = hashNodeId;
  } else if (firstNode) {
    initialNodeId = firstNode.id;
  }

  if (initialTab) {
    document.querySelectorAll('.sidebar-section').forEach(function (s) {
      s.classList.toggle('active', s.dataset.tab === initialTab);
    });
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === initialTab);
    });
  }

  if (initialNodeId) {
    loadNode(initialNodeId, false);
  }
})();
`.trim();
}

export function getCachedThemeScriptContent(tabs) {
  const id = createTabId(tabs);
  
  const entry = blobManager.get(DOC_THEME_BLOB_SECTION, id);
  if (entry)
    return entry;

  const js = createScript(tabs);

  const newEntry = blobManager.add(DOC_THEME_BLOB_SECTION, id, { 
    data: js, 
    type: 'application/javascrip',
  });
  return newEntry;
}

export function buildScript(tabs) {
  const entry = getCachedThemeScriptContent(tabs);
  return `<script src="${entry.url}"></script>`;
}


export function ResolveProjectTheme(project) {
  let theme = findDocTheme(project.docThemeId) ?? 
    findDocTheme(project.docThemeId, getPresetDocThemes());
  if (!theme)
    theme = getFallbackTheme()

  return (theme && typeof theme === 'object') ? theme : {}
}

export function getFallbackTheme() {
  console.log('[HtmlBuilder] getFallbackTheme');
  const presets = getPresetDocThemes();
  return (presets.length > 0) ? presets[0] : null;
}

// ─── Document Assembly ───────────────────────────────────────────────────────

export function buildNodePreview(content, theme = null) {
  const resolvedTheme = (theme && typeof theme === 'object') ? 
    theme : 
    (getFallbackTheme() ?? {});

  const styleUrl = getCachedThemeStyleUrl(resolvedTheme);
  const bodyHTML = parseMarkdown(content ?? '', resolvedTheme);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="${styleUrl}">
</head>
<body>
<div class="preview-root main">
${bodyHTML}
</div>
</body>
</html>`;
}

export function buildDocument(project, theme = null) {
  const result = (doc, msg) => ({ doc, msg });
  if (!project) 
    return result(null, 'invalid project');

  const tabs = project.tabs.filter(t => t.nodes.length > 0);
  if (!tabs.length) 
    return result(null, 'project contains no populated tabs');

  const resolvedTheme = theme ?? ResolveProjectTheme(project);

  const headerShow = getThemeValue(resolvedTheme, 'header-show')  ?? 'always';
  const headerStyle = getThemeValue(resolvedTheme, 'header-style') ?? 'solid';
  const tocShow = getThemeValue(resolvedTheme, 'toc-show')     ?? 'always';
  const tocPosition = getThemeValue(resolvedTheme, 'toc-position') ?? 'right';

  const headerHtml = buildHeader(project.name, headerShow, headerStyle);
  const tocHtml = buildToc(tocShow, tocPosition);

  const parts = {
    head:        buildHead({ title: project.name, theme: resolvedTheme }),
    header:      headerHtml,
    sidebar:     buildSidebar(tabs, project, resolvedTheme, headerShow),
    tabNav:      buildTabNav(tabs),
    dynamicArea: buildDynamicContentAndTemplates(tabs, resolvedTheme, tocHtml),
    script:      buildScript(tabs, { headerShow, tocShow }),
  };
  return result(assembleDocument(parts), null);
}

export function assembleDocument(parts) {
  return `<!-- Generated with ${APP_NAME} v${APP_VERSION} -->
  <!DOCTYPE html>
  <html lang="en">
  <head>
  ${parts.head}
  </head>
  <body>
  <div class="document">
    ${parts.header ?? ''}
    <div class="layout">
      ${parts.sidebar}
      <div class="content-col">
        ${parts.tabNav}
        ${parts.dynamicArea}
      </div>
    </div>
  </div> 
  ${parts.script ? parts.script : ''}
  </body>
  </html>`;
}