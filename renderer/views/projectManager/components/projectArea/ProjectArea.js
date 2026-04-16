import { Component } from '@core/Component.js';
import { eventBus } from '@core/EventBus.js';
import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { getActiveProject, findProject } from '@data/ProjectManager.js'
import { session } from '@core/SessionState.js';
import { openProject  } from '../helpers/ProjektHelper.js';
import { exportProjectAsHTML } from '@common/ExportHelper'
import { normalizeFileName } from '@common/Common.js';

const EXPORT_TYPE = {
  PROJECT: 'project',
  HTML: 'html'
};

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
    this._activeExportProject = null;

    this._buildExportModal();
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

    // ── Export button ─────────────────────────────────────────────────────────
    this.element('project_export').addEventListener('click', () => {
      this._openExportModal();
    });
  }

  _buildExportModal() {
    const id = this.elementId('');
    this._exportModal = buildDoneModal(this.elementId('project-export-modal'), {
      title: 'Export Project',
      bodyHTML: `
      <div>
        <div class="form-top-row form-group--spaced">
          <input class="form-input" data-export-name-input type="text" placeholder="Name..." />
          <select data-export-type>
            <option value="project">Project (*.dfproj)</option>
            <option value="html">HTML (*.html)</option>
          </select>
        </div>
      </div>`,
      doneLabel: 'Export',
      wide: false,
      doneCallback: () => {
        const modal = this._exportModal;
        const nameInput = modal.querySelector('[data-export-name-input]');
        const typeSelect = modal.querySelector('[data-export-type]');
        if(!nameInput || !typeSelect) {
          const msg = `Faild to export project '${project.name}'`;
          eventBus.emit('toast:show', { message: msg, type: 'error' });
          return;
        }

        const name = nameInput.value;
        const type = typeSelect.value;

        this._exportProject(this._activeExportProject, name, type);
        this._activeExportProject = null;
      }
    });
  }

  _openExportModal() {
    this._activeExportProject = getActiveProject();
    if(!this._activeExportProject) {
      eventBus.emit('toast:show', { message: 'Faild to open export modal', type: 'error' });
      return;
    }

    const modal = this._exportModal;
    const titleEl = modal.querySelector('[data-modal-title]');
    const nameInput = modal.querySelector('[data-export-name-input]');
    const typeSelect = modal.querySelector('[data-export-type]');

    if (titleEl)
      titleEl.textContent = `Export Project ${this._activeExportProject.name ? `'${this._activeExportProject.name}'` : 'untitled'}`;

    if (nameInput)
      nameInput.value = normalizeFileName(this._activeExportProject.name || 'untitled');

    if (typeSelect)
      typeSelect.value = EXPORT_TYPE.PROJECT;
    
    openModal(this._exportModal);
  }
  
  _exportProject(project, name, type) {
    switch(type) {
    case EXPORT_TYPE.PROJECT:
      break;
    case EXPORT_TYPE.HTML:
      const result = exportProjectAsHTML(project);

      eventBus.emit('toast:show', {
        message: result.message,
        type: (result.success ? 'succes' : 'error'),
      });
      break;
    default:
      eventBus.emit('toast:show', {
        message: `Faild to export project '${project.name}', invalid type '${type}'`,
        type: 'error',
      });
      break;
    }
  }

  _openActiveProject() {
    const project = getActiveProject();
    if(!project) {
      eventBus.emit('toast:show', { message: `No project selected`, type: 'error' });
      return;
    }

    openProject(project.id);
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