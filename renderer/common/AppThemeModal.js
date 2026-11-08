import { buildDoneModal, buildStandardModal, openModal, closeModal, onModalClose } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { isDevelopment } from '@core/Platform.js';
import { escapeHTML } from '@common/Common.js';
import { askChoice, addModalEnterAction } from '@common/BaseModals.js';
import { bindColorSwatch, setSwatchColor, closeColorPicker } from '@common/ColorPicker.js';
import { setCheckBox, isCheckedBoxActive, addCheckboxEventListener } from '@common/UIUtils.js';
import {
  APP_THEME_GROUPS,
  APP_THEME_MODES,
  getAppTheme,
  getAppThemes,
  getAppThemeColor,
  getAppThemeBaseColor,
  getCurrentMode,
  isAppThemeBuiltIn,
  duplicateAppTheme,
  setActiveAppTheme,
  setAppThemeColor,
  copyAppThemeColors,
} from '@data/AppThemeManager.js';

/**
 * Modals of the app themes (@data/AppThemeManager.js), opened from the preferences:
 * - openAppThemeColorsModal(themeId): every color of a theme, grouped, for the dark or light
 *   variant, with a search. Built-in themes are read-only (changing a color offers a copy).
 * - copy colors from another theme / variant (whole groups or single colors)
 * - askAppThemeName(): name input for duplicate / rename
 */

const MODE_LABELS = { dark: 'Dark mode', light: 'Light mode' };
const RESET_ICON = '↺';

/** CSS variable names only help developers: shown (and searchable) in development only. */
const _varLabel = name => isDevelopment() ? `--${name}` : '';
const _varHTML = name => isDevelopment() ? `<span class="app-theme-colors__var">--${escapeHTML(name)}</span>` : '';

// ─── Name input ───────────────────────────────────────────────────────────────

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.value]
 * @param {string} [options.primaryLabel]
 * @returns {Promise<string|null>} the trimmed name, null if canceled
 */
export function askAppThemeName({ title, value = '', primaryLabel = 'Save' }) {
  return new Promise(resolve => {
    let result = null;
    const inputId = `app-theme-name-${Date.now()}`;
    const overlay = buildStandardModal(`${inputId}-modal`, {
      title,
      primaryLabel,
      bodyHTML: `
        <div class="form-group">
          <label class="form-label" for="${inputId}">Name</label>
          <input type="text" class="form-input" id="${inputId}" autocomplete="off" spellcheck="false" value="${escapeHTML(value)}">
        </div>`,
      zIndex: '1100',
      onPrimary: () => {
        const name = overlay.querySelector(`#${inputId}`).value.trim();
        if (!name)
          return;
        result = name;
        closeModal(overlay);
      },
    });
    addModalEnterAction(overlay, { targetSelector: `#${inputId}` });

    openModal(overlay);
    const input = overlay.querySelector(`#${inputId}`);
    input.focus();
    input.select();

    const stopWatching = onModalClose(overlay, () => {
      stopWatching();
      overlay.remove();
      resolve(result);
    });
  });
}

// ─── Colors of a theme ────────────────────────────────────────────────────────

let _colorsOverlay = null;

/**
 * Opens the color editor of a theme.
 * @param {string} themeId
 */
export function openAppThemeColorsModal(themeId) {
  if (_colorsOverlay || !getAppTheme(themeId))
    return;

  const view = { themeId, mode: getCurrentMode(), cleanups: [] };
  const overlay = buildDoneModal(`app-theme-colors-${Date.now()}`, {
    title: 'Theme colors',
    wide: 'l',
    bodyHTML: `
      <div class="app-theme-colors">
        <div class="app-theme-colors__header">
          <div class="icon-button-group-hor" data-modes>
            ${APP_THEME_MODES.map(mode => `<button type="button" data-mode="${mode}">${MODE_LABELS[mode]}</button>`).join('')}
          </div>
          <input class="form-input app-theme-colors__search" data-search type="text" placeholder="Search colors…"
            autocomplete="off" spellcheck="false" aria-label="Search colors">
          <button type="button" class="button button--secondary" data-copy>Copy colors from…</button>
        </div>
        <div class="app-theme-colors__notice hidden" data-notice>
          <span>Built-in themes can't be changed.</span>
          <button type="button" class="button button--primary" data-duplicate>Duplicate to edit</button>
        </div>
        <div class="app-theme-colors__list" data-list></div>
      </div>`,
  });
  _colorsOverlay = overlay;
  overlay.querySelector('.modal')?.classList.add('modal--fixed');

  const list = overlay.querySelector('[data-list]');
  const search = overlay.querySelector('[data-search]');
  const render = () => _renderColors(overlay, view, render);

  overlay.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    view.mode = button.dataset.mode;
    render();
  }));
  search.addEventListener('input', () => _applySearch(list, search.value));

  overlay.querySelector('[data-duplicate]').addEventListener('click', async () => {
    const copy = await _offerCopy(view.themeId, { ask: false });
    if (copy) {
      view.themeId = copy.id;
      render();
    }
  });

  overlay.querySelector('[data-copy]').addEventListener('click', () => {
    openCopyColorsModal(view.themeId, view.mode, () => render());
  });

  render();
  openModal(overlay);

  const stopWatching = onModalClose(overlay, () => {
    stopWatching();
    closeColorPicker();
    view.cleanups.forEach(cleanup => cleanup());
    overlay.remove();
    _colorsOverlay = null;
  });
}

function _renderColors(overlay, view, render) {
  closeColorPicker();
  view.cleanups.forEach(cleanup => cleanup());
  view.cleanups = [];

  const theme = getAppTheme(view.themeId);
  const builtIn = isAppThemeBuiltIn(theme.id);
  const { mode } = view;

  overlay.querySelector('[data-modal-title]').textContent = `Theme colors: ${theme.name}`;
  overlay.querySelectorAll('[data-mode]').forEach(button =>
    button.classList.toggle('active', button.dataset.mode === mode));
  overlay.querySelector('[data-notice]').classList.toggle('hidden', !builtIn);
  // only custom themes can take colors, for built-in ones the button would only confuse
  overlay.querySelector('[data-copy]').classList.toggle('hidden', builtIn);

  const list = overlay.querySelector('[data-list]');
  list.innerHTML = APP_THEME_GROUPS.map(group => `
    <div class="app-theme-colors__group" data-group>
      <div class="app-theme-colors__group-title">${escapeHTML(group.name)}</div>
      ${group.colors.map(color => {
        const value = getAppThemeColor(theme, mode, color.var);
        const changed = !builtIn && value !== getAppThemeBaseColor(theme, mode, color.var);
        const search = `${group.name} ${color.name} ${_varLabel(color.var)}`.toLowerCase();
        return `
          <div class="app-theme-colors__row${changed ? ' app-theme-colors__row--changed' : ''}" data-var="${color.var}" data-search="${escapeHTML(search)}">
            <div class="app-theme-colors__text">
              <span class="app-theme-colors__name">${escapeHTML(color.name)}</span>
              ${_varHTML(color.var)}
            </div>
            <span class="app-theme-colors__value">${escapeHTML(value)}</span>
            <button type="button" class="color-swatch" data-swatch aria-label="${escapeHTML(color.name)}"></button>
            <button type="button" class="icon-button icon-button--small app-theme-colors__reset" data-reset title="Reset to the base theme"${builtIn ? ' disabled' : ''}>${RESET_ICON}</button>
          </div>`;
      }).join('')}
    </div>`).join('');

  list.querySelectorAll('[data-var]').forEach(row => {
    const name = row.dataset.var;
    const swatch = row.querySelector('[data-swatch]');
    setSwatchColor(swatch, getAppThemeColor(theme, mode, name));

    if (builtIn) {
      // read-only: a click offers an editable copy
      const onClick = async () => {
        const copy = await _offerCopy(view.themeId, { ask: true });
        if (copy) {
          view.themeId = copy.id;
          render();
        }
      };
      swatch.addEventListener('click', onClick);
      return;
    }

    view.cleanups.push(bindColorSwatch(swatch, {
      allowAlpha: true,
      onInput: value => {
        setAppThemeColor(theme.id, mode, name, value);
        row.querySelector('.app-theme-colors__value').textContent = value;
        row.classList.toggle('app-theme-colors__row--changed', value !== getAppThemeBaseColor(theme, mode, name));
      },
    }));

    row.querySelector('[data-reset]').addEventListener('click', () => {
      setAppThemeColor(theme.id, mode, name, null);
      const value = getAppThemeColor(theme, mode, name);
      setSwatchColor(swatch, value);
      row.querySelector('.app-theme-colors__value').textContent = value;
      row.classList.remove('app-theme-colors__row--changed');
    });
  });

  _applySearch(list, overlay.querySelector('[data-search]').value);
}

/** Duplicates a built-in theme (after asking) and selects the copy. */
async function _offerCopy(themeId, { ask }) {
  const theme = getAppTheme(themeId);
  if (ask) {
    const choice = await askChoice({
      title: 'Built-in theme',
      message: `"${theme.name}" can't be changed. Create a copy that you can edit?`,
      choices: [
        { id: 'cancel', label: 'Cancel' },
        { id: 'copy', label: 'Create copy', style: 'primary' },
      ],
    });
    if (choice !== 'copy')
      return null;
  }

  const name = await askAppThemeName({ title: 'Duplicate theme', value: `${theme.name} copy`, primaryLabel: 'Create' });
  if (!name)
    return null;
  const copy = duplicateAppTheme(themeId, name);
  setActiveAppTheme(copy.id);
  eventBus.emit('toast:show', { message: `Created "${copy.name}"`, type: 'success' });
  return copy;
}

/** Hides rows (and groups without rows) that don't contain the search text. */
function _applySearch(list, value) {
  const query = value.trim().toLowerCase();
  list.querySelectorAll('[data-group]').forEach(group => {
    let visible = 0;
    group.querySelectorAll('[data-search]').forEach(row => {
      const match = !query || row.dataset.search.includes(query);
      row.classList.toggle('hidden', !match);
      if (match)
        visible++;
    });
    group.classList.toggle('hidden', visible === 0);
  });
}

// ─── Copy colors from another theme ───────────────────────────────────────────

/**
 * Lets the user pick colors of another theme / variant and copies them into `targetId`.
 * @param {string} targetId - custom theme
 * @param {'dark'|'light'} targetMode
 * @param {() => void} [onCopied]
 */
export function openCopyColorsModal(targetId, targetMode, onCopied = null) {
  const target = getAppTheme(targetId);
  if (!target || isAppThemeBuiltIn(targetId))
    return;

  const sources = getAppThemes();
  const firstSource = sources.find(theme => theme.id !== targetId) ?? target;
  const selection = { sourceId: firstSource.id, sourceMode: targetMode };
  const cleanups = [];

  const overlay = buildStandardModal(`app-theme-copy-${Date.now()}`, {
    title: `Copy colors into "${target.name}" (${MODE_LABELS[targetMode]})`,
    wide: 'l',
    primaryLabel: 'Copy',
    zIndex: '1050',
    bodyHTML: `
      <div class="app-theme-colors">
        <div class="app-theme-colors__header">
          <label class="form-label" for="app-theme-copy-source">From</label>
          <select id="app-theme-copy-source" data-source>
            ${sources.map(theme => `<option value="${escapeHTML(theme.id)}">${escapeHTML(theme.name)}</option>`).join('')}
          </select>
          <select data-source-mode aria-label="Variant">
            ${APP_THEME_MODES.map(mode => `<option value="${mode}">${MODE_LABELS[mode]}</option>`).join('')}
          </select>
          <span class="app-theme-colors__count" data-count></span>
        </div>
        <div class="app-theme-colors__hint">Check a group to take all of its colors, then uncheck the ones you want to keep. Left: current color, right: the color you get.</div>
        <div class="app-theme-colors__list" data-list></div>
      </div>`,
    onPrimary: () => {
      const names = [...overlay.querySelectorAll('[data-color-check].checked')].map(check => check.dataset.colorCheck);
      if (!names.length) {
        eventBus.emit('toast:show', { message: 'No colors selected', type: 'info' });
        return;
      }
      copyAppThemeColors(targetId, targetMode, selection.sourceId, selection.sourceMode, names);
      closeModal(overlay);
      eventBus.emit('toast:show', { message: `Copied ${names.length} color${names.length === 1 ? '' : 's'}`, type: 'success' });
      onCopied?.();
    },
  });
  overlay.querySelector('.modal')?.classList.add('modal--fixed');

  const sourceSelect = overlay.querySelector('[data-source]');
  const modeSelect = overlay.querySelector('[data-source-mode]');
  sourceSelect.value = selection.sourceId;
  modeSelect.value = selection.sourceMode;

  const render = () => {
    cleanups.splice(0).forEach(cleanup => cleanup());
    _renderCopyList(overlay, target, targetMode, selection, cleanups);
  };
  sourceSelect.addEventListener('change', () => { selection.sourceId = sourceSelect.value; render(); });
  modeSelect.addEventListener('change', () => { selection.sourceMode = modeSelect.value; render(); });

  render();
  openModal(overlay);

  const stopWatching = onModalClose(overlay, () => {
    stopWatching();
    cleanups.forEach(cleanup => cleanup());
    overlay.remove();
  });
}

function _renderCopyList(overlay, target, targetMode, { sourceId, sourceMode }, cleanups) {
  const source = getAppTheme(sourceId);
  const list = overlay.querySelector('[data-list]');

  list.innerHTML = APP_THEME_GROUPS.map(group => `
    <div class="app-theme-colors__group" data-group="${group.id}">
      <div class="app-theme-colors__group-title app-theme-colors__group-title--check">
        <button type="button" class="checkbox-element" data-checkbox="false" data-group-check="${group.id}" aria-label="${escapeHTML(group.name)}"></button>
        <span>${escapeHTML(group.name)}</span>
      </div>
      ${group.colors.map(color => {
        const current = getAppThemeColor(target, targetMode, color.var);
        const next = getAppThemeColor(source, sourceMode, color.var);
        return `
          <div class="app-theme-colors__row app-theme-colors__row--copy${current === next ? ' app-theme-colors__row--same' : ''}">
            <button type="button" class="checkbox-element" data-checkbox="false" data-color-check="${color.var}" aria-label="${escapeHTML(color.name)}"></button>
            <div class="app-theme-colors__text">
              <span class="app-theme-colors__name">${escapeHTML(color.name)}</span>
              ${_varHTML(color.var)}
            </div>
            <span class="color-swatch color-swatch--static" data-preview="${escapeHTML(current)}"></span>
            <span class="app-theme-colors__arrow">→</span>
            <span class="color-swatch color-swatch--static" data-preview="${escapeHTML(next)}"></span>
          </div>`;
      }).join('')}
    </div>`).join('');

  list.querySelectorAll('[data-preview]').forEach(swatch => setSwatchColor(swatch, swatch.dataset.preview));

  // group checkbox <-> its colors
  let syncing = false;
  const updateCount = () => {
    const count = list.querySelectorAll('[data-color-check].checked').length;
    overlay.querySelector('[data-count]').textContent = count ? `${count} selected` : '';
  };
  const syncGroup = groupEl => {
    const checks = [...groupEl.querySelectorAll('[data-color-check]')];
    syncing = true;
    setCheckBox(groupEl.querySelector('[data-group-check]'), checks.length > 0 && checks.every(isCheckedBoxActive));
    syncing = false;
  };

  list.querySelectorAll('[data-group]').forEach(groupEl => {
    const groupCheck = groupEl.querySelector('[data-group-check]');
    cleanups.push(addCheckboxEventListener(groupCheck, checked => {
      if (syncing)
        return;
      syncing = true;
      groupEl.querySelectorAll('[data-color-check]').forEach(check => setCheckBox(check, checked));
      syncing = false;
      updateCount();
    }));
    groupEl.querySelectorAll('[data-color-check]').forEach(check => {
      cleanups.push(addCheckboxEventListener(check, () => {
        if (syncing)
          return;
        syncGroup(groupEl);
        updateCount();
      }));
    });
  });
  updateCount();
}
