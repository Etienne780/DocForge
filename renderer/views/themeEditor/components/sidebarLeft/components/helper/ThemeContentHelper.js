import { state } from '@core/State.js';
import { eventBus } from '@core/EventBus.js';
import { setCheckBox, isCheckedBoxActive } from '@common/UIUtils.js';
import { 
  resetThemeSettings,
  modifyThemeValue,
  getThemeValue,
  getEntry
} from '@data/DocThemeManager.js';

/**
 * Resets theme values for all keys found in the given content container.
 * @param {HTMLElement} content - Container with elements holding data-key attributes
 * @param {string} themeId - ID of the theme to reset
 * @returns {boolean} True if reset was executed, false if theme not found
 */
export function resetThemeContent(content, theme) {
  if (!theme)
    return false;

  // collect all elements with data-key (deep search)
  const elements = content.querySelectorAll('[data-key]');
  const params = Array.from(elements).map(el => el.dataset.key);

  resetThemeSettings(theme, params);

  return true;
}

export function bindThemeInputs(container, theme) {
  const elements = container.querySelectorAll('[data-key][data-type]');

  elements.forEach(el => {
    const key = el.dataset.key;
    const type = el.dataset.type;

    switch(type) {
      case 'color': {
        const input = el.querySelector('input[type="color"]');
        if (!input)
          break;

        input.addEventListener('input', () => {
          modifyThemeValue(theme, key, input.value);
          eventBus.emit('themeEditor:update:display');
        });
        break;
      }
      case 'number': {
        const input = el.querySelector('input[type="number"]');
        if (!input)
          break;

        input.addEventListener('input', () => {
          modifyThemeValue(theme, key, Number(input.value));
          eventBus.emit('themeEditor:update:display');
        });
        break;
      }
      case 'select': {
        const select = el.querySelector('select');
        if (!select)
          break;

        select.addEventListener('change', () => {
          modifyThemeValue(theme, key, select.value);
          eventBus.emit('themeEditor:update:display');
        });
        break;
      }
    }
  });
}

/**
 * Updates UI inputs inside the given content container with current theme values.
 * @param {HTMLElement} content - Container with elements holding data-key/type attributes
 * @param {string} themeId - ID of the theme to read from
 */
export function updateThemeContent(content, theme) {;
  if(!theme)
    return;

  const updateChildren = (element) => {
    Array.from(element.children).forEach(el => {
      const key = el.dataset?.key;
      const type = el.dataset?.type;
      
      if(el.classList.contains('item--sub-container'))
        updateChildren(el);
      
      if(!key || !type)
        return;

      _updateThemeElement(el, key, type, theme);
    });
  };

  updateChildren(content);
}

function _updateThemeElement(el, key, type, theme) {
  const entry = getEntry(theme, key);
  if(!entry)
    return;

  const value = entry.value;

  switch(type) {
    case 'color': {
      const input = el.querySelector('input[type="color"]');
      if (input)
        input.value = value ?? '#000000';
      _syncCheckbox(el, key, theme);
      break;
    }
    case 'number': {
      const input = el.querySelector('input[type="number"]');
      if (!input)
        return;
      
      input.value = value ?? 0;

      if (entry.min != null)
        input.min = entry.min;

      if (entry.max != null)
        input.max = entry.max;
      break;
    }
    case 'select': {
      const select = el.querySelector('select');
      if (!select)
        break;

      if (Array.isArray(entry.options)) {
        select.innerHTML = entry.options
          .map(o => `<option value="${o}">${o}</option>`)
          .join('');
      }
      select.value = value;
      break;
    }
  }
}

function _syncCheckbox(el, key, entry) {
  if (!entry)
    return;

  const container = el.parentElement;
  if (!container)
    return;

  const checkbox = container.querySelector(
    `[data-checkbox-target="[data-key='${key}']"]`
  );

  if (!checkbox)
    return;

  const isChecked = !entry.useFallback;
  setCheckBox(checkbox, isChecked);
}