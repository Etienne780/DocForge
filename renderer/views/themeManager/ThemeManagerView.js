import { BaseView } from '@core/BaseView.js';
import { shortcutManager } from '@core/ShortcutManager';
import { session } from '@core/SessionState.js';
import {
  themeSectionName,
  langSectionName,
  buildSectionModal, 
  openThemeSectionModal, 
  openLangSectionModal,
  closeThemeSectionModal,
  closeLangSectionModal 
} from './components/helpers/SectionModalHelper.js';

export class ThemeManagerView extends BaseView {

  _viewPath() {
    return 'views/themeManager/ThemeManagerView';
  }

  async mount(componentLoader) {
    const viewPrefix = `${this._getViewPath()}/components`;
    // viewPrefix = 'views/docThemeEditor/components'
  
    const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/docThemeCards/DocThemeCards`, this.slot('docThemeCards')),
      componentLoader.load(`${viewPrefix}/languageThemeCards/LanguageThemeCards`, this.slot('languageThemeCards')),
      componentLoader.load('SortingActions', this.slot('themeSortContainer'), { target: 'themeSortAction', type: 'state' }),
    ]);

    this._instanceIds = instances.map(i => i.instanceId);

    shortcutManager.setContext('themeManager');
    this._buildModals();
    this._setupElementEvents();

    const refreshDisplay = (value) => {
      this._updateDisplaSection(value);
      this._renderSelectedThemeSection(value)
    };

    refreshDisplay();
    this.subscribe('session:change:themeManagerDisplay', ({value}) => refreshDisplay(value));
    this.subscribe(`themeManager:openModal:${themeSectionName}`, ({ id }) => this._openSectionModal(themeSectionName, id));
    this.subscribe(`themeManager:openModal:${langSectionName}`, ({ id }) => this._openSectionModal(langSectionName, id));
  }

  onDestroy() {
    [this._themeModal, this._langModal]
      .forEach(el => el?.remove());
  }

  _setupElementEvents() {
    // ── Search ───────────────────────────────────────────────────────────────
    session.set('themeSearchQuery', '');
    document.getElementById('theme-manager_search-input').addEventListener('input', event => {
      session.set('themeSearchQuery', event.target.value);
    });

    // ── sidebar ───────────────────────────────────────────────────────────────
    this.element('theme-manager_sidebar').addEventListener('click', event => {
      const target = event.target.closest('[data-display-option]');
      if(!target)
        return;

      event.stopPropagation();
      const op = target.dataset.displayOption;
      session.set('themeManagerDisplay', op);
    });
  }

  _buildModals() {
    const modals = buildSectionModal(
      'theme-manager_theme-open-modal',
      'theme-manager_lang-open-modal'
    );

    this._themeModal = modals.theme;
    this._langModal = modals.lang;
  }

  _updateDisplaSection(value) {
    const type = value ?? session.get('themeManagerDisplay');

    const active = 'theme-manager_slot-active';
    const doc = document.querySelector('[data-slot="docThemeCards"]');
    const lan = document.querySelector('[data-slot="languageThemeCards"]');

    switch(type) {
      case 'all':
        doc.classList.add(active);
        lan.classList.add(active);
        break;
      case 'doc':
        doc.classList.add(active);
        lan.classList.remove(active);
        break;
      case 'lan':
        doc.classList.remove(active);
        lan.classList.add(active);
        break;
    }
  }

  _renderSelectedThemeSection(value) {
    const type = value ?? session.get('themeManagerDisplay');
    const parent = this.element('theme-manager_sidebar');
    Array.from(parent.children).forEach(el => {
      if(el.dataset.displayOption === type)
        el.classList.add('icon-button--active');
      else
        el.classList.remove('icon-button--active');
    });
  }

  _openSectionModal(section, id) {
    if (section === themeSectionName) {
      closeLangSectionModal(this._langModal);
      openThemeSectionModal(this._themeModal, id);
    } else if (section === langSectionName) {
      closeThemeSectionModal(this._themeModal);
      openLangSectionModal(this._langModal, id);
    }
  }
}