import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { findProject } from '@data/ProjectManager.js';

export function openProject(projectId) {
  const project = findProject(projectId);
  if(!project) {
    eventBus.emit('toast:show', { message: `Project faild to open`, type: 'error' });
    return;
  }
  // select first tab in project
  if(project.tabs.length > 0) {
    session.set('activeTabId', project.tabs[0].id);
  }
  project.lastOpenedAt = Date.now();
  eventBus.emit('navigate:docEditor');
}