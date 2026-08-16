import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import {
  FILE_EXTENSION_PROJECT,
  RECENT_PROJECT_SOURCE_TYPE_FILE,
  RECENT_PROJECT_SOURCE_TYPE_FOLDER,
} from '@core/AppMeta.js';
import { eventBus } from '@core/EventBus.js';
import { isPlatformWeb } from '@core/Platform.js';
import { getNumberOfSegments, normalizePath, combinePath, slicePath } from '@core/Path.js';
import {
  createProject,
  getAllProjectPresets,
  openProjectInEditor,
} from '@data/ProjectManager.js';
import { isNameValid } from '@common/Common.js';
import { getValidation, getValidationError } from '@common/Validations.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { saveProject } from '@common/ProjectPersistence.js';

// ─── IDs ──────────────────────────────────────────────────────────
const modalId = 'application-create_project-modal';

const projectInputId = `${modalId}-input`;
const projectErrorId = `${modalId}-error`;
const projectPathId = `${modalId}-path`;
const projectPathErrorId = `${modalId}-path-error`;
const browseButtonId = `${modalId}-browse`;
const saveTypeContainerId = `${modalId}-save-type`;
const saveTypeFileId = `${modalId}-save-file`;
const saveTypeFolderId = `${modalId}-save-folder`;
const goToImportSelector = '[data-action-go-to-import]';

export function buildCreateProjectModal() {

  // ─── Build Modal ──────────────────────────────────────────────────
  const createProjectModal = buildStandardModal(modalId, {
    title: 'Create Project',
    bodyHTML: `
      <div class="form-group">
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
        
        <button class="button button--dashed project-import-button" data-action-go-to-import>import project</button>
      </div>`,
    primaryLabel: 'Create',

    onPrimary: async () => {
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
        if (saveKind === RECENT_PROJECT_SOURCE_TYPE_FILE && !savePath.endsWith(FILE_EXTENSION_PROJECT)) {
          savePath = savePath + FILE_EXTENSION_PROJECT;
        }
        project.sourcePath = savePath;
        project.sourceKind = saveKind;
      }

      // ─── Save project ──────────────────────────────────
      try {
        await saveProject(project);
      } catch (error) {
        eventBus.emit('toast:show', {
          message: `Failed to save project: ${error.message}`,
          type: 'error'
        });
        return;
      }

      // ─── Open project (already added to recents by saveProject) ─────
      closeModal(createProjectModal);
      openProjectInEditor(project, { addToRecents: false });
    }
  });

  // ─── State ──────────────────────────────────────────────────────
  createProjectModal._state = {
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

      saveTypeContainer.querySelectorAll('.save-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const newSaveType = btn.dataset.saveType;
      createProjectModal._state.saveType = newSaveType;

      _updatePathPlaceholder();

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
  pathInput.addEventListener('focus', () => {
    _setSavePathWithoutProjectName();
  });

  pathInput.addEventListener('input', () => {
    const value = pathInput.value.trim();
    createProjectModal._state.selectedPath = value;
  });

  pathInput.addEventListener('focusout', () => {
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
          if (window.electronAPI.saveDialog) {
            const result = await window.electronAPI.saveDialog({
              defaultPath: `${projectName}${FILE_EXTENSION_PROJECT}`,
              filters: [{ name: 'DocForge Project', extensions: ['dfproj'] }],
            });

            if (!result.canceled && result.filePath) {
              selectedPath = result.filePath;

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

  // ─── Go to Import Modal ─────────────────────────────────────────
  const goToImportBtn = createProjectModal.querySelector(goToImportSelector);
  if (goToImportBtn) {
    goToImportBtn.addEventListener('click', () => {
      closeModal(createProjectModal);
      eventBus.emit('show:modal:importProject');
    });
  }

  // ─── Enter Key ────────────────────────────────────────────────
  addModalEnterAction(createProjectModal, { targetId: projectInputId });

  // ─── Event: show:modal:createProject ──────────────────────────
  eventBus.on('show:modal:createProject', (payload = {}) => {
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
  const locationSection = createProjectModal.querySelector('[data-section="location"]');
  if (locationSection) {
    if (isPlatformWeb()) {
      locationSection.style.display = 'none';
    } else {
      locationSection.style.display = 'block';
    }
  }

  // Initial placeholder update
  _updatePathPlaceholder();

  return createProjectModal;
}