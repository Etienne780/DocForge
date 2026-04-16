import { getActiveProject, getActiveDocTheme } from '@data/ProjectManager.js';
import { findDocTheme, getDocThemes } from '@data/DocThemeManager.js';
import { buildDocument, getCachedThemeStyleContent } from './HtmlBuilder.js';


// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates and triggers the download of a standalone HTML export
 * for the entire active project — all tabs in one self-contained file.
 *
 * @returns {{ success: boolean, message: string }}
 */
export function exportProjectAsHTML(project) {
  if (!project)
    return { success: false, message: 'Invalid project.' };

  let theme = findDocTheme(project.docThemeId);
  theme = getDocThemes()[0];
  if (!theme)
    return { success: false, message: 'No valid Doc-theme was found.' };

  let html = buildDocument(project, theme);
  if (!html)
    return { success: false, message: 'Failed to generate document.' };

  html = _inlineBlobStylesheets(html, theme);

  const safeName = project.name.replace(/[^a-z0-9]/gi, '_');
  const blob = new Blob([html], { type: 'text/html' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `${safeName}.html`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);

  return { success: true, message: 'HTML exported.' };
}

/**
 * Ersetzt alle Blob‑Stylesheet‑Links im HTML durch Inline‑<style>‑Tags.
 * @param {string} html     - Der HTML‑String
 * @param {Object} theme    - Das aktuell verwendete Theme
 * @returns {string}        - HTML mit eingebettetem CSS
 */
function _inlineBlobStylesheets(html, theme) {
  const cssContent = getCachedThemeStyleContent(theme);

  const linkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["'](blob:[^"']+)["'][^>]*>/gi;

  return html.replace(linkRegex, () => `<style>${cssContent}</style>`);
}