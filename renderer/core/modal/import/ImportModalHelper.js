import { SYNTAX_DEFINITION_SCHEMA_VERSION, LANGUAGE_STYLE_SCHEMA_VERSION } from '@core/AppMeta.js';
import { unwrapEntity } from '@core/Envelope.js';
import { eventBus } from '@core/EventBus.js';
import { generateSyntaxDefinitionId, generateHighlightStyleId, matchHighlightStyleToLang } from '@data/SyntaxDefinitionManager.js';
import { migrateSyntaxDefinition } from '@migration/SyntaxDefinitionMigration.js';
import { migrateLanguageStyle } from '@migration/LanguageStyleMigration.js';
import { pickImportFile } from '@core/Platform.js';
import { escapeHTML } from '@common/Common.js';
import { getImportTargetProjects } from '@common/ProjectPersistence.js';

// Shared building blocks for the theme/language/style import modals.
// Same section layout as ImportProjectModal: "select" -> "preview".

export const cancelImportSelector = '[data-action-cancel-import]';

/**
 * @param {string} label - e.g. 'Import a theme from'
 * @returns {string}
 */
export function buildImportSelectSectionHTML(label) {
  return `
    <div class="form-group" data-section="select">
      <div class="project-import-center-label">
        <span class="form-label no-select">${escapeHTML(label)}</span>
      </div>
      <div class="form-top-row flex-end">
        <button class="button button--dashed project-import-button" data-action-import-file>
          <span>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
            </svg>
            Select a file
          </span>
        </button>
      </div>
    </div>`;
}

/**
 * @returns {string} table row with the target project select
 */
export function buildImportProjectRowHTML() {
  return `
    <div class="row">
      <span class="text-muted">Project:</span>
      <select data-import-target-project></select>
    </div>`;
}

/**
 * Opens a file picker for `extension` and parses the picked JSON file.
 * @param {string} extension - with leading dot, e.g. '.dftheme'
 * @param {string} entityLabel - used in error toasts, e.g. 'theme'
 * @returns {Promise<{ obj: Object, filePath: string|null }|null>} null on cancel/error
 */
export async function pickImportEntityFile(extension, entityLabel) {
  try {
    const result = await pickImportFile([extension.replace('.', '')]);
    if (result.canceled)
      return null;

    const ext = `.${result.extension ?? ''}`.toLowerCase();
    if (ext !== extension.toLowerCase()) {
      eventBus.emit('toast:show', {
        message: `Failed to import ${entityLabel}: invalid extension '${result.extension}'`,
        type: 'error'
      });
      return null;
    }

    const obj = parseImportData(result.data, entityLabel);
    return obj ? { obj, filePath: result.filePath ?? null } : null;
  } catch (error) {
    eventBus.emit('toast:show', { message: `Failed to import ${entityLabel}: ${error}`, type: 'error' });
    return null;
  }
}

/**
 * @param {string|Object} data - raw file content or already parsed object
 * @param {string} entityLabel
 * @returns {Object|null}
 */
export function parseImportData(data, entityLabel) {
  if (data && typeof data === 'object')
    return data;

  try {
    return JSON.parse(data);
  } catch {
    eventBus.emit('toast:show', {
      message: `Failed to import ${entityLabel}: invalid JSON file`,
      type: 'error'
    });
    return null;
  }
}

/**
 * Fills the target project select. Returns false if there is no project
 * the element could be imported into.
 * @param {HTMLElement} modal
 * @param {string|null} selectedId
 * @returns {boolean}
 */
export function renderImportProjectSelect(modal, selectedId = null) {
  const select = modal.querySelector('[data-import-target-project]');
  const targets = getImportTargetProjects();
  if (!select)
    return false;

  select.innerHTML = targets
    .map(t => `<option value="${escapeHTML(t.id)}">${escapeHTML(t.name)}${t.isOpen ? ' (open)' : ''}</option>`)
    .join('');

  if (selectedId && targets.some(t => t.id === selectedId))
    select.value = selectedId;

  return targets.length > 0;
}

/**
 * @param {HTMLElement} modal
 * @returns {string|null}
 */
export function getSelectedImportProjectId(modal) {
  return modal.querySelector('[data-import-target-project]')?.value || null;
}

/**
 * Shows the source path row value (or its fallback when missing).
 * @param {HTMLElement} modal
 * @param {string|null} filePath
 */
export function setImportSourcePath(modal, filePath) {
  const valueEl = modal.querySelector('[data-import-source-path]');
  const emptyEl = modal.querySelector('[data-import-no-source-path]');

  valueEl?.classList.toggle('hidden', !filePath);
  emptyEl?.classList.toggle('hidden', !!filePath);
  if (valueEl) {
    valueEl.textContent = filePath ?? '-';
    valueEl.title = filePath ?? '-';
  }
}

/**
 * Switches the visible section ('select' | 'preview') and the footer buttons.
 * @param {HTMLElement} modal
 * @param {'select'|'preview'} section
 */
export function showImportSection(modal, section) {
  const isPreview = section === 'preview';

  modal.querySelector('[data-section="select"]')?.classList.toggle('hidden', isPreview);
  modal.querySelector('[data-section="preview"]')?.classList.toggle('hidden', !isPreview);
  modal.querySelector(cancelImportSelector)?.classList.toggle('hidden', !isPreview);
  modal.querySelector('[data-modal-primary]')?.classList.toggle('hidden', !isPreview);
}

// ─── Languages ────────────────────────────────────────────────────

/**
 * Parses a language entity - a .dflang file or a language embedded in a
 * .dftheme (both: wrapEntity('language', ...) + `styles: [{ style, refs }]`).
 * @param {Object} obj
 * @returns {{ lang: Object, styles: Array<{ style: Object, refs: Object }> } | null}
 */
export function parseImportLanguageEntity(obj) {
  const lang = unwrapEntity(obj, migrateSyntaxDefinition, SYNTAX_DEFINITION_SCHEMA_VERSION);
  if (!lang)
    return null;

  const styles = Array.isArray(obj.styles)
    ? obj.styles.map(s => migrateLanguageStyle(s, LANGUAGE_STYLE_SCHEMA_VERSION))
    : [];
  return { lang, styles };
}

/**
 * Gives a parsed language (see parseImportLanguageEntity) and its styles new
 * ids, ready to be added to a project.
 * @returns {{ lang: Object, styles: Object[], oldLangId: string, styleIdMap: Object<string, string> }}
 */
export function createImportedLanguage({ lang, styles }) {
  const imported = {
    ...lang,
    id: generateSyntaxDefinitionId(),
    builtIn: false,
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
  };

  const styleIdMap = {};
  const importedStyles = styles.map(({ style, refs }) => {
    const matched = matchHighlightStyleToLang(style, imported, refs).style;
    matched.id = generateHighlightStyleId();
    styleIdMap[style.id] = matched.id;
    return matched;
  });

  return { lang: imported, styles: importedStyles, oldLangId: lang.id, styleIdMap };
}
