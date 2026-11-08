import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { FILE_EXTENSION_PROJECT } from '@core/AppMeta.js';
import { eventBus } from '@core/EventBus.js';
import { exportProjectAsHTML, exportProjectAsJSON, exportProjectAsFolder } from '@common/ExportHelper';
import { normalizeFileName, escapeHTML } from '@common/Common.js';
import { t } from '@core/i18n/I18n.js';
const tx = (key, vars) => escapeHTML(t(`exportModals.${key}`, vars));
import { exportWithSaveDialog, isPlatformWeb } from '@core/Platform.js';
import { setCheckBox, isCheckedBoxActive } from '@common/UIUtils.js';

const EXPORT_TYPE = {
  PROJECT: 'project',
  HTML: 'html',
  FOLDER: 'folder',
};

let _activeExportProject = null;

// ─── IDs ──────────────────────────────────────────────────────────
const modalId = 'application-export_project-modal';

const exportNameInputId = `${modalId}_export-name_input`;
const exportNameErrorId = `${modalId}_export-name_error`;
const exportTypeId = `${modalId}_export-type`;
const exportProjIncludeThemeId = `${modalId}_export-proj_include_theme`;

export function buildExportProjectModal() {
  const exportModal = buildDoneModal(modalId, {
    title: t('exportModals.project.title'),
    bodyHTML: `
    <div class="form-top-row form-group--spaced">
      <div class="form-group">
        <div class="form-row">
          <span>${tx('fileName')} </span>
          <div class="form-group">
            <input id="${exportNameInputId}" class="form-input" type="text" placeholder="${tx('namePlaceholder')}" />
            <span id="${exportNameErrorId}" class="body-label text-error" data-error-msg>${tx('invalidName')}</span>
          </div>
          <div class="form-group">
            <select id="${exportTypeId}">
              <option value="${EXPORT_TYPE.PROJECT}">${tx('project.typeProject')}</option>
              <option value="${EXPORT_TYPE.HTML}">${tx('project.typeHtml')}</option>
              ${!isPlatformWeb() ? `<option value="${EXPORT_TYPE.FOLDER}">${tx('project.typeFolder')}</option>` : ''}
            </select>
            <div class="form-row form-list-padding" data-project-settings>
              <span>${tx('project.includeTheme')} </span>
              <button id="${exportProjIncludeThemeId}" class="checkbox-element" data-checkbox="true"></button>
            </div>
          </div>
        </div>
      </div>
    </div>`,
    doneLabel: t('exportModals.export'),
    wide: 'm',
    doneCallback: async () => {
      const modal = exportModal;
      const nameInput = document.getElementById(exportNameInputId);
      const typeSelect = document.getElementById(exportTypeId);
      if (!nameInput || !typeSelect) {
        const msg = t('exportModals.project.failedNamed', { name: _activeExportProject?.name ?? t('exportModals.project.untitled') });
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
    eventBus.emit('toast:show', { message: t('exportModals.project.notFound'), type: 'error' });
    return;
  }

  _resetProjectExportModal(modal, project);
  openModal(modal);
}

function _resetProjectExportModal(modal, project) {
  const projectExport = project.name ?? t('exportModals.project.untitled');

  const nameInput = document.getElementById(exportNameInputId);
  nameInput.value = t('exportModals.project.exportSuffix', { name: projectExport });
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
    const msg = t('exportModals.project.failed');
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
          message: t('exportModals.project.exported', { name: project.name }),
          type: 'success',
        });
      }
    }
    catch (error) {
      eventBus.emit('toast:show', {
        message: t('exportModals.project.failedError', { name: project.name, error }),
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
  case EXPORT_TYPE.FOLDER: {
    const result = await exportProjectAsFolder(project, name);

    if (result.message !== 'UserAbort') {
      eventBus.emit('toast:show', {
        message: result.message,
        type: result.success ? 'success' : 'error',
      });
    }
    break;
  }
  default:
    eventBus.emit('toast:show', {
      message: t('exportModals.project.invalidType', { name: project.name, type }),
      type: 'error',
    });
    break;
  }
}