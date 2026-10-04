import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { FILE_EXTENSION_SYNTAXDEFINITION } from '@core/AppMeta.js';
import { eventBus } from '@core/EventBus.js';
import { loadTargetProject, commitTargetProject } from '@common/ProjectPersistence.js';
import {
  cancelImportSelector,
  buildImportSelectSectionHTML,
  buildImportProjectRowHTML,
  pickImportEntityFile,
  parseImportData,
  renderImportProjectSelect,
  getSelectedImportProjectId,
  setImportSourcePath,
  showImportSection,
  parseImportLanguageEntity,
  createImportedLanguage,
} from './ImportModalHelper.js';

// ─── IDs ──────────────────────────────────────────────────────────
const modalId = 'application-import_language-modal';

export function buildImportLanguageModal() {

  // ─── Build Modal ──────────────────────────────────────────────────
  const importModal = buildStandardModal(modalId, {
    title: 'Import Language',
    bodyHTML: `
      ${buildImportSelectSectionHTML('Import a language from')}

      <div class="form-group project-import hidden" data-section="preview">
        <div class="form-tabel">

          <div class="row">
            <span class="text-muted">Name:</span>
            <span class="form-tag form--accent" data-import-name>-</span>
          </div>

          <div class="row">
            <span class="text-muted">Aliases:</span>
            <span class="form-tag form--accent" data-import-aliases>-</span>
          </div>

          <div class="row">
            <span class="text-muted">Styles:</span>
            <span class="form-tag form--accent" data-import-styles>-</span>
          </div>

          <div class="row">
            <span class="text-muted">Path:</span>
            <span class="form-tag form--accent" data-import-source-path>-</span>
            <span class="text-muted" data-import-no-source-path>No path available</span>
          </div>

          ${buildImportProjectRowHTML()}

        </div>
      </div>`,
    footerHTML: `
      <button class="button button--secondary hidden" data-action-cancel-import>Back</button>`,
    primaryLabel: 'Import',
    wide: 'm',

    onPrimary: async () => {
      if (!importModal._state.pendingLanguage)
        return;

      await _handleImport(importModal);
    }
  });

  // ─── State ──────────────────────────────────────────────────────
  importModal._state = {
    pendingLanguage: null,
    pendingStyles: [], // [{ style, refs }]
    selectedPath: null,
    projectId: null,
  };

  importModal.querySelector('[data-action-import-file]')?.addEventListener('click', async () => {
    const result = await pickImportEntityFile(FILE_EXTENSION_SYNTAXDEFINITION, 'language');
    if (result)
      _showPreview(importModal, result.obj, result.filePath);
  });

  importModal.querySelector(cancelImportSelector)?.addEventListener('click', () => _resetToSelectSection(importModal));

  // ─── Event: show:modal:importLanguage ──────────────────────────
  // payload: { projectId?, data?, filePath? } - with data the file pick is skipped
  eventBus.on('show:modal:importLanguage', (payload = {}) => {
    _resetToSelectSection(importModal);
    importModal._state.projectId = payload.projectId ?? null;

    if (payload.data) {
      const obj = parseImportData(payload.data, 'language');
      if (!obj)
        return;
      _showPreview(importModal, obj, payload.filePath ?? null);
    }

    openModal(importModal);
  });

  return importModal;
}

// ─── Helper Functions ─────────────────────────────────────────────

function _showPreview(modal, obj, filePath) {
  const parsed = parseImportLanguageEntity(obj);
  if (!parsed) {
    eventBus.emit('toast:show', { message: 'Failed to import language: invalid language file', type: 'error' });
    return;
  }

  if (!renderImportProjectSelect(modal, modal._state.projectId)) {
    eventBus.emit('toast:show', { message: 'Failed to import language: no project available', type: 'error' });
    return;
  }

  const lang = parsed.lang;
  modal._state.pendingLanguage = lang;
  modal._state.pendingStyles = parsed.styles;
  modal._state.selectedPath = filePath;

  const nameEl = modal.querySelector('[data-import-name]');
  if (nameEl)
    nameEl.textContent = lang.name ?? 'untitled language';

  const aliasesEl = modal.querySelector('[data-import-aliases]');
  if (aliasesEl)
    aliasesEl.textContent = lang.aliases?.length ? lang.aliases.join(', ') : '-';

  const stylesEl = modal.querySelector('[data-import-styles]');
  if (stylesEl) {
    const styles = modal._state.pendingStyles;
    stylesEl.textContent = styles.length ? `${styles.length} included` : '-';
    stylesEl.title = styles.map(s => s.style.name).join(', ');
  }

  setImportSourcePath(modal, filePath);
  showImportSection(modal, 'preview');
}

async function _handleImport(modal) {
  const { lang, styles } = createImportedLanguage({
    lang: modal._state.pendingLanguage,
    styles: modal._state.pendingStyles,
  });

  try {
    const project = await loadTargetProject(getSelectedImportProjectId(modal));
    if (!project)
      throw new Error('project could not be loaded');

    const ok = await commitTargetProject(project, p => {
      p.languages ??= [];
      p.languages.push(lang);
      if (styles.length) {
        p.languagesStyles ??= [];
        p.languagesStyles.push(...styles);
      }
    }, 'languages');

    if (!ok)
      throw new Error(`failed to save project '${project.name}'`);

    eventBus.emit('toast:show', { message: `Imported language '${lang.name}' into '${project.name}'`, type: 'success' });
    _resetToSelectSection(modal);
    closeModal(modal);
  } catch (error) {
    eventBus.emit('toast:show', { message: `Failed to import language: ${error.message ?? error}`, type: 'error' });
  }
}

function _resetToSelectSection(modal) {
  modal._state.pendingLanguage = null;
  modal._state.pendingStyles = [];
  modal._state.selectedPath = null;
  showImportSection(modal, 'select');
}
