import { state } from '../State.js';
import { eventBus } from '@core/EventBus.js';
import { isPlatformWeb } from '@core/Platform.js';
import { LocalStorageAdapter } from './adapters/LocalStorageAdapter.js';
import { ElectronAdapter } from './adapters/ElectronAdapter.js';

/**
 * @class StorageManager
 * @brief Platform-agnostic persistence layer for all application state modules.
 *
 * Sits between application modules and the storage backend. Each module registers
 * itself via subscribe with a save/load/reset handler triple and a unique key
 * (e.g. `"settings"`, `"projects"`, `"backup"`). StorageManager then handles
 * debounced auto-saving on state changes and immediate saves on explicit requests.
 *
 * The actual read/write is delegated to a platform adapter:
 * - **Browser**  → LocalStorageAdapter  (keys are namespaced as `docforge:<key>`)
 * - **Electron** → ElectronAdapter      (file-system based, see key format below)
 *
 * @par Key format and folder mapping
 * Keys may contain colon-separated segments to express a hierarchy:
 * `"saves:autosave"`, `"saves:slots:slot1"`, etc.
 * On file-system platforms each segment becomes a directory level:
 * | Key                    | Path (Electron / Windows)                        |
 * |------------------------|--------------------------------------------------|
 * | `"settings"`           | `%APPDATA%/docforge/settings`                    |
 * | `"saves:autosave"`     | `%APPDATA%/docforge/saves/autosave`              |
 * | `"saves:slots:slot1"`  | `%APPDATA%/docforge/saves/slots/slot1`           |
 *
 * In the browser adapter the key is stored verbatim as a namespaced localStorage
 * key (`docforge:saves:slots:slot1`) — no folder structure is created.
 *
 * Multiple independent datasets (settings, saves, backups, …) are supported — each
 * registered key maps to its own isolated storage slot in the adapter.
 *
 * @par Event contract
 * | Direction | Event                  | Description                             |
 * |-----------|------------------------|-----------------------------------------|
 * | consumed  | `state:change`         | Schedules a debounced auto-save         |
 * | consumed  | `save:request`         | Triggers an immediate full flush        |
 * | consumed  | `save:request:<key>`   | Triggers an immediate single-key save   |
 * | emitted   | `save:complete`        | Fired after a successful full flush     |
 * | emitted   | `save:complete:<key>`  | Fired after a successful single save    |
 * | emitted   | `reset:complete`       | Fired after a successful full reset     |
 * | emitted   | `reset:complete:<key>` | Fired after a successful single reset   |
 */
export class StorageManager {
  constructor() {
    this._initCalled = false;
    /** @type {Map<string, {save: Function, load: Function, reset: Function}>} */
    this._subscribed = new Map();
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._autoSaveTimer = null;
    this._autoSaveDelayMs = 800;
    this._storageAdapter = isPlatformWeb()
      ? new LocalStorageAdapter()
      : new ElectronAdapter();
  }

  /**
   * @brief Wires up global event subscriptions.
   *
   * Must be called once during application bootstrap before any state changes
   * occur. Subsequent calls are ignored.
   */
  init() {
    if (this._initCalled) {
      console.warn('[StorageManager] init() called more than once - ignoring.');
      return;
    }

    eventBus.on('state:change', () => this._scheduleAutoSave());
    eventBus.on('save:request', () => this.saveNow());
    this._initCalled = true;
  }

  /**
   * @brief Registers a module for managed persistence.
   *
   * The module is identified by key, which doubles as the storage slot name
   * passed to the adapter. Keys may use colon-separated segments to express a
   * folder hierarchy on file-system platforms:
   *
   * @code
   * storageManager.subscribe('settings',          handlers); // flat
   * storageManager.subscribe('saves:autosave',    handlers); // one level deep
   * storageManager.subscribe('saves:slots:slot1', handlers); // two levels deep
   * @endcode
   *
   * On Electron each segment maps to a directory:
   * `saves:slots:slot1` → `%APPDATA%/docforge/saves/slots/slot1`.
   * In the browser the key is stored verbatim in localStorage:
   * `docforge:saves:slots:slot1`.
   *
   * A `save:request:<key>` listener is also registered so the module can trigger
   * its own isolated save without flushing unrelated modules.
   *
   * @par Handler signatures
   * @example
   * // save — called by StorageManager to obtain a snapshot. Must return a
   * //         plain JSON-serialisable object. Return null/undefined to skip.
   * save: () => ({ ...myState })
   *
   * // load — called by StorageManager after reading from the adapter.
   * //         Receives the deserialised snapshot and must apply it to state.
   * //         Never called if the slot is empty (first run / after reset).
   * load: (data: object) => void
   *
   * // reset — called to wipe in-memory state back to defaults.
   * //          StorageManager clears the storage slot separately.
   * reset: () => void
   *
   *
   * @param {string} key      Colon-separated storage path for this module's slot.
   * @param {object} handlers
   * @param {() => object}       handlers.save   Returns a JSON-serialisable snapshot.
   * @param {(data: object)=>void} handlers.load Applies a deserialised snapshot.
   * @param {() => void}         handlers.reset  Restores in-memory defaults.
   */
  subscribe(key, { save, load, reset }) {
    if (key)
      eventBus.on(`save:request:${key}`, () => this.saveNow(key));

    this._subscribed.set(key, { save, load, reset });
  }

  /**
   * @brief Unregisters a module and removes its event listener.
   *
   * After this call the key is no longer included in full flushes and its
   * `save:request:<key>` listener is removed from the event bus. The persisted
   * data in the adapter slot is left untouched call reset first if you
   * want to clear it as well.
   *
   * @param {string} key  Storage slot to unregister.
   */
  unsubscribe(key) {
    if (!key)
      return;

    if (!this._subscribed.has(key)) {
      console.warn(`[StorageManager] unsubscribe('${key}') — key was never registered.`);
      return;
    }

    eventBus.off(`save:request:${key}`);
    this._subscribed.delete(key);
  }

  /**
   * @brief Persists state immediately, bypassing the auto-save debounce.
   *
   * Cancels any pending auto-save timer before writing. Pass a key to save
   * only that module's slot (e.g. just `"settings"`), or omit it to flush every
   * registered module to its own slot in one pass.
   * Emits `save:complete` (or `save:complete:<key>`) after the write.
   *
   * @param  {string|null} key  Storage slot to save, or null for a full flush.
   * @return {boolean}          True if all targeted writes succeeded.
   */
  async saveNow(key = null) {
    clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = null;

    const result = key ? await this._saveSingle(key) : await this._saveAll();
    eventBus.emit(`save:complete${key ? ':' + key : ''}`);
    return result;
  }

  /**
   * @brief Loads persisted state immediately.
   *
   * Cancels any pending auto-save timer before reading to avoid a stale write
   * overwriting freshly loaded data. Pass a key to restore only that module
   * (e.g. just `"backup"`), or omit it to restore all registered modules.
   *
   * Silently no-ops for any slot that has no data yet (e.g. first launch).
   *
   * @param {string|null} key  Storage slot to load, or null to load all.
   */
  async loadNow(key = null) {
    clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = null;

    if (key)
      await this._loadSingle(key);
    else
      await this._loadAll();
  }

  /**
   * @brief Resets one or all modules to their default state and clears storage.
   *
   * Calls the module's `reset` handler to wipe in-memory state, then removes the
   * corresponding slot from the adapter. Pass a key to target a single module,
   * or omit it to reset every registered module.
   * Emits `reset:complete` (or `reset:complete:<key>`) after the operation.
   *
   * @param {string|null} key  Storage slot to reset, or null to reset all.
   */
  async reset(key = null) {
    clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = null;

    if (key)
      await this._resetSingle(key);
    else
      await this._resetAll();

    eventBus.emit(`reset:complete${key ? ':' + key : ''}`);
  }

  /**
   * @brief Saves a one-shot snapshot without prior registration.
   *
   * Useful for temporary or dynamic data (e.g. tmp files, session caches) that
   * do not need to participate in auto-saving or full flushes. The slot name
   * follows the same colon-separated key format as subscribe.
   *
   * @param  {string} key   Storage slot name (e.g. `"tmp:preview"`).
   * @param  {object} data  JSON-serialisable snapshot to persist.
   * @return {boolean}      True if the adapter write succeeded.
   */
  async saveOnce(key, data) {
    if (!key || !data) {
      console.error('[StorageManager] saveOnce() requires both a key and data.');
      return false;
    }
    return await this._storageAdapter.save(data, key);
  }

  /**
   * @brief Loads a one-shot snapshot without prior registration.
   *
   * Counterpart to saveOnce. Returns null if the slot is empty or the
   * read fails, so callers can safely treat null as "not found".
   *
   * @param  {string}      key  Storage slot name (e.g. `"tmp:preview"`).
   * @return {object|null}      The deserialised snapshot, or null if not found.
   */
  async loadOnce(key) {
    if (!key) {
      console.error('[StorageManager] loadOnce() requires a key.');
      return null;
    }
    return await this._storageAdapter.load(key);
  }

  /**
   * @brief Clears a one-shot slot without prior registration.
   *
   * Removes the adapter slot for key. Safe to call even if the slot does
   * not exist — the adapter will silently no-op.
   *
   * @param  {string}  key  Storage slot name (e.g. `"tmp:preview"`).
   * @return {boolean}      True if the adapter clear succeeded.
   */
  async clearOnce(key) {
    if (!key) {
      console.error('[StorageManager] clearOnce() requires a key.');
      return false;
    }
    return await this._storageAdapter.clear(key);
  }

  /**
   * @brief Schedules a debounced auto-save across all registered modules.
   *
   * Each call resets the timer, so rapid state changes only result in a single
   * full flush once the stream of changes settles for _autoSaveDelayMs ms.
   *
   * @internal
   */
  _scheduleAutoSave() {
    clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => this.saveNow(), this._autoSaveDelayMs);
  }

  /**
   * @brief Flushes every registered module to its own storage slot.
   *
   * Delegates each write to _saveSingle. Continues on failure so a broken
   * module (e.g. a corrupted backup handler) does not block others from saving.
   *
   * @return {boolean} True only if every slot was written successfully.
   * @internal
   */
  async _saveAll() {
    const results = await Promise.all(
      Array.from(this._subscribed.entries())
        .map(([key, handlers]) => this._saveSingle(key, handlers))
    );
    return results.every(Boolean);
  }

  /**
   * @brief Restores every registered module from its own storage slot.
   *
   * Delegates each read to _loadSingle. Continues on failure so a missing
   * slot (e.g. `"backup"` not yet written) does not block other modules.
   *
   * @internal
   */
  async _loadAll() {
    await Promise.all(
      Array.from(this._subscribed.entries())
        .map(([key, handlers]) => this._loadSingle(key, handlers))
    );
  }

  /**
   * @brief Resets every registered module and clears all storage slots.
   * @internal
   */
  async _resetAll() {
    await Promise.all(
      Array.from(this._subscribed.entries())
        .map(([key, handlers]) => this._resetSingle(key, handlers))
    );
  }

  /**
   * @brief Saves a single module to its adapter slot.
   *
   * Calls the module's `save` handler to obtain a snapshot, then passes it to
   * the adapter together with key as the slot name. The adapter handles the
   * platform-specific key formatting (e.g. `docforge:settings` in localStorage).
   * If handlers is omitted the entry is looked up by key.
   *
   * @param  {string}      key       Storage slot name (e.g. `"settings"`).
   * @param  {object|null} handlers  Pre-resolved handler object, or null to look up.
   * @return {boolean}               True if the adapter write succeeded.
   * @internal
   */
  async _saveSingle(key, handlers = null) {
    if (!key)
      return false;

    const handler = handlers ?? this._subscribed.get(key);
    if (!handler) {
      console.error(`[StorageManager] Failed to save ${key}, entry doesn't exist!`);
      return false;
    }

    if (!handler.save) {
      console.error(`[StorageManager] Failed to save ${key}, save handler is invalid!`);
      return false;
    }

    const data = await handler.save();
    if (!data)
      return false;
    return this._storageAdapter.save(data, key);
  }

  /**
   * @brief Loads a single module from its adapter slot.
   *
   * Reads the stored snapshot from the adapter using key as the slot name,
   * then passes the deserialised object to the module's `load` handler.
   * Silently returns if the slot is empty (first run, or after a reset).
   * If handlers is omitted the entry is looked up by key.
   *
   * @param {string}      key       Storage slot name (e.g. `"projects"`).
   * @param {object|null} handlers  Pre-resolved handler object, or null to look up.
   * @internal
   */
  async _loadSingle(key, handlers = null) {
    if (!key)
      return;

    const handler = handlers ?? this._subscribed.get(key);
    if (!handler) {
      console.error(`[StorageManager] Failed to load ${key}, entry doesn't exist!`);
      return;
    }

    if (!handler.load) {
      console.error(`[StorageManager] Failed to load ${key}, load handler is invalid!`);
      return;
    }

    const data = await this._storageAdapter.load(key);
    if (!data)
      return;
    handler.load(data);
  }

  /**
   * @brief Resets a single module and removes its adapter slot.
   *
   * Calls the module's `reset` handler to restore in-memory defaults, then
   * calls `adapter.clear(key)` to remove the persisted slot entirely. Both
   * steps are attempted independently — a missing `reset` handler is skipped
   * but the storage slot is still cleared, and vice versa.
   *
   * @param {string}      key       Storage slot name (e.g. `"backup"`).
   * @param {object|null} handlers  Pre-resolved handler object, or null to look up.
   * @internal
   */
  async _resetSingle(key, handlers = null) {
    if (!key)
      return;

    const handler = handlers ?? this._subscribed.get(key);
    if (!handler) {
      console.error(`[StorageManager] Failed to reset ${key}, entry doesn't exist!`);
      return;
    }

    if (handler.reset)
      handler.reset();

    const result = await this._storageAdapter.clear(key);
    if (!result)
      console.warn(`[StorageManager] Failed to clear storage for ${key}`);
  }
}

export const storageManager = new StorageManager();

/**
 * Inits the storage manager with the base sub events
 */
export async function InitStorage() {
  storageManager.init();

  storageManager.subscribe('state', {
    save: () => state.snapshot(),
    load: (data) => state.load(data),
    reset: () => state.reset(),
  });

  storageManager.loadNow();
}