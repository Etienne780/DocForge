import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js';
import { 
  initThemeContent,
  bindThemeInputs 
} from '../helper/ThemeContentHelper.js';

export default class ContentLayout extends Component {

  async onLoad() {
    this._activeTheme = this.props.theme;

    const sidebar = this.element('theme-editor_sidebar-left');
    bindThemeInputs(sidebar, this._activeTheme);
    initThemeContent(sidebar, this._activeTheme);

    this._setupElementEvents();
  }

  onDestroy() {
  }

  _setupElementEvents() {
    this._selectTabEvent('sidebar-width-type', [
      { 
        id: 'sidebar-width-px',
        activeOn: 'pixels',
      },
      { 
        id: 'sidebar-width-per',
        activeOn: 'percent',
      },
    ]);

    this._selectTabEvent('toc-width-type', [
      { 
        id: 'toc-width-px',
        activeOn: 'pixels',
      },
      { 
        id: 'toc-width-per',
        activeOn: 'percent',
      },
    ]);
  }

  _selectTabEvent(selectId, entries) {
    const selectEl = this.element(selectId);
    if (!selectEl ||
      !entries ||
      !Array.isArray(entries) ||
      entries.length === 0)
      return;
    
    const updateVisibility = () => {
      const val = selectEl.value;

      entries.forEach(e => {
        const htmlEl = this.element(e.id);
        if (!htmlEl || !val)
          return;
      
        htmlEl.classList.toggle('hidden', val !== e.activeOn);
      });

      updateLastVisible();
    };

    const updateLastVisible = () => {
      const elements = entries
        .map(e => this.element(e.id))
        .filter(Boolean);
    
      elements.forEach(el => el.classList.remove('is-last-visible'));
    
      const visible = elements.filter(el => !el.classList.contains('hidden'));
      const last = visible.at(-1);
    
      if (last) {
        last.classList.add('is-last-visible');
      }
    };
  
    selectEl.addEventListener('change', () => {
      updateVisibility();
    });
  
    updateVisibility();
  }

}