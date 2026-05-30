import { DOC_THEME_PRESETS } from '@core/presets/DocThemePresets.js';
import { LANGUAGE_PRESETS } from '@core/presets/LanguagePresets/LanguagePresets';
import { session } from '@core/SessionState.js';
import { isDevelopment } from '@core/Platform.js';

export function registerPresets() {
  registerDocThemesPresets();
  registerLanguagePresets();
}

export function registerDocThemesPresets() {
  const presets = DOC_THEME_PRESETS
    .map(fn => fn())
    .filter(theme => {
      if (theme.devOnly) {
        return isDevelopment();
      }
    
      return true;
    })
    .map(theme => Object.freeze({
      ...theme,
      isPreset: true
    }));

  session.set('docThemePresets', presets);
}

export function registerLanguagePresets() {
  const presets = LANGUAGE_PRESETS
    .map(fn => fn())
    .filter(lang => {
      if (lang.devOnly) {
        return isDevelopment();
      }
      return true;
    })
    .map(lang => Object.freeze({
      ...lang,
      isPreset: true
    }));

  session.set('languagePresets', presets);
}