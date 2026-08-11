import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { FILE_EXTENSION_PROJECT } from '@core/AppMeta.js';
import { eventBus } from '@core/EventBus.js';
import { exportProjectAsHTML, exportProjectAsJSON } from '@common/ExportHelper';
import { normalizeFileName } from '@common/Common.js';
import { exportWithSaveDialog } from '@core/Platform.js';
import { setCheckBox, isCheckedBoxActive } from '@common/UIUtils.js';

const EXPORT_TYPE = {
  PROJECT: 'project',
  HTML: 'html',
};

let _activeExportProject = null;

const modalId = 'application-export_project-modal';
const exportNameInputId = `${modalId}_export-name_input`;
const exportNameErrorId = `${modalId}_export-name_error`;
const exportTypeId = `${modalId}_export-type`;
const exportProjIncludeThemeId = `${modalId}_export-proj_include_theme`;

export function buildExportProjectModal() {
  const exportModal = buildDoneModal(modalId, {
    title: 'Export Project',
    bodyHTML: `
    <div class="form-top-row form-group--spaced">
      <div class="form-group">
        <div class="form-row">
          <span>File Name: </span>
          <div class="form-group">
            <input id="${exportNameInputId}" class="form-input" type="text" placeholder="Name..." />
            <span id="${exportNameErrorId}" class="body-label text-error" data-error-msg>Invalid file name</span>
          </div>
          <div class="form-group">
            <select id="${exportTypeId}">
              <option value="${EXPORT_TYPE.PROJECT}">Project (*.dfproj)</option>
              <option value="${EXPORT_TYPE.HTML}}">HTML (*.html)</option>
            </select>
            <div class="form-row form-list-padding" data-project-settings>
              <span>Include theme: </span>
              <button id="${exportProjIncludeThemeId}" class="checkbox-element" data-checkbox="true"></button>
            </div>
          </div>
        </div>
      </div>
    </div>`,
    doneLabel: 'Export',
    wide: 'm',
    doneCallback: async () => {
      const modal = exportModal;
      const nameInput = document.getElementById(exportNameInputId);
      const typeSelect = document.getElementById(exportTypeId);
      if (!nameInput || !typeSelect) {
        const msg = `Failed to export project '${_activeExportProject?.name ?? 'untitled project'}'`;
        eventBus.emit('toast:show', { message: msg, type: 'error' });
        return;
      }
      const name = nameInput.value;
      const type = typeSelect.value;
      await _exportProject(modal, _activeExportProject, name, type);
      _activeExportProject = null;
      closeModal(modal);
    }
  });

  const nameInput = document.getElementById(exportNameInputId);
  nameInput.addEventListener('input', () => {
    const value = nameInput.value.trim();
    const nameError = document.getElementById(exportNameErrorId);

    nameError.classList.toggle('invisible', Boolean(value));
  });

  document.getElementById(exportTypeId).addEventListener('change', (event) => {
    const type = event.target?.value ?? null;
    if (!type)
      return;
    const projSet = exportModal.querySelector('[data-project-settings]');
    projSet?.classList.toggle('hidden', type !== EXPORT_TYPE.PROJECT);
  });

  eventBus.on('show:modal:exportProject', ({ project }) => _openModal(exportModal, project));
  return exportModal;
}

function _openModal(modal, project) {
  _activeExportProject = project;
  if (!_activeExportProject) {
    eventBus.emit('toast:show', { message: 'Failed to open export modal, project was null!', type: 'error' });
    return;
  }

  _resetProjectExportModal(modal, project);
  openModal(modal);
}

function _resetProjectExportModal(modal, project) {
  const projectExport = project.name ?? 'untitled project';

  const nameInput = document.getElementById(exportNameInputId);
  nameInput.value = `${projectExport}_export`;
  const nameError = document.getElementById(exportNameErrorId);
  nameError.classList.add('invisible');
  
  // select project type
  const typeSelect = document.getElementById(exportTypeId);
  typeSelect.value = EXPORT_TYPE.PROJECT;

  const projSet = modal.querySelector('[data-project-settings]');
  projSet?.classList.toggle('hidden', typeSelect.value !== EXPORT_TYPE.PROJECT);
  
  const includeCheckbox = document.getElementById(exportProjIncludeThemeId);
  setCheckBox(includeCheckbox, true);
}

async function _exportProject(modal, project, name, type) {
  if (!project) {
    const msg = 'Failed to export project';
    eventBus.emit('toast:show', { message: msg, type: 'error' });
    return;
  }

  switch (type) {
  case EXPORT_TYPE.PROJECT: {
    try {
      const includeCheckbox = document.getElementById(exportProjIncludeThemeId);
      const includeTheme = isCheckedBoxActive(includeCheckbox);

      const json = exportProjectAsJSON(project, includeTheme);
      const ok = await exportWithSaveDialog(
        json,
        normalizeFileName(name),
        FILE_EXTENSION_PROJECT,
        'application/json',
      );

      if (ok) {
        eventBus.emit('toast:show', {
          message: `Exported project '${project.name}'`,
          type: 'success',
        });
      }
    }
    catch (error) {
      eventBus.emit('toast:show', {
        message: `Failed to export project '${project.name}': ${error}`,
        type: 'error',
      });
    }

    break;
  }
  case EXPORT_TYPE.HTML: {
    const result = await exportProjectAsHTML(project, name);

    if (result.message !== 'UserAbort') {
      eventBus.emit('toast:show', {
        message: result.message,
        type: (result.success ? 'success' : 'error'),
      });
    }
    break;
  }
  default:
    eventBus.emit('toast:show', {
      message: `Failed to export project '${project.name}', invalid type '${type}'`,
      type: 'error',
    });
    break;
  }
}