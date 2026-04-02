import { eventBus } from './EventBus.js';

/**
 * Default session state shape. All keys use full camelCase.
 *
 * @typedef {Object} AppState
 * @property {string|null} activeProjectId  - Currently active project ID
 * @property {string|null}  activeTabID     - Currently active tab ID'<tab-id>'
 * @property {string|null} activeNodeId     - Currently selected node ID
 * @property {Object}  collapsedNodes       - Map of nodeId -> boolean (collapsed)
 * @property {Object}  theme                - CSS variable overrides e.g. { 'accent-color': '#f00' }
 * @property {string}  editorMode           - 'split' | 'editor' | 'preview'
 * @property {string}  searchQuery          - Current sidebar search string
 */
const DEFAULT_SESSION = {
  activeProjectId: null,
  activeTabID: null,
  activeNodeId: null,
  collapsedNodes: {},
  searchQuery: '',
  isEditorSidbarCollpased: false,
};

/**
 * SessionStateManager - central session state with EventBus change notifications.
 *
 * Events emitted when a value changes:
 *   'session:change'           - { key, value, previousValue }
 *   'session:change:<key>'     - { value, previousValue }
 *
 * Example:
 *   session.set('activeTabID', '<ID>');
 *   // → emits 'state:change' and 'state:change:activeTabID'
 */
class SessionStateManager {
  constructor() {
    /** @type {AppState} */
    this._state = { ...DEFAULT_SESSION };
  }

  /**
   * Get a value from session state.
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    return this._state[key] ?? DEFAULT_SESSION[key];
  }

  /**
   * Set a value in session state and emit change events.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    const previousValue = this._state[key];
    this._state[key] = value;
    const payload = { key, value, previousValue };

    eventBus.emit('session:change', payload);
    eventBus.emit(`session:change:${key}`, { value, previousValue });
  }

  /**
   * Returns a shallow copy of the entire session state object.
   * @returns {AppState}
   */
  snapshot() {
    return { ...this._state };
  }

  /**
   * Resets the session state to its default values.
   */
  reset() {
    this._state = { ...DEFAULT_SESSION };
  }
}

/** Singleton SessionStateManager instance. */
export const session = new SessionStateManager();