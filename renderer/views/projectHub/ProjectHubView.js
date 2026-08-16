import { BaseView } from '@core/BaseView.js';
import { shortcutManager } from '@core/ShortcutManager';
import { closeProject } from '@data/ProjectManager.js'

import { getArrowDownIcon, getArrowUpIcon } from '@ui/Icon.js'

export class ProjectHubView extends BaseView {
  static viewId = 'projectHub';

  _viewPath() {
    return this._buildBasePath(this.constructor.viewId);
  }

  async mount(componentLoader) {
    const viewPrefix = `${this._getViewPath()}/components`;
    // viewPrefix = 'views/projectHub/components'

    const instances = await Promise.all([
      componentLoader.load(`${viewPrefix}/toolbar/Toolbar`, this.slot('toolbar')),
      componentLoader.load(`${viewPrefix}/templateGallery/TemplateGallery`, this.slot('template-gallery')),
      componentLoader.load(`${viewPrefix}/recentProjects/RecentProjects`, this.slot('recent-projects')),
    ]);
    
    this._instanceIds = instances.map(i => i.instanceId);
    this._setupElementEvents();

    this._updateTabContainerDisplay();
    shortcutManager.setContext('projectHub');
    closeProject(); // close any open projects
  }

  _setupElementEvents() {
    const tabContainer = this.element('project-hub__tab-container');

    Array.from(tabContainer.children).forEach(tabEl => {
      const btn = tabEl.querySelector('.tab_button');
      btn.addEventListener('click', (event) => {
        event.preventDefault();
      
        const isOpen = this._isTabElementOpen(tabEl);
        this._toggleTabElement(!isOpen, tabEl);
      });
    });
  }

  _updateTabContainerDisplay() {
    const container = this.element('project-hub__tab-container');

    Array.from(container.children).forEach(tabEl => {
      const isOpen = this._isTabElementOpen(tabEl);
      this._toggleTabElement(isOpen, tabEl);
    });
  }

  _isTabElementOpen(element) {
    return element.dataset.open === "true";
  }

  _toggleTabElement(isOpen, element) {
    element.dataset.open = String(isOpen);

    const slot = element.querySelector('[data-slot]');
    slot?.classList.toggle('hidden', !isOpen);

    // Update icon
    const icon = element.querySelector('[data-icon]');
    if (!icon)
        return;

    icon.innerHTML = isOpen ? getArrowUpIcon() : getArrowDownIcon();
  }
}