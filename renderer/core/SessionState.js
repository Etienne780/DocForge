import { eventBus } from './EventBus.js';

/**
 * Default session state shape. All keys use full camelCase.
 *
 * @typedef {Object} AppState
 * @property {string|null} activeProjectId  - Currently active project ID
 * @property {string|null}  activeTabId     - Currently active tab ID'<tab-id>'
 * @property {string|null} activeNodeId     - Currently selected node ID
 * @property {Object}  collapsedNodes       - Map of nodeId -> boolean (collapsed)
 * @property {string}  projectSearchQuery          - Current sidebar search string for project section
 * @property {string}  themeSearchQuery          - Current sidebar search string for theme section
 * @property {bool}  isRightDocEditorSidebarCollpased - Doc Editor right sidebar collapsed
 * @property {string} themeManagerDisplay - 'all', 'doc' or 'lang'
 */
const DEFAULT_SESSION = {
  isDev: null,// gets set in main.js
  activeSection: null,// project/theme
  activeProjectId: null,
  activeTabId: null,
  activeNodeId: null,
  collapsedNodes: {},
  docThemePresets: [],
  languagePresets: [],
  projectSearchQuery: '',
  projectThemeSearchQuery: '',
  themeSearchQuery: '',
  activeView: null,// gets set through the view manager
  isRightDocEditorSidebarCollapsed: false,
  themeManagerDisplay: 'all',
};

/**
 * SessionStateManager - central session state with EventBus change notifications.
 *
 * Events emitted when a value changes:
 *   'session:change'           - { key, value, previousValue }
 *   'session:change:<key>'     - { value, previousValue }
 *
 * Example:
 *   session.set('activeTabId', '<ID>');
 *   // → emits 'state:change' and 'state:change:activeTabId'
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
    eventBus.emit('session:change', eventPayload);
    eventBus.emit(`session:change:${key}${(extension ? ':' + extension : '')}`, { value, previousValue });
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