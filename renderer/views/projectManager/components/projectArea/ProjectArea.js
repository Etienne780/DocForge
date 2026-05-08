import { Component } from '@core/Component.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { FILE_EXTENSION_PROJECT } from '@core/AppMeta.js';
import { eventBus } from '@core/EventBus.js';
import { blobManager } from '@core/BlobManager.js';
import { session } from '@core/SessionState.js';
import { exportWithSaveDialog } from '@core/Platform.js';
import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { getActiveProject, findProject } from '@data/ProjectManager.js'
import { findDocTheme, getDocThemes, getPresetDocThemes, docThemeMatchesSearch } from '@data/DocThemeManager.js'
import { setHTML } from '@common/Common.js';
import { buildDocument, revokeThemeCache, createTabId } from '@common/HtmlBuilder.js';
import { exportProjectAsHTML, exportProjectAsJSON } from '@common/ExportHelper'
import { normalizeFileName, setIframeContent } from '@common/Common.js';
import { setCheckBox, isCheckedBoxActive } from '@common/UIUtils.js';
import { createThemeCard, buildDocThemeCardBody, buildDocThemeCardFooter, applyDocThemeCardColors, setCardState } from '@common/ThemeCardHelper.js';
import { openProject  } from '../helpers/ProjektHelper.js';


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

  async onLoad() {
    this._activeExportProject = null;

    this._buildExportModal();
    this._setupElementEvents();

    const instances = await Promise.all([
      componentLoader.load(
        'Searchbar', 
        this.element('theme-searchbar'),
        { target: 'projectThemeSearchQuery', type: 'session', placeholder: 'Search themes ...' },
      ),
    ]);
    
    const showActiveProject = () => {
      const id = session.get('activeProjectId');
      
      // remove previous cache
      if(this._activeProject) {
        revokeThemeCache(createTabId(this._activeProject.tabs));
      }

      this._activeProject = findProject(id);
      this._displayProject(this._activeProject);
    };

    showActiveProject();
    this.subscribe('session:change:activeProjectId', () => showActiveProject());
    this.subscribe('session:change:projectThemeSearchQuery', () => this._renderThemeCards());
  }

  onDestroy() {
    if(this._activeProject)
      revokeThemeCache(createTabId(this._activeProject.tabs));
  }

  _setupElementEvents() {
    this.element('project_open').addEventListener('click', () => this._openActiveProject() );

    this.element('theme-button').addEventListener('click', () => this._toggleThemeButton() );

    // ── Export button ─────────────────────────────────────────────────────────
    this.element('project_export').addEventListener('click', () => {
      this._openExportModal();
    });

    // ── Theme sidebar ─────────────────────────────────────────────────────────
    this.element('theme-container').addEventListener('click', (event) => {
      const target = event.target.closest('[data-theme-id]');
      if (!target || !this._activeProject)
        return;

      const themeId = target?.dataset?.themeId;
      if (!themeId || themeId === this._activeProject.docThemeId)
        return;

      this._activeProject.docThemeId = themeId;
      eventBus.emit('save:request:projects');
      this._displayProject(this._activeProject);
    });
  }

  _buildExportModal() {
    this._exportModal = buildDoneModal(this.elementId('project-export-modal'), {
      title: 'Export Project',
      bodyHTML: `
      <div class="form-top-row form-group--spaced">
        <div class="form-group">
          <div class="form-row">
            <span>File Name: </span>
            <input class="form-input" data-export-name-input type="text" placeholder="Name..." />
            <div class="form-group">
              <select data-export-type>
                <option value="project">Project (*.dfproj)</option>
                <option value="html">HTML (*.html)</option>
              </select>
              <div class="form-row form-list-padding" data-project-settings>
                <span>Include theme: </span>
                <button class="checkbox-element" data-checkbox="true" data-checkbox-include-theme></button>
              </div>
            </div>
          </div>
        </div>
      </div>`,
      doneLabel: 'Export',
      wide: 'm',
      doneCallback: () => {
        const modal = this._exportModal;
        const nameInput = modal.querySelector('[data-export-name-input]');
        const typeSelect = modal.querySelector('[data-export-type]');
        if(!nameInput || !typeSelect) {
          const msg = `Failed to export project '${this._activeExportProject.name}'`;
          eventBus.emit('toast:show', { message: msg, type: 'error' });
          return;
        }

        const name = nameInput.value;
        const type = typeSelect.value;

        this._exportProject(this._activeExportProject, name, type);
        this._activeExportProject = null;
      }
    });

    this._exportModal.querySelector('[data-export-type]').addEventListener('change', (event) => {
      const type = event.target?.value ?? null
      if (!type)
        return;

      const projSet = this._exportModal.querySelector('[data-project-settings]');
      projSet?.classList.toggle('hidden',  type !== EXPORT_TYPE.PROJECT);
    });
  }

  _openExportModal() {
    this._activeExportProject = getActiveProject();
    if(!this._activeExportProject) {
      eventBus.emit('toast:show', { message: 'Failed to open export modal', type: 'error' });
      return;
    }

    const modal = this._exportModal;
    const titleEl = modal.querySelector('[data-modal-title]');
    const nameInput = modal.querySelector('[data-export-name-input]');
    const typeSelect = modal.querySelector('[data-export-type]');
    const includeThemeCheck = modal.querySelector('[data-checkbox-include-theme]');

    if (titleEl)
      titleEl.textContent = `Export Project ${this._activeExportProject.name ? `'${this._activeExportProject.name}'` : 'untitled'}`;

    if (nameInput)
      nameInput.value = normalizeFileName(this._activeExportProject.name || 'untitled');

    if (typeSelect)
      typeSelect.value = EXPORT_TYPE.PROJECT;

    if(includeThemeCheck)
      setCheckBox(includeThemeCheck, true);
    
    openModal(this._exportModal);
  }
  
  async _exportProject(project, name, type) {
    if(!project) {
      const msg = 'Failed to export project';
      eventBus.emit('toast:show', { message: msg, type: 'error' });
      return;
    }

    switch(type) {
    case EXPORT_TYPE.PROJECT: {
      try {        
        const includeCheckbox = this._exportModal.querySelector('[data-checkbox-include-theme]');
        const includeTheme = isCheckedBoxActive(includeCheckbox);
        
        const json = exportProjectAsJSON(project, includeTheme);

        await exportWithSaveDialog(
          json,
          normalizeFileName(name),
          FILE_EXTENSION_PROJECT,
          'application/json',
        );

        eventBus.emit('toast:show', {
          message: `Exported project '${project.name}'`,
          type: 'success',
        });
      }
      catch (error) {
        eventBus.emit('toast:show', {
          message: `Failed to export project '${project.name}': ${error}`,
          type: 'error',
        });
      }
    
      break;
    }
    case EXPORT_TYPE.HTML:
      const result = await exportProjectAsHTML(project, name);

      eventBus.emit('toast:show', {
        message: result.message,
        type: (result.success ? 'success' : 'error'),
      });
      break;
    default:
      eventBus.emit('toast:show', {
        message: `Failed to export project '${project.name}', invalid type '${type}'`,
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

  _toggleThemeButton() {
    const activeBtnStyleName = 'theme-sidebar-button--active';
    const activeStyleName = 'theme-sidebar--active';
    
    const btn = this.element('theme-button');
    const text = btn?.firstChild;
    const sidebar = this.element('theme-sidebar');
    
    const active = btn.classList.contains(activeBtnStyleName);
    
    if (active) {
      btn.classList.remove(activeBtnStyleName);
      sidebar.classList.remove(activeStyleName);
      if(text)
        text.innerHTML = 'Theme';
    } else {
      btn.classList.add(activeBtnStyleName);
      sidebar.classList.add(activeStyleName);
      if(text)
        text.innerHTML = 'Close';
    }
  }

  _displayProject(project) {
    this._displayProjectHeader(project);
    this._displayProjectBody(project);
    this._renderThemeCards(project);
  }

  _displayProjectHeader(project) {
    const title = this.element('project_title');
    const subtitle = this.element('project_subtitle');

    if (!project) {
      title.textContent = '';
      subtitle.textContent = '';
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

  _displayProjectBody(project) {
    const hiddenStyleName = 'hidden';
    const empty = this.element('empty-preview-container');
    const container = this.element('preview-container');
    if(!project) {
      empty.innerHTML = 'No project selected';
      container.classList.add(hiddenStyleName);
      empty.classList.remove(hiddenStyleName);
      return;
    }

    const tabs = project.tabs.filter(t => t.nodes.length > 0);
    if(!tabs.length || tabs.length === 0) {
      empty.innerHTML = 'Selected project has no populated tabs';
      container.classList.add(hiddenStyleName);
      empty.classList.remove(hiddenStyleName);
      return;
    }

    const html = buildDocument(project);
    if(!html.doc) {
      eventBus.emit('toast:show', { message: `Failed to display project preview: ${html.msg}`, type: 'error' });
      empty.innerHTML = 'Error!';
      container.classList.add(hiddenStyleName);
      empty.classList.remove(hiddenStyleName);
      return;
    }

    container.classList.remove(hiddenStyleName);
    empty.classList.add(hiddenStyleName);
    setIframeContent(container, html.doc);
  }

  _renderThemeCards(project) {
    const searchQuery = session.get('projectThemeSearchQuery');
    const presets = getPresetDocThemes();
    const themes = getDocThemes();
    const parent = this.element('theme-container');
    if (!parent)
      return;
    
    const list = [...themes, ...presets];
    
    let html = '';
    list.forEach(theme => {
      if(searchQuery && searchQuery !== '') {
        if(!docThemeMatchesSearch(theme, searchQuery.toLowerCase()))
          return;
      }
    
      html += createThemeCard({
        dataSet: 'theme-id',
        data: theme.id,
        bodyHTML: buildDocThemeCardBody(theme),
        footerHTML: buildDocThemeCardFooter(theme)
      });
    });
    
    setHTML(parent, html);
    applyDocThemeCardColors(parent);

    if(!project) { 
      project = findProject(session.get('activeProjectId'));
    }

    if(project) {
      let themeId = project.docThemeId;
      if (!themeId) {
        const presets = getPresetDocThemes();
        themeId = presets.length > 0 ? presets[0].id : null
        project.docThemeId = themeId;
        eventBus.emit('save:request:projects');
      }

      if(themeId)
        setCardState(true, parent, [`[data-theme-id="${themeId}"]`]);
    }
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