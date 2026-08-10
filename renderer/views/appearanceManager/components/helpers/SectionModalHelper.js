import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
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
  generateHighlightStyleId,
} from '@data/SyntaxDefinitionManager.js';
import { getOpenProject } from '@data/ProjectManager.js'
import { escapeHTML, isNameValid } from '@common/Common.js';
import { getValidationError } from '@common/Validations.js';

export const themeSectionName = 'theme';
export const langSectionName  = 'lang';
export const styleSectionName = 'style';

// ─── Active data ───────────────────────────────────────────────────────────────

let _activeThemeId = null;
let _activeLangId = null;

let _themeIsPreset = false;
let _langIsPreset = false;

let _themeCloseCb = null;
let _langCloseCb = null;

// Working copy of aliases — populated on open, committed on done/close
let _aliases = [];

let _activeStyleId = null;
let _styleIsPreset = false;
let _styleCloseCb = null;
let _activeProject = null;

/**
 * Builds both modals once. Call on init.
 * @param {string} themeModalHtmlId
 * @param {string} langModalHtmlId
 */
export function buildSectionModal(themeModalHtmlId, langModalHtmlId, styleModalHtmlId) {
  return {
    theme: _buildThemeModal(themeModalHtmlId),
    lang: _buildLangModal(langModalHtmlId),
    style: _buildStyleModal(styleModalHtmlId),
  };
}

/**
 * Opens the theme modal for a given theme ID.
 * Reads the ID from the clicked card element via data-theme-id.
 * @param {HTMLElement}   modalElement
 * @param {object}        project
 * @param {string}        themeId
 * @param {bool}          isPreset
 * @param {function|null} closeCb
 */
export function openThemeSectionModal(modalElement, project, themeId, isPreset, closeCb = null) {
  _activeThemeId = themeId;
  _themeIsPreset = isPreset; 
  _themeCloseCb = closeCb          

  const theme = findDocTheme(themeId, project.themes);
  if (!theme) {
    _resetThemeData();
    return;
  }

  modalElement.querySelector('[data-theme-del]').disabled = _themeIsPreset;
  modalElement.querySelector('[data-modal-primary]').disabled = _themeIsPreset;
  
  const input = modalElement.querySelector('[data-theme-name]'); 
  if(input) {
    input.disabled = _themeIsPreset;
    input.value = theme.name;
  }

  const errorElement = modalElement.querySelector('[data-error-msg]');
  if(errorElement) {
    errorElement.classList.add('invisible');
  }

  openModal(modalElement);
}

/**
 * Opens the language modal for a given language ID.
 * @param {HTMLElement} modalElement
 * @param {string}      langId
 */
export function openLangSectionModal(modalElement, project, langId, isPreset, closeCb = null) {
  _activeLangId = langId;
  _langIsPreset = isPreset;
  _langCloseCb = closeCb;

  const lang = findSyntaxDefinition(langId, project.languages);
  if (!lang)  {
    _resetLangData();
    return;
  }

  _aliases = [...(lang.aliases ?? [])];
    modalElement.querySelector('[data-lang-del]').disabled = _langIsPreset;
  modalElement.querySelector('[data-modal-primary]').disabled = _langIsPreset;
  
  const input = modalElement.querySelector('[data-lang-name]');
  if(input) {
    input.disabled = _langIsPreset; 
    input.value = lang.name;
  }

  const errorElement = modalElement.querySelector('[data-error-msg]');
  if(errorElement) {
    errorElement.classList.add('invisible');
  }

  modalElement.querySelector('[data-lang-alias-add]').disabled = _langIsPreset;
  const aliasInput = modalElement.querySelector('[data-lang-alias-input]');
  if(aliasInput) {
    aliasInput.disabled = _langIsPreset;
    aliasInput.value = '';
  }

  _renderTags(modalElement.querySelector('[data-lang-aliases]'), _aliases);
  openModal(modalElement);
}

/**
 * Opens the style modal for a given style ID.
 * @param {HTMLElement} modalElement
 * @param {Object} project
 * @param {string} styleId
 * @param {bool} isPreset
 */
export function openStyleSectionModal(modalElement, project, styleId, isPreset, closeCb = null) {
  _activeProject = project;
  _activeStyleId = styleId;
  _styleIsPreset = isPreset;
  _styleCloseCb = closeCb;

  const style = isPreset
    ? (session.get('languageStylePresets') ?? []).find(s => s.id === styleId)
    : findHighlightStyle(project, styleId);

  if (!style) {
    _resetStyleData();
    return;
  }

  modalElement.querySelector('[data-style-del]').disabled = _styleIsPreset;
  modalElement.querySelector('[data-modal-primary]').disabled = _styleIsPreset;

  const input = modalElement.querySelector('[data-style-name]');
  if (input) {
    input.disabled = _styleIsPreset;
    input.value = style.name;
  }

  const errorElement = modalElement.querySelector('[data-error-msg]');
  if (errorElement)
    errorElement.classList.add('invisible');

  const langLabel = modalElement.querySelector('[data-style-lang-label]');
  if (langLabel) {
    const langDef = findSyntaxDefinition(style.langId, project?.languages);
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
  _themeIsPreset = false;
  _themeCloseCb?.(_activeThemeId);
  _themeCloseCb = null;
  _activeThemeId = null;
}

function _resetLangData() {
  _langIsPreset = false;
  _langCloseCb?.(_activeLangId);
  _langCloseCb = null;
  _activeLangId = null;
}

function _resetStyleData() {
  _styleIsPreset = false;
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
      errorElement.classList.add('invisible');
    } else {
      errorElement.classList.remove('invisible');
    }
  });

  // Commits the name field. Called on done and on close (includes ESC via modal system).
  const _commitName = () => {
    if(_themeIsPreset) {
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
    if(_themeIsPreset)
      return;
    
    const proj = getOpenProject();
    const theme = findDocTheme(_activeThemeId, proj.themes);
    if (!theme)  {
      eventBus.emit('toast:show', { message: 'Failed to open Doc-theme.', type: 'error' });
      return;
    }
    
    _commitName();// resets theme data
    openDocThemeEditor(proj, theme);
    closeModal(element);
  });

  // close
  element.querySelector('[data-modal-close]')?.addEventListener('click', _commitName);

  // duplicate
  element.querySelector('[data-theme-dup]')?.addEventListener('click', () => {
    const proj = getOpenProject();

    dublicateDocThemeById(proj, _activeThemeId);
    _resetThemeData();
    closeModal(element);
  });

  // delete
  element.querySelector('[data-theme-del]')?.addEventListener('click', () => {
    if(_themeIsPreset)
      return;

    const proj = getOpenProject();
    const theme = findDocTheme(_activeThemeId, proj.themes);
    if (!theme) {
      eventBus.emit('toast:show', { message: 'Failed to copy theme.', type: 'error' });
      return;
    }

    if(theme.builtIn) {
      eventBus.emit('toast:show', { message:  'Built-in themes cannot be deleted.', type: 'error' });
      return;
    }
    
    const ok = removeDocThemeById(proj, _activeThemeId);
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
          <button class="button button--secondary" data-lang-dup>Duplicate</button>
          <button class="button button--danger"    data-lang-del>Delete</button>
        </div>
      </div>

      <span class="body-label text-error" data-error-msg>${getValidationError('LANGUAGE', 'NAME_MIN_LENGTH')}</span>

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
      errorElement.classList.add('invisible');
    } else {
      errorElement.classList.remove('invisible');
    }
  });

  // Adds an alias to the working copy and re-renders the tag list
  const _addAlias = () => {
    if(_langIsPreset)
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
    if(_langIsPreset) {
      _resetLangData();
      return;
    }

    const trimmed = nameInput.value.trim();
    updateSyntaxDefinition(_activeLangId, {
      ...(isNameValid(trimmed, 'LANGUAGE') && { name: trimmed }),
      aliases: [..._aliases],
    });
    _resetLangData();
  };

  // done
  element.querySelector('[data-modal-primary]')?.addEventListener('click', () => {
    if(_langIsPreset)
      return;

    const lang = findSyntaxDefinition(_activeLangId);
    if (!lang)  {
      eventBus.emit('toast:show', { message: 'Failed to open language.', type: 'error' });
      return;
    }

    _commit();// resets lang data
    openSyntaxDefinitionEditor(lang);
    _resetLangData();
    closeModal(element);
  });

  // close
  element.querySelector('[data-modal-close]')?.addEventListener('click', _commit);

  // duplicate
  element.querySelector('[data-lang-dup]')?.addEventListener('click', () => {
    let presets = null; 
    if(_langIsPreset)
      presets = getPresetLanguages();

    const lang = findSyntaxDefinition(_activeLangId, presets);
    if (!lang) {
      eventBus.emit('toast:show', { message: 'Failed to copy language.', type: 'error' });
      return;
    }
    const copy = JSON.parse(JSON.stringify(lang));
    copy.id = generateSyntaxDefinitionId();
    copy.name = lang.name + ' Copy';
    copy.builtIn = false;
    copy.createdAt = Date.now();
    copy.lastOpenedAt = Date.now();

    state.set('languages', [...getLanguages(), copy]);
    eventBus.emit('toast:show', { message: 'Language copied', type: 'success' });
    _resetLangData();
    closeModal(element);
  });

  // delete
  element.querySelector('[data-lang-del]')?.addEventListener('click', () => {
    if(_langIsPreset)
      return;

    const lang = findSyntaxDefinition(_activeLangId);
    if (!lang) {
      eventBus.emit('toast:show', { message: 'Failed to copy language.', type: 'error' });
      return;
    }

    if(lang.builtIn) {
      eventBus.emit('toast:show', { message:  'Built-in languages cannot be deleted.', type: 'error' });
      return;
    }

    const ok = removeSyntaxDefinition(_activeLangId);
    eventBus.emit('toast:show', ok
      ? { message: 'Language deleted',           type: 'success' }
      : { message: 'Failed to delete language.', type: 'error'   }
    );
    _resetLangData();
    closeModal(element);
  });

  return element;
}

// ─── Language style Modal ───────────────────────────────────────────────────────────

function _buildStyleModal(htmlId) {
  const element = buildDoneModal(htmlId, {
    title: 'Language Style',
    doneLabel: 'Open',
    wide: 'm',
    bodyHTML: `
      <div class="body-label text-muted" data-style-lang-label>Language</div>
      <div class="form-top-row">
        <input class="form-input" data-style-name type="text" placeholder="Style name" />
        <div class="form-top-actions">
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
      errorElement.classList.add('invisible');
    } else {
      errorElement.classList.remove('invisible');
    }
  });

  const _commitName = () => {
    if (_styleIsPreset) {
      _resetStyleData();
      return;
    }

    const style = findHighlightStyle(_activeProject, _activeStyleId);
    const trimmed = nameInput.value.trim();
    if (!style || !isNameValid(trimmed, 'LANGUAGE')) {
      _resetStyleData();
      return;
    }

    style.name = trimmed;
    notifyProjectChange(() => {}, 'languagesStyles');
    _resetStyleData();
  };

  // done -> open style editor (once it exists)
  element.querySelector('[data-modal-primary]')?.addEventListener('click', () => {
    if (_styleIsPreset)
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

  // duplicate
  element.querySelector('[data-style-dup]')?.addEventListener('click', () => {
    const source = _styleIsPreset
      ? (session.get('languageStylePresets') ?? []).find(s => s.id === _activeStyleId)
      : findHighlightStyle(_activeProject, _activeStyleId);

    if (!source) {
      eventBus.emit('toast:show', { message: 'Failed to copy style.', type: 'error' });
      return;
    }

    const copy = JSON.parse(JSON.stringify(source));
    copy.id = generateHighlightStyleId();
    copy.name = source.name + ' Copy';

    notifyProjectChange(project => {
      project.languagesStyles ??= [];
      project.languagesStyles.push(copy);
    }, 'languagesStyles');

    eventBus.emit('toast:show', { message: 'Style copied', type: 'success' });
    _resetStyleData();
    closeModal(element);
  });

  // delete
  element.querySelector('[data-style-del]')?.addEventListener('click', () => {
    if (_styleIsPreset)
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

// ─── Tag Renderer ─────────────────────────────────────────────────────────────

/**
 * Re-renders the alias tag list from the current working copy.
 * Mutates the passed aliases array on remove.
 * @param {HTMLElement} tagsEl
 * @param {string[]}    aliases  - the live working array (_aliases)
 */
function _renderTags(tagsEl, aliases) {
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
    const disabled = _langIsPreset ? 'disabled' : '';

    tag.className = 'form-tag';
    tag.innerHTML = `${escapeHTML(alias)}<button class="form-tag-remove" aria-label="Remove" ${disabled}>✕</button>`;
    tag.querySelector('button').addEventListener('click', () => {
      if(_langIsPreset)
        return;
      aliases.splice(i, 1);
      _renderTags(tagsEl, aliases);
    });
    tagsEl.appendChild(tag);
  });
}