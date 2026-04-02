import { eventBus } from './EventBus.js';

/** localStorage key for persisted state. */
const STORAGE_KEY = 'docforge';
const STORAGE_VERSION = 1;

/**
 * Default state shape. All keys use full camelCase.
 *
 * @typedef {Object} AppState
 * @property {number} version          - Version of the save
 * @property {Array}   projects        - All project objects
 * @property {Array}  docThemes        -  Array von { id, name, variables: {} }
 * @property {Array}  templates        -  Array von { id, name, project: <Project-Snapshot> }
 * @property {boolean} isDarkMode      - Whether dark theme is active
 * @property {string}  editorMode      - 'split' | 'editor' | 'preview'
 */
const DEFAULT_STATE = {
  version: STORAGE_VERSION,
  projects: [],
  docThemes: [],
  templates: [],
  isDarkMode: true,
  editorMode: 'split',
};

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
    const payload = { key, value, previousValue };

    eventBus.emit('state:change', payload);
    eventBus.emit(`state:change:${key}`, { value, previousValue });
  }

  /**
   * Returns a shallow copy of the entire state object.
   * @returns {AppState}
   */
  snapshot() {
    return { ...this._state };
  }

  /**
   * Resets the session state to its default values.
   */
  reset() {
    this._state = { ...DEFAULT_STATE };
  }

  /**
   * Load state from localStorage. Merges with defaults to handle missing keys.
   * If no stored state is found, sets DEFAULT_STATE
   */
  load() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      this._state = { ...DEFAULT_STATE };
      return; // IMPORTANT
    }
  
    let parsed;
    try {
      parsed = JSON.parse(stored);
    } catch (error) {
      console.warn('[State] Failed to load from localStorage:', error);
      this._state = { ...DEFAULT_STATE };
      return;
    }
    
    // validate structure
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn('[State] Invalid state format, resetting');
      this._state = { ...DEFAULT_STATE };
      return;
    }

    this._migrate(parsed);
    this._repairInvalidValues();
  }

  /**
   * Persist current state to localStorage.
   */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state));
    } catch (error) {
      console.warn('[State] Failed to save to localStorage:', error);
    }
  }

  _migrate(state) {
    this._state = {
      ...DEFAULT_STATE,
      ...state,
      version: STORAGE_VERSION
    };
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
