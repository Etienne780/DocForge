import { getActiveProject, getActiveDocTheme } from '@data/ProjectManager.js';
import {
  buildThemeCSS,
  buildBaseCSS,
  buildHead,
  buildSidebar,
  buildTabNav,
  buildAllTabContent,
  buildScript,
  assembleDocument,
} from './HtmlBuilder.js';


// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates and triggers the download of a standalone HTML export
 * for the entire active project — all tabs in one self-contained file.
 *
 * Tabs without any nodes are silently skipped.
 * If no tab has content the function returns early with success: false.
 * If exactly one tab has content, the tab navigation bar is hidden.
 *
 * The active project's DocTheme (referenced via docThemeId) is resolved
 * by getActiveDocTheme(). Falls back to an empty object when no theme is
 * assigned — getThemeValue() will return null for every key in that case,
 * so CSS custom properties simply won't be set (browser defaults apply).
 *
 * @returns {{ success: boolean, message: string }}
 */
export function exportProjectAsHTML(project) {
  if (!project)
    return { success: false, message: 'Invalid project.' };

  // Only export tabs that actually contain nodes
  const tabs = project.tabs.filter(t => t.nodes.length > 0);
  if (!tabs.length)
    return { success: false, message: 'No entries to export.' };

  let theme = getActiveDocTheme();
  if (!theme || typeof theme !== 'object')
    theme = {};

  // ── Build each document section independently ──────────────────────────────
  const parts = {
    head:    buildHead({
      title:    project.name,
      themeCSS: buildThemeCSS(theme),
      baseCSS:  buildBaseCSS(),
    }),
    sidebar: buildSidebar(tabs, project),
    tabNav:  buildTabNav(tabs),
    main:    buildAllTabContent(tabs, theme),
    script:  buildScript(tabs),
  };

  const html = assembleDocument(parts);
  const safeName = project.name.replace(/[^a-z0-9]/gi, '_');

  const blob = new Blob([html], { type: 'text/html' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `${safeName}.html`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);

  return { success: true, message: 'HTML exported.' };
}