import { escapeHTML } from './Common.js';

// ─── Dropdown ──────────────────────────────────────────────────────────────


const dropdownEvents = new Map();

/**
 * Registers a dropdown event listener.
 *
 * @param {HTMLElement} dropdownItem - The dropdown item element to attach the listener to.
 * @param {(event) => void} callback - Callback invoked when dropdown item clicked.
 * @returns {() => void} Function to remove this specific listener.
 */
export function addDropdownEventListener(dropdownItem, callback) {
  let set = dropdownEvents.get(dropdownItem);

  if (!set) {
    set = new Set();
    dropdownEvents.set(dropdownItem, set);
  }

  set.add(callback);

  return () => {
    removeDropdownEventListener(dropdownItem, callback);
  };
}

/**
 * Removes a previously registered dropdown event listener.
 *
 * @param {HTMLElement} dropdownItem - The checkbox element.
 * @param {(event) => void} callback - The callback to remove.
 * @returns {boolean} True if the callback was removed, otherwise false.
 */
export function removeDropdownEventListener(dropdownItem, callback) {
  const set = dropdownEvents.get(dropdownItem);

  if (!set)
    return false;

  const removed = set.delete(callback);

  // Cleanup empty sets to avoid memory leaks
  if (set.size === 0)
    dropdownEvents.delete(dropdownItem);

  return removed;
}

export function dropdownItemClick(dropdownItem, event) {
  const set = dropdownEvents.get(dropdownItem);
  if (!set)
    return;

  set.forEach(fn => fn?.(event));
}

/**
 * @brief Creates a dropdown item element as HTML string.
 *
 * The item can optionally display a shortcut label and a tooltip.
 * Sets the `data-item-name` attribute using the escaped HTML of the name,
 * which allows later querying for event binding.
 * 
 * @param {string} name                         Visible name of the item.
 * @param {object} options
 * @param {string|null} [options.description]   Optional description, shown as tooltip.
 * @param {string|null} [options.shortcut]      Name of the shortcut (maps to data-shortcut-label).
 * @param {string} [options.shortcutContext]    Context for the shortcut (maps to data-shortcut-context).
 * @returns {string}                            HTML string for the dropdown item.
 */
export function createDropDownItem(name, { description = null, shortcut = null, shortcutContext = 'global' } = {}) {
  const dataAttributes = shortcut
    ? `data-shortcut-label="${shortcut}" ${shortcutContext ? `data-shortcut-context="${shortcutContext}"` : ''}`
    : '';

  const shortcutSpan = `<span class="shortcut" ${dataAttributes}></span>`;

  return `
  <div class="dropdown-item"${description ? ` title="${escapeHTML(description)}"` : ''} data-item-name="${escapeHTML(name)}">
    <span>${escapeHTML(name)}</span>
    ${shortcutSpan}
  </div>`;
}

/**
 * @brief Closes all dropdown menus matching the given selector.
 *
 * Iterates over all elements that match the selector and removes the
 * 'open' class, effectively closing them.
 *
 * @param {string} selector  CSS selector for open dropdowns. Defaults to '.menu-item.open'.
 */
export function closeAllDropDowns(selector = '.menu-item.open') {
  document.querySelectorAll(selector)
    .forEach(el => el.classList.remove('open'));
}

// ─── Tab ──────────────────────────────────────────────────────────────

/**
 * @brief Deselects all tabs within a specified root element.
 *
 * Queries all elements with the class 'tab-element' under the root
 * and removes the 'active' class if the provided condition returns true.
 *
 * @param {object} params
 * @param {HTMLElement|null} [params.element=null]  Root element for tab search. Defaults to document if null.
 * @param {boolean} [params.isParent=false]        If true, the root is the element itself; otherwise its parent.
 * @param {function(HTMLElement):boolean} [params.condition=() => true]  Filter function to decide which tabs to deselect. Defaults to always true.
 */
export function deselectAllTabs({ element = null, isParent = false, condition = () => true }) {
  const root = (isParent ? element : element?.parentElement) ?? document;

  root.querySelectorAll('.tab-element').forEach(el => {
    if (condition(el))
      el.classList.remove('active');
  });
}

/**
 * @brief Selects a tab by its action identifier and deselects others.
 *
 * Finds the first tab element whose dataset.tabAction matches the provided
 * action, adds the 'active' class to it, and removes 'active' from all other
 * tabs within the same root.
 *
 * @param {object} params
 * @param {HTMLElement|null} [params.element=null]  Element or container for tab selection. Defaults to its parent if null.
 * @param {string} params.tabAction                 Identifier of the tab to activate.
 * @param {boolean} [params.isParent=false]        If true, element itself is the root; otherwise its parent.
 */
export function selectTab({ element = null, tabAction, isParent = false }) {
  const root = isParent ? element : element?.parentElement;
  if (!root)
    return;

  let activeElement = null;
  for (const el of root.querySelectorAll('.tab-element')) {
    if (el.dataset.tabAction === tabAction) {
      el.classList.add('active');
      activeElement = el;
      break;
    }
  }

  deselectAllTabs({
    element,
    isParent,
    condition: (el) => el !== activeElement,
  });
}

// ─── Checkbox ──────────────────────────────────────────────────────────────

const checkboxEvents = new Map();

/**
 * Registers a checkbox event listener.
 *
 * @param {HTMLElement} checkbox - The checkbox element to attach the listener to.
 * @param {(checked: boolean) => void} callback - Callback invoked when checkbox state changes. Checked is the new state of the checkbox
 * @returns {() => void} Function to remove this specific listener.
 */
export function addCheckboxEventListener(checkbox, callback) {
  let set = checkboxEvents.get(checkbox);

  if (!set) {
    set = new Set();
    checkboxEvents.set(checkbox, set);
  }

  set.add(callback);

  return () => {
    removeCheckboxEventListener(checkbox, callback);
  };
}

/**
 * Removes a previously registered checkbox event listener.
 *
 * @param {HTMLElement} checkbox - The checkbox element.
 * @param {(checked: boolean) => void} callback - The callback to remove.
 * @returns {boolean} True if the callback was removed, otherwise false.
 */
export function removeCheckboxEventListener(checkbox, callback) {
  const set = checkboxEvents.get(checkbox);

  if (!set)
    return false;

  const removed = set.delete(callback);

  // Cleanup empty sets to avoid memory leaks
  if (set.size === 0)
    checkboxEvents.delete(checkbox);

  return removed;
}

export function isCheckedBoxActive(checkbox) {
  return checkbox ? checkbox.classList.contains('checked') : false;
}

export function toggleCheckBox(checkbox) {
  if(!checkbox)
    return;

  setCheckBox(checkbox, !isCheckedBoxActive(checkbox));
}

export function setCheckBox(checkbox, value = true) {
  if (!checkbox)
    return;

  const isChecked = Boolean(value);

  checkbox.classList.toggle('checked', isChecked);

  _updateCheckboxState(checkbox);
  _callCheckboxEvents(checkbox, isChecked);
}

export function setCheckboxDisabled(checkbox, disabled) {
  if (!checkbox)
    return;

  const isDisabled = Boolean(disabled);
  
  checkbox.classList.toggle('checkbox-element--disabled', isDisabled);
}

export function _updateCheckboxState(el) {
  const isChecked = el.classList.contains('checked');

  el.dataset.checkbox = String(isChecked);
  _updateCheckboxTargets(el, isChecked);
}

function _updateCheckboxTargets(el, isChecked) {
  let selector = el.dataset.checkboxTarget;
  if (!selector)
    return;

  const targets = document.querySelectorAll(selector);
  targets.forEach(target => {
    const showOnCheck = target.dataset.showOnCheck ?? 'true';

    const shouldShow =
      showOnCheck === 'true'
        ? isChecked
        : !isChecked;

    target.classList.toggle('hidden', !shouldShow);
  });
}

function _callCheckboxEvents(checkbox, value) {
  const set = checkboxEvents.get(checkbox);
  if (!set)
    return;

  set.forEach(fn => fn?.(value));
}