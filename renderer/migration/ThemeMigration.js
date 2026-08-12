import { createDocTheme, mergeDocThemeEntries } from '@data/DocThemeManager.js';

const migrationSteps = { 

};

export function migrateTheme(raw, storedVersion = 0) {
  let theme = raw ?? {};

  for (const v of Object.keys(migrationSteps).map(Number).sort((a,b) => a - b)) {
    if (storedVersion < v) {
      theme = migrationSteps[v](theme);
    }
  }

  const defaultTheme = createDocTheme('unknown');
  return {
    ...defaultTheme,
    ...theme,
    settings: {
      ...defaultTheme.settings,
      ...theme.settings,
      entries: mergeDocThemeEntries(defaultTheme.settings.entries, theme?.settings?.entries ?? []),
    },
  };
}