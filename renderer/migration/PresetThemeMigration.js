import { migrateTheme } from './ThemeMigration.js';
import { THEME_SCHEMA_VERSION } from '@core/AppMeta.js';

export function migratePresetTheme(raw, storedVersion = 0) {
  let preset = raw ?? [];

  if (!Array.isArray(preset))
    return [];

  for (let i = 0; i < preset.length; i++) {
    const pre = preset[i];

    // stored themes get new theme entries (with their defaults)
    const theme = Array.isArray(pre?.settings?.entries) ? migrateTheme(pre, THEME_SCHEMA_VERSION) : pre;
    preset[i] = {
      ...theme,
      builtIn: false,
    };
  }

  return preset;
}