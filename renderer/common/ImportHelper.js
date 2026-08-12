import { eventBus } from '@core/EventBus.js';
import { migrateProject } from '@migration/ProjectMigration.js';
import { migrateTheme } from '@migration/ThemeMigration.js';

export function importProject(jsonObj) {
  if (!_validJSONObject(jsonObj) || !jsonObj?.data)
    throw Error('Invalid project structure');

  const project = migrateProject(jsonObj.data, jsonObj.storageVersion ?? 0);

  if (jsonObj.data.themes)
    project.themes = jsonObj.data.themes.map(t => migrateTheme(t, jsonObj.storageVersion ?? 0));
  return project;
}

export function importTheme(jsonObj, project) {
  if (!_validJSONObject(jsonObj) || !jsonObj.data)
    throw Error('Invalid project structure');

  const theme = migrateTheme(jsonObj.data, jsonObj.storageVersion ?? 0);
  project.themes.push(theme);
}

function _validJSONObject(jsonObj) {
  return jsonObj && typeof jsonObj === 'object';
}