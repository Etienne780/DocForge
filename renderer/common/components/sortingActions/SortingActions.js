import { Component } from '@core/Component.js';
import { resolveStateType } from '@common/StateHelper.js';

/** 
 * @props type        - State type (session, state)
 * @props target      - Target var in the state where the sotring action will be stored
 */
export default class SortingActions extends Component {

  onLoad() {
    const storageType = this.props.type;// state/session
    this._storageTarget = this.props.target;// target var in storage type
    
    if(!storageType) {
      console.error('[SortingActions] storage type has to be set to a valid type (state, session)');
      return;
    }

    this._storage = resolveStateType(storageType);
  
    if(!this._storage) {
      console.error(`[SortingActions] invalid storage type '${storageType}', valid types are 'state' and 'session'`);
      return;
    }

    if(!this._storageTarget) {
      console.error('[SortingActions] storage target has to be set to a valid target');
      return;
    }

    this._setupElementEvents();
    this._renderSortAction();

    this.subscribe(`${storageType}:change:${this._storageTarget}`, ({value}) => this._renderSortAction(value));
  }

  onDestroy() {
  }

  _isValidState() {
    return this._storage && this._storageTarget;
  }

  _setupElementEvents() {
    // ── Sort ───────────────────────────────────────────────────────────────
    this.element('sort-action-container').addEventListener('click', event => {
      const target = event.target.closest('[data-sort-action]');
      if (!target || !this._isValidState)
        return;
    
      event.stopPropagation();
      let action = target.dataset.sortAction;
      if (!action)
        return;
    
      if(this._storage.get(this._storageTarget) === action) {
        switch (action) {
          case 'recent':
          case 'oldest':
            action = (action === 'recent') ? 'oldest' : 'recent';
            target.dataset.sortAction = action;
            target.title = action;
            target.innerHTML = this._getIcon(action);
            break;
          case 'order-az':
          case 'order-za':
            action = (action === 'order-az') ? 'order-za' : 'order-az';
            target.dataset.sortAction = action;
            target.title = action;
            target.innerHTML = this._getIcon(action);
            break;
        }
      }
    
      this._storage.set(this._storageTarget, action);
    });
  }

  _renderSortAction(value) {
    if(!this._isValidState())
      return;

    const action = value ?? this._storage.get(this._storageTarget);
    const parent = this.element('sort-action-container');
    
    Array.from(parent.children).forEach(el => {
      let elAction = el.dataset.sortAction;
  
      if(action === 'oldest' && elAction === 'recent') {
        el.classList.add('active');
        el.dataset.sortAction = 'oldest';
        el.innerHTML = this._getIcon('oldest');
        return;
      }
    
      if(action === 'order-za' && elAction === 'order-az') {
        el.classList.add('active');
        el.dataset.sortAction = 'order-za';
        el.innerHTML = this._getIcon('order-za');
        return;
      }
    
      if(elAction === action) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  _getIcon(name) {
    switch (name) {
      case 'recent':
        return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6.5" cy="10" r="5" stroke="currentColor" stroke-width="1.25"/>
          <path d="M6.5 7.5v2.708l1.667 1.667" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16 5.5v9.5m0 0l2.5-2.5m-2.5 2.5l-2.5-2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case 'oldest':
        return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="6.5" cy="10" r="5" stroke="currentColor" stroke-width="1.25"/>
          <path d="M6.5 7.5v2.708l1.667 1.667" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16 5.5v9.5m0-9.5l2.5 2.5m-2.5-2.5l-2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case 'order-az':
        return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 15.5l3.75-11l3.75 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4.3 12h4.791" stroke="currentColor" stroke-width="1.44"/>
          <path d="M15 5.5v9.5m0 0l2.5-2.5m-2.5 2.5l-2.5-2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      case 'order-za':
        return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 15.5l3.75-11l3.75 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4.3 12h4.908" stroke="currentColor" stroke-width="1.46"/>
          <path d="M15 5.5v9.5m0-9.5l2.5 2.5m-2.5-2.5l-2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      default:
        return '';
    }
  }

}