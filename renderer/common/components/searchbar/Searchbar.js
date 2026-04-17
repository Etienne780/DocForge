import { Component } from "@core/Component.js";
import { resolveStateType } from '@common/StateHelper.js';

/** 
 * @props type        - State type (session, state)
 * @props target      - Target var in the state where the search text will be stored
 * @props placeholder - Placeholder text
 */
export default class Searchbar extends Component {
  
  onLoad() {
    const storageType = this.props.type;// state/session
    this._storageTarget = this.props.target;// target var in storage type
    
    if(!storageType) {
      console.error('[Searchbar] storage type has to be set to a valid type (state, session)');
      return;
    }

    this._storage = resolveStateType(storageType);
  
    if(!this._storage) {
      console.error(`[Searchbar] invalid storage type '${storageType}', valid types are 'state' and 'session'`);
      return;
    }

    if(!this._storageTarget) {
      console.error('[Searchbar] storage target has to be set to a valid target');
      return;
    }

    // reset search query
    this._storage.set(this._storageTarget, '');

    this._setupElementEvents();
  }

  onDestroy() { 
  }

  _isValidState() {
    return this._storage && this._storageTarget;
  }

  _setupElementEvents() {
    const input = this.element('search-input');
    input.addEventListener('input', event => {
      if(!this._isValidState())
        return;
      
      this._storage.set(this._storageTarget, event.target.value);
    });
    
    const placeholder = this.props.placeholder;
    if(placeholder)
      input.placeholder = placeholder;
  }

}