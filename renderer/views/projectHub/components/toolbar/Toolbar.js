import { Component } from '@core/Component.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { eventBus } from '@core/EventBus.js';
import { getImportIcon } from '@ui/Icon.js';
export default class Toolbar extends Component {

  async onLoad() {
    const instances = await Promise.all([
      componentLoader.load(
        'Searchbar', 
        this.element('project-hub-search'),
        { target: 'projectHubSearchQuery', type: 'session', placeholder: 'Search...' },
      ),
    ]);

    this._instanceIds = instances.map(i => i.instanceId);

    this._setupElementEvents();
  }
  
  onDestroy() {
  }

  _setupElementEvents() {
    const projectImportBtn = this.element('project-import-button');
    const projectImportIconContainer = projectImportBtn.querySelector('[data-icon]');
    projectImportIconContainer.innerHTML = getImportIcon();
    projectImportBtn.addEventListener('click', () => {
      eventBus.emit('show:modal:importProject');
    });
  }
}