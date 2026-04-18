import { DOC_THEME_PRESETS } from '@core/presets/DocThemePresets.js';
import { session } from '@core/SessionState.js';

export function registerDocThemesPresets() {
  const presets = DOC_THEME_PRESETS.map(fn => {
    const theme = fn();

    return Object.freeze({
      ...theme,
      isPreset: true
    });
  });

  session.set('docThemePresets', presets);
}