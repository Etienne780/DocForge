import { blobManager } from '@core/BlobManager.js';
import { exportWithSaveDialog } from '@core/Platform.js';
import { getActiveProject, getActiveDocTheme, cleanProject } from '@data/ProjectManager.js';
import { findDocTheme, getPresetDocThemes, getDocThemes, cleanDocTheme } from '@data/DocThemeManager.js';
import { normalizeFileName } from '@common/Common.js';
import { buildDocument, ResolveProjectTheme, getCachedThemeStyleContent, getCachedThemeScriptContent } from './HtmlBuilder.js';

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
export function exportProjectAsJSON(project, includeTheme = true) {
  const clean = cleanProject(project);

  const theme = includeTheme ? ResolveProjectTheme(project) : null;
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
export async function exportProjectAsHTML(project, fileName = null) {
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
  html = _inlineBlobScripts(html, project);

  const safeName = normalizeFileName(fileName ?? project.name);

  await exportWithSaveDialog(
    html,
    safeName,
    '.html',
    'text/html',
  );

  return { success: true, message: 'HTML exported.' };
}

/**
 * Replaces all blob-based stylesheet <link> tags with inline <style> tags.
 * 
 * @param {string} html   - The input HTML string
 * @param {Object} theme  - The current theme object
 * @returns {string}      - HTML with embedded CSS
 */
function _inlineBlobStylesheets(html, theme) {
  const cssContent = getCachedThemeStyleContent(theme);

  const linkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["'](blob:[^"']+)["'][^>]*>/gi;

  return html.replace(linkRegex, () => `<style>${cssContent}</style>`);
}

/**
 * Replaces all blob-based <script src="blob:..."> tags with inline <script> tags.
 * 
 * @param {string} html     - The input HTML string
 * @param {Object} project  - The current project object
 * @returns {string}        - HTML with embedded JavaScript
 */
function _inlineBlobScripts(html, project) {
  const jsEntry = getCachedThemeScriptContent(project.tabs);

  const scriptRegex = /<script\s+[^>]*src=["'](blob:[^"']+)["'][^>]*>\s*<\/script>/gi;

  return html.replace(scriptRegex, () => `<script>${jsEntry.data}</script>`);
}