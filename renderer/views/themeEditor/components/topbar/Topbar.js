import { Component } from '@core/Component.js';
import { session } from '@core/SessionState.js';

export default class SidebarLeft extends Component {
  
  onLoad() {
    this._setupElementEvents();
    this._renderEditorTypeSelect();
    
    this.subscribe('session:change:themeEditorTypeSelect', ({value}) => this._renderEditorTypeSelect(value));
  }

  onDestroy() { 
  }

  _setupElementEvents() {
    this.element('editor-select-conainer').addEventListener('click', (event) => {
      const target = event.target.closest('[data-editor-type]');
      if(!target)
        return;

      event.stopPropagation();
      const editorType = target.dataset.editorType;
      session.set('themeEditorTypeSelect', editorType);
    });
  }

  _renderEditorTypeSelect(value) {
    const type = value ?? session.get('themeEditorTypeSelect');

    const parent = this.element('editor-select-conainer');
    Array.from(parent.children).forEach(el => {
      if(el.dataset.editorType === type)
        el.classList.add('active');
      else
        el.classList.remove('active');
    });
  }

}