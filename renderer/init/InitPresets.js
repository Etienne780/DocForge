import { DOC_THEME_PRESETS } from '@core/presets/DocThemePresets.js';
import { LANGUAGE_PRESETS } from '@core/presets/LanguagePresets/LanguagePresets';
import { session } from '@core/SessionState.js';

export function registerPresets() {
  registerDocThemesPresets();
  registerLanguagePresets();
}

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

export function registerLanguagePresets() {
  const presets = LANGUAGE_PRESETS.map(fn => {
    const lang = fn();

    return Object.freeze({
      ...lang,
      isPreset: true
    });
  });

  session.set('languagePresets', presets);
}