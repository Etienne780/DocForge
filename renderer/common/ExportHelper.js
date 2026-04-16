import { getActiveProject, getActiveDocTheme } from '@data/ProjectManager.js';
import { findDocTheme, getPresetDocThemes, getDocThemes } from '@data/DocThemeManager.js';
import { normalizeFileName } from '@common/Common.js';
import { buildDocument, ResolveProjectTheme, getCachedThemeStyleContent } from './HtmlBuilder.js';


// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates and triggers the download of a standalone HTML export
 * for the entire active project — all tabs in one self-contained file.
 *
 * @param {object}      project
 * @param {string|null} fileName
 * 
 * @returns {{ success: boolean, message: string }}
 */
export function exportProjectAsHTML(project, fileName = null) {
  if (!project)
    return { success: false, message: 'Invalid project.' };

  const theme = ResolveProjectTheme(project);
  if (!theme)
    return { success: false, message: 'No valid Doc-theme was found.' };

  const result = buildDocument(project, theme);
  if (!result.doc)
    return { success: false, message: `Export failed: ${result.msg}` };

  let html = result.doc;
  html = _inlineBlobStylesheets(html, theme);

  const safeName = normalizeFileName(fileName ?? project.name);
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