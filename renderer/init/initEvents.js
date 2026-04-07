import { eventBus } from '@core/EventBus.js';
import { shortcutManager } from '@core/ShortcutManager.js';
import { applyStoredDocTheme } from '@common/DocThemeHelper.js';
import { closeAllDropDowns, deselectAllTabs } from '@common/UIUtils.js';

export function registerGlobalEvents() {
  _registerStateEvents();
  _registerClickDelegation();
}

function _registerStateEvents() {
  eventBus.on('session:change:activeProjectId', () => {
    document.querySelector('.preview-pane')?.removeAttribute('style');
    applyStoredDocTheme();
  });

  eventBus.on('zoom:changed', factor => {
    eventBus.emit('toast:show', {
      message: `Zoom: ${Math.round(factor * 100)}%`,
      type: 'info',
    });
  });
}

function _registerClickDelegation() {
  document.addEventListener('click', event => {
    _handleDropdown(event);
    _handleTabs(event);
  });
}

function _handleDropdown(event) {
  const menuItem = event.target.closest('.menu-item');
  if (menuItem) {
    event.stopPropagation();
    closeAllDropDowns();
    menuItem.classList.toggle('open');
    return;
  }

  closeAllDropDowns();
}

function _handleTabs(event) {
  const tab = event.target.closest('.tab-element');
  if (!tab)
    return;

  event.stopPropagation();

  deselectAllTabs(tab);
  tab.classList.add('active');
}