import { blobManager } from '@core/BlobManager.js';
import { getActiveProject, getActiveDocTheme, cleanProject } from '@data/ProjectManager.js';
import { findDocTheme, getPresetDocThemes, getDocThemes, cleanDocTheme } from '@data/DocThemeManager.js';
import { normalizeFileName } from '@common/Common.js';
import { buildDocument, ResolveProjectTheme, getCachedThemeStyleContent } from './HtmlBuilder.js';


// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts a project into a JSON export string.
 *
 * This function:
 * - cleans the project
 * - optionally includes linked docTheme
 * - serializes everything into formatted JSON
 *
 * @param {Object} project - The project to export
 * @returns {string} JSON export string
 */
export function exportProjectAsJSON(project) {
  const clean = cleanProject(project);

  const theme = project.docThemeId
    ? findDocTheme(project.docThemeId)
    : null;

  const cleanTheme = theme ? cleanDocTheme(theme) : null;

  return JSON.stringify(
    {
      project: clean,
      theme: cleanTheme
    },
    null,
    2
  );
}

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
  blobManager.downloadOnce(html, 'text/html', safeName, '.html');

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