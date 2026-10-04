import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { FILE_EXTENSION_LANGUAGE_STYLE, LANGUAGE_STYLE_SCHEMA_VERSION } from '@core/AppMeta.js';
import { unwrapEntity } from '@core/Envelope.js';
import { eventBus } from '@core/EventBus.js';
import {
  getPresetLanguages,
  matchHighlightStyleToLang,
  generateSyntaxDefinitionId,
  generateHighlightStyleId,
} from '@data/SyntaxDefinitionManager.js';
import { migrateLanguageStyle } from '@migration/LanguageStyleMigration.js';
import { escapeHTML } from '@common/Common.js';
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
} from './ImportModalHelper.js';

// ─── IDs ──────────────────────────────────────────────────────────
const modalId = 'application-import_language_style-modal';

// select value of the language that is included in the imported file
const FILE_LANGUAGE_VALUE = '__file__';

export function buildImportLanguageStyleModal() {

  // ─── Build Modal ──────────────────────────────────────────────────
  const importModal = buildStandardModal(modalId, {
    title: 'Import Language Style',
    bodyHTML: `
      ${buildImportSelectSectionHTML('Import a language style from')}

      <div class="form-group project-import hidden" data-section="preview">
        <div class="form-tabel">

          <div class="row">
            <span class="text-muted">Name:</span>
            <span class="form-tag form--accent" data-import-name>-</span>
          </div>

          <div class="row">
            <span class="text-muted">Exported for:</span>
            <span class="form-tag form--accent" data-import-source-lang>-</span>
          </div>

          <div class="row">
            <span class="text-muted">Path:</span>
            <span class="form-tag form--accent" data-import-source-path>-</span>
            <span class="text-muted" data-import-no-source-path>No path available</span>
          </div>

          ${buildImportProjectRowHTML()}

          <div class="row">
            <span class="text-muted">Language:</span>
            <select data-import-target-lang></select>
          </div>

        </div>
        <span class="body-label text-warning hidden" data-import-lang-warning></span>
      </div>`,
    footerHTML: `
      <button class="button button--secondary hidden" data-action-cancel-import>Back</button>`,
    primaryLabel: 'Import',
    wide: 'm',

    onPrimary: async () => {
      if (!importModal._state.pendingPackage || !importModal._state.project)
        return;

      await _handleImport(importModal);
    }
  });

  // ─── State ──────────────────────────────────────────────────────
  importModal._state = {
    pendingPackage: null, // { style, refs, language }
    selectedPath: null,
    projectId: null,
    langId: null,         // preselected language
    project: null,        // loaded target project
    langOptions: [],      // [{ value, lang, match }]
    loadCounter: 0,
  };

  importModal.querySelector('[data-action-import-file]')?.addEventListener('click', async () => {
    const result = await pickImportEntityFile(FILE_EXTENSION_LANGUAGE_STYLE, 'language style');
    if (result)
      _showPreview(importModal, result.obj, result.filePath);
  });

  importModal.querySelector(cancelImportSelector)?.addEventListener('click', () => _resetToSelectSection(importModal));

  importModal.querySelector('[data-import-target-project]')?.addEventListener('change', () => _loadProject(importModal));
  importModal.querySelector('[data-import-target-lang]')?.addEventListener('change', () => _updateLangWarning(importModal));

  // ─── Event: show:modal:importLanguageStyle ─────────────────────
  // payload: { projectId?, langId?, data?, filePath? } - with data the file pick is skipped
  eventBus.on('show:modal:importLanguageStyle', (payload = {}) => {
    _resetToSelectSection(importModal);
    importModal._state.projectId = payload.projectId ?? null;
    importModal._state.langId = payload.langId ?? null;

    if (payload.data) {
      const obj = parseImportData(payload.data, 'language style');
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
  const pkg = unwrapEntity(obj, migrateLanguageStyle, LANGUAGE_STYLE_SCHEMA_VERSION);
  if (!pkg?.style) {
    eventBus.emit('toast:show', { message: 'Failed to import language style: invalid file', type: 'error' });
    return;
  }

  if (!renderImportProjectSelect(modal, modal._state.projectId)) {
    eventBus.emit('toast:show', { message: 'Failed to import language style: no project available', type: 'error' });
    return;
  }

  modal._state.pendingPackage = pkg;
  modal._state.selectedPath = filePath;

  const nameEl = modal.querySelector('[data-import-name]');
  if (nameEl)
    nameEl.textContent = pkg.style.name ?? 'untitled style';

  const sourceLangEl = modal.querySelector('[data-import-source-lang]');
  if (sourceLangEl) {
    const langName = pkg.language?.name ?? pkg.refs.langName ?? 'Unknown language';
    sourceLangEl.textContent = `${langName} (${pkg.language ? 'included' : 'built-in'})`;
  }

  setImportSourcePath(modal, filePath);
  showImportSection(modal, 'preview');
  _loadProject(modal);
}

/**
 * Loads the selected target project and re-renders the language select.
 * @param {HTMLElement} modal
 */
async function _loadProject(modal) {
  const loadId = ++modal._state.loadCounter;
  const primaryBtn = modal.querySelector('[data-modal-primary]');
  if (primaryBtn)
    primaryBtn.disabled = true;

  modal._state.project = null;
  _renderLangSelect(modal, []);

  let project = null;
  try {
    project = await loadTargetProject(getSelectedImportProjectId(modal));
  } catch (error) {
    eventBus.emit('toast:show', { message: `Failed to load project: ${error.message ?? error}`, type: 'error' });
  }

  // a newer project selection was made in the meantime
  if (loadId !== modal._state.loadCounter)
    return;

  modal._state.project = project;
  _renderLangSelect(modal, project ? _buildLangOptions(modal._state.pendingPackage, project) : []);

  if (primaryBtn)
    primaryBtn.disabled = !project;
}

/**
 * Every language the style can be added to, each with its match result:
 * the language included in the file, the built-in languages and the
 * project's own languages.
 */
function _buildLangOptions(pkg, project) {
  const { style, refs, language } = pkg;
  const options = [];

  const addOption = (value, lang, label) => {
    options.push({ value, lang, label, match: matchHighlightStyleToLang(style, lang, refs) });
  };

  if (language)
    addOption(FILE_LANGUAGE_VALUE, language, `${language.name} (from file)`);

  getPresetLanguages().forEach(lang => addOption(lang.id, lang, `${lang.name} (built-in)`));
  (project.languages ?? []).forEach(lang => addOption(lang.id, lang, lang.name));

  return options;
}

function _renderLangSelect(modal, options) {
  modal._state.langOptions = options;
  const select = modal.querySelector('[data-import-target-lang]');
  if (!select)
    return;

  select.innerHTML = options.map(o => {
    const { total, missing } = o.match;
    const warn = missing > 0 ? ` ⚠ ${total - missing}/${total} match` : '';
    return `<option value="${escapeHTML(o.value)}">${escapeHTML(o.label + warn)}</option>`;
  }).join('');

  const preselected = _findPreselectedOption(modal, options);
  if (preselected)
    select.value = preselected.value;

  _updateLangWarning(modal);
}

function _findPreselectedOption(modal, options) {
  const { style, refs } = modal._state.pendingPackage ?? {};

  return options.find(o => o.value === modal._state.langId)
    ?? options.find(o => o.value === FILE_LANGUAGE_VALUE)
    ?? options.find(o => o.lang.id === style?.langId)
    ?? options.find(o => refs?.langName != null && o.lang.name === refs.langName)
    ?? options.find(o => o.match.missing === 0)
    ?? options[0];
}

function _getSelectedLangOption(modal) {
  const value = modal.querySelector('[data-import-target-lang]')?.value;
  return modal._state.langOptions.find(o => o.value === value) ?? null;
}

function _updateLangWarning(modal) {
  const warningEl = modal.querySelector('[data-import-lang-warning]');
  if (!warningEl)
    return;

  const option = _getSelectedLangOption(modal);
  const missing = option?.match.missing ?? 0;

  warningEl.classList.toggle('hidden', missing === 0);
  warningEl.textContent = missing > 0
    ? `${missing} of ${option.match.total} style elements don't match '${option.lang.name}'. They are kept and can be adjusted in the style editor after importing.`
    : '';
}

async function _handleImport(modal) {
  const project = modal._state.project;
  const option = _getSelectedLangOption(modal);
  if (!option) {
    eventBus.emit('toast:show', { message: 'Failed to import language style: no language selected', type: 'error' });
    return;
  }

  const { style: pendingStyle, refs } = modal._state.pendingPackage;

  let lang = null;
  if (option.value === FILE_LANGUAGE_VALUE) {
    lang = {
      ...option.lang,
      id: generateSyntaxDefinitionId(),
      builtIn: false,
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
    };
  }

  const { style } = matchHighlightStyleToLang(pendingStyle, lang ?? option.lang, refs);
  style.id = generateHighlightStyleId();

  try {
    const ok = await commitTargetProject(project, p => {
      if (lang) {
        p.languages ??= [];
        p.languages.push(lang);
      }
      p.languagesStyles ??= [];
      p.languagesStyles.push(style);
    }, lang ? 'languages' : 'languagesStyles');

    if (!ok)
      throw new Error(`failed to save project '${project.name}'`);

    eventBus.emit('toast:show', { message: `Imported style '${style.name}' into '${project.name}'`, type: 'success' });
    _resetToSelectSection(modal);
    closeModal(modal);
  } catch (error) {
    eventBus.emit('toast:show', { message: `Failed to import language style: ${error.message ?? error}`, type: 'error' });
  }
}

function _resetToSelectSection(modal) {
  modal._state.pendingPackage = null;
  modal._state.selectedPath = null;
  modal._state.project = null;
  modal._state.langOptions = [];
  modal._state.loadCounter++;
  showImportSection(modal, 'select');
}
