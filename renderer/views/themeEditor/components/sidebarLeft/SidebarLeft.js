import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { ResizeController } from '@core/ResizeController';
import { buildConfirmModal, openModal, closeModal  } from '@core/ModalBuilder.js';
import { selectTab } from '@common/UIUtils.js';
import { findDocTheme, resetLanguageStyleIds } from '@data/DocThemeManager.js';
import { getOpenProject } from '@data/ProjectManager.js';
import { resetThemeContent, removeCheckboxEventListener } from './components/helper/ThemeContentHelper.js';
import { t } from '@core/i18n/I18n.js';

// settings tabs in their order (data-tab-action, also the `tab-element_<name>` ids)
const CONTENT_TABS = ['appearance', 'layout', 'spacing', 'mapping'];

export default class SidebarLeft extends Component {

  async onLoad() {
    this._activeTheme = this.props.theme;
    this._resize = new ResizeController(this.container, { 
      minSize: 150,
      maxSize: 500,
      keepRatio: false,
      direction: 'right',
    });

    const path = this.componentPath;
    const instances = await Promise.all([
      componentLoader.load(`${path}/contentAppearance/ContentAppearance`, this.element('content-appearance'), { theme: this._activeTheme }),
      componentLoader.load(`${path}/contentLayout/ContentLayout`, this.element('content-layout'), { theme: this._activeTheme }),
      componentLoader.load(`${path}/contentSpacing/ContentSpacing`, this.element('content-spacing'), { theme: this._activeTheme }),
      componentLoader.load(`${path}/contentMapping/ContentMapping`, this.element('content-mapping'), { theme: this._activeTheme }),
    ]);

    this._instanceIds = instances.map(i => i.instanceId);
    this._selectedContent = 'appearance';

    this._buildResetConfirmationModal();
    this._setupElementEvents();
    // ThemeEditor:tab* shortcuts: { tab } opens that tab, { direction } the next / previous one (wraps)
    this.subscribe('themeEditor:settings-tab', ({ tab = null, direction = 1 } = {}) => {
      const index = CONTENT_TABS.indexOf(this._selectedContent);
      this._clickContentTab(tab ?? CONTENT_TABS[(index + direction + CONTENT_TABS.length) % CONTENT_TABS.length]);
    });

    // select default tab
    this._selectContentTab(this._selectedContent);
    const childElement = this.element('tab-element_appearance');
    selectTab({
      element: childElement,
      tabAction: this._selectedContent,
      isParent: false,
    });
  }

  onDestroy() {
    removeCheckboxEventListener();
    this._resize.destroy();
    this._instanceIds.forEach(id => componentLoader.destroy(id));
    this._resetConfirmationModal?.remove();
  }

  _setupElementEvents() {
    // ── Tab elements ──────────────────────────────────────────────────────
    const tabHeader = this.element('tab-element_container');
    tabHeader.addEventListener('wheel', (e) => {
      if (e.deltaY === 0)
        return;
    
      e.preventDefault(); // prevent vertical scroll
      tabHeader.scrollBy({
        left: e.deltaY,
        behavior: 'smooth'
      });
    }, { passive: false });

    this.element('tab-element_appearance').addEventListener('click', () => {
      this._selectContentTab('appearance');
    });

    this.element('tab-element_layout').addEventListener('click', () => {
      this._selectContentTab('layout');
    });

    this.element('tab-element_spacing').addEventListener('click', () => {
      this._selectContentTab('spacing');
    });

    this.element('tab-element_mapping').addEventListener('click', () => {
      this._selectContentTab('mapping');
    });

    // ── reset ──────────────────────────────────────────────────────
    this.element('theme-editor_reset-button').addEventListener('click', () => {
      this._openResetConfirmationModal();
    });
  }

  /** Opens a settings tab like a click on its button (marks it active, scrolls it into view). */
  _clickContentTab(content) {
    const button = this.element(`tab-element_${content}`);
    if (!button)
      return;
    button.click();
    button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  _selectContentTab(content) {
    const elements = this.queryAll('.theme-editor_sidebarLeft-content-slot');
    this._selectedContent = content;

    elements.forEach(el => {
      if(el.dataset.tab === content) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  }

  _buildResetConfirmationModal() {
    this._resetConfirmationModal = buildConfirmModal('theme-editor_reset-modal', {
      title: t('themeEditor.resetTitle'),
      confirmLabel: t('themeEditor.reset'),
      message: t('themeEditor.resetMessage'),
      onConfirm: () => {
        this._performContentReset();
        eventBus.emit('themeEditor:update:display');
        closeModal(this._resetConfirmationModal);
      }
    });
  }

  _openResetConfirmationModal() {
    openModal(this._resetConfirmationModal)
  }

  _performContentReset() {
    let element = null;
    switch(this._selectedContent) {
    case 'appearance':
      element = this.element('content-appearance').firstChild;
      break;
    case 'layout':
      element = this.element('content-layout').firstChild;
      break;
    case 'spacing':
      element = this.element('content-spacing').firstChild;
      break;
    case 'mapping':
      resetLanguageStyleIds(getOpenProject(), this._activeTheme);
      eventBus.emit('save:request');
      eventBus.emit('toast:show', { message: t('themeEditor.resetStyles'), type: 'success' });
      return;
    }

    if(!element) {
      const errorMsg = t('themeEditor.resetFailed');
      eventBus.emit('toast:show', { message: errorMsg, type: 'error' });
      return;
    }

    resetThemeContent(element, this._activeTheme);

    const msg = t('themeEditor.resetDone');
    eventBus.emit('toast:show', { message: msg, type: 'success' });
  }

}