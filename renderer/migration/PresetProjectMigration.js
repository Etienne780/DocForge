const migrationSteps = {
  // presets got `description`, `createdAt` and `projectVersion` (schema of `project`).
  // The project schema of older presets is unknown, so they run every project step.
  2: (presets) => presets.map(preset => ({
    ...preset,
    description: preset.description ?? '',
    createdAt: preset.createdAt ?? Date.now(),
    projectVersion: preset.projectVersion ?? 0,
  })),
  // next file format changes ...
};

export function migratePresetProject(raw, storedVersion = 0) {
  let presets = raw ?? [];

  if (!Array.isArray(presets))
    return [];

  for (const version of Object.keys(migrationSteps).map(Number).sort((a, b) => a - b)) {
    if (storedVersion < version)
      presets = migrationSteps[version](presets);
  }

  return presets.map(preset => ({
    ...preset,
    builtIn: false,
  }));
}
