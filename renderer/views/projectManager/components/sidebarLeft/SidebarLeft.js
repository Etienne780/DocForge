import { Component } from '@core/Component.js';
import { state } from '@core/State.js';

/**
 * SidebarLeft - project selector.
 *
 * Responsibilities:
 *   - Project selector list
 *   - Drag & drop reordering within the same level
 *   - Modals: Rename projects, Delete confirm
 *   - Search filtering via state.searchQuery
 */
export default class SidebarLeft extends Component {

  onLoad() {
    state.set('searchQuery', '');
  }

  onDestroy() {

  }

}