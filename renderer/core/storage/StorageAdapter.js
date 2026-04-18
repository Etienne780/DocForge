import { session } from '@core/SessionState.js';

/** localStorage key for persisted state. */
export const STORAGE_KEY = 'docforge';

/**
 * @class StorageAdapter
 * @brief Abstract base class for all platform-specific storage backends.
 *
 * Defines the interface that StorageManager depends on. Concrete adapters
 * implement the three operations (save / load / clear) for their respective
 * platform — localStorage in the browser, the file system in Electron.
 *
 * Do not instantiate directly; extend and implement all three methods.
 */
export class StorageAdapter {
  constructor() {
    if (new.target === StorageAdapter) {
      throw new Error('StorageAdapter is abstract and cannot be instantiated directly');
    }
  }

  /**
   * @brief Persists a state snapshot to the storage backend.
   *
   * Implementors should serialise stateSnapshot and write it to the slot
   * identified by name. The slot path is resolved via _buildStorageKey.
   *
   * @param  {object}      stateSnapshot  JSON-serialisable data to persist.
   * @param  {string|null} name           Storage slot name, or null for the root slot.
   * @return {boolean}                    True if the write succeeded.
   */
  save(stateSnapshot, name = null) {
    throw new Error('save() must be implemented');
  }

  /**
   * @brief Reads a previously persisted snapshot from the storage backend.
   *
   * Implementors should retrieve and deserialise the data stored under name.
   * Returns null if the slot is empty or the read fails, so callers can treat
   * null as "not found" without additional error handling.
   *
   * @param  {string|null} name  Storage slot name, or null for the root slot.
   * @return {object|null}       The deserialised snapshot, or null if not found.
   */
  load(name = null) {
    throw new Error('load() must be implemented');
  }

  /**
   * @brief Removes a storage slot from the backend entirely.
   *
   * Implementors should delete all data stored under name. Safe to call
   * even if the slot does not exist — implementations should silently no-op.
   *
   * @param  {string|null} name  Storage slot name, or null for the root slot.
   * @return {boolean}           True if the clear succeeded.
   */
  clear(name = null) {
    throw new Error('clear() must be implemented');
  }

  /**
   * @brief Builds the final storage key or path for a given slot name.
   *
   * Strips any character that is not alphanumeric, a colon, underscore, or
   * hyphen, then prepends the global namespace `docforge`. Colon segments are
   * interpreted differently per adapter:
   * - **LocalStorageAdapter** — kept as-is: `docforge:saves:slots:slot1`
   * - **ElectronAdapter**     — colons become path separators:
   *   `%APPDATA%/docforge/saves/slots/slot1`
   *
   * @param  {string|null} name  Colon-separated slot name, or null for the root key.
   * @return {string}            The fully-qualified storage key or file-system path.
   * @internal
   */
  _buildStorageKey(name) {
    const isDev = session.get('isDev') ?? false;
    const safeName = name ? String(name).replace(/[^a-z0-9:_-]/gi, '') : '';
    return `${STORAGE_KEY}${isDev ? ':dev:': ''}${safeName ? ':' + safeName : ''}`;
  }
}