import { eventBus } from '@core/EventBus.js';
import { domObserver } from '@core/DOMObserver';
import { closeAllDropDowns, deselectAllTabs, toggleCheckBox, setCheckBox } from '@common/UIUtils.js';

export function registerGlobalEvents() {
  _registerStateEvents();
  _registerComponentInit();
  _registerClickDelegation();
}

function _registerStateEvents() {
  eventBus.on('session:change:activeProjectId', () => {
    document.querySelector('.preview-pane')?.removeAttribute('style');
  });

  eventBus.on('zoom:changed', factor => {
    eventBus.emit('toast:show', {
      message: `Zoom: ${Math.round(factor * 100)}%`,
      type: 'info',
    });
  });
}

function _registerComponentInit() {
  domObserver.register({
    type: 'added',
    selector: '.checkbox-element',
    callback: el => {
      _initCheckbox(el);
    }
  });
}

function _registerClickDelegation() {
  document.addEventListener('click', event => {
    _handleDropdown(event);
    _handleTabs(event);
    _handleCheckbox(event);
  });
}

function _handleDropdown(event) {
  const menuItem = event.target.closest('.menu-item');
  if (!menuItem) {
    closeAllDropDowns();
    return;
  }

  event.stopPropagation();
  const wasOpen = menuItem.classList.contains('open');
  closeAllDropDowns();

  if (!wasOpen)
    menuItem.classList.add('open');
}

function _handleTabs(event) {
  const tab = event.target.closest('.tab-element');
  if (!tab)
    return;

  event.stopPropagation();

  deselectAllTabs({ 
    element: tab,
    isParent: false, 
  });
  tab.classList.add('active');
}

function _handleCheckbox(event) {
  const checkbox = event.target.closest('.checkbox-element');
  if (!checkbox)
    return;

  event.stopPropagation();
  toggleCheckBox(checkbox);
}

function _initCheckbox(el) {
   if (el._checkboxInit)
    return;

  el._checkboxInit = true;
  if (!el.querySelector('.checkbox-box')) {
    const box = document.createElement('div');
    box.className = 'checkbox-box';
    box.innerHTML = `
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    el.appendChild(box);
  }

  const isChecked = el.dataset.checkbox === 'true';
  setCheckBox(el, isChecked);
}