import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import {
  PROJECT_SCHEMA_VERSION,
  RECENT_PROJECT_SOURCE_TYPE_FILE,
  RECENT_PROJECT_SOURCE_TYPE_FOLDER,
} from '@core/AppMeta.js';
import { unwrapEntity } from '@core/Envelope.js';
import { eventBus } from '@core/EventBus.js';
import { pickImportFile, pickImportFolder, isPlatformWeb } from '@core/Platform.js';
import { readFolderProjectData } from '@core/DocumentManager.js';
import { openRecentProject } from '@data/ProjectManager.js';
import { migrateProject } from '@migration/ProjectMigration.js';
import { setHTML, escapeHTML } from '@common/Common.js';
import { t } from '@core/i18n/I18n.js';
const tx = (key, vars) => escapeHTML(t(`importModals.${key}`, vars));
const ENTITY = () => t('importModals.entities.project');
import { importProject } from '@common/ImportHelper.js';
import { saveProject } from '@common/ProjectPersistence.js';

// ─── IDs ──────────────────────────────────────────────────────────
const modalId = 'application-import_project-modal';

const importTitleId = `${modalId}-title`;
const importFileButtonSelector = '[data-action-import-file]';
const importFolderButtonSelector = '[data-action-import-folder]';
const cancelImportSelector = '[data-action-cancel-import]';
const FILE_EXTENSION_PROJECT_LOCAL = '.dfproj'; // extension only used for filtering the file picker

export function buildImportProjectModal() {

  // ─── Build Modal ──────────────────────────────────────────────────
  const importProjectModal = buildStandardModal(modalId, {
    title: t('importModals.projectModal.title'),
    bodyHTML: `
      <!-- Section 1: pick a source (file or folder) -->
      <div class="form-group" data-section="select">
        <div class="project-import-center-label">
          <span class="form-label no-select">${tx('projectModal.from')}</span>
        </div>
        <div class="form-top-row flex-end">
          <button class="button button--dashed project-import-button" data-action-import-file>
            <span>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
              </svg>
              ${tx('selectFile')}
            </span>
          </button>
          <button class="button button--dashed project-import-button desktop-only" data-action-import-folder>
            <span>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
              </svg>
              ${tx('selectFolder')}
            </span>
          </button>
        </div>
      </div>

      <!-- Section 2: preview of the picked project's data -->
      <div class="form-group project-import hidden" data-section="preview">
        <div class="form-tabel">

          <div class="row">
            <span class="text-muted">${tx('name')}</span>
            <span class="form-tag form--accent" data-import-project-name>-</span>
          </div>

          <div class="row">
            <span class="text-muted">${tx('path')}</span>
            <span class="form-tag form--accent" data-import-source-path>-</span>
            <span class="text-muted" data-import-no-source-path>${tx('projectModal.pathInvalid')}</span>
          </div>

          <div class="row">
            <span class="text-muted">${tx('projectModal.kind')}</span>
            <span class="form-tag form--accent" data-import-source-kind>-</span>
            <span class="text-muted" data-import-no-source-kind>${tx('projectModal.invalidKind')}</span>
          </div>

          <div class="row">
            <span class="text-muted">${tx('projectModal.theme')}</span>
            <span class="form-tag form--accent" data-import-theme-name>-</span>
            <span class="text-muted" data-import-no-theme>${tx('projectModal.noTheme')}</span>
          </div>

        </div>
      </div>`,
    footerHTML: `
      <button class="button button--secondary hidden" data-action-cancel-import>${tx('back')}</button>`,
    primaryLabel: t('importModals.import'),

    onPrimary: async () => {
      if (!importProjectModal._state.pendingImportObj)
        return; // nothing picked yet, primary is hidden in this state anyway

      await _handleImport(importProjectModal);
    }
  });

  // ─── State ──────────────────────────────────────────────────────
  importProjectModal._state = {
    pendingImportObj: null,
    selectedPath: null,
    saveType: RECENT_PROJECT_SOURCE_TYPE_FILE,
  };

  // ─── Import: File ───────────────────────────────────────────────
  const importFileBtn = importProjectModal.querySelector(importFileButtonSelector);
  if (importFileBtn) {
    importFileBtn.addEventListener('click', () => _handleImportFilePick(importProjectModal));
  }

  // ─── Import: Folder (desktop only) ───────────────────────────────
  const importFolderBtn = importProjectModal.querySelector(importFolderButtonSelector);
  if (importFolderBtn) {
    importFolderBtn.addEventListener('click', () => _handleImportFolderPick(importProjectModal));
  }

  // ─── Back Button: return to the select section ─────────────────
  const cancelImportBtn = importProjectModal.querySelector(cancelImportSelector);
  if (cancelImportBtn) {
    cancelImportBtn.addEventListener('click', () => _resetToSelectSection(importProjectModal));
  }

  // ─── Event: show:modal:importProject ──────────────────────────
  // payload: { data?, filePath? } - with data the file pick is skipped
  eventBus.on('show:modal:importProject', (payload = {}) => {
    _resetToSelectSection(importProjectModal);

    if (payload.data && !_showProjectFromData(importProjectModal, payload.data, payload.filePath ?? null))
      return;

    openModal(importProjectModal);
  });

  // Folder import is desktop-only
  if (importFolderBtn && isPlatformWeb()) {
    importFolderBtn.style.display = 'none';
  }

  return importProjectModal;
}

// ─── Helper Functions ─────────────────────────────────────────────

/**
 * Picks a `.dfproj` file, parses it, and - if valid - shows the import
 * preview. The parsed object is already `{ project: {...} }`-shaped, exactly
 * what importProject() expects, so it's stored as-is.
 * @param {HTMLElement} modal - The modal DOM element
 */
async function _handleImportFilePick(modal) {
  try {
    const result = await pickImportFile([FILE_EXTENSION_PROJECT_LOCAL.replace('.', '')]);

    if (result.canceled)
      return;

    const ext = result.extension?.startsWith('.')
      ? result.extension.toLowerCase()
      : `.${result.extension}`.toLowerCase();

    if (ext !== FILE_EXTENSION_PROJECT_LOCAL.toLowerCase()) {
      eventBus.emit('toast:show', {
        message: t('importModals.invalidExtension', { entity: ENTITY(), extension: result.extension }),
        type: 'error'
      });
      return;
    }

    _showProjectFromData(modal, result.data, result.filePath);

  } catch (error) {
    eventBus.emit('toast:show', { message: t('importModals.failed', { entity: ENTITY(), error }), type: 'error' });
  }
}

/**
 * Parses the content of a `.dfproj` file and - if valid - shows the import preview.
 * @param {HTMLElement} modal - The modal DOM element
 * @param {string} data - The file content
 * @param {string|null} filePath - The file path (null on web)
 * @returns {boolean} false if the data was invalid
 */
function _showProjectFromData(modal, data, filePath) {
  let obj;
  try {
    obj = JSON.parse(data);
  } catch {
    eventBus.emit('toast:show', {
      message: t('importModals.invalidJson', { entity: ENTITY() }),
      type: 'error'
    });
    return false;
  }

  const projectData = unwrapEntity(obj, migrateProject, PROJECT_SCHEMA_VERSION);
  modal._state.pendingImportObj = { project: projectData };
  if (filePath)
    modal._state.selectedPath = filePath;
  modal._state.saveType = RECENT_PROJECT_SOURCE_TYPE_FILE;

  _showProjectImportPreview(modal, modal._state.pendingImportObj);
  return true;
}

/**
 * Picks a project folder, reads + reconciles it via
 * `readFolderProjectData()` (same logic `openDocument('folder')` uses
 * internally, just without opening the project live), wraps the result in
 * the same `{ project: {...} }` shape a file import produces, and shows the
 * import preview.
 * @param {HTMLElement} modal - The modal DOM element
 */
async function _handleImportFolderPick(modal) {
  try {
    const result = await pickImportFolder();

    if (result.canceled)
      return;

    const projectData = await readFolderProjectData(result.filePath);
    const obj = { project: projectData };

    modal._state.pendingImportObj = obj;
    if (result.filePath)
      modal._state.selectedPath = result.filePath;
    modal._state.saveType = RECENT_PROJECT_SOURCE_TYPE_FOLDER;

    _showProjectImportPreview(modal, obj);

  } catch (error) {
    eventBus.emit('toast:show', { message: t('importModals.failed', { entity: ENTITY(), error: error.message ?? error }), type: 'error' });
  }
}

/**
 * Handles the import flow once the user confirms via the primary button.
 * @param {HTMLElement} modal - The modal DOM element
 */
async function _handleImport(modal) {
  const objToImport = { data: modal._state.pendingImportObj.project ?? null, storageVersion: PROJECT_SCHEMA_VERSION };

  try {
    const project = importProject(objToImport);

    // Desktop: Select save location
    if (!isPlatformWeb()) {
      const saveKind = modal._state.saveType;
      let savePath = modal._state.selectedPath;
      if (!savePath) {
        savePath = await _pickSaveLocation(project.name, saveKind);
        if (!savePath)
          return; // User cancelled
      }

      if (saveKind === RECENT_PROJECT_SOURCE_TYPE_FILE) {
        if (!savePath.endsWith(FILE_EXTENSION_PROJECT_LOCAL)) {
          savePath = savePath + FILE_EXTENSION_PROJECT_LOCAL;
        }
      }

      project.sourcePath = savePath;
      project.sourceKind = saveKind;
    }

    // Save project
    const projectId = await saveProject(project);

    _resetToSelectSection(modal);
    closeModal(modal);
    openRecentProject(projectId);

  } catch (error) {
    eventBus.emit('toast:show', {
      message: t('importModals.failed', { entity: ENTITY(), error: error.message }),
      type: 'error'
    });
  }
}

/**
 * Opens a save dialog and returns the selected path.
 * @param {string} projectName - The project name
 * @param {string} saveKind - 'file' or 'folder'
 * @returns {Promise<string|null>} Selected path or null if cancelled
 */
async function _pickSaveLocation(projectName, saveKind = RECENT_PROJECT_SOURCE_TYPE_FILE) {
  return new Promise((resolve) => {
    if (!window.electronAPI) {
      eventBus.emit('toast:show', {
        message: t('importModals.projectModal.webMemory'),
        type: 'info'
      });
      resolve('memory');
      return;
    }

    if (saveKind === RECENT_PROJECT_SOURCE_TYPE_FOLDER) {
      window.electronAPI.openDialog({
        type: RECENT_PROJECT_SOURCE_TYPE_FOLDER,
        promptToCreate: true,
        defaultPath: projectName,
      }).then(result => {
        if (result.canceled || !result.filePaths.length) {
          resolve(null);
        } else {
          resolve(result.filePaths[0]);
        }
      }).catch(() => resolve(null));
    } else {
      if (window.electronAPI.saveDialog) {
        window.electronAPI.saveDialog({
          defaultPath: `${projectName}${FILE_EXTENSION_PROJECT_LOCAL}`,
          filters: [{ name: t('importModals.projectModal.fileFilter'), extensions: ['dfproj'] }],
        }).then(result => {
          resolve(result.canceled ? null : result.filePath);
        }).catch(() => resolve(null));
      } else {
        resolve(null);
      }
    }
  });
}

/**
 * Shows the preview section with the picked project's details and switches
 * the visible section from "select" to "preview".
 * @param {HTMLElement} modal - The modal DOM element
 * @param {Object} obj - The imported project object
 */
function _showProjectImportPreview(modal, obj) {
  const projectNameEl = modal.querySelector('[data-import-project-name]');
  if (projectNameEl)
    projectNameEl.textContent = obj?.project?.name ?? t('importModals.projectModal.untitled');

  const setValueRow = (selector, emptySelector, value, html = value) => {
    const valueElement = modal.querySelector(selector);
    const emptyElement = modal.querySelector(emptySelector);
    const hasValue = !!value;

    valueElement?.classList.toggle('hidden', !hasValue);
    emptyElement?.classList.toggle('hidden', hasValue);

    if (valueElement) {
      setHTML(valueElement, hasValue ? html ?? value : '-');
      valueElement.title = hasValue ? value : '-';
    }

    return hasValue;
  };

  const selectedPath = modal._state?.selectedPath;
  setValueRow(
    '[data-import-source-path]',
    '[data-import-no-source-path]',
    selectedPath,
    `<span>${selectedPath ?? '-'}</span>`,
  );

  const kind = modal._state?.saveType;
  setValueRow(
    '[data-import-source-kind]',
    '[data-import-no-source-kind]',
    kind,
    kind ? tx(`projectModal.kinds.${kind}`) : null,
  );

  const themes = obj?.project?.themes;
  const tLenght = themes?.length ?? 0;
  let themeText;

  if (tLenght === 0) {
    themeText = '-';
  } else if (tLenght === 1) {
    themeText = themes[0]?.name ?? t('importModals.projectModal.untitledTheme');
  } else {
    themeText = t('importModals.projectModal.themeCount', { count: tLenght });
  }
  setValueRow(
    '[data-import-theme-name]',
    '[data-import-no-theme]',
    themes ? themeText : null,
  );

  modal.querySelector('[data-section="select"]')?.classList.add('hidden');
  modal.querySelector('[data-section="preview"]')?.classList.remove('hidden');
  modal.querySelector(cancelImportSelector)?.classList.remove('hidden');

  const primaryBtn = modal.querySelector('[data-modal-primary]');
  if (primaryBtn) {
    primaryBtn.classList.remove('hidden');
    primaryBtn.textContent = t('importModals.import');
  }
}

/**
 * Resets the modal back to the "select a source" section, clearing any
 * pending import and hiding the preview / primary / back controls.
 * @param {HTMLElement} modal - The modal DOM element
 */
function _resetToSelectSection(modal) {
  modal._state.pendingImportObj = null;
  modal._state.selectedPath = null;
  modal._state.saveType = RECENT_PROJECT_SOURCE_TYPE_FILE;

  const titleEl = document.getElementById(importTitleId);
  if (titleEl)
    titleEl.textContent = t('importModals.projectModal.title');

  const selectSection = modal.querySelector('[data-section="select"]');
  const previewSection = modal.querySelector('[data-section="preview"]');
  const cancelBtn = modal.querySelector(cancelImportSelector);
  const primaryBtn = modal.querySelector('[data-modal-primary]');

  if (selectSection)
    selectSection.classList.remove('hidden');
  if (previewSection)
    previewSection.classList.add('hidden');
  if (cancelBtn)
    cancelBtn.classList.add('hidden');
  if (primaryBtn)
    primaryBtn.classList.add('hidden'); // no selection yet, nothing to import
}