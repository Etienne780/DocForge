import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { FILE_EXTENSION_PROJECT } from '@core/AppMeta.js';
import { pickImportFile } from '@core/Platform.js';
import { createProject, addProject } from '@data/ProjectManager.js';
import { getValidation, getValidationError } from '@common/Validations.js';  
import { addModalEnterAction } from '@common/BaseModals.js';
import { setCheckBox, setCheckboxDisabled, isCheckedBoxActive } from '@common/UIUtils.js';
import { importProject } from '@common/ImportHelper.js';
import { isNameValid } from '@common/Common.js'

export function buildCreateProjectModal() {

  const projectInputId = 'application-create_project-modal-input';
  const projectErrorId = 'application-create_project-modal-error';

  const createProjectModal = buildStandardModal('application-create_project-modal', {
    title: 'Create Project',
    bodyHTML: `
      <div class="form-group" data-section="create">
        <label class="form-label" for="${projectInputId}">Name</label>
        <input type="text" class="form-input" id="${projectInputId}"
               autocomplete="off" placeholder="Project name...">
        
        <span id="${projectErrorId}" class="body-label text-error" data-error-msg>${getValidationError('PROJECT', 'NAME_MIN_LENGTH')}</span>
        
        <div class="project-import-center-label">
          <span class="form-label no-select">or import project</span>
        </div>
        <div class="form-top-row flex-end">
          <button class="button button--dashed project-import-button" data-action-import>
            <span>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
              </svg>
              Select a file
            </span>
          </button>
        </div>
      </div>

      <div class="form-group project-import hidden" data-section="import">
        <div class="project-import-preview-tabel">

         <div class="row">
            <span class="text-muted">Name</span>
            <span class="form-tag form-tag--accent" data-import-project-name>-</span>
          </div>

          <div class="row">
            <span class="text-muted">Theme</span>
            <span class="form-tag form-tag--accent" data-import-theme-name>-</span>
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

    onPrimary: () => {
      // navigates to project manager if not already open
      eventBus.emit('navigate:projectManager');

      /* ── Import mode ─────────────────────────────────── */
      if (createProjectModal._state.pendingImportObj) {
        const includeThemeCheckbox = createProjectModal.querySelector('[data-import-include-theme]');
        const includeTheme = isCheckedBoxActive(includeThemeCheckbox);

        const objToImport = includeTheme ? 
          createProjectModal._state.pendingImportObj : 
          { ...createProjectModal._state.pendingImportObj, theme: null };

        try {
          const project = importProject(objToImport);
          addProject(project);
          session.set('activeProjectId', project.id);
          eventBus.emit('save:request:projects');
          eventBus.emit('toast:show', { message: `Project '${project.name}' imported`, type: 'success' });
        } catch (error) {
          eventBus.emit('toast:show', { message: `Failed to import project: ${error}`, type: 'error' });
          return;
        }

        _resetProjectImportModal(createProjectModal);
        closeModal(createProjectModal);
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

      const project = createProject(value);
      addProject(project);
      session.set('activeProjectId', project.id);

      closeModal(createProjectModal);
      eventBus.emit('save:request:projects');
      eventBus.emit('toast:show', { message: `Project '${value}' created`, type: 'success' });
    }
  });

  createProjectModal._state = {
    pendingImportObj: null
  };

  const input = document.getElementById(projectInputId);
  input.addEventListener('input', () => {
    const value = input.value.trim();
    const errorElement = document.getElementById(projectErrorId);
    
    if(isNameValid(value, 'PROJECT')) {
      errorElement.classList.add('invisible');
    } else {
      errorElement.classList.remove('invisible');
    }
  });

  /* ── "Import" button: pick file -> show preview ───── */
  createProjectModal.querySelector('[data-action-import]')
    .addEventListener('click', async () => {
      try {
        const result = await pickImportFile();

        if (result.canceled) {
          eventBus.emit('toast:show', { message: 'Import was canceled', type: 'info' });
          return;
        }

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

        createProjectModal._state.pendingImportObj = obj;
        _showProjectImportPreview(createProjectModal, obj);

      } catch (error) {
        eventBus.emit('toast:show', { message: `Failed to import project: ${error}`, type: 'error' });
      }
    });

  /* ── "<- Back" button: return to create section ───── */
  createProjectModal.querySelector('[data-action-cancel-import]')
    .addEventListener('click', () => _resetProjectImportModal(createProjectModal));

  addModalEnterAction(createProjectModal, { targetId: projectInputId });

  eventBus.on('show:modal:createProject', () => {
    _resetProjectImportModal(createProjectModal);
    const input = document.getElementById(projectInputId);
    if (input) {
      input.value = 'New project';
      input.focus();
      input.select();
    }

    const errorElement = document.getElementById(projectErrorId);
    if(errorElement) {
      errorElement.classList.add('invisible');
    }

    openModal(createProjectModal);
  });

  return createProjectModal;
}

function _showProjectImportPreview(modal, obj) {
  const projectName = obj?.project?.name ?? 'untitled';
  modal.querySelector('[data-import-project-name]').textContent = projectName;

  const hasTheme = !!obj?.theme;
  modal.querySelector('[data-import-theme-name]').classList.toggle('hidden', !hasTheme);
  modal.querySelector('[data-import-no-theme]').classList.toggle('hidden', hasTheme);
  
  const includeThemeCheckbox = modal.querySelector('[data-import-include-theme]');
  if (hasTheme) {
    const themeName = obj.theme?.name ?? 'untitled theme';
    modal.querySelector('[data-import-theme-name]').textContent = themeName;
    setCheckboxDisabled(includeThemeCheckbox, false);
    setCheckBox(includeThemeCheckbox, true);
  } else {
    setCheckboxDisabled(includeThemeCheckbox, true);
    setCheckBox(includeThemeCheckbox, false);
  }
  
  modal.querySelector('[data-section="create"]').classList.add('hidden');
  modal.querySelector('[data-section="import"]').classList.remove('hidden');
  modal.querySelector('[data-action-cancel-import]').classList.remove('hidden');

  const primaryBtn = modal.querySelector('[data-modal-primary]');
  if (primaryBtn) 
    primaryBtn.textContent = 'Import';
}

function _resetProjectImportModal(modal) {
  modal._state.pendingImportObj = null;

  modal.querySelector('[data-section="create"]').classList.remove('hidden');
  modal.querySelector('[data-section="import"]').classList.add('hidden');
  modal.querySelector('[data-action-cancel-import]').classList.add('hidden');

  const primaryBtn = modal.querySelector('[data-modal-primary]');
  if (primaryBtn) 
    primaryBtn.textContent = 'Create';
}