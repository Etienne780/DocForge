import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import {
  FILE_EXTENSION_PROJECT,
  RECENT_PROJECT_SOURCE_TYPE_FILE,
  RECENT_PROJECT_SOURCE_TYPE_FOLDER,
  RECENT_PROJECT_SOURCE_TYPE_IN_APP,
} from '@core/AppMeta.js';
import { pickImportFile, pickImportFolder, isPlatformWeb } from '@core/Platform.js';
import { getNumberOfSegments, normalizePath, combinePath, slicePath } from '@core/Path.js';
import { storageManager } from '@core/storage/StorageManager.js';
import { readFolderProjectData } from '@core/DocumentManager.js';
import { 
  createProject,
  addRecentProject,
  getAllProjectPresets,
  openProjectInEditor,
  openRecentProject 
} from '@data/ProjectManager.js';
import { isNameValid, setHTML } from '@common/Common.js';
import { getValidation, getValidationError } from '@common/Validations.js';  
import { addModalEnterAction } from '@common/BaseModals.js';
import { setCheckBox, setCheckboxDisabled, isCheckedBoxActive } from '@common/UIUtils.js';
import { importProject } from '@common/ImportHelper.js';

// ─── IDs ──────────────────────────────────────────────────────────
const modalId = 'application-create_project-modal';

const projectTitleId = `${modalId}-title`;
const projectInputId = `${modalId}-input`;
const projectErrorId = `${modalId}-error`;
const projectPathId = `${modalId}-path`;
const projectPathErrorId = `${modalId}-path-error`;
const browseButtonId = `${modalId}-browse`;
const saveTypeContainerId = `${modalId}-save-type`;
const saveTypeFileId = `${modalId}-save-file`;
const saveTypeFolderId = `${modalId}-save-folder`;

const importFileButtonSelector = '[data-action-import-file]';
const importFolderButtonSelector = '[data-action-import-folder]';
const cancelImportSelector = '[data-action-cancel-import]';

export function buildCreateProjectModal() {

  // ─── Build Modal ──────────────────────────────────────────────────
  const createProjectModal = buildStandardModal(modalId, {
    title: 'Create Project',
    bodyHTML: `
      <div class="form-group" data-section="create">
        <label class="form-label" for="${projectInputId}">Name</label>
        <input type="text" class="form-input" id="${projectInputId}"
               autocomplete="off" placeholder="Project name...">
        
        <span id="${projectErrorId}" class="body-label text-error" data-error-msg>${getValidationError('PROJECT', 'NAME_MIN_LENGTH')}</span>
        
        <!-- Save location – visible only on desktop -->
        <div class="form-group project-create-location desktop-only" data-section="location">
          <label class="form-label" for="${projectPathId}">Save location</label>
          
          <!-- Save type toggle: File vs Folder -->
          <div class="form-row form-row--space-between">
            <span class="form-label no-select">Save as:</span>
            <div class="button-group-hor" id="${saveTypeContainerId}">
              <button class="button button--small save-type-btn active" id="${saveTypeFileId}" data-save-type="file">File (.dfproj)</button>
              <button class="button button--small save-type-btn" id="${saveTypeFolderId}" data-save-type="folder">Folder</button>
            </div>
          </div>
          
          <div class="form-row">
            <input type="text" class="form-input form-input" id="${projectPathId}"
                   placeholder="Select a folder...">
            <button class="button button--secondary" id="${browseButtonId}">Browse…</button>
          </div>
          <span id="${projectPathErrorId}" class="body-label text-error" data-error-msg>Please select a save location.</span>
        </div>
        
        <div class="project-import-center-label">
          <span class="form-label no-select">or import project</span>
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
          <button class="button button--dashed project-import-button desktop-only" data-action-import-folder>
            <span>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
              </svg>
              Select a folder
            </span>
          </button>
        </div>
      </div>

      <div class="form-group project-import hidden" data-section="import">
        <div class="form-tabel">

         <div class="row">
            <span class="text-muted">Name:</span>
            <span class="form-tag form--accent" data-import-project-name>-</span>
          </div>

          <div class="row">
            <span class="text-muted">Path:</span>
            <span class="form-tag form--accent" data-import-source-path>-</span>
            <span class="text-muted" data-import-no-source-path>Path was invalid</span>
          </div>

          <div class="row">
            <span class="text-muted">Kind:</span>
            <span class="form-tag form--accent" data-import-source-kind>-</span>
            <span class="text-muted" data-import-no-source-kind>Invalid kind</span>
          </div>
          
          <div class="row">
            <span class="text-muted">Theme:</span>
            <span class="form-tag form--accent" data-import-theme-name>-</span>
            <span class="text-muted" data-import-no-theme>No theme included in this file</span>
          </div>

          <div class="row">
            <span class="text-muted">Include theme: </span>
            <button class="checkbox-element" data-checkbox="true" data-import-include-theme></button>
          </div>

        </div>
      </div>`,
    footerHTML: `
      <button class="button button--secondary hidden" data-action-cancel-import>Back</button>`,
    primaryLabel: 'Create',

    onPrimary: async () => {
      /* ── Import mode ─────────────────────────────────── */
      if (createProjectModal._state.pendingImportObj) {
        await _handleImport(createProjectModal);
        return;
      }

      /* ── Create mode ─────────────────────────────────── */
      const value = document.getElementById(projectInputId).value.trim();
      if (!isNameValid(value, 'PROJECT')) {
        eventBus.emit('toast:show', {
          message: `Failed to create project, name has to be at least ${getValidation('PROJECT', 'NAME_MIN_LENGTH')} characters long`,
          type: 'error'
        });
        return;
      }

      // ─── Desktop: Check save location ─────────────────
      let savePath = null;
      let saveKind = RECENT_PROJECT_SOURCE_TYPE_FILE;
      if (!isPlatformWeb()) {
        saveKind = createProjectModal._state.saveType || RECENT_PROJECT_SOURCE_TYPE_FILE;
        const selectedPath = createProjectModal._state.selectedPath;
        const projName = createProjectModal._state.projectName;

        if (!selectedPath) {
          eventBus.emit('toast:show', {
            message: 'Please select a save location.',
            type: 'error'
          });
          return;
        }

        let fileName = projName;
        if (saveKind === RECENT_PROJECT_SOURCE_TYPE_FILE) {
          if (!fileName.endsWith(FILE_EXTENSION_PROJECT)) {
            fileName += FILE_EXTENSION_PROJECT;
          }
        }

        const fullPath = combinePath(selectedPath, fileName);
        savePath = normalizePath(fullPath);
      }

      // ─── Create project ────────────────────────────────
      let project;
      const selectedPreset = createProjectModal._state.selectedPreset;
      if (selectedPreset) {
        project = selectedPreset.factory();
        project.name = value;
      } else {
        project = createProject(value);
      }

      // ─── Set path and kind (desktop only) ─────────────
      if (!isPlatformWeb() && savePath) {
        // If saving as file, append extension if not present
        if (saveKind === RECENT_PROJECT_SOURCE_TYPE_FILE && !savePath.endsWith(FILE_EXTENSION_PROJECT)) {
          savePath = savePath + FILE_EXTENSION_PROJECT;
        }
        project.sourcePath = savePath;
        project.sourceKind = saveKind;
      }

      // ─── Save project ──────────────────────────────────
      try {
        await _saveProject(project);
      } catch (error) {
        eventBus.emit('toast:show', {
          message: `Failed to save project: ${error.message}`,
          type: 'error'
        });
        return;
      }

      // ─── Open project (already added to recents by _saveProject) ─────
      closeModal(createProjectModal);
      openProjectInEditor(project, { addToRecents: false });
    }
  });

  // ─── State ──────────────────────────────────────────────────────
  createProjectModal._state = {
    pendingImportObj: null,
    selectedPreset: null,
    selectedPath: null,
    saveType: RECENT_PROJECT_SOURCE_TYPE_FILE, // 'file' or 'folder'
    projectName: '',
  };

  // ─── Helper: Update input placeholder based on save type ──────
  function _updatePathPlaceholder() {
    const pathInput = document.getElementById(projectPathId);
    if (!pathInput) 
      return;
    
    const saveType = createProjectModal._state.saveType || RECENT_PROJECT_SOURCE_TYPE_FILE;
    if (saveType === RECENT_PROJECT_SOURCE_TYPE_FILE) {
      pathInput.placeholder = 'Select a location and filename...';
    } else {
      pathInput.placeholder = 'Select a folder...';
    }
  }

  function _updatePathTooltip() {
    const pathInput = document.getElementById(projectPathId);
    if (pathInput) {
      pathInput.title = pathInput.value || '';
    }
  }

  function _setSavePathWithProjectName() {
    const pathInput = document.getElementById(projectPathId);
    const projName = createProjectModal._state.projectName;
    const selectedPath = createProjectModal._state.selectedPath;
    const saveType = createProjectModal._state.saveType;

    if (selectedPath && projName && saveType === RECENT_PROJECT_SOURCE_TYPE_FOLDER)
      pathInput.value = normalizePath(combinePath(selectedPath, projName));
    else if (selectedPath && projName && saveType === RECENT_PROJECT_SOURCE_TYPE_FILE)
      pathInput.value = normalizePath(combinePath(selectedPath, projName + FILE_EXTENSION_PROJECT));
    else 
      pathInput.value = '';

    _updatePathTooltip();
  }

  function _setSavePathWithoutProjectName() {
    const pathInput = document.getElementById(projectPathId);
    const selectedPath = createProjectModal._state.selectedPath;
    const saveType = createProjectModal._state.saveType;

    if (selectedPath)
      pathInput.value = normalizePath(selectedPath);
    else 
      pathInput.value = '';

    _updatePathTooltip();
  }

  // ─── Input Validation ──────────────────────────────────────────
  const input = document.getElementById(projectInputId);
  if (input) {
    input.addEventListener('input', () => {
      const value = input.value.trim();
      const pathInput = document.getElementById(projectPathId);
      const errorElement = document.getElementById(projectErrorId);

      const validName = isNameValid(value, 'PROJECT');

      if (!errorElement || !pathInput)
        return;

      if (validName) {
        errorElement.classList.add('invisible');
        createProjectModal._state.projectName = value;
      } else {
        errorElement.classList.remove('invisible');
        createProjectModal._state.projectName = '';
      }

      _setSavePathWithProjectName();
    });
  }

  // ─── Save Type Toggle ──────────────────────────────────────────
  const saveTypeContainer = document.getElementById(saveTypeContainerId);
  if (saveTypeContainer) {
    saveTypeContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.save-type-btn');
      if (!btn) 
        return;

      // Remove active from all
      saveTypeContainer.querySelectorAll('.save-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Store selected type
      const newSaveType = btn.dataset.saveType;
      createProjectModal._state.saveType = newSaveType;
      
      // Update placeholder
      _updatePathPlaceholder();
      
      // Clear the selected path when switching modes
      createProjectModal._state.selectedPath = null;
      const pathInput = document.getElementById(projectPathId);
      if (pathInput) {
        pathInput.value = '';
        _updatePathTooltip();
      }
    });
  }

  // ─── Browse path (Desktop) ──────────────────────────────────
  const pathInput = document.getElementById(projectPathId);
  pathInput.addEventListener('focus', (e) => {
    _setSavePathWithoutProjectName();
  });

  pathInput.addEventListener('focusout', (e) => {
    _setSavePathWithProjectName();
  });

  pathInput.addEventListener('mouseenter', _updatePathTooltip);

  // ─── Browse Button (Desktop) ──────────────────────────────────
  const browseBtn = document.getElementById(browseButtonId);
  if (browseBtn) {
    browseBtn.addEventListener('click', async () => {
      if (!window.electronAPI) {
        eventBus.emit('toast:show', {
          message: 'File selection is only available in the desktop version.',
          type: 'info'
        });
        return;
      }

      const saveType = createProjectModal._state.saveType || RECENT_PROJECT_SOURCE_TYPE_FILE;
      const projectName = document.getElementById(projectInputId)?.value.trim() || 'project';

      try {
        let selectedPath = null;

        if (saveType === RECENT_PROJECT_SOURCE_TYPE_FILE) {
          // ─── File mode: Use save dialog ──────────────────
          if (window.electronAPI.saveDialog) {
            const result = await window.electronAPI.saveDialog({
              defaultPath: `${projectName}${FILE_EXTENSION_PROJECT}`,
              filters: [{ name: 'DocForge Project', extensions: ['dfproj'] }],
            });
            
            if (!result.canceled && result.filePath) {
              selectedPath = result.filePath;
              
              // remove last segement
              const sCount = getNumberOfSegments(selectedPath);
              selectedPath = slicePath(selectedPath, 0, sCount - 1);
            }
          } else {
            eventBus.emit('toast:show', {
              message: 'Save dialog not available.',
              type: 'error'
            });
            return;
          }
        } else {
          // ─── Folder mode: Use folder picker ──────────────
          if (window.electronAPI.openDialog) {
            const result = await window.electronAPI.openDialog({
              type: RECENT_PROJECT_SOURCE_TYPE_FOLDER,
              promptToCreate: true,
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              selectedPath = result.filePaths[0];
            }
          } else {
            eventBus.emit('toast:show', {
              message: 'Folder picker not available.',
              type: 'error'
            });
            return;
          }
        }

        if (selectedPath) {
          createProjectModal._state.selectedPath = selectedPath;
          _setSavePathWithProjectName();
          // Hide error
          const errorEl = document.getElementById(projectPathErrorId);
          if (errorEl) {
            errorEl.classList.add('invisible');
          }
        }

      } catch (error) {
        console.warn('[CreateProjectModal] Browse dialog error:', error);
        eventBus.emit('toast:show', {
          message: `Failed to select location: ${error.message}`,
          type: 'error'
        });
      }
    });
  } else {
    console.warn('[CreateProjectModal] Browse button not found with ID:', browseButtonId);
  }

  // ─── Import: File ───────────────────────────────────────────────
  const importFileBtn = createProjectModal.querySelector(importFileButtonSelector);
  if (importFileBtn) {
    importFileBtn.addEventListener('click', () => _handleImportFilePick(createProjectModal));
  }

  // ─── Import: Folder (desktop only) ───────────────────────────────
  const importFolderBtn = createProjectModal.querySelector(importFolderButtonSelector);
  if (importFolderBtn) {
    importFolderBtn.addEventListener('click', () => _handleImportFolderPick(createProjectModal));
  }

  // ─── Back Button ──────────────────────────────────────────────
  const cancelImportBtn = createProjectModal.querySelector(cancelImportSelector);
  if (cancelImportBtn) {
    cancelImportBtn.addEventListener('click', () => _resetProjectImportModal(createProjectModal));
  }

  // ─── Enter Key ────────────────────────────────────────────────
  addModalEnterAction(createProjectModal, { targetId: projectInputId });

  // ─── Event: show:modal:createProject ──────────────────────────
  eventBus.on('show:modal:createProject', (payload = {}) => {
    _resetProjectImportModal(createProjectModal);
    const input = document.getElementById(projectInputId);
    
    if (payload.preset) {
      const allPresets = getAllProjectPresets();
      const found = allPresets.find(p => p.id === payload.preset.id);
      if (found && input) {
        const tempProject = found.factory();
        input.value = tempProject.name || 'New Project';
        createProjectModal._state.selectedPreset = found;
      } else if (input) {
        input.value = 'New Project';
        createProjectModal._state.selectedPreset = null;
      }
    } else if (input) {
      input.value = 'New project';
      createProjectModal._state.selectedPreset = null;
    }
    createProjectModal._state.projectName = input.value.trim();
    
    // Reset location
    createProjectModal._state.selectedPath = null;
    createProjectModal._state.saveType = RECENT_PROJECT_SOURCE_TYPE_FILE;
    const pathInput = document.getElementById(projectPathId);
    if (pathInput) {
      pathInput.value = '';
      _updatePathTooltip();
      _updatePathPlaceholder();
    }
    const errorEl = document.getElementById(projectPathErrorId);
    if (errorEl) {
      errorEl.classList.add('invisible');
    }

    // Reset save type toggle
    const saveTypeContainer = document.getElementById(saveTypeContainerId);
    if (saveTypeContainer) {
      saveTypeContainer.querySelectorAll('.save-type-btn').forEach(b => b.classList.remove('active'));
      const fileBtn = document.getElementById(saveTypeFileId);
      if (fileBtn) fileBtn.classList.add('active');
    }

    if (input) {
      input.focus();
      input.select();
    }

    const errorElement = document.getElementById(projectErrorId);
    if (errorElement) {
      errorElement.classList.add('invisible');
    }

    openModal(createProjectModal);
  });

  // ─── Platform-specific visibility ──────────────────────────────
  // Location section is only visible on desktop
  const locationSection = createProjectModal.querySelector('[data-section="location"]');
  if (locationSection) {
    if (isPlatformWeb()) {
      locationSection.style.display = 'none';
    } else {
      locationSection.style.display = 'block';
    }
  }

  // Folder import is desktop-only (see pickImportFolder in @core/Platform.js)
  if (importFolderBtn && isPlatformWeb()) {
    importFolderBtn.style.display = 'none';
  }

  // Initial placeholder update
  _updatePathPlaceholder();

  return createProjectModal;
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
    const result = await pickImportFile([FILE_EXTENSION_PROJECT.replace('.', '')]);

    if (result.canceled)
      return;

    const ext = result.extension?.startsWith('.')
      ? result.extension.toLowerCase()
      : `.${result.extension}`.toLowerCase();

    if (ext !== FILE_EXTENSION_PROJECT.toLowerCase()) {
      eventBus.emit('toast:show', {
        message: `Failed to import project: invalid extension '${result.extension}'`,
        type: 'error'
      });
      return;
    }

    let obj;
    try {
      obj = JSON.parse(result.data);
    } catch {
      eventBus.emit('toast:show', {
        message: 'Failed to import project: invalid JSON file',
        type: 'error'
      });
      return;
    }

    if (!obj?.project) {
      eventBus.emit('toast:show', {
        message: 'Failed to import project: missing project data',
        type: 'error'
      });
      return;
    }

    modal._state.pendingImportObj = obj;
    if (result.filePath)
      modal._state.selectedPath = result.filePath;
    modal._state.saveType = RECENT_PROJECT_SOURCE_TYPE_FILE;

    _showProjectImportPreview(modal, obj);

  } catch (error) {
    eventBus.emit('toast:show', { message: `Failed to import project: ${error}`, type: 'error' });
  }
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
    eventBus.emit('toast:show', { message: `Failed to import project: ${error.message ?? error}`, type: 'error' });
  }
}

/**
 * Handles the import flow when a file is selected.
 * @param {HTMLElement} modal - The modal DOM element
 */
async function _handleImport(modal) {
  const includeThemeCheckbox = modal.querySelector('[data-import-include-theme]');
  const includeTheme = includeThemeCheckbox ? isCheckedBoxActive(includeThemeCheckbox) : false;

  const objToImport = includeTheme
    ? modal._state.pendingImportObj
    : { ...modal._state.pendingImportObj, project: { ...modal._state.pendingImportObj.project, theme: null } };

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

      project.sourcePath = savePath;
      project.sourceKind = saveKind;
    }

    // Save project
    const projectId = await _saveProject(project);

    _resetProjectImportModal(modal);
    closeModal(modal);
    openRecentProject(projectId);

  } catch (error) {
    eventBus.emit('toast:show', { 
      message: `Failed to import project: ${error.message}`, 
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
        message: 'Projects are stored in memory on web. Use "Export" to save.',
        type: 'info'
      });
      resolve('memory');
      return;
    }

    if (saveKind === RECENT_PROJECT_SOURCE_TYPE_FOLDER) {
      // Folder mode: Use folder picker
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
      // File mode: Use save dialog
      if (window.electronAPI.saveDialog) {
        window.electronAPI.saveDialog({
          defaultPath: `${projectName}${FILE_EXTENSION_PROJECT}`,
          filters: [{ name: 'DocForge Project', extensions: ['dfproj'] }],
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
 * Saves a project to disk (desktop) or to memory (web).
 * @param {Object} project - The project object to save
 */
async function _saveProject(project) {
  // ─── Desktop: Write to the known source path via DocumentManager ──
  if (!isPlatformWeb() && project.sourcePath) {
    const { saveDocument } = await import('@core/DocumentManager.js');
    const success = await saveDocument(project);
    if (!success) {
      throw new Error('Failed to write project file');
    }
  }

  // ─── Web & Desktop: Add to recents (saves in state) ──────────
  const projectId = addRecentProject(project);
  
  // ─── Persist storage ──────────────────────────────────────────
  await storageManager.saveNow('recentProjects');
  return projectId;
}

/**
 * Shows the import preview section with project details.
 * @param {HTMLElement} modal - The modal DOM element
 * @param {Object} obj - The imported project object
 */
function _showProjectImportPreview(modal, obj) {
  const titleEl = document.getElementById(projectTitleId);
  if (titleEl)
    titleEl.textContent = 'Import Project';

  const projectNameEl = modal.querySelector('[data-import-project-name]');
  if (projectNameEl)
    projectNameEl.textContent = obj?.project?.name ?? 'untitled';

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
  const hasSourcePath = setValueRow(
    '[data-import-source-path]',
    '[data-import-no-source-path]',
    selectedPath,
    `<span>${selectedPath ?? '-'}</span>`,
  );

  setValueRow(
    '[data-import-source-kind]',
    '[data-import-no-source-kind]',
    modal._state?.saveType
  );

  const theme = obj?.project?.theme;
  const hasTheme = setValueRow(
    '[data-import-theme-name]',
    '[data-import-no-theme]',
    theme ? (theme.name ?? 'untitled theme') : null,
  );

  const includeThemeCheckbox = modal.querySelector(
    '[data-import-include-theme]',
  );

  if (includeThemeCheckbox) {
    setCheckboxDisabled(includeThemeCheckbox, !hasTheme);
    setCheckBox(includeThemeCheckbox, hasTheme);
  }

  modal.querySelector('[data-section="create"]')?.classList.add('hidden');
  modal.querySelector('[data-section="import"]')?.classList.remove('hidden');
  modal.querySelector(cancelImportSelector)?.classList.remove('hidden');

  const primaryBtn = modal.querySelector('[data-modal-primary]');
  if (primaryBtn)
    primaryBtn.textContent = 'Import';
}

/**
 * Resets the modal back to the create state (hides import preview).
 * @param {HTMLElement} modal - The modal DOM element
 */
function _resetProjectImportModal(modal) {
  modal._state.pendingImportObj = null;

  const titleEl = document.getElementById(projectTitleId);
  if (titleEl)
    titleEl.textContent = "Create Project";

  const createSection = modal.querySelector('[data-section="create"]');
  const importSection = modal.querySelector('[data-section="import"]');
  const cancelBtn = modal.querySelector('[data-action-cancel-import]');
  const primaryBtn = modal.querySelector('[data-modal-primary]');
  
  if (createSection)
    createSection.classList.remove('hidden');
  if (importSection)
    importSection.classList.add('hidden');
  if (cancelBtn)
    cancelBtn.classList.add('hidden');
  if (primaryBtn)
    primaryBtn.textContent = 'Create';
}