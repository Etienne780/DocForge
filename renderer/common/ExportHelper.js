import { UI_STATE_SCHEMA_VERSION, PROJECT_SCHEMA_VERSION } from '@core/AppMeta.js';
import { wrapEntity } from '@core/Envelope.js';
import { blobManager } from '@core/BlobManager.js';
import { exportWithSaveDialog } from '@core/Platform.js';
import { exportProjectAsFolder as writeProjectFolder } from '@core/DocumentManager.js';
import { cleanProject } from '@data/ProjectManager.js';
import { findDocTheme, getPresetDocThemes, getDocThemes, cleanDocTheme, ResolveProjectTheme } from '@data/DocThemeManager.js';
import { normalizeFileName } from '@common/Common.js';
import { buildDocument, buildLanguageCssForProject, getCachedThemeStyleContent, getCachedThemeScriptContent } from './HtmlBuilder.js';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Exports the project as a browsable folder structure (same layout used for
 * live folder-kind projects). Prompts for a parent directory; the project
 * itself is written into `<chosen path>/<project name>`.
 *
 * @param {Object} project
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function exportProjectAsFolder(project, folderName = null) {
  if (!project)
    return { success: false, message: 'Invalid project.' };

  const { canceled, filePaths } = await window.electronAPI.openDialog({
    type: 'folder',
    title: 'Choose export location',
    buttonLabel: 'Export here',
  });

  if (canceled || !filePaths?.length)
    return { success: false, message: 'UserAbort' };

  const targetPath = await window.electronAPI.joinPath(filePaths[0], normalizeFileName(folderName ?? project.name));
  const ok = await writeProjectFolder(project, targetPath);

  return {
    success: ok,
    message: ok ? `Project exported to '${targetPath}'.` : 'Failed to export project folder.',
  };
}

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
  return JSON.stringify(wrapEntity('project', PROJECT_SCHEMA_VERSION, cleanProject(project)), null, 2);
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

  const result = await buildDocument(project, theme);
  if (!result.doc)
    return { success: false, message: `Export failed: ${result.msg}` };

  let html = result.doc;
  html = _inlineBlobStylesheets(html, project, theme);
  html = _inlineBlobScripts(html, project);

  const safeName = normalizeFileName(fileName ?? project.name);

  const ok = await exportWithSaveDialog(
    html,
    safeName,
    '.html',
    'text/html',
  );

  return { success: ok, message: ok ? 'HTML exported.' : 'UserAbort' };
}

/**
 * Replaces all blob-based stylesheet <link> tags with inline <style> tags.
 * 
 * @param {string} html     - The input HTML string
 * @param {Object} project  - The current project object
 * @param {Object} theme    - The current theme object
 * @returns {string}        - HTML with embedded CSS
 */
function _inlineBlobStylesheets(html, project, theme) {
  const cssContent = getCachedThemeStyleContent(theme);
  const langCss = buildLanguageCssForProject(project, theme, 'data');
  const combinedCss = (cssContent + '\n' + langCss).trim();

  const linkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["'](blob:[^"']+)["'][^>]*>/gi;

  let cleanedHtml = html.replace(linkRegex, '');

  if (combinedCss) {
    cleanedHtml = cleanedHtml.replace('</head>', `<style>${combinedCss}</style></head>`);
  }

  return cleanedHtml;
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