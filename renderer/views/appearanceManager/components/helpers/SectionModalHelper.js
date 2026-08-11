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
  dublicateSyntaxDefinitionById,
} from '@data/SyntaxDefinitionManager.js';
import { getOpenProject } from '@data/ProjectManager.js'
import { escapeHTML, isNameValid } from '@common/Common.js';
import { getValidationError } from '@common/Validations.js';

export const themeSectionName = 'theme';
export const langSectionName  = 'lang';

// ─── Active data ───────────────────────────────────────────────────────────────

let _activeThemeId = null;
let _activeLangId = null;

let _themeBuiltIn = false;
let _langBuiltIn = false;

let _themeCloseCb = null;
let _langCloseCb = null;

// Working copy of aliases — populated on open, committed on done/close
let _aliases = [];
let _activeProject = null;

/**
 * Builds both modals once. Call on init.
 * @param {string} themeModalHtmlId
 * @param {string} langModalHtmlId
 */
export function buildSectionModal(themeModalHtmlId, langModalHtmlId) {
  return {
    theme: _buildThemeModal(themeModalHtmlId),
    lang: _buildLangModal(langModalHtmlId),
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
    errorElement.classList.add('invisible');
  }

  openModal(modalElement);
}

/**
 * Opens the language modal for a given language ID.
 * @param {HTMLElement} modalElement
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
    errorElement.classList.add('invisible');
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

export function closeThemeSectionModal(el) { 
  _resetThemeData();
  closeModal(el); 
}

export function closeLangSectionModal(el)  { 
  _resetLangData();
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