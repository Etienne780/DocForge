import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { notifyOpenProjectChange, getOpenProject } from '@data/ProjectManager.js';
import {
  findDocTheme,
  updateDocTheme,
  removeDocThemeById,
  generateDocThemeId,
  openDocThemeEditor,
  getPresetDocThemes,
  dublicateDocThemeById,
} from '@data/DocThemeManager.js';
import {
  findSyntaxDefinition,
  getPresetLanguages,
  updateSyntaxDefinition,
  removeSyntaxDefinition,
  generateSyntaxDefinitionId,
  openSyntaxDefinitionEditor,
  findHighlightStyle,
  getHighlightStylesForLang,
  removeHighlightStyle,
  addHighlightStyle,
  isHighlightStylesBuiltIn,
  generateHighlightStyleId,
  dublicateSyntaxDefinitionById,
  getBuiltInLanguageOverlaps,
} from '@data/SyntaxDefinitionManager.js';
import { escapeHTML, isNameValid, isQueryMatchesBuiltIn } from '@common/Common.js';
import { getValidationError } from '@common/Validations.js';

export const themeSectionName    = 'theme';
export const langSectionName     = 'lang';
export const styleSectionName    = 'style';
export const styleListSectionName = 'styleList';

// ─── Active data ───────────────────────────────────────────────────────────────

let _activeThemeId = null;
let _activeLangId = null;

let _themeBuiltIn = false;
let _langBuiltIn = false;

let _themeCloseCb = null;
let _langCloseCb = null;

// Working copy of aliases — populated on open, committed on done/close
let _aliases = [];

let _activeStyleId = null;
let _styleBuiltIn = false;
let _styleCloseCb = null;
let _activeProject = null;

// Styles-list modal state
let _stylesListProject = null;
let _stylesListLangId = null;
let _styleModalElement = null;

/**
 * Builds all modals once. Call on init.
 * @param {string} themeModalHtmlId
 * @param {string} langModalHtmlId
 * @param {string} styleModalHtmlId
 * @param {string} styleListModalHtmlId
 */
export function buildSectionModal(themeModalHtmlId, langModalHtmlId, styleModalHtmlId, styleListModalHtmlId) {
  const styleModal = _buildStyleModal(styleModalHtmlId);
  _styleModalElement = styleModal;

  return {
    theme: _buildThemeModal(themeModalHtmlId),
    lang: _buildLangModal(langModalHtmlId),
    style: styleModal,
    styleList: _buildStyleListModal(styleListModalHtmlId),
  };
}

/**
 * Opens the theme modal for a given theme ID.
 * Reads the ID from the clicked card element via data-theme-id.
 * @param {HTMLElement}   modalElement
 * @param {object}        project
 * @param {string}        themeId
 * @param {bool}          builtIn
 * @param {function|null} closeCb
 */
export function openThemeSectionModal(modalElement, project, themeId, builtIn, closeCb = null) {
  _activeProject = project;
  _activeThemeId = themeId;
  _themeBuiltIn = builtIn; 
  _themeCloseCb = closeCb          

  const theme = findDocTheme(themeId, project.themes);
  if (!theme) {
    _resetThemeData();
    return;
  }

  modalElement.querySelector('[data-theme-del]').disabled = _themeBuiltIn;
  modalElement.querySelector('[data-modal-primary]').disabled = _themeBuiltIn;
  
  const input = modalElement.querySelector('[data-theme-name]'); 
  if(input) {
    input.disabled = _themeBuiltIn;
    input.value = theme.name;
  }

  const errorElement = modalElement.querySelector('[data-error-msg]');
  if(errorElement) {
    errorElement.classList.add('hidden');
  }

  openModal(modalElement);
}

/**
 * Opens the language modal for a given language ID.
 * @param {HTMLElement} modalElement
 * @param {Object}      project
 * @param {string}      langId
 */
export function openLangSectionModal(modalElement, project, langId, builtIn, closeCb = null) {
  _activeProject = project;
  _activeLangId = langId;
  _langBuiltIn = builtIn;
  _langCloseCb = closeCb;

  const lang = findSyntaxDefinition(langId, project?.languages ?? []);
  if (!lang)  {
    _resetLangData();
    return;
  }

  _aliases = [...(lang.aliases ?? [])];
  modalElement.querySelector('[data-lang-del]').disabled = _langBuiltIn;
  modalElement.querySelector('[data-modal-primary]').disabled = _langBuiltIn;
  
  const input = modalElement.querySelector('[data-lang-name]');
  if(input) {
    input.disabled = _langBuiltIn; 
    input.value = lang.name;
  }

  const errorElement = modalElement.querySelector('[data-error-msg]');
  if(errorElement) {
    errorElement.classList.add('hidden');
  }

  modalElement.querySelector('[data-lang-alias-add]').disabled = _langBuiltIn;
  const aliasInput = modalElement.querySelector('[data-lang-alias-input]');
  if(aliasInput) {
    aliasInput.disabled = _langBuiltIn;
    aliasInput.value = '';
  }

  _renderTags(modalElement.querySelector('[data-lang-aliases]'), _aliases);
  openModal(modalElement);
}

/**
 * Shows which built-in languages the name/aliases being edited overlap with.
 * @param {HTMLElement} modalElement
 */
function _updateLangOverlap(modalElement) {
  const overlapEl = modalElement?.querySelector('[data-lang-overlap]');
  if (!overlapEl)
    return;

  const name = modalElement.querySelector('[data-lang-name]')?.value.trim() ?? '';
  const overlaps = _langBuiltIn ? [] : getBuiltInLanguageOverlaps(name, _aliases);

  overlapEl.classList.toggle('hidden', !overlaps.length);
  overlapEl.textContent = overlaps
    .map(o => `Overrides built-in '${o.lang.name}' for: ${o.matches.join(', ')}`)
    .join(' · ');
}

/**
 * Opens the style modal for a given style ID.
 * @param {HTMLElement} modalElement
 * @param {Object} project
 * @param {string} styleId
 * @param {bool}   builtIn
 * @param {function|null} closeCb
 */
export function openStyleSectionModal(modalElement, project, styleId, builtIn, closeCb = null) {
  _activeProject = project;
  _activeStyleId = styleId;
  _styleBuiltIn = builtIn;
  _styleCloseCb = closeCb;

  const style = findHighlightStyle(project, styleId);
  if (!style) {
    _resetStyleData();
    return;
  }

  modalElement.querySelector('[data-style-del]').disabled = _styleBuiltIn;
  modalElement.querySelector('[data-modal-primary]').disabled = _styleBuiltIn;

  const input = modalElement.querySelector('[data-style-name]');
  if (input) {
    input.disabled = _styleBuiltIn;
    input.value = style.name;
  }

  const errorElement = modalElement.querySelector('[data-error-msg]');
  if (errorElement)
    errorElement.classList.add('hidden');

  const langLabel = modalElement.querySelector('[data-style-lang-label]');
  if (langLabel) {
    const langDef = findSyntaxDefinition(style.langId, project?.languages ?? []);
    langLabel.textContent = langDef?.name ?? 'Unknown language';
  }

  openModal(modalElement);
}

export function closeThemeSectionModal(el) { 
  _resetThemeData();
  closeModal(el); 
}

export function closeLangSectionModal(el)  { 
  _resetLangData();
  closeModal(el); 
}

export function closeStyleSectionModal(el) {
  _resetStyleData();
  closeModal(el);
}

function _resetThemeData() {
  _themeBuiltIn = false;
  _themeCloseCb?.(_activeThemeId);
  _themeCloseCb = null;
  _activeThemeId = null;
  _activeProject = null;
}

function _resetLangData() {
  _langBuiltIn = false;
  _langCloseCb?.(_activeLangId);
  _langCloseCb = null;
  _activeLangId = null;
  _activeProject = null;
}

function _resetStyleData() {
  _styleBuiltIn = false;
  _styleCloseCb?.(_activeStyleId);
  _styleCloseCb = null;
  _activeStyleId = null;
  _activeProject = null;
}

// ─── Theme Modal ──────────────────────────────────────────────────────────────

function _buildThemeModal(htmlId) {
  const element = buildDoneModal(htmlId, {
    title: 'Theme',
    doneLabel: 'Open',
    wide: 'm',
    bodyHTML: `
      <div class="form-top-row">
        <input class="form-input" data-theme-name type="text" placeholder="Theme name" />
        <div class="form-top-actions">
          <button class="button button--secondary" data-theme-export>Export</button>
          <button class="button button--secondary" data-theme-dup>Duplicate</button>
          <button class="button button--danger"    data-theme-del>Delete</button>
        </div>
      </div>
      <span class="body-label text-error" data-error-msg>${getValidationError('THEME', 'NAME_MIN_LENGTH')}</span>`,
  });

  const nameInput = element.querySelector('[data-theme-name]');

  nameInput.addEventListener('input', () => {
    const value = nameInput.value.trim();
    const errorElement = element.querySelector('[data-error-msg]');
    
    if(isNameValid(value, 'THEME')) {
      errorElement.classList.add('hidden');
    } else {
      errorElement.classList.remove('hidden');
    }
  });

  // Commits the name field. Called on done and on close (includes ESC via modal system).
  const _commitName = () => {
    if(_themeBuiltIn) {
      _resetThemeData();
      return;
    }
    const trimmed = nameInput.value.trim();
    const proj = getOpenProject();
    updateDocTheme(proj, _activeThemeId, { 
      name: trimmed,
    });

    _resetThemeData();
  };

  // done
  element.querySelector('[data-modal-primary]')?.addEventListener('click', () => {
    if(_themeBuiltIn)
      return;
    
    const theme = findDocTheme(_activeThemeId, _activeProject.themes);
    if (!theme)  {
      eventBus.emit('toast:show', { message: 'Failed to open Doc-theme.', type: 'error' });
      return;
    }
    
    _commitName();// resets theme data
    openDocThemeEditor(_activeProject, theme);
    closeModal(element);
  });

  // close
  element.querySelector('[data-modal-close]')?.addEventListener('click', _commitName);

  // export
  element.querySelector('[data-theme-export]')?.addEventListener('click', () => {
    eventBus.emit('show:modal:exportDocTheme', { project: _activeProject, themeId: _activeThemeId });
  });

  // duplicate
  element.querySelector('[data-theme-dup]')?.addEventListener('click', () => {
    dublicateDocThemeById(_activeProject, _activeThemeId);
    _resetThemeData();
    closeModal(element);
  });

  // delete
  element.querySelector('[data-theme-del]')?.addEventListener('click', () => {
    if(_themeBuiltIn)
      return;

    const theme = findDocTheme(_activeThemeId, _activeProject.themes);
    if (!theme) {
      eventBus.emit('toast:show', { message: 'Failed to delete theme.', type: 'error' });
      return;
    }

    if(theme.builtIn) {
      eventBus.emit('toast:show', { message:  'Built-in themes cannot be deleted.', type: 'error' });
      return;
    }
    
    const ok = removeDocThemeById(_activeProject, _activeThemeId);
    eventBus.emit('toast:show', ok
      ? { message: 'Theme deleted',           type: 'success' }
      : { message: 'Failed to delete theme.', type: 'error'   }
    );
    _resetThemeData();
    closeModal(element);
  });

  return element;
}

// ─── Language Modal ───────────────────────────────────────────────────────────

function _buildLangModal(htmlId) {
  const element = buildDoneModal(htmlId, {
    title: 'Language',
    doneLabel: 'Open',
    wide: 'm',
    bodyHTML: `
      <div class="form-top-row">
        <input class="form-input" data-lang-name type="text" placeholder="Language name" />
        <div class="form-top-actions">
          <button class="button button--secondary" data-lang-export>Export</button>
          <button class="button button--secondary" data-lang-dup>Duplicate</button>
          <button class="button button--danger"    data-lang-del>Delete</button>
        </div>
      </div>

      <div class="form-top-column">
        <span class="body-label text-error" data-error-msg>${getValidationError('LANGUAGE', 'NAME_MIN_LENGTH')}</span>
        <span class="body-label text-warning hidden" data-lang-overlap></span>
      </div>

      <div class="form-section-label">Aliases</div>
      <div class="form-tags" data-lang-aliases></div>
      <div class="form-top-row form-group--spaced">
        <input class="form-input" data-lang-alias-input type="text" placeholder="Add alias…" />
        <button class="button button--secondary" data-lang-alias-add>Add</button>
      </div>`,
  });

  const nameInput = element.querySelector('[data-lang-name]');
  const tagsEl = element.querySelector('[data-lang-aliases]');
  const aliasInput = element.querySelector('[data-lang-alias-input]');

  nameInput.addEventListener('input', () => {
    const value = nameInput.value.trim();
    const errorElement = element.querySelector('[data-error-msg]');
    
    if(isNameValid(value, 'LANGUAGE')) {
      errorElement.classList.add('hidden');
    } else {
      errorElement.classList.remove('hidden');
    }

    _updateLangOverlap(element);
  });

  // Adds an alias to the working copy and re-renders the tag list
  const _addAlias = () => {
    if(_langBuiltIn)
      return;

    const val = aliasInput.value.trim();
    if (!val || _aliases.includes(val)) 
      return;

    _aliases.push(val);
    aliasInput.value = '';
    _renderTags(tagsEl, _aliases);
  };

  element.querySelector('[data-lang-alias-add]')?.addEventListener('click', _addAlias);
  aliasInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { 
      e.preventDefault(); 
      _addAlias(); 
    }
  });

  const _commit = () => {
    if(_langBuiltIn) {
      _resetLangData();
      return;
    }

    const trimmed = nameInput.value.trim();
    updateSyntaxDefinition(_activeProject, _activeLangId, {
      ...(isNameValid(trimmed, 'LANGUAGE') && { name: trimmed }),
      aliases: [..._aliases],
    });
    _resetLangData();
  };

  // done
  element.querySelector('[data-modal-primary]')?.addEventListener('click', () => {
    if(_langBuiltIn)
      return;

    const lang = findSyntaxDefinition(_activeLangId, _activeProject?.languages ?? []);
    if (!lang)  {
      eventBus.emit('toast:show', { message: 'Failed to open language.', type: 'error' });
      return;
    }

    _commit();// resets lang data
    openSyntaxDefinitionEditor(_activeProject, lang);
    _resetLangData();
    closeModal(element);
  });

  // close
  element.querySelector('[data-modal-close]')?.addEventListener('click', _commit);

  // export
  element.querySelector('[data-lang-export]')?.addEventListener('click', () => {
    eventBus.emit('show:modal:exportLanguage', { project: _activeProject, langId: _activeLangId });
  });

  // duplicate
  element.querySelector('[data-lang-dup]')?.addEventListener('click', () => {
    dublicateSyntaxDefinitionById(_activeProject, _activeLangId);
    _resetLangData();
    closeModal(element);
  });

  // delete
  element.querySelector('[data-lang-del]')?.addEventListener('click', () => {
    if(_langBuiltIn)
      return;

    const lang = findSyntaxDefinition(_activeLangId, _activeProject?.languages ?? []);
    if (!lang) {
      eventBus.emit('toast:show', { message: 'Failed to delete language.', type: 'error' });
      return;
    }

    if(lang.builtIn) {
      eventBus.emit('toast:show', { message:  'Built-in languages cannot be deleted.', type: 'error' });
      return;
    }

    const ok = removeSyntaxDefinition(_activeProject, _activeLangId);
    eventBus.emit('toast:show', ok
      ? { message: 'Language deleted',           type: 'success' }
      : { message: 'Failed to delete language.', type: 'error'   }
    );
    _resetLangData();
    closeModal(element);
  });

  return element;
}

// ─── Style Modal (single style: rename/duplicate/delete) ──────────────────────

function _buildStyleModal(htmlId) {
  const element = buildDoneModal(htmlId, {
    title: 'Language Style',
    doneLabel: 'Open',
    wide: 'm',
    zIndex: 1001,
    bodyHTML: `
      <div class="body-label text-muted" data-style-lang-label>Language</div>
      <div class="form-top-row">
        <input class="form-input" data-style-name type="text" placeholder="Style name" />
        <div class="form-top-actions">
          <button class="button button--secondary" data-style-export>Export</button>
          <button class="button button--secondary" data-style-dup>Duplicate</button>
          <button class="button button--danger"    data-style-del>Delete</button>
        </div>
      </div>
      <span class="body-label text-error" data-error-msg>${getValidationError('LANGUAGE', 'NAME_MIN_LENGTH')}</span>`,
  });

  const nameInput = element.querySelector('[data-style-name]');

  nameInput.addEventListener('input', () => {
    const value = nameInput.value.trim();
    const errorElement = element.querySelector('[data-error-msg]');
    if (isNameValid(value, 'LANGUAGE')) {
      errorElement.classList.add('hidden');
    } else {
      errorElement.classList.remove('hidden');
    }
  });

  const _commitName = () => {
    if (_styleBuiltIn) {
      _resetStyleData();
      return;
    }

    const style = findHighlightStyle(_activeProject, _activeStyleId);
    const trimmed = nameInput.value.trim();
    if (!style || !isNameValid(trimmed, 'LANGUAGE')) {
      _resetStyleData();
      return;
    }

    notifyOpenProjectChange(() => {
      style.name = trimmed;
    }, 'languagesStyles');

    _resetStyleData();
  };

  // done -> open style editor (once it exists)
  element.querySelector('[data-modal-primary]')?.addEventListener('click', () => {
    if (_styleBuiltIn)
      return;

    const style = findHighlightStyle(_activeProject, _activeStyleId);
    if (!style) {
      eventBus.emit('toast:show', { message: 'Failed to open style.', type: 'error' });
      return;
    }

    _commitName(); // resets style data
    eventBus.emit('navigate:languageStyleEditor', { project: _activeProject, styleId: style.id, langId: style.langId });
    closeModal(element);
  });

  // close
  element.querySelector('[data-modal-close]')?.addEventListener('click', _commitName);

  // export
  element.querySelector('[data-style-export]')?.addEventListener('click', () => {
    eventBus.emit('show:modal:exportLanguageStyle', { project: _activeProject, styleId: _activeStyleId });
  });

  // duplicate
  element.querySelector('[data-style-dup]')?.addEventListener('click', () => {
    const source = findHighlightStyle(_activeProject, _activeStyleId);
    if (!source) {
      eventBus.emit('toast:show', { message: 'Failed to copy style.', type: 'error' });
      return;
    }

    const copy = JSON.parse(JSON.stringify(source));
    copy.id = generateHighlightStyleId();
    copy.name = source.name + ' Copy';

    notifyOpenProjectChange(project => {
      project.languagesStyles ??= [];
      project.languagesStyles.push(copy);
    }, 'languagesStyles');

    eventBus.emit('toast:show', { message: 'Style copied', type: 'success' });
    _resetStyleData();
    closeModal(element);
  });

  // delete
  element.querySelector('[data-style-del]')?.addEventListener('click', () => {
    if (_styleBuiltIn)
      return;

    const ok = removeHighlightStyle(_activeProject, _activeStyleId);
    eventBus.emit('toast:show', ok
      ? { message: 'Style deleted',           type: 'success' }
      : { message: 'Failed to delete style.', type: 'error'   }
    );
    _resetStyleData();
    closeModal(element);
  });

  return element;
}

// ─── Style List Modal (per-language style manager) ────────────────────────────

/**
 * Opens the style-list modal for a given language, showing every style
 * (own + built-in presets) that belongs to it.
 * @param {HTMLElement} modalElement
 * @param {Object}      project
 * @param {string}      langId
 */
export function openStyleListSectionModal(modalElement, project, langId) {
  _stylesListProject = project;
  _stylesListLangId = langId;

  const searchInput = modalElement.querySelector('[data-style-list-search]');
  if (searchInput)
    searchInput.value = '';

  _renderStyleList(modalElement);
  openModal(modalElement);
}

function _renderStyleList(modalElement) {
  const sublabelEl = modalElement.querySelector('[data-style-list-sublabel]');
  const listEl = modalElement.querySelector('[data-style-list]');
  if (!listEl)
    return;

  const langDef = findSyntaxDefinition(_stylesListLangId, _stylesListProject?.languages ?? []);
  if (sublabelEl)
    sublabelEl.textContent = langDef?.name ?? 'Unknown language';

  const query = (modalElement.querySelector('[data-style-list-search]')?.value ?? '').trim().toLowerCase();
  const styles = getHighlightStylesForLang(_stylesListProject, _stylesListLangId);
  const ownStyles = styles.filter(s => !isHighlightStylesBuiltIn(s.id));
  const builtInStyles = styles.filter(s => isHighlightStylesBuiltIn(s.id));

  const matches = (style, builtIn) => {
    if (!query)
      return true;
    if (isQueryMatchesBuiltIn(query))
      return builtIn;
    return style.name.toLowerCase().includes(query);
  };

  listEl.innerHTML = '';

  if (!styles.length) {
    listEl.appendChild(_buildStyleListGroup(null, [], 'No styles yet'));
    return;
  }

  const visibleOwn = ownStyles.filter(s => matches(s, false));
  const visibleBuiltIn = builtInStyles.filter(s => matches(s, true));

  if (!visibleOwn.length && !visibleBuiltIn.length) {
    listEl.appendChild(_buildStyleListGroup(null, [], 'No styles match your search'));
    return;
  }

  if (visibleOwn.length)
    listEl.appendChild(_buildStyleListGroup(`Project styles (${visibleOwn.length})`, visibleOwn));
  if (visibleBuiltIn.length)
    listEl.appendChild(_buildStyleListGroup(`Built-in styles (${visibleBuiltIn.length})`, visibleBuiltIn));
}

function _buildStyleListGroup(label, styles, emptyText = null) {
  const group = document.createElement('div');
  group.className = 'style-list_group';

  if (label) {
    const labelEl = document.createElement('div');
    labelEl.className = 'form-section-label';
    labelEl.textContent = label;
    group.appendChild(labelEl);
  }

  const table = document.createElement('div');
  table.className = 'form-tabel';

  if (emptyText) {
    const row = document.createElement('div');
    row.className = 'row';

    const empty = document.createElement('span');
    empty.className = 'form-tags-empty';
    empty.textContent = emptyText;
    row.appendChild(empty);
    table.appendChild(row);
  }

  styles.forEach(style => table.appendChild(_buildStyleListRow(style)));
  group.appendChild(table);
  return group;
}

function _buildStyleListRow(style) {
  const builtIn = isHighlightStylesBuiltIn(style.id);

  const row = document.createElement('div');
  row.className = 'row backup-manager-list-row';
  row.dataset.styleRow = style.id;

  const name = document.createElement('span');
  name.textContent = style.name;

  const right = document.createElement('span');
  right.className = 'backup-manager-row-right';

  if (builtIn) {
    const tag = document.createElement('span');
    tag.className = 'form-tag form-tag--small';
    tag.textContent = 'Built In';
    right.appendChild(tag);
  }

  const arrow = document.createElement('span');
  arrow.className = 'backup-manager-row-arrow text-muted';
  arrow.textContent = '›';
  right.appendChild(arrow);

  row.appendChild(name);
  row.appendChild(right);
  return row;
}

function _buildStyleListModal(htmlId) {
  const element = buildDoneModal(htmlId, {
    title: 'Language Styles',
    doneLabel: 'Close',
    wide: 'm',
    bodyHTML: `
      <div class="body-label text-muted" data-style-list-sublabel></div>
      <div class="form-top-row form-group--spaced">
        <div class="search-wrapper style-list_search">
          <span class="search-wrapper__icon" aria-hidden="true">⌕</span>
          <input type="text" class="search-input" placeholder="Search styles…" autocomplete="off" data-style-list-search>
        </div>
        <div class="form-top-actions">
          <button class="button button--secondary" data-style-list-import>Import</button>
          <button class="button button--secondary" data-style-list-new>+ New style</button>
        </div>
      </div>
      <div class="style-list_scroll" data-style-list></div>`,
  });

  element.querySelector('[data-style-list-search]')?.addEventListener('input', () => _renderStyleList(element));

  const _close = () => {
    _stylesListProject = null;
    _stylesListLangId = null;
    closeModal(element);
  };

  element.querySelector('[data-modal-primary]')?.addEventListener('click', _close);
  element.querySelector('[data-modal-close]')?.addEventListener('click', _close);

  element.querySelector('[data-style-list-import]')?.addEventListener('click', () => {
    const payload = { projectId: _stylesListProject?.id, langId: _stylesListLangId };
    _close();
    eventBus.emit('show:modal:importLanguageStyle', payload);
  });

  element.querySelector('[data-style-list-new]')?.addEventListener('click', () => {
    if (!_stylesListProject || !_stylesListLangId)
      return;

    const style = addHighlightStyle(_stylesListProject, _stylesListLangId, 'New Style');
    eventBus.emit('save:request');
    _renderStyleList(element);

    // Open the new style right away so the user can rename/configure it,
    // same "create then configure" flow used elsewhere in this file.
    openStyleSectionModal(_styleModalElement, _stylesListProject, style.id, false, () => _renderStyleList(element));
  });

  element.querySelector('[data-style-list]')?.addEventListener('click', event => {
    const row = event.target.closest('[data-style-row]');
    if (!row)
      return;

    const styleId = row.dataset.styleRow;
    const builtIn = isHighlightStylesBuiltIn(styleId);
    openStyleSectionModal(_styleModalElement, _stylesListProject, styleId, builtIn, () => _renderStyleList(element));
  });

  return element;
}

// ─── Tag Renderer ─────────────────────────────────────────────────────────────

/**
 * Re-renders the alias tag list from the current working copy.
 * Mutates the passed aliases array on remove.
 * @param {HTMLElement} tagsEl
 * @param {string[]}    aliases  - the live working array (_aliases)
 */
function _renderTags(tagsEl, aliases) {
  _updateLangOverlap(tagsEl.closest('.modal-overlay'));
  tagsEl.innerHTML = '';

  if (aliases.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'form-tags-empty';
    empty.textContent = 'No aliases';
    tagsEl.appendChild(empty);
    return;
  }

  aliases.forEach((alias, i) => {
    const tag = document.createElement('span');
    const disabled = _langBuiltIn ? 'disabled' : '';

    tag.className = 'form-tag';
    tag.innerHTML = `${escapeHTML(alias)}<button class="form-tag-remove" aria-label="Remove" ${disabled}>✕</button>`;
    tag.querySelector('button').addEventListener('click', () => {
      if(_langBuiltIn)
        return;
      aliases.splice(i, 1);
      _renderTags(tagsEl, aliases);
    });
    tagsEl.appendChild(tag);
  });
}