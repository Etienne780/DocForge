import { Component } from '@core/Component.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';

/**
 * SidebarLeft - project selector.
 *
 * Responsibilities:
 *   - Project selector list
 *   - Drag & drop reordering within the same level
 *   - Modals: Rename projects, Delete confirm
 *   - Search filtering via session.searchQuery
 */
export default class SidebarLeft extends Component {

  onLoad() {
    session.set('searchQuery', '');
  }

  onDestroy() {

  }

}