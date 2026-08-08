import { Component } from '@core/Component.js';
import { componentLoader } from '@core/ComponentLoader.js';

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
  }
  
  onDestroy() {
  }
}