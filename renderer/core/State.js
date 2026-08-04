import { eventBus } from './EventBus.js';
import { createProject, migrateTab } from '@data/ProjectManager.js';
import { createDocTheme, mergeDocThemeEntries } from '@data/DocThemeManager.js';
import { createSyntaxDefinition } from '@data/SyntaxDefinitionManager.js';

export const STORAGE_VERSION = 1;

/**
 * Default state shape. All keys use full camelCase.
 *
 * @typedef {Object} AppState
 * @property {number}   storageVersion    - Version of the save
 * @property {Array}    recentProjects    -  Array of on web project it self and on desktop path to project with last opend date
 * @property {Array}    projectPresets    -  Array of { id, name, project: <Project-Snapshot> }
 * @property {Array}    themePresets      -  Array of { id, name, theme: <Theme-Snapshot> }
 * @property {boolean}  isDarkMode        - Whether dark theme is active
 * @property {string}   projectEditorMode - 'split' | 'editor' | 'preview'
 * @property {boolean}  hideWebProjectLimitWarn - used only in web. Hides the warning shown when opening a new project would exceed the maximum number of recent projects.
*/
const DEFAULT_STATE = {
  storageVersion: STORAGE_VERSION,
  isFirstLaunch: true,
  hasViewedOverview: false,
  recentProjects: [],
  projectPresets: [],
  themePresets: [],
  isDarkMode: true,
  projectEditorMode: 'split',
  hideWebProjectLimitWarn: false,
  // projectSortAction: 'none',
  // themeSortAction: 'none',
};

/**
 * marks the vars that should be saved in the state save
 */
const PERSISTED_KEYS = [
  'isFirstLaunch',
  'hasViewedOverview',
  'isDarkMode',
  'projectEditorMode',
  'hideWebProjectDeleteWarn',
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
    const snapshot = { storageVersion: STORAGE_VERSION };

    for (const key of PERSISTED_KEYS) {
      snapshot[key] = this._state[key];
    }

    return snapshot;
  }

  /**
   * Returns a shallow copy of the recent projects object with the current storage version
   * @returns {AppState}
   */
  recentProjectsSnapshot() {
    return {
      storageVersion: STORAGE_VERSION,
      projects: this._state.recentProjects.map(template => {
        const snapshot = { ...template };
        delete snapshot['builtIn'];
        return snapshot;
      }),
    };
  }

  /**
   * Returns a shallow copy of the project presets object with the current storage version
   * @returns {AppState}
   */
  projectPresetsSnapshot() {
    return {
      storageVersion: STORAGE_VERSION,
      presets: this._state.projectPresets.map(template => {
        const snapshot = { ...template };
        delete snapshot['builtIn'];
        return snapshot;
      }),
    };
  }

  /**
   * Returns a shallow copy of the theme presets object with the current storage version
   * @returns {AppState}
   */
  themePresetsSnapshot() {
    return {
      storageVersion: STORAGE_VERSION,
      presets: this._state.themePresets.map(template => {
        const snapshot = { ...template };
        delete snapshot['builtIn'];
        return snapshot;
      })
    };
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
  load(data) {
    if (!data) {
      this._state = { ...DEFAULT_STATE };
      return;
    }

    this._migrate(data);
    this._repairInvalidValues();
  }

  loadRecentProjects(data) {
    if (!data) {
      return;
    }

    if (!Array.isArray(data.projects)) {
      this.resetRecentProjects();
      return;
    }

    this._state.recentProjects = data.projects.map(pro => {
      return {
        ...pro,
        builtIn: false,
      };
    });
  }

  loadProjectPresets(presetData) {
    if (!presetData)
      return;

    if (!Array.isArray(presetData.presets)) {
      this.resetProjectPresets();
      return;
    }

    this._state.projectPresets = presetData.presets.map(pre => {
      return {
        ...pre,
        builtIn: false,
      };
    });
  }

  loadThemePresets(presetData) {
    if (!presetData) {
      return;
    }

    if (!Array.isArray(presetData.presets)) {
      this.resetThemePresets();
      return;
    }

    this._state.themePresets = presetData.presets.map(pre => {
      return {
        ...pre,
        builtIn: false,
      };
    });
  }

  _migrate(state) {
    this._state = {
      ...DEFAULT_STATE,
      ...state,
      storageVersion: STORAGE_VERSION
    };
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
