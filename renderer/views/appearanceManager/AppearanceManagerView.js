import { BaseView } from '@core/BaseView.js';
import { shortcutManager } from '@core/ShortcutManager';
import { session } from '@core/SessionState.js';
import { setCardState } from '@common/ThemeCardHelper.js';
import { getOpenProject } from '@data/ProjectManager.js';
import { 
  getFourSquaresEmptyIcon,
  getDocFileWithContentIcon,
  getTerminalIcon,
  getArrowDownIcon
} from '@ui/Icon.js';
import {
  themeSectionName,
  langSectionName,
  styleListSectionName,
  buildSectionModal,
  openThemeSectionModal,
  openLangSectionModal,
  openStyleListSectionModal,
  closeThemeSectionModal,
  closeLangSectionModal,
} from './components/helpers/SectionModalHelper.js';

const TABS = [
  { id: 'all',  label: 'All',   icon: () => getFourSquaresEmptyIcon() },
  { id: 'doc',  label: 'Doc',   icon: () => getDocFileWithContentIcon() },
  { id: 'lan',  label: 'Lang',  icon: () => getTerminalIcon() },
];

export class AppearanceManagerView extends BaseView {
  static viewId = 'appearanceManager';

  _viewPath() {
    return this._buildBasePath(this.constructor.viewId);
  }

  async mount(componentLoader) {
    this._project = getOpenProject();
    const viewPrefix = `${this._getViewPath()}/components`;

    const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/docThemeCards/DocThemeCards`, this.slot('docThemeCards'), { project: this._project }),
      componentLoader.load(`${viewPrefix}/languageThemeCards/LanguageThemeCards`, this.slot('languageThemeCards'), { project: this._project }),
      componentLoader.load('SortingActions', this.slot('themeSortContainer'), { target: 'appereanceSortAction', type: 'state' }),
    ]);

    this._instanceIds = instances.map(i => i.instanceId);

    shortcutManager.setContext('appearanceManager');
    this._buildModals();
    this._renderSidebarTabs();
    this._setupElementEvents();

    const refreshDisplay = (value) => {
      this._updateDisplaySection(value);
      this._renderSelectedTab(value);
    };

    refreshDisplay(session.get('appearanceManagerDisplay') ?? 'all');

    this.subscribe('session:change:appearanceManagerDisplay', ({ value }) => refreshDisplay(value));

    this.subscribe(`appearanceManager:openModal:${themeSectionName}`, ({ id, builtIn }) => this._openSectionModal(themeSectionName, id, builtIn));
    this.subscribe(`appearanceManager:openModal:${langSectionName}`,  ({ id, builtIn }) => this._openSectionModal(langSectionName, id, builtIn));
    this.subscribe(`appearanceManager:openModal:${styleListSectionName}`, ({ id }) => this._openStyleListModal(id));
  }

  onDestroy() {
    [this._themeModal, this._langModal, this._styleModal, this._styleListModal].forEach(el => el?.remove());
  }

  _setupElementEvents() {
    session.set('themeSearchQuery', '');
    document.getElementById('appearance-manager_search-input').addEventListener('input', event => {
      session.set('themeSearchQuery', event.target.value);
    });

    this.element('appearance-manager_sidebar').addEventListener('click', event => {
      const target = event.target.closest('[data-display-option]');
      if (!target)
        return;

      event.stopPropagation();
      session.set('appearanceManagerDisplay', target.dataset.displayOption);
    });
  }

  // ─── Sidebar tabs ─────────────────────────────────────────────────────────

  _renderSidebarTabs() {
    const sidebar = this.element('appearance-manager_sidebar');
    const current = session.get('appearanceManagerDisplay') ?? 'all';

    sidebar.innerHTML = TABS.map(tab => `
      <div class="icon-button icon-button--large${tab.id === current ? ' icon-button--active' : ''}" data-display-option="${tab.id}">
        ${tab.icon?.()}
        <span>${tab.label}</span>
      </div>`
    ).join('');

    if (!TABS.some(t => t.id === current))
      session.set('appearanceManagerDisplay', 'all');
  }

  // ─── Display switching ────────────────────────────────────────────────────

  _updateDisplaySection(value) {
    const active = 'appearance-manager_slot-active';
    const slots = {
      all:   ['docThemeCards', 'languageThemeCards'],
      doc:   ['docThemeCards'],
      lan:   ['languageThemeCards'],
    };

    ['docThemeCards', 'languageThemeCards'].forEach(name => {
      document.querySelector(`[data-slot="${name}"]`)?.classList.remove(active);
    });

    (slots[value] ?? slots.all).forEach(name => {
      document.querySelector(`[data-slot="${name}"]`)?.classList.add(active);
    });
  }

  _renderSelectedTab(value) {
    const parent = this.element('appearance-manager_sidebar');
    Array.from(parent.children).forEach(el => {
      el.classList.toggle('icon-button--active', el.dataset.displayOption === value);
    });
  }

  // ─── Modals ───────────────────────────────────────────────────────────────

  _buildModals() {
    const modals = buildSectionModal(
      'appearance-manager_theme-open-modal',
      'appearance-manager_lang-open-modal',
      'appearance-manager_lang-style-open-modal',
      'appearance-manager_lang-style-list-modal',
    );

    this._themeModal = modals.theme;
    this._langModal = modals.lang;
    this._styleModal = modals.style;
    this._styleListModal = modals.styleList;
  }

  _openSectionModal(section, id, builtIn) {
    this._setCardState(id, true);
    closeThemeSectionModal(this._themeModal);
    closeLangSectionModal(this._langModal);

    const resetCb = () => this._setCardState(id, false);

    if (section === themeSectionName)
      openThemeSectionModal(this._themeModal, this._project, id, builtIn, resetCb);
    else if (section === langSectionName)
      openLangSectionModal(this._langModal, this._project, id, builtIn, resetCb);
  }

  _openStyleListModal(langId) {
    openStyleListSectionModal(this._styleListModal, this._project, langId);
  }

  _setCardState(id, active) {
    setCardState(active, this.container, [
      `[data-theme-id="${id}"]`,
      `[data-lang-id="${id}"]`
    ]);
  }
}