import { escapeHTML } from './Common.js';

// ─── Dropdown ──────────────────────────────────────────────────────────────

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

// ─── modal ──────────────────────────────────────────────────────────────

/**
 * @brief Closes all modals matching the given selector.
 *
 * Iterates over all elements that match the selector and removes the
 * 'modal-overlay--open' class, effectively closing them.
 *
 * @param {string} [query='.modal-overlay--open']  CSS selector for open modals. Defaults to '.modal-overlay--open'.
 */
export function closeModals(query = '.modal-overlay--open') {
  document.querySelectorAll(query).forEach(el => {
    el.classList.remove('modal-overlay--open');
  });
}

// ─── Checkbox ──────────────────────────────────────────────────────────────

export function toggleCheckBox(checkbox) {
  if(!checkbox)
    return;

  checkbox.classList.toggle('checked');
  _updateCheckBoxState(checkbox);
}

export function setCheckBox(checkbox, value = true) {
  if(!checkbox)
    return;

  const isChecked = Boolean(value);

  checkbox.classList.toggle('checked', isChecked);
  _updateCheckBoxState(checkbox);
}

export function _updateCheckBoxState(el) {
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