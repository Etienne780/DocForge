import { BaseView } from '@core/BaseView.js';
import { state, getStateDefault, getStateNumber, NUMBER_RANGES } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { shortcutManager } from '@core/ShortcutManager.js';
import { viewManager } from '@core/ViewManager.js';
import { isPlatformWeb } from '@core/Platform.js';
import { escapeHTML } from '@common/Common.js';
import { openHotkeysModal } from '@common/HotkeysModal.js';
import { getFlashMixColor } from '@common/ColorFlash.js';
import { PREFERENCE_SECTIONS } from '@common/PreferencesNav.js';
import { setCheckBox, isCheckedBoxActive, addCheckboxEventListener } from '@common/UIUtils.js';
import { closeColorPicker } from '@common/ColorPicker.js';
import { askChoice } from '@common/BaseModals.js';
import { t } from '@core/i18n/I18n.js';
import { UI_LANGUAGES, UI_LANGUAGE_AUTO } from '@core/i18n/Languages.js';
import { eventBus } from '@core/EventBus.js';
import { FILE_EXTENSION_APP_THEME } from '@core/AppMeta.js';
import { openAppThemeColorsModal, askAppThemeName } from '@common/AppThemeModal.js';
import {
  getAppThemes,
  getActiveAppTheme,
  setActiveAppTheme,
  isAppThemeBuiltIn,
  duplicateAppTheme,
  renameAppTheme,
  deleteAppTheme,
  importAppTheme,
  exportAppTheme,
} from '@data/AppThemeManager.js';

/**
 * Settings that are one state key each. Every change is saved right away (state.set);
 * the reset button sets the default of DEFAULT_STATE (State.js).
 *
 * Texts: preferences.settings.<key>.label / .description / .options.<value> (core/i18n/strings)
 *
 * type: 'toggle' | 'select' (options) | 'number' / 'range' (NUMBER_RANGES, unit or unitKey, step)
 * options: values (text from .options.<value>) or a function that returns [value, label] pairs
 * unitKey: unit text from preferences.units.<unitKey>, unit: a unit that is not translated
 * apply(value): extra work after the change (e.g. the app theme attribute)
 */
const SETTINGS = [
  {
    // a change builds the views again in the new language (i18n:change, InitEvents.js)
    section: 'general', key: 'uiLanguage', type: 'select',
    options: () => [
      [UI_LANGUAGE_AUTO, t('preferences.settings.uiLanguage.options.auto')],
      ...UI_LANGUAGES.map(language => [language.id, language.name]),
    ],
  },
  {
    section: 'general', key: 'isDarkMode', type: 'toggle',
    apply: value => document.documentElement.setAttribute('data-theme', value ? 'dark' : 'light'),
  },
  {
    section: 'general', key: 'colorPickerMode', type: 'select',
    options: ['sv-square', 'hsl-wheel', 'hsl-sliders', 'rgb-sliders'],
  },
  {
    section: 'general', key: 'hideWebProjectLimitWarn', type: 'toggle', web: true,
  },
  {
    section: 'editor', key: 'projectEditorMode', type: 'select',
    options: ['split', 'editor', 'preview'],
  },
  {
    section: 'editor', key: 'docEditorWordWrapEnabled', type: 'toggle',
  },
  {
    section: 'editor', key: 'rememberEntryScroll', type: 'toggle',
  },
  {
    section: 'editor', key: 'defaultTabSize', type: 'number', unitKey: 'spaces',
  },
  {
    section: 'editor', key: 'historySize', type: 'number', unitKey: 'steps',
  },
  {
    section: 'theme-editor', key: 'themePreviewHighlightAmount', type: 'range', unit: '%', step: 1,
  },
  {
    section: 'theme-editor', key: 'themePreviewHighlightDuration', type: 'range', unit: 'ms', step: 100,
  },
];

const _settingLabel = setting => t(`preferences.settings.${setting.key}.label`);
const _settingDescription = setting => t(`preferences.settings.${setting.key}.description`);
const _settingUnit = setting => setting.unitKey ? t(`preferences.units.${setting.unitKey}`) : (setting.unit ?? '');
/** [value, label] pairs of a select setting. */
const _settingOptions = setting => typeof setting.options === 'function'
  ? setting.options()
  : setting.options.map(value => [value, t(`preferences.settings.${setting.key}.options.${value}`)]);

const SECTION_DESCRIPTIONS = {
};

const RESET_ICON = '↺';

/** Sample colors of the highlight preview (theme editor section), taken from the app colors. */
const FLASH_PREVIEW_COLORS = [
  { id: 'background', source: '--background' },
  { id: 'heading',    source: '--editor-color-heading' },
  { id: 'text',       source: '--text-primary' },
  { id: 'link',       source: '--link-color' },
];
/** Stands for the link in the sample text until the escaped text gets the link element. */
const FLASH_PREVIEW_LINK_MARKER = '%%link%%';
const FLASH_PREVIEW_VAR = '--pref-flash-amount';

/** Track fill of a .range-input up to its value (main.css). */
function _setRangeFill(slider) {
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 100;
  const percent = max > min ? ((Number(slider.value) - min) / (max - min)) * 100 : 0;
  slider.style.setProperty('--range-fill', `${Math.min(Math.max(percent, 0), 100)}%`);
}

export class PreferencesView extends BaseView {
  static viewId = 'preferences';

  _viewPath() {
    return this._buildBasePath(this.constructor.viewId);
  }

  async mount() {
    this._previousRoute = viewManager.getPreviousRoute();
    this._cleanups = [];

    session.set('navContext', { path: [{ label: t('preferences.title') }] });
    shortcutManager.setContext('preferences');

    this._renderNav();
    this._renderContent();
    this._setupEvents();

    this.subscribe('preferences:show-section', ({ section }) => this._showSection(section));
    // changed in the hotkeys modal
    this._cleanups.push(shortcutManager.onChange(() => this._renderSection('hotkeys')));
    // themes added, renamed, deleted
    this.subscribe('appThemes:change', () => this._renderSection('app-theme'));
    // changed elsewhere (title bar mode button, editor toolbar, ...)
    this.subscribe('state:change', ({ key }) => {
      if (key === 'appThemeId')
        this._renderSection('app-theme');
      if (SETTINGS.some(setting => setting.key === key))
        this._syncSetting(key);
      if (key === 'themePreviewHighlightAmount' || key === 'themePreviewHighlightDuration')
        this._playFlashPreview();
      // the preview copies the app colors
      if (key === 'appThemeId' || key === 'isDarkMode')
        this._renderSection('theme-editor');
    });
  }

  async onLoad() {
    this._showSection(this.props.section ?? null, { smooth: false });
  }

  onDestroy() {
    closeColorPicker();
    this._flashPreview?.animation?.cancel();
    this._cleanups.forEach(cleanup => cleanup());
  }

  // ─── Layout ────────────────────────────────────────────────────────────────

  _renderNav() {
    this.element('preferences_nav').innerHTML = PREFERENCE_SECTIONS
      .map(({ id, label }) => `<button type="button" class="preferences__nav-item" data-section="${id}">${escapeHTML(label)}</button>`)
      .join('');
  }

  _renderContent() {
    this.element('preferences_content').innerHTML = PREFERENCE_SECTIONS
      .map(({ id, label }) => `
        <section class="preferences__section" data-section-id="${id}">
          <h2 class="preferences__section-title">${escapeHTML(label)}</h2>
          ${SECTION_DESCRIPTIONS[id] ? `<div class="preferences__description">${escapeHTML(SECTION_DESCRIPTIONS[id])}</div>` : ''}
          <div class="preferences__section-body" data-section-body="${id}"></div>
        </section>`)
      .join('');

    for (const { id } of PREFERENCE_SECTIONS)
      this._renderSection(id);
  }

  _renderSection(id) {
    const body = this.element('preferences_content').querySelector(`[data-section-body="${id}"]`);
    if (!body)
      return;

    this._cleanupSection(id);
    if (id === 'app-theme')
      this._renderAppTheme(body);
    else if (id === 'hotkeys')
      this._renderHotkeys(body);
    else
      this._renderSettings(body, id);

    this._applySearch();
  }

  _cleanupSection(id) {
    this._sectionCleanups ??= {};
    (this._sectionCleanups[id] ?? []).forEach(cleanup => cleanup());
    this._sectionCleanups[id] = [];
  }

  _onSectionCleanup(id, cleanup) {
    this._sectionCleanups[id].push(cleanup);
  }

  _setupEvents() {
    this.element('preferences_nav').addEventListener('click', event => {
      const item = event.target.closest('[data-section]');
      if (item)
        this._showSection(item.dataset.section);
    });

    this.element('preferences_back').addEventListener('click', () => this._goBack());

    const search = this.element('preferences_search');
    search.addEventListener('input', () => this._applySearch());

    const content = this.element('preferences_content');
    content.addEventListener('scroll', () => this._updateActiveNav());
  }

  _goBack() {
    const route = this._previousRoute;
    if (route && route.event !== 'navigate:preferences')
      viewManager.show(route.event, route.props ?? {});
    else
      viewManager.show('navigate:projectHub');
  }

  _showSection(id, { smooth = true } = {}) {
    const content = this.element('preferences_content');
    const section = id ? content.querySelector(`[data-section-id="${id}"]`) : null;
    content.scrollTo({ top: section ? section.offsetTop - content.offsetTop : 0, behavior: smooth ? 'smooth' : 'auto' });
    this._setActiveNav(id ?? PREFERENCE_SECTIONS[0].id);
  }

  _updateActiveNav() {
    const content = this.element('preferences_content');
    const top = content.scrollTop + 40;
    let active = PREFERENCE_SECTIONS[0].id;
    for (const section of content.querySelectorAll('[data-section-id]')) {
      if (section.offsetTop - content.offsetTop <= top && !section.classList.contains('hidden'))
        active = section.dataset.sectionId;
    }
    // at the very end the last section is active, even if it is short
    if (content.scrollTop + content.clientHeight >= content.scrollHeight - 2) {
      const visible = [...content.querySelectorAll('[data-section-id]:not(.hidden)')];
      active = visible.at(-1)?.dataset.sectionId ?? active;
    }
    this._setActiveNav(active);
  }

  _setActiveNav(id) {
    this.element('preferences_nav').querySelectorAll('[data-section]').forEach(item =>
      item.classList.toggle('preferences__nav-item--active', item.dataset.section === id));
  }

  /** Hides rows (and sections without rows) that don't contain the search text. */
  _applySearch() {
    const query = this.element('preferences_search')?.value.trim().toLowerCase() ?? '';
    const content = this.element('preferences_content');

    for (const section of content.querySelectorAll('[data-section-id]')) {
      let visible = 0;
      section.querySelectorAll('[data-search]').forEach(row => {
        const match = !query || row.dataset.search.includes(query);
        row.classList.toggle('hidden', !match);
        if (match)
          visible++;
      });
      section.classList.toggle('hidden', Boolean(query) && visible === 0);
    }
  }

  // ─── Rows ──────────────────────────────────────────────────────────────────

  _rowHTML({ id, label, name = '', description = '', controlHTML, changed = false, conflict = '' }) {
    const search = `${label} ${name} ${description}`.toLowerCase();
    return `
      <div class="preferences__row${changed ? ' preferences__row--changed' : ''}" data-row="${escapeHTML(id)}" data-search="${escapeHTML(search)}">
        <div class="preferences__text">
          <div class="preferences__label">${escapeHTML(label)}${name ? `<span class="preferences__name">${escapeHTML(name)}</span>` : ''}</div>
          ${description ? `<div class="preferences__description">${escapeHTML(description)}</div>` : ''}
          ${conflict ? `<div class="preferences__conflict">${escapeHTML(conflict)}</div>` : ''}
        </div>
        <div class="preferences__control">${controlHTML}</div>
        <button type="button" class="icon-button icon-button--small preferences__reset" data-reset title="${escapeHTML(t('preferences.reset'))}">${RESET_ICON}</button>
      </div>`;
  }

  // ─── Simple settings (one state key) ───────────────────────────────────────

  _renderSettings(body, sectionId) {
    const settings = SETTINGS.filter(setting => setting.section === sectionId && (!setting.web || isPlatformWeb()));
    body.innerHTML = settings.map(setting => this._rowHTML({
      id: setting.key,
      label: _settingLabel(setting),
      description: _settingDescription(setting),
      controlHTML: this._controlHTML(setting),
    })).join('') || `<div class="preferences__empty">${escapeHTML(t('preferences.empty'))}</div>`;

    for (const setting of settings) {
      const row = body.querySelector(`[data-row="${setting.key}"]`);
      this._bindSetting(row, setting, sectionId);
      this._syncSetting(setting.key);
    }

    if (sectionId === 'theme-editor')
      this._renderFlashPreview(body);
  }

  // ─── Theme editor: preview of the color highlight ─────────────────────────

  /**
   * A small sample like the theme editor: a list of colors and a text that uses them.
   * One color always pulses with the current strength / speed (so a change is visible
   * while dragging the slider), hovering another color in the list pulses that one.
   */
  _renderFlashPreview(body) {
    const colors = FLASH_PREVIEW_COLORS;
    const preview = document.createElement('div');
    preview.className = 'preferences__flash';
    preview.setAttribute('data-search', t('preferences.flashPreview.search'));
    const linkHTML = `<span class="preferences__flash-link" data-flash-target="link">${escapeHTML(t('preferences.flashPreview.link'))}</span>`;
    const textHTML = escapeHTML(t('preferences.flashPreview.text', { link: FLASH_PREVIEW_LINK_MARKER }))
      .replace(FLASH_PREVIEW_LINK_MARKER, linkHTML);
    preview.innerHTML = `
      <div class="preferences__flash-colors">
        <span class="preferences__flash-label">${escapeHTML(t('preferences.flashPreview.label'))}</span>
        ${colors.map(color => `
          <span class="preferences__flash-color" data-flash-color="${color.id}">
            <span class="preferences__flash-swatch" data-flash-swatch="${color.id}"></span>${escapeHTML(t(`preferences.flashPreview.colors.${color.id}`))}
          </span>`).join('')}
      </div>
      <div class="preferences__flash-sample" data-flash-sample data-flash-target="background">
        <span class="preferences__flash-heading" data-flash-target="heading">${escapeHTML(t('preferences.flashPreview.heading'))}</span>
        <span class="preferences__flash-text" data-flash-target="text">${textHTML}</span>
      </div>`;
    body.append(preview);

    // the sample colors are copies of app colors, so the pulse only changes the preview
    const sample = preview.querySelector('[data-flash-sample]');
    const appStyle = getComputedStyle(document.documentElement);
    for (const color of colors) {
      const value = appStyle.getPropertyValue(color.source).trim();
      sample.style.setProperty(`--flash-${color.id}`, value);
      // white, or black for light colors (like the theme editor preview)
      sample.style.setProperty(`--flash-${color.id}-mix`, getFlashMixColor(value));
      preview.querySelector(`[data-flash-swatch="${color.id}"]`).style.setProperty('--flash-swatch', value);
    }

    // a clicked color keeps pulsing (also while the values are changed), hover shows another one
    // for a moment; the choice survives a rebuild (theme / mode change)
    this._flashSelected ??= colors[0].id;
    this._flashPreview = { sample, active: this._flashSelected, animation: null };
    preview.querySelectorAll('[data-flash-color]').forEach(item => {
      item.addEventListener('click', () => {
        this._flashSelected = item.dataset.flashColor;
        this._setFlashTarget(this._flashSelected, { force: true });
      });
      item.addEventListener('mouseenter', () => this._setFlashTarget(item.dataset.flashColor));
      item.addEventListener('mouseleave', () => this._setFlashTarget(this._flashSelected));
    });
    this._playFlashPreview();
  }

  _setFlashTarget(id, { force = false } = {}) {
    if (!this._flashPreview || (this._flashPreview.active === id && !force))
      return;
    this._flashPreview.active = id;
    this._playFlashPreview();
  }

  /** Same pulse as DocThemePreview: the color mixed with white, animated in a loop. */
  _playFlashPreview() {
    const preview = this._flashPreview;
    if (!preview?.sample.isConnected)
      return;

    preview.animation?.cancel();
    preview.animation = null;
    // the sample itself is the 'background' target
    [preview.sample, ...preview.sample.querySelectorAll('[data-flash-target]')].forEach(el =>
      el.classList.toggle('preferences__flash--active', el.dataset.flashTarget === preview.active));
    preview.sample.parentElement.querySelectorAll('[data-flash-color]').forEach(el => {
      el.classList.toggle('preferences__flash-color--active', el.dataset.flashColor === preview.active);
      el.classList.toggle('preferences__flash-color--selected', el.dataset.flashColor === this._flashSelected);
    });

    const amount = getStateNumber('themePreviewHighlightAmount');
    if (amount <= 0)
      return;

    try {
      CSS.registerProperty({ name: FLASH_PREVIEW_VAR, syntax: '<percentage>', inherits: true, initialValue: '0%' });
    } catch (e) {
      // already registered
    }
    preview.animation = preview.sample.animate(
      [{ [FLASH_PREVIEW_VAR]: '0%' }, { [FLASH_PREVIEW_VAR]: `${amount}%` }],
      { duration: getStateNumber('themePreviewHighlightDuration'), direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' },
    );
  }

  _controlHTML(setting) {
    const range = NUMBER_RANGES[setting.key] ?? {};
    const unitText = _settingUnit(setting);
    const unit = unitText ? `<span class="preferences__unit">${escapeHTML(unitText)}</span>` : '';
    const ariaLabel = escapeHTML(_settingLabel(setting));

    switch (setting.type) {
      case 'toggle':
        return `<button type="button" class="checkbox-element" data-checkbox="false" data-control aria-label="${ariaLabel}"></button>`;
      case 'select':
        return `<select data-control aria-label="${ariaLabel}">${_settingOptions(setting)
          .map(([value, label]) => `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`).join('')}</select>`;
      case 'number':
        return `<input type="number" class="form-input preferences__number" data-control min="${range.min ?? ''}" max="${range.max ?? ''}" step="${setting.step ?? 1}" aria-label="${ariaLabel}">${unit}`;
      case 'range':
        return `<input type="range" class="range-input preferences__range" data-control-range min="${range.min ?? 0}" max="${range.max ?? 100}" step="${setting.step ?? 1}" aria-label="${ariaLabel}">`
          + `<input type="number" class="form-input preferences__number" data-control min="${range.min ?? ''}" max="${range.max ?? ''}" step="${setting.step ?? 1}" aria-label="${ariaLabel}">${unit}`;
      default:
        return '';
    }
  }

  _bindSetting(row, setting, sectionId) {
    const control = row.querySelector('[data-control]');
    const slider = row.querySelector('[data-control-range]');

    const save = value => {
      if (state.get(setting.key) === value)
        return;
      state.set(setting.key, value);
      setting.apply?.(value);
    };

    if (setting.type === 'toggle') {
      this._onSectionCleanup(sectionId, addCheckboxEventListener(control, checked => save(checked)));
    } else if (setting.type === 'select') {
      control.addEventListener('change', () => save(control.value));
    } else {
      const range = NUMBER_RANGES[setting.key] ?? {};
      const commit = raw => {
        const value = Number(raw);
        if (!Number.isFinite(value))
          return this._syncSetting(setting.key);
        save(Math.min(Math.max(value, range.min ?? value), range.max ?? value));
        this._syncSetting(setting.key);
      };
      control.addEventListener('change', () => commit(control.value));
      slider?.addEventListener('input', () => {
        control.value = slider.value;
        _setRangeFill(slider);
        save(Number(slider.value));
        row.classList.toggle('preferences__row--changed', state.get(setting.key) !== getStateDefault(setting.key));
      });
    }

    row.querySelector('[data-reset]').addEventListener('click', () => {
      save(getStateDefault(setting.key));
      this._syncSetting(setting.key);
    });
  }

  /** Shows the current value of a setting (also after it changed elsewhere). */
  _syncSetting(key) {
    const setting = SETTINGS.find(s => s.key === key);
    const row = this.element('preferences_content')?.querySelector(`[data-row="${key}"]`);
    if (!setting || !row)
      return;

    const value = state.get(key);
    const control = row.querySelector('[data-control]');
    if (setting.type === 'toggle')
      setCheckBox(control, Boolean(value));
    else if (document.activeElement !== control)
      control.value = String(value);

    const slider = row.querySelector('[data-control-range]');
    if (slider) {
      slider.value = String(value);
      _setRangeFill(slider);
    }

    row.classList.toggle('preferences__row--changed', value !== getStateDefault(key));
  }

  // ─── App theme ─────────────────────────────────────────────────────────────

  _renderAppTheme(body) {
    const active = getActiveAppTheme();
    const builtIn = isAppThemeBuiltIn(active.id);
    const themes = getAppThemes();
    const option = theme => `<option value="${escapeHTML(theme.id)}"${theme.id === active.id ? ' selected' : ''}>${escapeHTML(theme.name)}</option>`;
    const custom = themes.filter(theme => !isAppThemeBuiltIn(theme.id));

    const text = key => escapeHTML(t(`preferences.appTheme.${key}`));
    const selectHTML = `
      <select data-theme-select aria-label="${text('selectLabel')}">
        <optgroup label="${text('groupBuiltIn')}">${themes.filter(theme => isAppThemeBuiltIn(theme.id)).map(option).join('')}</optgroup>
        ${custom.length ? `<optgroup label="${text('groupCustom')}">${custom.map(option).join('')}</optgroup>` : ''}
      </select>`;

    const storage = t(isPlatformWeb() ? 'preferences.appTheme.storageWeb' : 'preferences.appTheme.storageDesktop');

    body.innerHTML = `
      ${this._rowHTML({
        id: 'app-theme',
        label: t('preferences.appTheme.label'),
        description: t('preferences.appTheme.description'),
        controlHTML: selectHTML,
      })}
      ${this._rowHTML({
        id: 'app-theme-actions',
        label: t(builtIn ? 'preferences.appTheme.builtInLabel' : 'preferences.appTheme.customLabel'),
        description: builtIn ? `${t('preferences.appTheme.builtInNote')} ${storage}` : storage,
        controlHTML: `
          <button type="button" class="button button--secondary" data-theme-action="edit">${text(builtIn ? 'showColors' : 'editColors')}</button>
          <button type="button" class="button button--secondary" data-theme-action="duplicate">${text('duplicate')}</button>
          <button type="button" class="button button--secondary" data-theme-action="rename"${builtIn ? ' disabled' : ''}>${text('rename')}</button>
          <button type="button" class="button button--danger" data-theme-action="delete"${builtIn ? ' disabled' : ''}>${text('delete')}</button>`,
      })}
      ${this._rowHTML({
        id: 'app-theme-files',
        label: t('preferences.appTheme.filesLabel'),
        description: t('preferences.appTheme.filesDescription', { extension: FILE_EXTENSION_APP_THEME }),
        controlHTML: `
          <button type="button" class="button button--secondary" data-theme-action="import">${text('import')}</button>
          <button type="button" class="button button--secondary" data-theme-action="export">${text('export')}</button>`,
      })}`;

    body.querySelector('[data-theme-select]').addEventListener('change', event => setActiveAppTheme(event.target.value));
    body.querySelectorAll('[data-theme-action]').forEach(button =>
      button.addEventListener('click', () => this._themeAction(button.dataset.themeAction, active)));
  }

  async _themeAction(action, theme) {
    switch (action) {
      case 'edit':
        openAppThemeColorsModal(theme.id);
        break;
      case 'duplicate': {
        const name = await askAppThemeName({
          title: t('preferences.appTheme.duplicateTitle'),
          value: t('preferences.appTheme.duplicateName', { name: theme.name }),
          primaryLabel: t('preferences.appTheme.create'),
        });
        if (name)
          setActiveAppTheme(duplicateAppTheme(theme.id, name).id);
        break;
      }
      case 'rename': {
        const name = await askAppThemeName({ title: t('preferences.appTheme.renameTitle'), value: theme.name });
        if (name)
          renameAppTheme(theme.id, name);
        break;
      }
      case 'delete': {
        const choice = await askChoice({
          title: t('preferences.appTheme.deleteTitle'),
          message: t('preferences.appTheme.deleteMessage', { name: theme.name }),
          choices: [
            { id: 'cancel', label: t('preferences.appTheme.cancel') },
            { id: 'delete', label: t('preferences.appTheme.delete'), style: 'danger' },
          ],
        });
        if (choice === 'delete')
          await deleteAppTheme(theme.id);
        break;
      }
      case 'import': {
        const imported = await importAppTheme();
        if (imported) {
          setActiveAppTheme(imported.id);
          eventBus.emit('toast:show', { message: t('preferences.appTheme.imported', { name: imported.name }), type: 'success' });
        } else if (imported === null) {
          // canceled or not an app theme file
        }
        break;
      }
      case 'export':
        await exportAppTheme(theme.id);
        break;
    }
  }

  // ─── Hotkeys (own modal) ───────────────────────────────────────────────────

  _renderHotkeys(body) {
    const changed = Object.keys(shortcutManager.getOverrides()).length;
    body.innerHTML = this._rowHTML({
      id: 'hotkeys',
      label: t('preferences.hotkeys.label'),
      description: changed
        ? t('preferences.hotkeys.changed', { count: changed })
        : t('preferences.hotkeys.unchanged'),
      controlHTML: `<button type="button" class="button button--secondary" data-open-hotkeys>${escapeHTML(t('preferences.hotkeys.edit'))}</button>`,
    });
    body.querySelector('[data-open-hotkeys]').addEventListener('click', () => openHotkeysModal());
  }

}
