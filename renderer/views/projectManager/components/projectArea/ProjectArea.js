import { Component } from '@core/Component.js';
import { state } from '@core/State.js';

/*
  const projects = state.get('projects');
  if (!Array.isArray(projects) || projects.length === 0) {
    const defaultProject = createDefaultProject();
    state.set('projects', [defaultProject]);
    state.set('activeProjectId', defaultProject.id);

    // Select the first node so the editor opens with content immediately
    const firstTab = defaultProject.tabs?.explanation;
    const firstNode = firstTab?.nodes?.[0];
    if (firstNode) {
      session.set('activeNodeId', firstNode.id);
    }

    // Persist the freshly seeded state
    eventBus.emit('save:request');
  }
*/

/**
 * SidebarLeft - project selector.
 *
 * Responsibilities:
 *   - Display selected projects
 *   - Show project meta data
 *   - Display project preview
 *   - Open Project in editor
 *   - Modals: Rename projects, Delete confirm
 */
export default class ProjectArea extends Component {

  onLoad() {
    
  }

  onDestroy() {
    
  }

}