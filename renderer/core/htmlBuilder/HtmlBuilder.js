import { APP_NAME, APP_VERSION } from '@core/AppMeta.js';
import { getThemeValue, ResolveProjectTheme, getFallbackTheme } from '@data/DocThemeManager.js';
import { parseMarkdownAsync, cleanupCodeBlockCache } from '@core/markdownParser/MarkdownParser.js';
import { getCachedThemeStyleUrl, buildLanguageCssForContent } from './StyleCache.js';
import {
  buildHead, buildSearchBar, buildHeader, buildToc, buildSidebar, buildTabNav,
  buildDynamicContentAndTemplates
} from './DocumentLayout.js';
import { getPopulatedTabs, buildScript, buildNodePreviewScript } from './DocumentScript.js';

// Entry point of the builder: assembles the documents and re-exports the parts
// of this folder: ThemeCss (theme -> CSS, ExportBase.css), StyleCache (theme /
// language style blobs), DocumentLayout (HTML parts), DocumentScript (search
// index, runtime scripts in runtime/).
export { getThemeColorVar, buildThemeCSS, buildBaseCSS } from './ThemeCss.js';
export {
  buildLanguageCssForProject, getCachedThemeStyleUrl, getCachedThemeStyleContent,
  getCachedLanguageStyle, revokeThemeCache
} from './StyleCache.js';
export {
  buildHead, buildSearchBar, buildHeader, buildToc, buildSidebar, buildTabNav,
  buildDynamicContentAndTemplates, shiftMarkdownHeadings
} from './DocumentLayout.js';
export {
  createTabId, createScript, getCachedScriptEntry, getPopulatedTabs, revokeScriptCache,
  getCachedThemeScriptContent, buildScript, getCachedPreviewNodeScriptConent, buildNodePreviewScript
} from './DocumentScript.js';

// ─── Document Assembly ───────────────────────────────────────────────────────

export async function buildNodePreview(content, codeBlockCache, theme = null, project = null, nodeId = null) {
  const resolvedTheme = (theme && typeof theme === 'object') ? 
    theme : 
    (getFallbackTheme() ?? {});

  const styleUrl = getCachedThemeStyleUrl(resolvedTheme);
  const options = {
    codeBlockCache: codeBlockCache,
    nodeId: nodeId,
    lineAnchors: true,
  }
  const bodyHTML = await parseMarkdownAsync(content ?? '', resolvedTheme, project, options);
  cleanupCodeBlockCache(codeBlockCache);
  const languageCss = buildLanguageCssForContent(project, content ?? '', resolvedTheme);
  
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    
    <link rel="stylesheet" href="${styleUrl}">
    ${languageCss}
  </head>
  <body class="preview-root">
    <div class="dynamic-content preview-root main">
    ${bodyHTML}
    </div>
  </body>
    ${buildNodePreviewScript()}
  </html>`;
}

/**
 * Builds the full export HTML of a project.
 * @param {Object} project
 * @param {Object|null} [theme]
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal] - cancels the build; it then rejects with an AbortError
 * @returns {Promise<{doc: string|null, msg: string|null}>}
 */
export async function buildDocument(project, theme = null, { signal = null } = {}) {
  const result = (doc, msg) => ({ doc, msg });
  if (!project) 
    return result(null, 'invalid project');

  const tabs = getPopulatedTabs(project);
  if (!tabs.length) 
    return result(null, 'project contains no populated tabs');

  const resolvedTheme = theme ?? ResolveProjectTheme(project);

  const headerShow = getThemeValue(resolvedTheme, 'header-show') ?? 'always';
  const tocShow = getThemeValue(resolvedTheme, 'toc-show')    ?? 'always';

  // ── Search placement ────────────────────────────────────────────────────
  // Honour the user's preferred position, but fall back to tab-nav when the
  // header is not rendered (header-show !== 'top').
  const searchEnabled = getThemeValue(resolvedTheme, 'search-enabled') ?? true;
  const searchPos = getThemeValue(resolvedTheme, 'search-position') ?? 'header';
  const effectiveSearchPos = (searchPos === 'header' && headerShow !== 'top')
    ? 'tab-nav'
    : searchPos;

  const searchBarHtml = searchEnabled ? buildSearchBar(resolvedTheme) : '';
  const headerSearchHtml = (effectiveSearchPos === 'header')  ? searchBarHtml : '';
  const tabNavSearchHtml = (effectiveSearchPos === 'tab-nav') ? searchBarHtml : '';
  // ────────────────────────────────────────────────────────────────────────

  const hasHeader = headerShow === 'top';
  const tocHtml = buildToc(resolvedTheme, tocShow);
  const dynamicArea = await buildDynamicContentAndTemplates(tabs, resolvedTheme, project, project.session.codeBlockCache, tocHtml, signal);
  // Not reached when aborted, so a cancelled build doesn't evict cache entries
  cleanupCodeBlockCache(project.session.codeBlockCache);
  
  const parts = {
    head:        buildHead({ project: project, theme: resolvedTheme }),
    header:      buildHeader(project.name, headerShow, headerSearchHtml),
    tabNav:      buildTabNav(tabs, hasHeader, tabNavSearchHtml),
    sidebar:     buildSidebar(tabs, project, resolvedTheme, headerShow),
    dynamicArea: dynamicArea,
    script:      buildScript(tabs, { fresh: true, project }),
    documentClass: hasHeader ? '' : ' no-header',
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
  <div class="document${parts.documentClass ?? ''}" id="docRoot">
    ${parts.header ?? ''}
    <div class="nav-backdrop" id="navBackdrop"></div>
    <div class="layout">
      <div class="content-col">
        ${parts.tabNav}
        <div class="content-row">
          ${parts.sidebar}
          ${parts.dynamicArea}
        </div>
      </div>
    </div>
  </div> 
  ${parts.script ? parts.script : ''}
  </body>
  </html>`;
}
