/**
 * EventBus - lightweight publish/subscribe event system.
 * Used for cross-component communication without tight coupling.
 *
 * Usage:
 *   import { eventBus } from './EventBus.js';
 *
 *   const unsubscribe = eventBus.on('toast:show', ({ message }) => console.log(message));
 *   eventBus.emit('toast:show', { message: 'Saved!', type: 'success' });
 *   unsubscribe(); // remove the handler
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} Unsubscribe function - call it to remove the handler.
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe a specific handler from an event.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  /**
   * Emit an event with an optional data payload.
   * @param {string} event
   * @param {*} [data]
   */
  emit(event, data) {
    // console.log(`[EventBus] Emitting event "${event}"`);
    this._listeners.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[EventBus] Error in handler for "${event}":`, error);
      }
    });
  }

  /**
   * Remove all handlers for a given event.
   * @param {string} event
   */
  clearEvent(event) {
    this._listeners.delete(event);
  }
}

/** Singleton EventBus instance shared across the entire application. */
export const eventBus = new EventBus();
