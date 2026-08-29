import {
  UI_STATE_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION, 
  RECENT_PROJECT_SCHEMA_VERSION,
  PRESET_PROJECT_SCHEMA_VERSION,
  PRESET_THEME_SCHEMA_VERSION
} from '@core/AppMeta.js'
import { eventBus } from '@core/EventBus.js';
import { cleanSaveProject } from '@data/ProjectManager.js';
import { wrapEntity, unwrapEntity } from '@core/Envelope.js';
import { migrateRecentProject } from '@migration/RecentProjectMigration.js';
import { migratePresetProject } from '@migration/PresetProjectMigration.js';
import { migratePresetTheme } from '@migration/PresetThemeMigration.js';
import { removeUnknownProperties } from '@common/Common.js';

/**
 * Default state shape. All keys use full camelCase.
 *
 * @typedef {Object} AppState
 * @property {Array}    recentProjects    -  Array of on web project it self and on desktop path to project with last opend date
 * @property {Array}    projectPresets    -  Array of { id, name, project: <Project-Snapshot> }
 * @property {Array}    themePresets      -  Array of { id, name, theme: <Theme-Snapshot> }
 * @property {boolean}  isDarkMode        - Whether dark theme is active
 * @property {string}   projectEditorMode - 'split' | 'editor' | 'preview'
 * @property {boolean}  hideWebProjectLimitWarn - used only in web. Hides the warning shown when opening a new project would exceed the maximum number of recent projects.
 * @property {boolean}  docEditorWordWrapEnabled - marks if word wrap is in  the doc editor enabled 
*/
const DEFAULT_STATE = {
  isFirstLaunch: true,
  hasViewedOverview: false,
  recentProjects: [],
  projectPresets: [],
  themePresets: [],
  isDarkMode: true,
  projectEditorMode: 'split',
  appereanceSortAction: 'none',
  hideWebProjectLimitWarn: false,
  docEditorWordWrapEnabled: false,
  skippedUpdateVersion: null,
};

/**
 * marks the vars that should be saved in the state save
 */
const PERSISTED_KEYS = [
  'isFirstLaunch',
  'hasViewedOverview',
  'isDarkMode',
  'projectEditorMode',
  'appereanceSortAction',
  'hideWebProjectLimitWarn',
  'docEditorWordWrapEnabled',
  'skippedUpdateVersion',
];

/**
 * StateManager - central state store with EventBus change notifications.
 *
 * Events emitted when a value changes:
 *   'state:change'           - { key, value, previousValue }
 *   'state:change:<key>'     - { value, previousValue }
 *
 * Example:
 *   state.set('isDarkMode', 'true');
 *   // → emits 'state:change' and 'state:change:isDarkMode'
 */
class StateManager {
  constructor() {
    /** @type {AppState} */
    this._state = { ...DEFAULT_STATE };
  }

  /**
   * Get a value from state.
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    return this._state[key] ?? DEFAULT_STATE[key];
  }

  /**
   * Set a value in state and emit change events.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    // console.log(`[State] key: ${key}; value: ${value};`);
    const previousValue = this._state[key];
    this._state[key] = value;

    this.notify(key, { value, previousValue });
  }

  /**
   * Emit a change event for a given state key, optionally scoped to a sub-property.
   * @param {string} key - The state key to notify.
   * @param {{value: *, previousValue: *}} payload - Object containing current and previous values.
   * @param {string|null} [extension=null] - Optional sub-property identifier.
   */
  notify(key, { value, previousValue }, extension = null) {
    const eventPayload = { key, value, previousValue };
    eventBus.emit('state:change', eventPayload);
    eventBus.emit(`state:change:${key}${(extension ? ':' + extension : '')}`, { value, previousValue });
  }

  /**
   * Returns a shallow copy of the entire state object.
   * @returns {AppState}
   */
  snapshot() {
    return { ...this._state };
  }

  uiStateSnapshot() {
    const snapshot = {};

    for (const key of PERSISTED_KEYS) {
      snapshot[key] = this._state[key];
    }

    return wrapEntity('state', UI_STATE_SCHEMA_VERSION, snapshot);
  }

  /**
   * Returns a shallow copy of the recent projects object with the current storage version
   * @returns {WrapEntity}
   */
  recentProjectsSnapshot() {
    const recentProjects = this._state.recentProjects.map(recent => {
      const snapshot = { ...recent };

      // in web, projects are stored inside of recentProjects so they need to be wrapped separately
      if (snapshot.project) {
        const clean = cleanSaveProject(snapshot.project);
        snapshot.project = wrapEntity('project', PROJECT_SCHEMA_VERSION, clean);
      }

      return snapshot;
    })
    
    return wrapEntity('recentProject', RECENT_PROJECT_SCHEMA_VERSION, recentProjects); 
  }

  /**
   * Returns a shallow copy of the project presets object with the current storage version
   * @returns {WrapEntity}
   */
  projectPresetsSnapshot() {
    const projectPresets = this._state.projectPresets;

    return wrapEntity('projectPresets', PRESET_PROJECT_SCHEMA_VERSION, projectPresets);
  }

  /**
   * Returns a shallow copy of the theme presets object with the current storage version
   * @returns {WrapEntity}
   */
  themePresetsSnapshot() {
    const themePresets = this._state.themePresets;

    return wrapEntity('themePresets', PRESET_THEME_SCHEMA_VERSION, themePresets);
  }

  /**
   * Resets the session state to its default values.
   */
  reset() {
    this._state = { ...DEFAULT_STATE };
  }

  uiStateReset() {
    for (const key of PERSISTED_KEYS) {
      this._state[key] = DEFAULT_STATE[key];
    }
  }

  resetRecentProjects() {
    this._state.recentProjects = [];
  }

  resetProjectPresets() {
    this._state.projectPresets = [];
  }

  resetThemePresets() {
    this._state.themePresets = [];
  }

  /**
   * Load state vaia storag manager subscription. Merges with defaults to handle missing keys.
   * If no stored state is found, sets DEFAULT_STATE
   */
  load(rawData) {
    const data = unwrapEntity(rawData, this._migrateUIState, UI_STATE_SCHEMA_VERSION);
    if (!data)
      this._state = { ...DEFAULT_STATE };

    this._state = data;
    this._repairInvalidValues();
  }

  loadRecentProjects(rawData) {
    const data = unwrapEntity(rawData, migrateRecentProject, RECENT_PROJECT_SCHEMA_VERSION);
    if (!data) {
      this.resetRecentProjects();
      return;
    }

    if (!Array.isArray(data)) {
      this.resetRecentProjects();
      return;
    }

    this._state.recentProjects = data;
  }

  loadProjectPresets(rawPresetData) {
    const presetData = unwrapEntity(rawPresetData, migratePresetProject, PRESET_PROJECT_SCHEMA_VERSION);
    if (!presetData)
      return;

    if (!Array.isArray(presetData)) {
      this.resetProjectPresets();
      return;
    }

    this._state.projectPresets = presetData;
  }

  loadThemePresets(rawPresetData) {
    const presetData = unwrapEntity(rawPresetData, migratePresetTheme, PRESET_THEME_SCHEMA_VERSION);
    if (!presetData) {
      return;
    }

    if (!Array.isArray(presetData.presets)) {
      this.resetThemePresets();
      return;
    }

    this._state.themePresets = presetData;
  }

  _migrateUIState(raw, version, currentVersion) {
    let state = {
      ...DEFAULT_STATE,
      ...(raw ?? {}),
    };

    removeUnknownProperties(state, DEFAULT_STATE);
    return state;
  }

  /** Ensures all state values are valid types after loading from storage. */
  _repairInvalidValues() {
    if (!Array.isArray(this._state.recentProjects)) {
      this._state.recentProjects = [];
    }
    const validModes = ['split', 'editor', 'preview'];
    if (!validModes.includes(this._state.projectEditorMode)) {
      this._state.projectEditorMode = 'split';
    }
  }
}

/** Singleton StateManager instance. */
export const state = new StateManager();
