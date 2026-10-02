import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { FILE_EXTENSION_SYNTAXDEFINITION, SYNTAX_DEFINITION_SCHEMA_VERSION } from '@core/AppMeta.js';
import { wrapEntity } from '@core/Envelope.js';
import { eventBus } from '@core/EventBus.js';
import { exportWithSaveDialog } from '@core/Platform.js';
import {
  findSyntaxDefinition,
  getHighlightStylesForLang,
  isHighlightStylesBuiltIn,
  buildHighlightStyleRefs,
} from '@data/SyntaxDefinitionManager.js';
import { normalizeFileName, escapeHTML, isQueryMatchesBuiltIn } from '@common/Common.js';
import { isCheckedBoxActive } from '@common/UIUtils.js';

let _activeExportLang = null;
let _activeExportStyles = [];

// ─── IDs ──────────────────────────────────────────────────────────
const modalId = 'application-export_language-modal';

const exportNameInputId = `${modalId}_export-name_input`;
const exportNameErrorId = `${modalId}_export-name_error`;

export function buildExportLanguageModal() {
  const exportModal = buildDoneModal(modalId, {
    title: 'Export Language',
    bodyHTML: `
    <div class="form-top-row form-group--spaced">
      <div class="form-group">
        <span>File Name: </span>
        <div class="form-row">
          <div class="form-group">
            <input id="${exportNameInputId}" class="form-input" type="text" placeholder="Name..." />
            <span id="${exportNameErrorId}" class="body-label text-error" data-error-msg>Invalid file name</span>
          </div>
          <span class="text-muted">${FILE_EXTENSION_SYNTAXDEFINITION}</span>
        </div>
      </div>
    </div>
    <div class="form-section-label">Include styles</div>
    <div class="form-top-row form-group--spaced">
      <div class="search-wrapper style-list_search">
        <span class="search-wrapper__icon" aria-hidden="true">⌕</span>
        <input type="text" class="search-input" placeholder="Search styles…" autocomplete="off" data-export-styles-search>
      </div>
    </div>
    <div class="style-list_scroll" data-export-styles></div>`,
    doneLabel: 'Export',
    wide: 'm',
    zIndex: 1002,
    doneCallback: async () => {
      const name = document.getElementById(exportNameInputId)?.value.trim();
      if (name)
        await _exportLanguage(_activeExportLang, _getSelectedStyles(exportModal), name);
      _activeExportLang = null;
      _activeExportStyles = [];
      closeModal(exportModal);
    }
  });

  const nameInput = document.getElementById(exportNameInputId);
  nameInput.addEventListener('input', () => {
    const nameError = document.getElementById(exportNameErrorId);
    nameError.classList.toggle('invisible', Boolean(nameInput.value.trim()));
  });

  exportModal.querySelector('[data-export-styles-search]')?.addEventListener('input', () => _filterStyleList(exportModal));

  // payload: { project, langId }
  eventBus.on('show:modal:exportLanguage', ({ project, langId }) => _openModal(exportModal, project, langId));
  return exportModal;
}

function _openModal(modal, project, langId) {
  _activeExportLang = findSyntaxDefinition(langId, project?.languages);
  if (!_activeExportLang) {
    eventBus.emit('toast:show', { message: 'Failed to open export modal, language was not found!', type: 'error' });
    return;
  }
  _activeExportStyles = getHighlightStylesForLang(project, langId);

  const nameInput = document.getElementById(exportNameInputId);
  nameInput.value = _activeExportLang.name ?? 'untitled language';
  document.getElementById(exportNameErrorId).classList.add('invisible');

  const searchInput = modal.querySelector('[data-export-styles-search]');
  if (searchInput)
    searchInput.value = '';

  _renderStyleList(modal);
  openModal(modal);
}

function _renderStyleList(modal) {
  const listEl = modal.querySelector('[data-export-styles]');
  if (!listEl)
    return;

  if (!_activeExportStyles.length) {
    listEl.innerHTML = _buildStyleGroupHTML(null, [], 'No styles for this language');
    return;
  }

  const ownStyles = _activeExportStyles.filter(s => !isHighlightStylesBuiltIn(s.id));
  const builtInStyles = _activeExportStyles.filter(s => isHighlightStylesBuiltIn(s.id));

  // rows are only hidden while searching, so checkbox states survive the filter
  listEl.innerHTML = `
    ${ownStyles.length ? _buildStyleGroupHTML('Project styles', ownStyles) : ''}
    ${builtInStyles.length ? _buildStyleGroupHTML('Built-in styles', builtInStyles, null, true) : ''}
    <div class="hidden" data-export-styles-empty>
      ${_buildStyleGroupHTML(null, [], 'No styles match your search')}
    </div>`;
}

function _buildStyleGroupHTML(label, styles, emptyText = null, builtIn = false) {
  const rows = styles.map(style => `
    <div class="row" data-export-style-row data-style-name="${escapeHTML(style.name.toLowerCase())}" data-built-in="${builtIn}">
      <span>${escapeHTML(style.name)}</span>
      <button class="checkbox-element checked" data-checkbox="true" data-export-style="${escapeHTML(style.id)}"></button>
    </div>`
  ).join('');

  return `
    <div class="style-list_group" data-export-style-group>
      ${label ? `<div class="form-section-label">${escapeHTML(label)}</div>` : ''}
      <div class="form-tabel">
        ${emptyText ? `<div class="row"><span class="form-tags-empty">${escapeHTML(emptyText)}</span></div>` : ''}
        ${rows}
      </div>
    </div>`;
}

function _filterStyleList(modal) {
  const query = (modal.querySelector('[data-export-styles-search]')?.value ?? '').trim().toLowerCase();
  let anyVisible = false;

  modal.querySelectorAll('[data-export-style-row]').forEach(row => {
    const visible = !query
      || (isQueryMatchesBuiltIn(query) ? row.dataset.builtIn === 'true' : row.dataset.styleName.includes(query));
    row.classList.toggle('hidden', !visible);
    anyVisible ||= visible;
  });

  modal.querySelectorAll('[data-export-style-group]').forEach(group => {
    const rows = group.querySelectorAll('[data-export-style-row]');
    if (rows.length)
      group.classList.toggle('hidden', [...rows].every(row => row.classList.contains('hidden')));
  });

  modal.querySelector('[data-export-styles-empty]')?.classList.toggle('hidden', anyVisible || !_activeExportStyles.length);
}

function _getSelectedStyles(modal) {
  return _activeExportStyles.filter(style => {
    const checkbox = modal.querySelector(`[data-export-style="${CSS.escape(style.id)}"]`);
    return isCheckedBoxActive(checkbox);
  });
}

async function _exportLanguage(lang, styles, name) {
  if (!lang) {
    eventBus.emit('toast:show', { message: 'Failed to export language', type: 'error' });
    return;
  }

  try {
    // styles sit next to the language data, so a .dflang file stays readable
    // as a plain language (folder projects, older versions)
    const entity = {
      ...wrapEntity('language', SYNTAX_DEFINITION_SCHEMA_VERSION, lang),
      styles: styles.map(style => ({ style, refs: buildHighlightStyleRefs(style, lang) })),
    };

    const json = JSON.stringify(entity, null, 2);
    const ok = await exportWithSaveDialog(json, normalizeFileName(name), FILE_EXTENSION_SYNTAXDEFINITION, 'application/json');

    if (ok)
      eventBus.emit('toast:show', { message: `Exported language '${lang.name}'`, type: 'success' });
  } catch (error) {
    eventBus.emit('toast:show', { message: `Failed to export language '${lang.name}': ${error}`, type: 'error' });
  }
}
