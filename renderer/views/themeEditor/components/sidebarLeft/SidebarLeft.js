import { Component } from '@core/Component.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { selectTab } from '@common/UIUtils.js';

export default class SidebarLeft extends Component {

  async onLoad() {
    const path = this.componentPath;
    const instances = await Promise.all([
      componentLoader.load(`${path}/contentAppearance/ContentAppearance`, this.element('content-appearance')),
      componentLoader.load(`${path}/contentLayout/ContentLayout`, this.element('content-layout')),
      componentLoader.load(`${path}/contentSpacing/ContentSpacing`, this.element('content-spacing')),
      // componentLoader.load(`${path}/contentMapping/ContentMapping`, this.element('content-mapping')),
    ]);

    this._instanceIds = instances.map(i => i.instanceId);
    this._selectedContent = 'appearance';

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

}