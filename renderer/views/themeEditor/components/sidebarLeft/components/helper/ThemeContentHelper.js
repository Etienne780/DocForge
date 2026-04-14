import { eventBus } from '@core/EventBus.js';
import { 
  resetThemeSettings,
  findDocTheme,
  getThemeColor, 
  getThemeBorderRadius,
  getThemeSpacing,
  getThemeFontSize,
} from '@data/DocThemeManager.js';

/**
 * Resets theme values for all keys found in the given content container.
 * @param {string} area - UI area identifier (for error context)
 * @param {HTMLElement} content - Container with elements holding data-key attributes
 * @param {string} themeId - ID of the theme to reset
 * @returns {boolean} True if reset was executed, false if theme not found
 */
export function resetThemeContent(area, content, themeId) {
  const theme = _getThemeWithError(area, themeId);
  if(!theme)
    return false;

  // collect params from the context page
  let params = [];
  Array.from(content.children).forEach(el => {
    if(el.dataset && el.dataset.key)
      params.push(el.dataset.key);
  });

  resetThemeSettings(theme, params);
  return true;
}

/**
 * Updates UI inputs inside the given content container with current theme values.
 * @param {string} area - UI area identifier (for error context)
 * @param {HTMLElement} content - Container with elements holding data-key/type attributes
 * @param {string} themeId - ID of the theme to read from
 */
export function updateThemeContent(area, content, themeId) {
  const theme = _getThemeWithError(area, themeId);
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
  switch(type) {
  case 'color': {
      const color = getThemeColor(theme, key);
      const input = el.querySelector('input[type="color"]');

      if (input)
        input.value = color ?? '#000000ff';
      break;
    }
  case 'number': {
      let value = null;
      const radius = getThemeBorderRadius(theme, key);
      const spacing = getThemeSpacing(theme, key);
      const fontSize = getThemeFontSize(theme, key);

      value = radius ??
        spacing ??
        fontSize ?? null;

      const input = el.querySelector('input[type="number"]');
      if (input)
        input.value = value ?? 0;
      break;
    }
  }
}

function _getThemeWithError(area, themeId) {
  const theme = findDocTheme(themeId);
  if(!theme) {
    eventBus.emit('toast:show', { message: `[themeEditor:sidebar:${area}] Faild to find Doc-Theme \'${themeId}\'`, type: 'error' });
    eventBus.emit('navigate:themeManager');
    return null;
  }
  return theme;
}