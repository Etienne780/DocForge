import { eventBus } from './EventBus.js';
import { STORAGE_KEY } from './storage/StorageAdapter.js';

export const STORAGE_VERSION = 1;

/**
 * Default state shape. All keys use full camelCase.
 *
 * @typedef {Object} AppState
 * @property {number} storageVersion          - Version of the save
 * @property {Array}   projects        - All project objects
 * @property {Array}  docThemes        -  Array von { id, name, variables: {} }
 * @property {Array}  templates        -  Array von { id, name, project: <Project-Snapshot> }
 * @property {boolean} isDarkMode      - Whether dark theme is active
 * @property {string}  editorMode      - 'split' | 'editor' | 'preview'
 */
const DEFAULT_STATE = {
  storageVersion: STORAGE_VERSION,
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

  /**
   * Resets the session state to its default values.
   */
  reset() {
    this._state = { ...DEFAULT_STATE };
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

  _migrate(state) {
    this._state = {
      ...DEFAULT_STATE,
      ...state,
      storageVersion: STORAGE_VERSION
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
