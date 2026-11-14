import { getThemeValue } from '@data/DocThemeManager.js';
import { resolveExportTree, MAX_SECTION_HEADING_LEVEL } from '@data/NodeTypes.js';
import { parseMarkdownAsync } from '@core/markdownParser/MarkdownParser.js';
import { escapeHTML } from '@common/Common.js';
import { getCachedThemeStyleUrl, buildLanguageCssForProject } from './StyleCache.js';

// ─── <head> Builder ───────────────────────────────────────────────────────────

export function buildHead({ project, theme }) {
  const styleUrl = getCachedThemeStyleUrl(theme);
  const languageCss = buildLanguageCssForProject(project, theme, 'url');
  return `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHTML(project.name)}</title>
  <link rel="stylesheet" href="${styleUrl}">
  ${languageCss}`.trim();
}

// ─── Search Bar Builder ───────────────────────────────────────────────────────

/**
 * Builds the search bar HTML fragment.
 * Rendered only when search-enabled is true.
 * The optional "Search in tab" checkbox is shown only when
 * search-show-in-tab is true.
 *
 * @param   {object} theme  Resolved doc theme object.
 * @returns {string}        HTML string, or '' when search is disabled.
 */
export function buildSearchBar(theme) {
  const enabled = getThemeValue(theme, 'search-enabled') ?? true;
  if (!enabled)
    return '';

  const showToggle = getThemeValue(theme, 'search-show-in-tab') ?? false;

  const toggleHtml = showToggle
    ? `<div class="search-results-footer">
        <label class="doc-search-toggle">
          <input type="checkbox" id="searchIncludeTabs">
          Search in tab
        </label>
      </div>`
    : '';

  return `<div class="doc-search" id="docSearch">
    <input class="doc-search-input" id="searchInput" type="text" placeholder="Search…" autocomplete="off" spellcheck="false">
    <div class="search-results" id="searchResults">
      <div class="search-results-list" id="searchResultsList"></div>
      ${toggleHtml}
    </div>
  </div>`;
}

function getSidebarExpandButton() {
  return `<button class="nav-toggle-btn" id="navToggleBtn" aria-label="Toggle sidebar" aria-expanded="true">☰</button>`;
}

export function buildHeader(projectName, headerShow, searchBarHtml = '') {
  if (headerShow !== 'top') 
    return '';

  return `
  <header class="doc-header header-style-solid" id="docHeader">
    ${getSidebarExpandButton()}
    <span class="header-title">${escapeHTML(projectName)}</span>
    ${searchBarHtml}
  </header>`;
}

export function buildToc(resolvedTheme, tocShow) {
  if (tocShow === 'never') 
    return '';

  const tocPosition = getThemeValue(resolvedTheme, 'toc-position') ?? 'right';
  const tocWidthType = getThemeValue(resolvedTheme, 'toc-width-type') ?? 'fit-content';

  const desktopClass = tocShow === 'desktop' ? ' toc-desktop' : '';
  const posClass = tocPosition === 'left' ? ' toc-left' : '';
  const widthClassMap = {
    pixels: 'toc-width-px',
    percent: 'toc-width-per',
  };

  const widthClass = widthClassMap[tocWidthType] || '';

  return `
  <aside class="toc${posClass}${desktopClass} ${widthClass}" id="tocSidebar">
    <div class="toc-title">Table of content:</div>
    <nav id="tocLinks"></nav>
  </aside>`;
}

// ─── Sidebar Builder (unchanged but nav-row gets data-node-id) ────────────────

export function buildSidebar(tabs, project, theme, headerShow) {
  const showNav = getThemeValue(theme, 'content-show-nav') ?? 'always';
  const hiddenClass = showNav === 'never' ? ' nav-hidden' : '';
  const widthType = getThemeValue(theme, 'sidebar-width-type') ?? 'fit-content';

  const widthClassMap = {
    pixels: 'nav-width-px',
    percent: 'nav-width-per',
  };
  
  const widthClass = widthClassMap[widthType] || '';

  const sections = tabs.map((tab, i) =>
  `<div class="sidebar-section${i === 0 ? ' active' : ''}" data-tab="${tab.id}">
    ${buildNavTree(resolveExportTree(tab.nodes).nav, tab.id)}
  </div>`
  ).join('\n');

  const sidebarHeader = headerShow === 'sidebar';
  const sidebarVisConstrains = !sidebarHeader ? 'nav-visibility-constrains' : '';

  return `
  <div class="nav${hiddenClass} nav-container">
    <div class="sidebar-header ${sidebarVisConstrains}">
      <div class="nav-brand">${escapeHTML(project.name)}</div>
      <button class="nav-toggle-btn nav-close-btn" id="navCloseBtn" aria-label="Close sidebar">✕</button>
    </div>
    <nav class="nav-width-general ${widthClass}" id="docSidebar">
      ${sections}
    </nav>
  </div>`.trim();
}

/**
 * @param {Array} navItems - `nav` of resolveExportTree()
 */
function buildNavTree(navItems, tabId, depth = 0) {
  const indentClass = `indent-${depth}`;

  return navItems.map(item => {
    const node = item.node;
    const nodeNameEsc = escapeHTML(node.name);
    const hoverHtml = `title="${nodeNameEsc}"`;

    if (item.kind === 'folder') {
      if (item.children.length === 0)
        return `<div class="nav-row nav-row--folder nav-row--empty ${indentClass}" ${hoverHtml}>${nodeNameEsc}</div>`;

      return `
      <div class="nav-group" id="navg-${node.id}">
        <div class="nav-row nav-row--parent nav-row--folder ${indentClass}" ${hoverHtml} data-toggle-group="navg-${node.id}">
          <span class="nav-folder-label">${nodeNameEsc}</span>
          <button class="nav-chevron-btn" data-toggle-group="navg-${node.id}" aria-label="toggle section">▾</button>
        </div>
        <div class="nav-children">
          ${buildNavTree(item.children, tabId, depth + 1)}
        </div>
      </div>`;
    }

    if (item.children.length > 0) {
      return `
      <div class="nav-group" id="navg-${node.id}">
        <div class="nav-row nav-row--parent ${indentClass}" ${hoverHtml} data-node-id="${node.id}" data-tab-id="${tabId}">
          <a class="nav-link" href="#${node.id}">${nodeNameEsc}</a>
          <button class="nav-chevron-btn" data-toggle-group="navg-${node.id}" aria-label="toggle section">▾</button>
        </div>
        <div class="nav-children">
          ${buildNavTree(item.children, tabId, depth + 1)}
        </div>
      </div>`;
    }

    return `<a class="nav-row ${indentClass}" ${hoverHtml} data-node-id="${node.id}" data-tab-id="${tabId}" href="#${node.id}">${nodeNameEsc}</a>`;
  }).join('\n');
}

// ─── Tab Navigation Bar ───────────────────────────────────────────────────────

/**
 * @param {Array}  tabs           All populated tabs.
 * @param {string} searchBarHtml  Optional search bar fragment to append.
 */
export function buildTabNav(tabs, hasHeader, searchBarHtml = '') {
  // Hide the entire bar only when there is a single tab AND no search bar.
  const hiddenClass = (tabs.length <= 1 && !searchBarHtml) ? ' hidden' : '';

  // Render tab buttons only when there are multiple tabs to switch between.
  const buttons = tabs.length > 1
    ? tabs.map((tab, i) =>
        `<button class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${tab.id}">
          ${escapeHTML(tab.name)}
        </button>`
      ).join('\n')
    : '';

  return `
  <div class="tab-nav${hiddenClass}" id="tabNav">
    ${!hasHeader ? getSidebarExpandButton() : ''}
    <div id="tabNavContainer" class="tab-nav-container">
      ${buttons}
    </div>
    ${searchBarHtml}
  </div>`;
}

// ─── Dynamic Content & Templates ─────────────────────────────────────────────

/**
 * Builds the container for dynamic content (where the selected page will appear)
 * and the hidden templates container that holds every page's rendered HTML.
 * Pages come from resolveExportTree(), so folders get no template and merged
 * nodes get one template with their children as sections.
 */
export async function buildDynamicContentAndTemplates(tabs, theme, project, codeBlockCache, tocHtml = '', signal = null) {
  const yieldToUI = createBuildYielder(signal);
  const templates = [];
  for (const tab of tabs) {
    for (const page of resolveExportTree(tab.nodes).pages) {
      await yieldToUI();
      templates.push(await buildPageTemplate(page, tab.id, theme, project, codeBlockCache));
    }
  }

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

/**
 * Returns a function to await between build steps: it lets the UI render a
 * frame now and then (so a large build doesn't freeze it) and throws an
 * AbortError once `signal` is aborted.
 * @param {AbortSignal|null} signal
 * @returns {function(): Promise<void>}
 */
function createBuildYielder(signal) {
  const FRAME_BUDGET_MS = 16;
  let lastYield = performance.now();
  return async () => {
    signal?.throwIfAborted();
    if (performance.now() - lastYield < FRAME_BUDGET_MS)
      return;
    await new Promise(resolve => setTimeout(resolve, 0));
    lastYield = performance.now();
    signal?.throwIfAborted();
  };
}

async function buildPageTemplate(page, tabId, theme, project, codeBlockCache) {
  const sectionsHtml = [];
  for (const section of page.sections)
    sectionsHtml.push(await buildSectionHtml(section, theme, project, codeBlockCache));

  return `<template id="tmpl-${page.node.id}">
  <div class="main" data-node-id="${page.node.id}" data-tab-id="${tabId}">
    ${sectionsHtml.join('\n')}
  </div>
</template>`;
}

/**
 * Renders one node of a page. `section.depth` is 0 for the page node itself
 * and > 0 for merged children, whose headings are shifted down by their depth.
 */
async function buildSectionHtml(section, theme, project, codeBlockCache) {
  const { node, depth, showContent } = section;
  const rawContent = showContent ? (node.content || '').trim() : '';
  const hasHeading = /^#{1,6}\s/.test(rawContent);
  const level = Math.min(1 + depth, MAX_SECTION_HEADING_LEVEL);
  const heading = hasHeading ? '' : `<h${level}>${escapeHTML(node.name)}</h${level}>\n`;
  const options = {
    codeBlockCache: codeBlockCache,
    nodeId: node.id,
  }
  const body = rawContent
    ? await parseMarkdownAsync(shiftMarkdownHeadings(rawContent, depth), theme, project, options)
    : '';
  return `<section id="${node.id}" class="export-section">
    ${heading}
    <div class="export-section__body">${body}</div>
  </section>`;
}

/**
 * Shifts ATX headings (# ...) outside of code fences down by `by` levels.
 * h1-h3 are capped at MAX_SECTION_HEADING_LEVEL, deeper headings stay as they are.
 */
export function shiftMarkdownHeadings(markdown, by) {
  if (!by)
    return markdown;

  let fence = null;
  return markdown.split('\n').map(line => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence)
        fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length)
        fence = null;
      return line;
    }
    if (fence)
      return line;

    return line.replace(/^(#{1,6})(?=\s)/, (hashes) => {
      if (hashes.length >= MAX_SECTION_HEADING_LEVEL)
        return hashes;
      return '#'.repeat(Math.min(hashes.length + by, MAX_SECTION_HEADING_LEVEL));
    });
  }).join('\n');
}
