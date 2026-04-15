import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { buildConfirmModal, openModal, closeModal  } from '@core/ModalBuilder.js';
import { selectTab } from '@common/UIUtils.js';
import { resetThemeContent } from './components/helper/ThemeContentHelper.js';
import { findDocTheme } from '@data/DocThemeManager.js';

export default class SidebarLeft extends Component {

  async onLoad() {
    const themeId = this.props['themeId'];
    this._activeTheme = findDocTheme(themeId);
    if(!this._activeTheme) {
      const errorMsg = '[themeEditor:sidebar] Faild to open Theme-editor';
      eventBus.emit('toast:show', { message: errorMsg, type: 'error' });
      eventBus.emit('navigate:themeManager');
      return;
    }

    const path = this.componentPath;
    const instances = await Promise.all([
      componentLoader.load(`${path}/contentAppearance/ContentAppearance`, this.element('content-appearance'), { theme: this._activeTheme }),
      componentLoader.load(`${path}/contentLayout/ContentLayout`, this.element('content-layout'), { theme: this._activeTheme }),
      componentLoader.load(`${path}/contentSpacing/ContentSpacing`, this.element('content-spacing'), { theme: this._activeTheme }),
      // componentLoader.load(`${path}/contentMapping/ContentMapping`, this.element('content-mapping')),
    ]);

    this._instanceIds = instances.map(i => i.instanceId);
    this._selectedContent = 'appearance';

    this._buildResetConfirmationModal();
    this._setupElementEvents();

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
    this._instanceIds.forEach(id => componentLoader.destroy(id));
    this._resetConfirmationModal?.remove();
  }

  _setupElementEvents() {
    // ── Tab elements ──────────────────────────────────────────────────────
    this.element('tab-element_appearance').addEventListener('click', () => {
      this._selectContentTab('appearance');
    });

    this.element('tab-element_layout').addEventListener('click', () => {
      this._selectContentTab('layout');
    });

    this.element('tab-element_spacing').addEventListener('click', () => {
      this._selectContentTab('spacing');
    });

    /*this.element('tab-element_mapping').addEventListener('click', () => {
      this._selectContentTab('mapping');
    });*/

    // ── reset ──────────────────────────────────────────────────────
    this.element('theme-editor_reset-button').addEventListener('click', () => {
      this._openResetConfirmationModal();
    });
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
      title: 'Reset Values',
      confirmLabel: 'Reset',
      message: 'Are you sure you want to reset all values to its default state?',
      onConfirm: () => {
        this._performContentReset();
        closeModal(this._resetConfirmationModal);
      }
    });
  }

  _openResetConfirmationModal() {
    eventBus.emit('save:request:docThemes');
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
    }

    if(!element) {
      const errorMsg = '[themeEditor:sidebar] Faild to reset values';
      eventBus.emit('toast:show', { message: errorMsg, type: 'error' });
      return;
    }

    resetThemeContent(element, this._activeTheme);

    const msg = 'Reseted values';
    eventBus.emit('toast:show', { message: msg, type: 'success' });
  }

}