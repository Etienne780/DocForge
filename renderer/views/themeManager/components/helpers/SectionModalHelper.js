import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import {
  findDocTheme,
  getDocThemes,
  getPresetDocThemes,
  removeDocThemeById,
  generateDocThemeId,
} from '@data/DocThemeManager.js';
import {
  findSyntaxDefinition,
  getLanguages,
  getPresetLanguages,
  updateSyntaxDefinition,
  removeSyntaxDefinition,
  generateSyntaxDefinitionId,
} from '@data/SyntaxDefinitionManager.js';
import { escapeHTML, isNameValid } from '@common/Common.js';

export const themeSectionName = 'theme';
export const langSectionName  = 'lang';

// ─── Active data ───────────────────────────────────────────────────────────────

let _activeThemeId = null;
let _activeLangId = null;
let _themeIsPreset = false;
let _langIsPreset = false;

// Working copy of aliases — populated on open, committed on done/close
let _aliases = [];

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
 * @param {HTMLElement} modalElement
 * @param {string}      themeId
 * @param {bool}        isPreset
 */
export function openThemeSectionModal(modalElement, themeId, isPreset) {
  _activeThemeId = themeId;
  _themeIsPreset = isPreset;

  let presets = null; 
  if(_themeIsPreset)
    presets = getPresetDocThemes();
  const theme = findDocTheme(themeId, presets);
  if (!theme) 
    return;

  modalElement.querySelector('[data-theme-del]').disabled = _themeIsPreset;
  modalElement.querySelector('[data-modal-primary]').disabled = _themeIsPreset;
  const input = modalElement.querySelector('[data-theme-name]');
  input.disabled = _themeIsPreset;
  input.value = theme.name;
  openModal(modalElement);
}

/**
 * Opens the language modal for a given language ID.
 * @param {HTMLElement} modalElement
 * @param {string}      langId
 */
export function openLangSectionModal(modalElement, langId, isPreset) {
  _activeLangId = langId;
  _langIsPreset = isPreset;

  let presets = null; 
  if(_langIsPreset)
    presets = getPresetLanguages();

  const lang = findSyntaxDefinition(langId, presets);
  if (!lang) 
    return;

  _aliases = [...(lang.nameAliases ?? [])];
    modalElement.querySelector('[data-lang-del]').disabled = _langIsPreset;
  modalElement.querySelector('[data-modal-primary]').disabled = _langIsPreset;
  const input = modalElement.querySelector('[data-lang-name]');
  input.disabled = _langIsPreset; 
  input.value = lang.name;
  modalElement.querySelector('[data-lang-alias-add]').disabled = _langIsPreset;
  const aliasInput = modalElement.querySelector('[data-lang-alias-input]');
  aliasInput.disabled = _langIsPreset;
  aliasInput.value = '';


  _renderTags(modalElement.querySelector('[data-lang-aliases]'), _aliases);
  openModal(modalElement);
}

export function closeThemeSectionModal(el) { 
  _themeIsPreset = false; 
  closeModal(el); 
}

export function closeLangSectionModal(el)  { 
  _langIsPreset = false;
  closeModal(el); 
}

// ─── Theme Modal ──────────────────────────────────────────────────────────────

function _buildThemeModal(htmlId) {
  const element = buildDoneModal(htmlId, {
    title: 'Theme',
    doneLabel: 'Open',
    wide: false,
    bodyHTML: `
      <div class="form-top-row">
        <input class="form-input" data-theme-name type="text" placeholder="Theme name" />
        <div class="form-top-actions">
          <button class="button button--secondary" data-theme-dup>Duplicate</button>
          <button class="button button--danger"    data-theme-del>Delete</button>
        </div>
      </div>`,
  });

  const nameInput = element.querySelector('[data-theme-name]');

  // Commits the name field. Called on done and on close (includes ESC via modal system).
  const _commitName = () => {
    if(_themeIsPreset)
      return;

    const theme = findDocTheme(_activeThemeId);
    const trimmed = nameInput.value.trim();
    if (!theme || !isNameValid(trimmed)) 
      return;
    
    theme.name = trimmed;
    state.set('docThemes', [...getDocThemes()]);
  };

  // done
  element.querySelector('[data-modal-primary]')?.addEventListener('click', () => {
    if(_themeIsPreset)
      return;
    
    const theme = findDocTheme(_activeThemeId);
    if (!theme)  {
      eventBus.emit('toast:show', { message: 'Failed to open Doc-theme.', type: 'error' });
      return;
    }
    
    _commitName();
    theme.lastOpenedAt = Date.now();
    state.set('docThemes', [...getDocThemes()]);

    eventBus.emit('save:request:docThemes');
    eventBus.emit('navigate:themeEditor', { themeId: theme.id });
    closeModal(element);
  });

  // close
  element.querySelector('[data-modal-close]')?.addEventListener('click', _commitName);

  // duplicate
  element.querySelector('[data-theme-dup]')?.addEventListener('click', () => {
    let presets = null; 
    if(_themeIsPreset)
      presets = getPresetDocThemes();
    const theme = findDocTheme(_activeThemeId, presets);
    if (!theme) {
      eventBus.emit('toast:show', { message: 'Failed to copy theme.', type: 'error' });
      return;
    }
    const copy = JSON.parse(JSON.stringify(theme));
    copy.id = generateDocThemeId();
    copy.name = theme.name + ' Copy';
    copy.builtIn = false;
    copy.createdAt = Date.now();
    copy.lastOpenedAt = Date.now();
    
    state.set('docThemes', [...getDocThemes(), copy]);
    eventBus.emit('toast:show', { message: 'Theme copied', type: 'success' });
    closeModal(element);
  });

  // delete
  element.querySelector('[data-theme-del]')?.addEventListener('click', () => {
    if(_themeIsPreset)
      return;

    const theme = findDocTheme(_activeThemeId);
    if (!theme) {
      eventBus.emit('toast:show', { message: 'Failed to copy theme.', type: 'error' });
      return;
    }

    if(theme.builtIn) {
      eventBus.emit('toast:show', { message:  'Built-in themes cannot be deleted.', type: 'error' });
      return;
    }
    
    const ok = removeDocThemeById(_activeThemeId);
    eventBus.emit('toast:show', ok
      ? { message: 'Theme deleted',           type: 'success' }
      : { message: 'Failed to delete theme.', type: 'error'   }
    );
    closeModal(element);
  });

  return element;
}

// ─── Language Modal ───────────────────────────────────────────────────────────

function _buildLangModal(htmlId) {
  const element = buildDoneModal(htmlId, {
    title: 'Language',
    doneLabel: 'Open',
    wide: true,
    bodyHTML: `
      <div class="form-top-row">
        <input class="form-input" data-lang-name type="text" placeholder="Language name" />
        <div class="form-top-actions">
          <button class="button button--secondary" data-lang-dup>Duplicate</button>
          <button class="button button--danger"    data-lang-del>Delete</button>
        </div>
      </div>

      <div class="form-section-label">Aliases</div>
      <div class="form-tags" data-lang-aliases></div>
      <div class="form-tag-add form-group--spaced">
        <input class="form-input" data-lang-alias-input type="text" placeholder="Add alias…" />
        <button class="button button--secondary" data-lang-alias-add>Add</button>
      </div>`,
  });

  const nameInput = element.querySelector('[data-lang-name]');
  const tagsEl = element.querySelector('[data-lang-aliases]');
  const aliasInput = element.querySelector('[data-lang-alias-input]');

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
    if(_langIsPreset)
      return;

    const trimmed = nameInput.value.trim();
    updateSyntaxDefinition(_activeLangId, {
      ...(isNameValid(trimmed) && { name: trimmed }),
      nameAliases: [..._aliases],
    });
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

    _commit();
    updateSyntaxDefinition(_activeLangId, { lastOpenedAt: Date.now() });
    
    eventBus.emit('save:request:languages');
    eventBus.emit('navigate:languageEditor', { langId: _activeLangId });
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