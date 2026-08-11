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
      if (theme?.devOnly === true) {
        return isDevelopment();
      }
    
      return true;
    })
    .map(theme => Object.freeze({
      ...theme,
      builtIn: true,
      builtIn: true,
    }));

  session.set('docThemePresets', presets);
}

export function registerLanguagePresets() {
  const languages = [];
  const styles = [];

  LANGUAGE_PRESETS.forEach(({ createLanguage, createStyles }) => {
    const def = createLanguage();
    if (def?.devOnly === true && !isDevelopment())
      return;

    languages.push(Object.freeze({ ...def, builtIn: true }));

    const defStyles = createStyles(def) ?? [];
    defStyles.forEach(s => styles.push(Object.freeze({ ...s, langId: def.id, builtIn: true })));
  });

  session.set('languagePresets', languages);
  session.set('languageStylePresets', styles);
}