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
 * @property {string}   colorPickerMode   - 'sv-square' | 'hsl-wheel' | 'hsl-sliders' | 'rgb-sliders', view used by every color picker
 * @property {Object}   editorColors      - legacy: doc editor colors before app themes, moved into a custom app theme on start (AppThemeManager)
 * @property {string}   appThemeId        - selected app theme (@data/AppThemeManager.js), the variant follows isDarkMode
 * @property {number}   themePreviewHighlightAmount   - % white mixed into the color under the mouse in the theme editor preview, 0 = off
 * @property {number}   themePreviewHighlightDuration - ms of one pulse step (normal -> brightest) of that color
 * @property {boolean}  rememberEntryScroll - doc editor: reopening an entry restores its scroll position (session only)
 * @property {number}   historySize - max undo steps of the open project (@data/ProjectHistory.js)
 * @property {Object}   shortcutOverrides - { "context:name": combo | '' } user keys of the shortcuts (ShortcutManager)
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
  colorPickerMode: 'sv-square',
  editorColors: { dark: {}, light: {} },
  themePreviewHighlightAmount: 10,
  themePreviewHighlightDuration: 1200,
  rememberEntryScroll: true,
  historySize: 100,
  shortcutOverrides: {},
  appThemeId: 'docforge',
};

/**
 * Value type for keys whose DEFAULT_STATE value is null (null is always allowed too)
 */
const NULLABLE_TYPES = {
  skippedUpdateVersion: 'string',
};

/**
 * Keys that only accept a fixed set of values
 */
const ALLOWED_VALUES = {
  projectEditorMode: ['split', 'editor', 'preview'],
  colorPickerMode: ['sv-square', 'hsl-wheel', 'hsl-sliders', 'rgb-sliders'],
};

/**
 * Number keys with a valid range (inclusive). Values outside are clamped when loading,
 * readers use getStateNumber() so a value set at runtime stays in range too.
 */
export const NUMBER_RANGES = {
  themePreviewHighlightAmount:   { min: 0,   max: 100 },
  themePreviewHighlightDuration: { min: 200, max: 2000 },
  historySize:                   { min: 10,  max: 500 },
};

/**
 * Returns the type of a value like typeof, but separates 'array' and 'null' from 'object'
 * @param {*} value
 * @returns {string}
 */
function getValueType(value) {
  if (value === null)
    return 'null';
  if (Array.isArray(value))
    return 'array';
  return typeof value;
}

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
  'colorPickerMode',
  'editorColors',
  'themePreviewHighlightAmount',
  'themePreviewHighlightDuration',
  'rememberEntryScroll',
  'historySize',
  'shortcutOverrides',
  'appThemeId',
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
 *   // -> emits 'state:change' and 'state:change:isDarkMode'
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
    if (!data) {
      this.uiStateReset();
      return;
    }

    for (const key of PERSISTED_KEYS) {
      this._state[key] = data[key];
    }
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

    if (!Array.isArray(presetData)) {
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

  /**
   * Ensures all state values match the type of their DEFAULT_STATE value after loading from storage.
   * Keys with a null default take their type from NULLABLE_TYPES, keys in ALLOWED_VALUES must be one of the listed values,
   * keys in NUMBER_RANGES are clamped.
   * Invalid values are replaced with the default.
   */
  _repairInvalidValues() {
    for (const key of Object.keys(DEFAULT_STATE)) {
      const value = this._state[key];
      const defaultValue = DEFAULT_STATE[key];

      const isValid = defaultValue === null
        ? value === null || getValueType(value) === NULLABLE_TYPES[key]
        : getValueType(value) === getValueType(defaultValue);

      if (!isValid || (ALLOWED_VALUES[key] && !ALLOWED_VALUES[key].includes(value))) {
        this._state[key] = Array.isArray(defaultValue) ? [] : defaultValue;
      } else if (NUMBER_RANGES[key]) {
        this._state[key] = clampToRange(key, value);
      }
    }
    this._state.editorColors = this._repairEditorColors(this._state.editorColors);
  }

  /** Keeps only { dark: { token: string }, light: { ... } }. */
  _repairEditorColors(colors) {
    const repaired = { dark: {}, light: {} };
    for (const mode of Object.keys(repaired)) {
      const source = colors?.[mode];
      if (!source || typeof source !== 'object')
        continue;
      for (const [token, value] of Object.entries(source)) {
        if (typeof value === 'string' && value)
          repaired[mode][token] = value;
      }
    }
    return repaired;
  }
}

/** Singleton StateManager instance. */
export const state = new StateManager();

/**
 * Clamps a number into the NUMBER_RANGES range of its key (default if not a finite number).
 * @param {string} key
 * @param {*} value
 * @returns {number}
 */
function clampToRange(key, value) {
  const range = NUMBER_RANGES[key];
  if (typeof value !== 'number' || !Number.isFinite(value))
    return DEFAULT_STATE[key];
  return range ? Math.min(Math.max(value, range.min), range.max) : value;
}

/**
 * Default value of a state key (e.g. for "reset" buttons).
 * @param {string} key
 * @returns {*} a copy for objects and arrays
 */
export function getStateDefault(key) {
  const value = DEFAULT_STATE[key];
  return value !== null && typeof value === 'object' ? structuredClone(value) : value;
}

/**
 * Reads a number key, clamped into its NUMBER_RANGES range.
 * @param {string} key
 * @returns {number}
 */
export function getStateNumber(key) {
  return clampToRange(key, state.get(key));
}
