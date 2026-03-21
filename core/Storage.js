import { state } from './State.js';
import { eventBus } from './EventBus.js';

/**
 * StorageManager — handles auto-save scheduling and manual save triggers.
 *
 * Listens to 'state:change' and debounces writes to localStorage.
 * Also listens to 'save:request' for immediate saves.
 *
 * Events consumed:
 *   'save:request' — triggers an immediate save
 *
 * Events emitted:
 *   'save:complete' — fired after a successful save
 */
class StorageManager {
  constructor() {
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._autoSaveTimer = null;
    this._autoSaveDelayMs = 800;
  }

  /**
   * Wire up event subscriptions. Call once during application bootstrap.
   */
  initialize() {
    eventBus.on('state:change', () => this._scheduleAutoSave());
    eventBus.on('save:request', () => this.saveNow());
  }

  /**
   * Schedule a debounced save. Resets the timer on each call.
   * Used internally by the state:change handler.
   */
  _scheduleAutoSave() {
    clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => this.saveNow(), this._autoSaveDelayMs);
  }

  /**
   * Save immediately, cancelling any pending auto-save timer.
   * Emits 'save:complete' after saving.
   */
  saveNow() {
    clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = null;
    state.save();
    eventBus.emit('save:complete');
  }
}

/** Singleton StorageManager instance. */
export const storage = new StorageManager();
