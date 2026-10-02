import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { FILE_EXTENSION_DOCTHEME, THEME_SCHEMA_VERSION } from '@core/AppMeta.js';
import { wrapEntity } from '@core/Envelope.js';
import { eventBus } from '@core/EventBus.js';
import { exportWithSaveDialog } from '@core/Platform.js';
import { findDocTheme } from '@data/DocThemeManager.js';
import { normalizeFileName } from '@common/Common.js';

let _activeExportTheme = null;

// ─── IDs ──────────────────────────────────────────────────────────
const modalId = 'application-export_doc_theme-modal';

const exportNameInputId = `${modalId}_export-name_input`;
const exportNameErrorId = `${modalId}_export-name_error`;

export function buildExportDocThemeModal() {
  const exportModal = buildDoneModal(modalId, {
    title: 'Export Theme',
    bodyHTML: `
    <div class="form-top-row form-group--spaced">
      <div class="form-group">
        <span>File Name: </span>
        <div class="form-row">
          <div class="form-group">
            <input id="${exportNameInputId}" class="form-input" type="text" placeholder="Name..." />
            <span id="${exportNameErrorId}" class="body-label text-error" data-error-msg>Invalid file name</span>
          </div>
          <span class="text-muted">${FILE_EXTENSION_DOCTHEME}</span>
        </div>
      </div>
    </div>`,
    doneLabel: 'Export',
    wide: 'm',
    zIndex: 1002,
    doneCallback: async () => {
      const name = document.getElementById(exportNameInputId)?.value.trim();
      if (name)
        await _exportTheme(_activeExportTheme, name);
      _activeExportTheme = null;
      closeModal(exportModal);
    }
  });

  const nameInput = document.getElementById(exportNameInputId);
  nameInput.addEventListener('input', () => {
    const nameError = document.getElementById(exportNameErrorId);
    nameError.classList.toggle('invisible', Boolean(nameInput.value.trim()));
  });

  // payload: { project, themeId }
  eventBus.on('show:modal:exportDocTheme', ({ project, themeId }) => _openModal(exportModal, project, themeId));
  return exportModal;
}

function _openModal(modal, project, themeId) {
  _activeExportTheme = findDocTheme(themeId, project?.themes);
  if (!_activeExportTheme) {
    eventBus.emit('toast:show', { message: 'Failed to open export modal, theme was not found!', type: 'error' });
    return;
  }

  const nameInput = document.getElementById(exportNameInputId);
  nameInput.value = _activeExportTheme.name ?? 'untitled theme';
  document.getElementById(exportNameErrorId).classList.add('invisible');

  openModal(modal);
}

async function _exportTheme(theme, name) {
  if (!theme) {
    eventBus.emit('toast:show', { message: 'Failed to export theme', type: 'error' });
    return;
  }

  try {
    const json = JSON.stringify(wrapEntity('theme', THEME_SCHEMA_VERSION, theme), null, 2);
    const ok = await exportWithSaveDialog(json, normalizeFileName(name), FILE_EXTENSION_DOCTHEME, 'application/json');

    if (ok)
      eventBus.emit('toast:show', { message: `Exported theme '${theme.name}'`, type: 'success' });
  } catch (error) {
    eventBus.emit('toast:show', { message: `Failed to export theme '${theme.name}': ${error}`, type: 'error' });
  }
}
