import { Component } from '@core/Component.js';
import { session } from '@core/SessionState.js';

export default class SidebarLeft extends Component {
  
  onLoad() {
    this._setupElementEvents();
    
    this.subscribe('session:change:themeEditorTypeSelect', ({value}) => {
      
    });
  }

  onDestroy() { 

  }

  _setupElementEvents() {
    this.element('editor-select-conainer').addEventListener('click', (event) => {
      const target = event.target.closest('[data-editor-type]');
      if(!target)
        return;

      const editorType = target.dataset.editorType;
      session.set('themeEditorTypeSelect', editorType);
    });
  }

}