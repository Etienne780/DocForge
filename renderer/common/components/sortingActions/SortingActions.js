import { Component } from '@core/Component.js';
import { session } from '@core/SessionState.js';

export default class SortingActions extends Component {

  onLoad() {
    this._storageTarget = this.props.target;
    if(!this._storageTarget) {
      console.warn('[SortingActions] storage target has to be set to a valid target in SessionState');
      return;
    }

    this._setupElementEvents();
    this._renderSortAction();

    this.subscribe(`session:change:${this._storageTarget}`, ({value}) => this._renderSortAction(value));
  }

  onDestroy() {
  }

  _setupElementEvents() {
    // ── Sort ───────────────────────────────────────────────────────────────
    this.element('sort-action-container').addEventListener('click', event => {
      const target = event.target.closest('[data-sort-action]');
      if (!target || !this._storageTarget)
        return;
    
      event.stopPropagation();
      let action = target.dataset.sortAction;
      if (!action)
        return;
    
      if(session.get(this._storageTarget) === action) {
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
    
      session.set(this._storageTarget, action);
    });
  }

  _renderSortAction(value) {
    if(!this._storageTarget)
      return;

    const action = value ?? session.get(this._storageTarget);
    const parent = this.element('sort-action-container');
    
    Array.from(parent.children).forEach(el =>  {
      if(el.dataset.sortAction === action)
        el.classList.add('active');
      else
        el.classList.remove('active');
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