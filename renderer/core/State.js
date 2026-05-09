import { eventBus } from './EventBus.js';
import { createProject, migrateTab } from '@data/ProjectManager.js';
import { createDocTheme, mergeDocThemeEntries } from '@data/DocThemeManager.js';

export const STORAGE_VERSION = 1;

/**
 * Default state shape. All keys use full camelCase.
 *
 * @typedef {Object} AppState
 * @property {number} storageVersion   - Version of the save
 * @property {Array}   projects        - All project objects
 * @property {Array}  docThemes        -  Array of Docthemes{ id, name, ... }
 * @property {Array} languages         - Array of SyntaxDefinitions { id, name, ... }
 * @property {Array}  templates        -  Array of { id, name, project: <Project-Snapshot> }
 * @property {boolean} isDarkMode      - Whether dark theme is active
 * @property {string}  editorMode      - 'split' | 'editor' | 'preview'
 */
const DEFAULT_STATE = {
  storageVersion: STORAGE_VERSION,
  isFirstLaunch: true,
  hasViewedOverview: false,
  projects: [],
  docThemes: [],
  languages: [],
  templates: [],
  isDarkMode: true,
  editorMode: 'split',
  projectSortAction: 'none',
  themeSortAction: 'none',
};

/**
 * marks the vars that should be saved in the state save
 */
const PERSISTED_KEYS = [
  'isFirstLaunch',
  'hasViewedOverview',
  'templates',
  'isDarkMode',
  'editorMode',
  'projectSortAction',
  'themeSortAction'
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
   * Returns a shallow copy of the projects object with the current storage version
   * @returns {AppState}
   */
  projectSnapshot() {
    return {
      storageVersion: STORAGE_VERSION,
      projects: this._state.projects.map(p => {
        const { builtIn, ...rest } = p;
        return { ...rest };
      })
    };
  }

  /**
   * Returns a shallow copy of the docThemes object with the current storage version
   * @returns {AppState}
   */
  docThemeSnapshot() {
    return {
      storageVersion: STORAGE_VERSION,
      docThemes: this._state.docThemes.map(p => {
        const { builtIn, ...rest } = p;
        return { ...rest };
      })
    };
  }

  /**
   * Returns a shallow copy of the languages object with the current storage version
   * @returns {AppState}
   */
  languagesSnapshot() {
    return {
      storageVersion: STORAGE_VERSION,
      languages: [...this._state.languages]
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

  resetProjects() {
    this._state.projects = [];
  }

  resetDocThemes() {
    this._state.docThemes = [];
  }

  resetLanguages() {
    this._state.languages = [];
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

  loadProjects(projectData) {
    if (!projectData) {
      return;
    }

    this._migrateProjects(projectData);
  }

  loadDocThemes(docThemeData) {
    if (!docThemeData)
      return;

    this._migrateDocThemes(docThemeData);
  }

  loadLanguages(languagesData) {
    if (!languagesData)
      return;

    this._migrateLanguages(languagesData);
  }

  _migrate(state) {
    this._state = {
      ...DEFAULT_STATE,
      ...state,
      storageVersion: STORAGE_VERSION
    };
  }

  _migrateProjects(data) {
    if (!Array.isArray(data.projects)) {
      this._state.projects = [];
      return;
    }

    const defaultProject = createProject('unknown');

    this._state.projects = data.projects.map(project => {
      return {
        ...defaultProject,
        ...project,
        builtIn: false,
        tabs: Array.isArray(project.tabs)
          ? project.tabs.map(tab => migrateTab(tab))
          : [createDefaultTab()]
      };
    });
  }

  _migrateDocThemes(data) {
    if (!Array.isArray(data.docThemes)) {
      this._state.docThemes = [];
      return;
    }

    const defaultTheme = createDocTheme('unknown');

    this._state.docThemes = data.docThemes.map(theme => {
      const merged = {
        ...defaultTheme,
        ...theme,
        builtIn: false
      };

      merged.settings = {
        ...defaultTheme.settings,
        ...theme.settings,
        entries: mergeDocThemeEntries(
          defaultTheme.settings.entries,
          theme?.settings?.entries || []
        )
      };

      return merged;
    });
  }

  _migrateLanguages(data) {
    if (!Array.isArray(data.languages)) {
      this._state.languages = [];
      return;
    }

    this._state.languages = [...data.languages];
  }

  /** Ensures all state values are valid types after loading from storage. */
  _repairInvalidValues() {
    if (!Array.isArray(this._state.projects)) {
      this._state.projects = [];
    }
    const validModes = ['split', 'editor', 'preview'];
    if (!validModes.includes(this._state.editorMode)) {
      this._state.editorMode = 'split';
    }
  }
}

/** Singleton StateManager instance. */
export const state = new StateManager();
