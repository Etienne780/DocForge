import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js';
import { getActiveProject, findProject } from '@data/ProjectManager.js'
import { session } from '@core/SessionState.js';

/**
 * SidebarLeft - project selector.
 *
 * Responsibilities:
 *   - Display selected projects
 *   - Show project meta data
 *   - Display project preview
 *   - Open Project in editor
 */
export default class ProjectArea extends Component {

  onLoad() {
    this._setupElementEvents();
    
    const showActiveProject = () => {
      const projectId = session.get('activeProjectId');
      this._displayProject(projectId);
    };

    showActiveProject();
    this.subscribe('session:change:activeProjectId', showActiveProject);
  }

  onDestroy() {
  }

  _setupElementEvents() {
    this.element('project_open').addEventListener('click', () => this._openActiveProject() );
  }
  
  _openActiveProject() {
    const project = getActiveProject();
    if(!project) {
      eventBus.emit('toast:show', { message: `Faild to open project`, type: 'error' });
      return;
    }

    // select first tab in project
    if(project.tabs.length > 0) {
      session.set('activeTabId', project.tabs[0].id);
    }

    project.lastOpenedAt = Date.now();
    eventBus.emit('navigate:editor');
  }

  _displayProject(projectId) {
    const title = this.element('project_title');
    const subtitle = this.element('project_subtitle');

    const project = findProject(projectId);
    if (!project) {
      title.textContent = 'Unknown';
      subtitle.textContent = 'placeholder';
      return;
    }

    title.textContent = project.name;

    const createdText = `Created ${this._formatTimeString(project.createdAt)}`;
    const lastOpenedText = `Last opened ${this._formatTimeString(project.lastOpenedAt)}`;

    subtitle.textContent = createdText;
    const br = document.createElement('br');
    subtitle.appendChild(br);
    subtitle.appendChild(document.createTextNode(lastOpenedText));
  }

  /**
   * Format a timestamp into a human-readable relative time string.
   * @param {number|null} time - The timestamp in milliseconds.
   * @returns {string} - Human-readable string like "5 minutes ago".
   */
  _formatTimeString(time) {
    if (!time) return 'unknown';

    const diff = Date.now() - time;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours   = Math.floor(minutes / 60);
    const days    = Math.floor(hours / 24);
    const weeks   = Math.floor(days / 7);
    const months  = Math.floor(days / 30);
    const years   = Math.floor(days / 365);

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    if (seconds < 60)  return rtf.format(-seconds, 'second');
    if (minutes < 60)  return rtf.format(-minutes, 'minute');
    if (hours < 24)    return rtf.format(-hours,   'hour');
    if (days < 7)      return rtf.format(-days,    'day');
    if (weeks < 5)     return rtf.format(-weeks,   'week');
    if (months < 12)   return rtf.format(-months,  'month');
    return rtf.format(-years,    'year');
  }

}