// renderer/views/projectHub/components/toolbar/Toolbar.js
import { FILE_EXTENSION_PROJECT } from '@core/AppMeta.js';
import { Component } from '@core/Component.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { eventBus } from '@core/EventBus.js';
import { pickImportFile } from '@core/Platform.js';
import { openProject } from '@data/ProjectManager.js';
import { importProject } from '@common/ImportHelper.js';

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
    const importBtn = this.element('project_import');
    importBtn.addEventListener('click', async () => {
      await this._handleImport();
    });
  }

  async _handleImport() {
    try {
      const result = await pickImportFile();

      if (result.canceled) {
        eventBus.emit('toast:show', { message: 'Import canceled.', type: 'info' });
        return;
      }

      const ext = result.extension?.toLowerCase();
      const expectedExt = FILE_EXTENSION_PROJECT.replace('.', '').toLowerCase();
      
      if (ext !== expectedExt) {
        eventBus.emit('toast:show', { 
          message: `Please select a valid .${expectedExt} file.`, 
          type: 'error' 
        });
        return;
      }

      let jsonData;
      try {
        jsonData = JSON.parse(result.data);
      } catch (error) {
        eventBus.emit('toast:show', { 
          message: 'Invalid JSON file.', 
          type: 'error' 
        });
        return;
      }

      const project = importProject(jsonData);

      if (!project) {
        eventBus.emit('toast:show', { 
          message: 'Failed to import project: Invalid structure.', 
          type: 'error' 
        });
        return;
      }

      openProject(project);

    } catch (error) {
      eventBus.emit('toast:show', { 
        message: `Import error: ${error.message}`, 
        type: 'error' 
      });
    }
  }
}