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
import { escapeHTML } from '@common/Common.js';
import { t } from '@core/i18n/I18n.js';
const tx = (key, vars) => escapeHTML(t(`importModals.${key}`, vars));
const ENTITY = () => t('importModals.entities.theme');

// ─── IDs ──────────────────────────────────────────────────────────
const modalId = 'application-import_doc_theme-modal';

export function buildImportDocThemeModal() {

  // ─── Build Modal ──────────────────────────────────────────────────
  const importModal = buildStandardModal(modalId, {
    title: t('importModals.themeModal.title'),
    bodyHTML: `
      ${buildImportSelectSectionHTML(t('importModals.themeModal.from'))}

      <div class="form-group project-import hidden" data-section="preview">
        <div class="form-tabel">

          <div class="row">
            <span class="text-muted">${tx('name')}</span>
            <span class="form-tag form--accent" data-import-name>-</span>
          </div>

          <div class="row">
            <span class="text-muted">${tx('themeModal.languages')}</span>
            <span class="form-tag form--accent" data-import-languages>-</span>
          </div>

          <div class="row">
            <span class="text-muted">${tx('path')}</span>
            <span class="form-tag form--accent" data-import-source-path>-</span>
            <span class="text-muted" data-import-no-source-path>${tx('noPath')}</span>
          </div>

          ${buildImportProjectRowHTML()}

        </div>
      </div>`,
    footerHTML: `
      <button class="button button--secondary hidden" data-action-cancel-import>${tx('back')}</button>`,
    primaryLabel: t('importModals.import'),
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
    const result = await pickImportEntityFile(FILE_EXTENSION_DOCTHEME, ENTITY());
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
      const obj = parseImportData(payload.data, ENTITY());
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
    eventBus.emit('toast:show', { message: t('importModals.invalidFile', { entity: ENTITY() }), type: 'error' });
    return;
  }

  if (!renderImportProjectSelect(modal, modal._state.projectId)) {
    eventBus.emit('toast:show', { message: t('importModals.noProjectAvailable', { entity: ENTITY() }), type: 'error' });
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
    languagesEl.textContent = languages.length ? t('importModals.included', { count: languages.length }) : '-';
    languagesEl.title = languages.map(l => l.lang.name).join(', ');
  }

  const nameEl = modal.querySelector('[data-import-name]');
  if (nameEl)
    nameEl.textContent = theme.name ?? t('importModals.themeModal.untitled');

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
      throw new Error(t('importModals.projectNotLoaded'));

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
        throw new Error(t('importModals.projectNotSaved', { name: project.name }));
    }

    const ok = await commitTargetProject(project, p => {
      p.themes ??= [];
      p.themes.push(theme);
    }, 'themes');

    if (!ok)
      throw new Error(t('importModals.projectNotSaved', { name: project.name }));

    eventBus.emit('toast:show', { message: t('importModals.importedInto', { entity: t('importModals.entitiesTitle.theme'), name: theme.name, project: project.name }), type: 'success' });
    _resetToSelectSection(modal);
    closeModal(modal);
  } catch (error) {
    eventBus.emit('toast:show', { message: t('importModals.failed', { entity: ENTITY(), error: error.message ?? error }), type: 'error' });
  }
}

function _resetToSelectSection(modal) {
  modal._state.pendingTheme = null;
  modal._state.pendingLanguages = [];
  modal._state.selectedPath = null;
  showImportSection(modal, 'select');
}
