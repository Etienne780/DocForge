import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { FILE_EXTENSION_DOCTHEME, THEME_SCHEMA_VERSION } from '@core/AppMeta.js';
import { wrapEntity } from '@core/Envelope.js';
import { eventBus } from '@core/EventBus.js';
import { exportWithSaveDialog } from '@core/Platform.js';
import { findDocTheme } from '@data/DocThemeManager.js';
import { normalizeFileName, escapeHTML } from '@common/Common.js';
import { t } from '@core/i18n/I18n.js';
const tx = (key, vars) => escapeHTML(t(`exportModals.${key}`, vars));
import { isCheckedBoxActive } from '@common/UIUtils.js';
import { buildLanguageExportEntity } from './ExportLanguageModal.js';

let _activeExportTheme = null;
let _activeExportProject = null;

// ─── IDs ──────────────────────────────────────────────────────────
const modalId = 'application-export_doc_theme-modal';

const exportNameInputId = `${modalId}_export-name_input`;
const exportNameErrorId = `${modalId}_export-name_error`;

export function buildExportDocThemeModal() {
  const exportModal = buildDoneModal(modalId, {
    title: t('exportModals.theme.title'),
    bodyHTML: `
    <div class="form-top-row form-group--spaced">
      <div class="form-group">
        <span>${tx('fileName')} </span>
        <div class="form-row">
          <div class="form-group">
            <input id="${exportNameInputId}" class="form-input" type="text" placeholder="${tx('namePlaceholder')}" />
            <span id="${exportNameErrorId}" class="body-label text-error" data-error-msg>${tx('invalidName')}</span>
          </div>
          <span class="text-muted">${FILE_EXTENSION_DOCTHEME}</span>
        </div>
      </div>
    </div>
    <div data-export-languages-section>
      <div class="form-section-label">${tx('theme.includeLanguages')}</div>
      <div class="style-list_scroll" data-export-languages></div>
    </div>`,
    doneLabel: t('exportModals.export'),
    wide: 'm',
    zIndex: 1002,
    doneCallback: async () => {
      const name = document.getElementById(exportNameInputId)?.value.trim();
      if (name)
        await _exportTheme(_activeExportTheme, _getSelectedLanguages(exportModal), name);
      _activeExportTheme = null;
      _activeExportProject = null;
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
    eventBus.emit('toast:show', { message: t('exportModals.theme.notFound'), type: 'error' });
    return;
  }
  _activeExportProject = project;

  const nameInput = document.getElementById(exportNameInputId);
  nameInput.value = _activeExportTheme.name ?? t('exportModals.theme.untitled');
  document.getElementById(exportNameErrorId).classList.add('invisible');

  _renderLanguageList(modal);
  openModal(modal);
}

// only the project's own languages - built-in languages exist in every project
function _getProjectLanguages() {
  return _activeExportProject?.languages ?? [];
}

function _renderLanguageList(modal) {
  const languages = _getProjectLanguages();
  modal.querySelector('[data-export-languages-section]').classList.toggle('hidden', !languages.length);

  const listEl = modal.querySelector('[data-export-languages]');
  listEl.innerHTML = `
    <div class="form-tabel">
      ${languages.map(lang => `
        <div class="row">
          <span>${escapeHTML(lang.name)}</span>
          <button class="checkbox-element checked" data-checkbox="true" data-export-language="${escapeHTML(lang.id)}"></button>
        </div>`).join('')}
    </div>`;
}

function _getSelectedLanguages(modal) {
  return _getProjectLanguages().filter(lang => {
    const checkbox = modal.querySelector(`[data-export-language="${CSS.escape(lang.id)}"]`);
    return isCheckedBoxActive(checkbox);
  });
}

async function _exportTheme(theme, languages, name) {
  if (!theme) {
    eventBus.emit('toast:show', { message: t('exportModals.theme.failed'), type: 'error' });
    return;
  }

  try {
    // languages (with their project styles) sit next to the theme data, so the
    // file stays readable as a plain theme
    const entity = wrapEntity('theme', THEME_SCHEMA_VERSION, theme);
    if (languages.length) {
      entity.languages = languages.map(lang => buildLanguageExportEntity(
        lang,
        (_activeExportProject?.languagesStyles ?? []).filter(style => style.langId === lang.id),
      ));
    }

    const json = JSON.stringify(entity, null, 2);
    const ok = await exportWithSaveDialog(json, normalizeFileName(name), FILE_EXTENSION_DOCTHEME, 'application/json');

    if (ok)
      eventBus.emit('toast:show', { message: t('exportModals.theme.exported', { name: theme.name }), type: 'success' });
  } catch (error) {
    eventBus.emit('toast:show', { message: t('exportModals.theme.failedError', { name: theme.name, error }), type: 'error' });
  }
}
