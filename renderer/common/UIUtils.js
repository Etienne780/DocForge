import { escapeHTML, setHTML } from './Common.js';
import { toggleMenu } from './MenuManager.js';

// ─── Input/TextArea ──────────────────────────────────────────────────────────────

export function addTabIndenting(htmlInput) {
  if (!htmlInput) 
    return;

  htmlInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') 
      return;

    e.preventDefault();

    const start = htmlInput.selectionStart;
    const end = htmlInput.selectionEnd;

    const value = htmlInput.value;

    const before = value.substring(0, start);
    const selection = value.substring(start, end);
    const after = value.substring(end);

    const indent = '  ';

    // CASE 1: Cursor only (no selection)
    if (start === end) {
      htmlInput.value =
        before + indent + after;

      const newPos = start + indent.length;

      htmlInput.selectionStart = newPos;
      htmlInput.selectionEnd = newPos;

      htmlInput.dispatchEvent(new Event('input'));
      return;
    }

    // CASE 2: Selection (block indent)
    const lines = selection.split('\n');
    const indented = lines.map(line => indent + line);

    htmlInput.value =
      before + indented.join('\n') + after;

    const addedChars = indent.length * lines.length;

    // keep selection (IDE behavior)
    htmlInput.selectionStart = start;
    htmlInput.selectionEnd = end + addedChars;

    htmlInput.dispatchEvent(new Event('input'));
  });
}

export function addLineBreakIndenting(htmlInput) {
  if (!htmlInput)
    return;

  htmlInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') 
      return;

    e.preventDefault();

    const start = htmlInput.selectionStart;
    const value = htmlInput.value;

    const before = value.substring(0, start);
    const after = value.substring(start);

    // find current line start
    const lineStart = before.lastIndexOf('\n') + 1;
    const currentLine = before.substring(lineStart);

    // extract indentation (spaces or tabs at start of line)
    const indentMatch = currentLine.match(/^[ \t]*/);
    const indent = indentMatch ? indentMatch[0] : '';

    const newValue =
      before +
      '\n' +
      indent +
      after;

    htmlInput.value = newValue;

    const newPos = start + 1 + indent.length;

    htmlInput.selectionStart = newPos;
    htmlInput.selectionEnd = newPos;

    htmlInput.dispatchEvent(new Event('input'));
  });
}


// ─── Action menu ──────────────────────────────────────────────────────────────

/**
 * Creates a "⋯" button that opens its actions in the shared menu host
 * (see @common/MenuManager.js).
 *
 * @param {Array<{ name: string, description?: string, danger?: boolean, action: (event) => void }>} items
 * @param {object} [options]
 * @param {string} [options.title='More actions']
 * @returns {HTMLButtonElement}
 */
export function createActionMenu(items, { title = 'More actions' } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-item action-menu';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.setAttribute('aria-haspopup', 'menu');

  const icon = document.createElement('span');
  icon.className = 'action-menu__icon';
  icon.textContent = '⋯';
  button.append(icon);

  button.addEventListener('click', event => {
    event.stopPropagation();
    toggleMenu(button, items, 'end', 'dropdown--compact');
  });

  return button;
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

  if (isCheckedBoxActive(checkbox) === isChecked) 
    return;

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
// ─── Loading ──────────────────────────────────────────────────────────────

/**
 * Puts a loading overlay (spinner + label) over `container`, e.g. while its
 * content is fetched or built. Starts hidden.
 *
 * @param {HTMLElement} container
 * @param {Object} [options]
 * @param {string} [options.label="Loading…"]
 * @returns {{ show: Function, hide: Function, isShown: Function, destroy: Function }}
 */
export function createLoadingOverlay(container, { label = 'Loading…' } = {}) {
  // The overlay is positioned absolutely, so the container must be positioned
  const madeRelative = getComputedStyle(container).position === 'static';
  if (madeRelative)
    container.classList.add('loading-host');

  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.hidden = true;
  setHTML(overlay, `<div class="spinner"></div><span>${escapeHTML(label)}</span>`);
  container.append(overlay);

  return {
    show: () => { overlay.hidden = false; },
    hide: () => { overlay.hidden = true; },
    isShown: () => !overlay.hidden,
    destroy: () => {
      overlay.remove();
      if (madeRelative)
        container.classList.remove('loading-host');
    },
  };
}

/**
 * Shows a loading overlay over `container` while `task` runs, and removes it
 * afterwards (also when the task fails or is aborted).
 *
 * @example
 * const html = await runWithLoading(el, signal => buildSomething({ signal }), { signal });
 *
 * @template T
 * @param {HTMLElement} container
 * @param {function(AbortSignal|null): Promise<T>} task
 * @param {Object} [options]
 * @param {string} [options.label]
 * @param {AbortSignal} [options.signal] - passed on to `task`
 * @returns {Promise<T>}
 */
export async function runWithLoading(container, task, { label, signal = null } = {}) {
  const loading = createLoadingOverlay(container, { label });
  loading.show();
  try {
    return await task(signal);
  } finally {
    loading.destroy();
  }
}
