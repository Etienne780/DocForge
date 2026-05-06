import { eventBus } from './EventBus.js';

/**
 * Base class for all DocForge UI components.
 *
 * ─── Lifecycle ────────────────────────────────────────────────────────────────
 * 1. ComponentLoader fetches the component's HTML template and injects it into
 *    the container element, replacing {{id:name}} placeholders with prefixed IDs.
 * 2. ComponentLoader instantiates the component class (calls constructor).
 * 3. ComponentLoader calls instance.onLoad() - component wires up event listeners.
 * 4. When destroyed: instance.destroy() calls onDestroy() then removes all
 *    EventBus subscriptions registered via this.subscribe().
 *
 * ─── Element ID Convention ────────────────────────────────────────────────────
 * In the HTML template, use: id="{{id:my-button}}"
 * At runtime this becomes: id="topbar-1__my-button"
 *
 * In JS, retrieve with: this.element('my-button')
 * Or the full ID with: this.elementId('my-button')
 *
 * This ensures multiple instances of the same component have unique DOM IDs.
 *
 * ─── Subclass Example ─────────────────────────────────────────────────────────
 *   export default class MyComponent extends Component {
 *     onLoad() {
 *       this.element('my-button').addEventListener('click', () => this._handleClick());
 *       this.subscribe('state:change:activeTab', ({ value }) => this._onTabChange(value));
 *     }
 *     onDestroy() {
 *       // Clean up anything that subscribe() doesn't cover (e.g. DOM elements appended to body)
 *     }
 *   }
 */
export class Component {
  /**
   * @param {string} instanceId - Unique identifier, e.g. "topbar-1"
   * @param {HTMLElement} container - The DOM element this component owns
   * @param {Object} [props] - Optional configuration passed from the loader
   */
  constructor(instanceId, container, props = {}) {
    this.instanceId = instanceId;
    this.container = container;
    this.props = props;

    /** @type {Array<Function>} Collected unsubscribe functions from subscribe() */
    this._subscriptions = [];

    this.componentPath = this._buildComponentPath();
    if(!this.componentPath)
      console.warn(`[${instanceId}] Failed to resolve component path`);
  }

  /**
   * Returns the prefixed DOM element ID for a named element within this component.
   * @param {string} localName
   * @returns {string} e.g. "topbar-1__search-input"
   */
  elementId(localName) {
    return `${this.instanceId}__${localName}`;
  }

  /**
   * Gets a DOM element within this component by its local name.
   * @param {string} localName
   * @returns {HTMLElement|null}
   */
  element(localName) {
    const globalId = this.elementId(localName);
    return document.getElementById(globalId);
  }

  /**
   * Gets a DOM element within this component by its global name.
   * @param {string} globalName
   * @returns {HTMLElement|null}
   */
  elementById(globalName) {
    return document.getElementById(globalName);
  }

  /**
   * Gets a DOM element within document or a specific container by its local name.
   * @param {string} localName
   * @param {HTMLElement|null} container
   * @returns {HTMLElement|null}
   */
  globalElement(localName, container = null) {
    const globalId = this.elementId(localName);
    const el = container ? container.querySelector(`[id="${globalId}"]`) : document.getElementById(globalId);
    return  el;
  }

  /**
   * Queries the first matching element within this component's container.
   * @param {string} selector
   * @param {HTMLElement} container
   * @returns {HTMLElement|null}
   */
  query(selector, container) {
    return container ? container.querySelector(selector) : this.container.querySelector(selector);
  }

  /**
   * Queries all matching elements within this component's container.
   * @param {string} selector
   * @param {HTMLElement} container
   * @returns {HTMLElement|null}
   */
  queryAll(selector, container) {
    return container ? container.querySelectorAll(selector) : this.container.querySelectorAll(selector);
  }

  /**
   * Subscribe to an EventBus event. The subscription is automatically removed
   * when destroy() is called - no manual cleanup needed in onDestroy().
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} Unsubscribe function (also returned for manual use)
   */
  subscribe(event, handler) {
    const unsubscribe = eventBus.on(event, handler);
    this._subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  // ─── Lifecycle Hooks - override in subclasses ──────────────────────────────

  /** Called after HTML is injected and the instance is created. Wire up listeners here. */
  onLoad() {}

  /** Called before the component is removed. Clean up DOM appended outside container. */
  onDestroy() {}

  /** Called when the component's props are updated from outside. */
  onUpdate(newProps) {}

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * Tears down the component: fires onDestroy, removes all EventBus subscriptions.
   * Called by ComponentLoader.destroy(). Do not call directly.
   */
  destroy() {
    this.onDestroy();
    this._subscriptions.forEach(unsubscribe => unsubscribe());
    this._subscriptions = [];
  }

  _buildComponentPath() {
    // gets the path to this elements components
    let result = null;
    const name = this.container.dataset.componentName;

    if(name) {
      const parts = name.split('/');
      parts.pop();
      parts.push('components');
      result = parts.join('/');
    }

    return result;
  }
}
