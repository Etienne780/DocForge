export function migratePresetTheme(raw, storedVersion = 0) {
  let preset = raw ?? [];

  if (!Array.isArray(preset))
    return [];

  for (let i = 0; i < preset.length; i++) {
    const pre = preset[i];

    preset[i] = {
      ...pre,
      builtIn: false,
    };
  }

  return preset;
}