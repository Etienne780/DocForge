const migrationSteps = {

};

const MODES = ['dark', 'light'];

/**
 * Migrates an app theme (@data/AppThemeManager.js) to the current schema and keeps
 * only valid fields: { id, name, baseId, colors: { dark: { var: value }, light: {...} } }.
 * @param {Object} raw
 * @param {number} [storedVersion]
 * @returns {Object}
 */
export function migrateAppTheme(raw, storedVersion = 0) {
  let theme = raw ?? {};

  for (const v of Object.keys(migrationSteps).map(Number).sort((a, b) => a - b)) {
    if (storedVersion < v)
      theme = migrationSteps[v](theme);
  }

  const colors = {};
  for (const mode of MODES) {
    colors[mode] = {};
    for (const [name, value] of Object.entries(theme.colors?.[mode] ?? {})) {
      if (typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(name))
        colors[mode][name] = value;
    }
  }

  return {
    id: typeof theme.id === 'string' ? theme.id : null,
    name: typeof theme.name === 'string' && theme.name.trim() ? theme.name.trim() : 'Unnamed theme',
    baseId: typeof theme.baseId === 'string' ? theme.baseId : null,
    colors,
  };
}
