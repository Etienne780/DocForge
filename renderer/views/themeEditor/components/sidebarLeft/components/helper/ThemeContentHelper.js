import { state } from '@core/State.js';
import { eventBus } from '@core/EventBus.js';
import { setCheckBox, isCheckedBoxActive, addCheckboxEventListener } from '@common/UIUtils.js';
import { bindColorSwatch, setSwatchColor } from '@common/ColorPicker.js';
import { 
  resetThemeSettings,
  modifyThemeValue,
  getThemeValue,
  getEntry
} from '@data/DocThemeManager.js';

const checkboxEventRemoveCB = [];

export function removeCheckboxEventListener() {
  checkboxEventRemoveCB.forEach(fn => fn?.());
  checkboxEventRemoveCB.length = 0;
}

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
  const inputs = container.querySelectorAll('[data-key][data-type]');
  const checkboxs = container.querySelectorAll('[data-checkbox]');

  // toggle if a var should be active or not
  checkboxs.forEach(el => {
    const cb = addCheckboxEventListener(el, (value) => {
      const target = container.querySelector(el.dataset.checkboxTarget);
      const key = target?.dataset.key;
      if(!target || !key)
        return;

      modifyThemeValue(theme, key, { active: value });
      eventBus.emit('themeEditor:update:display');
    });

    checkboxEventRemoveCB.push(cb);
  });

  // evaluates the value of a key
  inputs.forEach(el => {
    const key = el.dataset.key;
    const type = el.dataset.type;

    switch(type) {
      case 'color': {
        const swatch = el.querySelector('.color-swatch');
        if (!swatch)
          break;

        bindColorSwatch(swatch, {
          placement: 'right',
          palette: () => _getThemeColorPalette(container, theme),
          onInput: (value) => {
            const val = modifyThemeValue(theme, key, { value });
            setSwatchColor(swatch, val);
            eventBus.emit('themeEditor:update:display');
          },
        });
        break;
      }
      case 'number': {
        const input = el.querySelector('input[type="number"]');
        if (!input)
          break;

        input.addEventListener('input', () => {
          const val = modifyThemeValue(theme, key, { value: Number(input.value) });
          input.value = val;
          eventBus.emit('themeEditor:update:display');
        });
        break;
      }
      case 'select': {
        const select = el.querySelector('select');
        if (!select)
          break;

        select.addEventListener('change', () => {
          const val = modifyThemeValue(theme, key, { value: select.value });
          select.value = val;
          eventBus.emit('themeEditor:update:display');
        });
        break;
      }
      case 'toggle': {
        const toggle = el.querySelector('button[data-checkbox]');
        if (!toggle)
          break;

        const cb = addCheckboxEventListener(toggle, (value) => {   
          modifyThemeValue(theme, key, { value: value });
          eventBus.emit('themeEditor:update:display');
        });
        
        checkboxEventRemoveCB.push(cb);
        break;
      }
    }
  });
}

/**
 * Collects all theme colors of the container for the color picker palette.
 * The name ("<header>: <label>") is shown as tooltip.
 * @returns {Array<{color: string, name: string}>}
 */
function _getThemeColorPalette(container, theme) {
  const palette = [];
  let group = '';

  container.querySelectorAll('header, [data-key][data-type="color"]').forEach(el => {
    if (el.tagName === 'HEADER') {
      group = el.textContent.trim();
      return;
    }

    const value = getEntry(theme, el.dataset.key)?.value;
    if (!value)
      return;

    const label = el.querySelector('span')?.textContent.trim();
    palette.push({ color: value, name: label ? `${group}: ${label}` : group });
  });

  return palette;
}

/**
 * inits UI inputs inside the given content container with current theme values.
 * @param {HTMLElement} content - Container with elements holding data-key/type attributes
 * @param {string} themeId - ID of the theme to read from
 */
export function initThemeContent(content, theme) {;
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
      const swatch = el.querySelector('.color-swatch');
      if (swatch)
        setSwatchColor(swatch, value ?? '#000000');
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
    case 'toggle': {
      const toggle = el.querySelector('button[data-checkbox]');
      if (!toggle)
        break;

      setCheckBox(toggle, Boolean(entry.value));
      break;
    }
  }

  _syncCheckbox(el, key, entry);
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

  const isChecked = Boolean(entry.active);
  setCheckBox(checkbox, isChecked);
}