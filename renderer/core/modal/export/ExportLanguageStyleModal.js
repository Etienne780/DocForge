import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import {
  FILE_EXTENSION_LANGUAGE_STYLE,
  LANGUAGE_STYLE_SCHEMA_VERSION,
  SYNTAX_DEFINITION_SCHEMA_VERSION,
} from '@core/AppMeta.js';
import { wrapEntity } from '@core/Envelope.js';
import { eventBus } from '@core/EventBus.js';
import { exportWithSaveDialog } from '@core/Platform.js';
import { findHighlightStyle, findSyntaxDefinition, buildHighlightStyleRefs } from '@data/SyntaxDefinitionManager.js';
import { normalizeFileName, escapeHTML } from '@common/Common.js';
import { t } from '@core/i18n/I18n.js';
const tx = (key, vars) => escapeHTML(t(`exportModals.${key}`, vars));

let _activeExportStyle = null;
let _activeExportLang = null;

// ─── IDs ──────────────────────────────────────────────────────────
const modalId = 'application-export_language_style-modal';

const exportNameInputId = `${modalId}_export-name_input`;
const exportNameErrorId = `${modalId}_export-name_error`;

export function buildExportLanguageStyleModal() {
  const exportModal = buildDoneModal(modalId, {
    title: t('exportModals.style.title'),
    bodyHTML: `
    <div class="form-top-row form-group--spaced">
      <div class="form-group">
        <div class="form-row">
          <span>${tx('fileName')} </span>
          <div class="form-group">
            <input id="${exportNameInputId}" class="form-input" type="text" placeholder="${tx('namePlaceholder')}" />
            <span id="${exportNameErrorId}" class="body-label text-error" data-error-msg>${tx('invalidName')}</span>
          </div>
          <span class="text-muted">${FILE_EXTENSION_LANGUAGE_STYLE}</span>
        </div>
      </div>
    </div>
    <div class="form-tabel">
      <div class="row">
        <span class="text-muted">${tx('style.language')}</span>
        <span class="form-tag form--accent" data-export-lang-name>-</span>
      </div>
      <div class="row">
        <span class="text-muted" data-export-lang-info></span>
      </div>
    </div>`,
    doneLabel: t('exportModals.export'),
    wide: 'm',
    zIndex: 1002,
    doneCallback: async () => {
      const name = document.getElementById(exportNameInputId)?.value.trim();
      if (name)
        await _exportStyle(_activeExportStyle, _activeExportLang, name);
      _activeExportStyle = null;
      _activeExportLang = null;
      closeModal(exportModal);
    }
  });

  const nameInput = document.getElementById(exportNameInputId);
  nameInput.addEventListener('input', () => {
    const nameError = document.getElementById(exportNameErrorId);
    nameError.classList.toggle('invisible', Boolean(nameInput.value.trim()));
  });

  // payload: { project, styleId }
  eventBus.on('show:modal:exportLanguageStyle', ({ project, styleId }) => _openModal(exportModal, project, styleId));
  return exportModal;
}

function _openModal(modal, project, styleId) {
  _activeExportStyle = findHighlightStyle(project, styleId);
  if (!_activeExportStyle) {
    eventBus.emit('toast:show', { message: t('exportModals.style.notFound'), type: 'error' });
    return;
  }
  _activeExportLang = findSyntaxDefinition(_activeExportStyle.langId, project?.languages);

  const nameInput = document.getElementById(exportNameInputId);
  nameInput.value = _activeExportStyle.name ?? t('exportModals.style.untitled');
  document.getElementById(exportNameErrorId).classList.add('invisible');

  const langNameEl = modal.querySelector('[data-export-lang-name]');
  if (langNameEl)
    langNameEl.textContent = _activeExportLang?.name ?? t('exportModals.style.unknownLanguage');

  const langInfoEl = modal.querySelector('[data-export-lang-info]');
  if (langInfoEl) {
    langInfoEl.textContent = !_activeExportLang
      ? t('exportModals.style.langMissing')
      : _activeExportLang.builtIn
        ? t('exportModals.style.langBuiltIn')
        : t('exportModals.style.langCustom');
  }

  openModal(modal);
}

async function _exportStyle(style, lang, name) {
  if (!style) {
    eventBus.emit('toast:show', { message: t('exportModals.style.failed'), type: 'error' });
    return;
  }

  try {
    const pkg = {
      style,
      refs: buildHighlightStyleRefs(style, lang),
      language: lang && !lang.builtIn
        ? wrapEntity('language', SYNTAX_DEFINITION_SCHEMA_VERSION, lang)
        : null,
    };

    const json = JSON.stringify(wrapEntity('languageStyle', LANGUAGE_STYLE_SCHEMA_VERSION, pkg), null, 2);
    const ok = await exportWithSaveDialog(json, normalizeFileName(name), FILE_EXTENSION_LANGUAGE_STYLE, 'application/json');

    if (ok)
      eventBus.emit('toast:show', { message: t('exportModals.style.exported', { name: style.name }), type: 'success' });
  } catch (error) {
    eventBus.emit('toast:show', { message: t('exportModals.style.failedError', { name: style.name, error }), type: 'error' });
  }
}
