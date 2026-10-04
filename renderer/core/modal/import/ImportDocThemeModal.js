import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { FILE_EXTENSION_DOCTHEME, THEME_SCHEMA_VERSION } from '@core/AppMeta.js';
import { unwrapEntity } from '@core/Envelope.js';
import { eventBus } from '@core/EventBus.js';
import { generateDocThemeId } from '@data/DocThemeManager.js';
import { migrateTheme } from '@migration/ThemeMigration.js';
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
const modalId = 'application-import_doc_theme-modal';

export function buildImportDocThemeModal() {

  // ─── Build Modal ──────────────────────────────────────────────────
  const importModal = buildStandardModal(modalId, {
    title: 'Import Theme',
    bodyHTML: `
      ${buildImportSelectSectionHTML('Import a theme from')}

      <div class="form-group project-import hidden" data-section="preview">
        <div class="form-tabel">

          <div class="row">
            <span class="text-muted">Name:</span>
            <span class="form-tag form--accent" data-import-name>-</span>
          </div>

          <div class="row">
            <span class="text-muted">Languages:</span>
            <span class="form-tag form--accent" data-import-languages>-</span>
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
      if (!importModal._state.pendingTheme)
        return;

      await _handleImport(importModal);
    }
  });

  // ─── State ──────────────────────────────────────────────────────
  importModal._state = {
    pendingTheme: null,
    pendingLanguages: [], // parseImportLanguageEntity() results
    selectedPath: null,
    projectId: null,
  };

  importModal.querySelector('[data-action-import-file]')?.addEventListener('click', async () => {
    const result = await pickImportEntityFile(FILE_EXTENSION_DOCTHEME, 'theme');
    if (result)
      _showPreview(importModal, result.obj, result.filePath);
  });

  importModal.querySelector(cancelImportSelector)?.addEventListener('click', () => _resetToSelectSection(importModal));

  // ─── Event: show:modal:importDocTheme ──────────────────────────
  // payload: { projectId?, data?, filePath? } - with data the file pick is skipped
  eventBus.on('show:modal:importDocTheme', (payload = {}) => {
    _resetToSelectSection(importModal);
    importModal._state.projectId = payload.projectId ?? null;

    if (payload.data) {
      const obj = parseImportData(payload.data, 'theme');
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
  const theme = unwrapEntity(obj, migrateTheme, THEME_SCHEMA_VERSION);
  if (!theme) {
    eventBus.emit('toast:show', { message: 'Failed to import theme: invalid theme file', type: 'error' });
    return;
  }

  if (!renderImportProjectSelect(modal, modal._state.projectId)) {
    eventBus.emit('toast:show', { message: 'Failed to import theme: no project available', type: 'error' });
    return;
  }

  modal._state.pendingTheme = theme;
  modal._state.pendingLanguages = Array.isArray(obj.languages)
    ? obj.languages.map(parseImportLanguageEntity).filter(Boolean)
    : [];
  modal._state.selectedPath = filePath;

  const languagesEl = modal.querySelector('[data-import-languages]');
  if (languagesEl) {
    const languages = modal._state.pendingLanguages;
    languagesEl.textContent = languages.length ? `${languages.length} included` : '-';
    languagesEl.title = languages.map(l => l.lang.name).join(', ');
  }

  const nameEl = modal.querySelector('[data-import-name]');
  if (nameEl)
    nameEl.textContent = theme.name ?? 'untitled theme';

  setImportSourcePath(modal, filePath);
  showImportSection(modal, 'preview');
}

async function _handleImport(modal) {
  // copy, so a failed import can be retried with the original mapping
  const theme = {
    ...JSON.parse(JSON.stringify(modal._state.pendingTheme)),
    id: generateDocThemeId(),
    builtIn: false,
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
  };

  // included languages get new ids -> the theme's language -> style mapping follows them
  const languages = modal._state.pendingLanguages.map(createImportedLanguage);
  const langStyleIds = theme.settings?.langStyleIds;
  for (const { lang, oldLangId, styleIdMap } of languages) {
    const entry = langStyleIds?.[oldLangId];
    if (!entry)
      continue;
    delete langStyleIds[oldLangId];
    langStyleIds[lang.id] = { ...entry, id: styleIdMap[entry.id] ?? entry.id };
  }

  try {
    const project = await loadTargetProject(getSelectedImportProjectId(modal));
    if (!project)
      throw new Error('project could not be loaded');

    if (languages.length) {
      const langsOk = await commitTargetProject(project, p => {
        p.languages ??= [];
        p.languagesStyles ??= [];
        for (const { lang, styles } of languages) {
          p.languages.push(lang);
          p.languagesStyles.push(...styles);
        }
      }, 'languages');

      if (!langsOk)
        throw new Error(`failed to save project '${project.name}'`);
    }

    const ok = await commitTargetProject(project, p => {
      p.themes ??= [];
      p.themes.push(theme);
    }, 'themes');

    if (!ok)
      throw new Error(`failed to save project '${project.name}'`);

    eventBus.emit('toast:show', { message: `Imported theme '${theme.name}' into '${project.name}'`, type: 'success' });
    _resetToSelectSection(modal);
    closeModal(modal);
  } catch (error) {
    eventBus.emit('toast:show', { message: `Failed to import theme: ${error.message ?? error}`, type: 'error' });
  }
}

function _resetToSelectSection(modal) {
  modal._state.pendingTheme = null;
  modal._state.pendingLanguages = [];
  modal._state.selectedPath = null;
  showImportSection(modal, 'select');
}
