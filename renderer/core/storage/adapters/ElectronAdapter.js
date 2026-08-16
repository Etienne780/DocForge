import { StorageAdapter } from '../StorageAdapter';
import { getUserDataPath } from '@core/Platform.js';

export class ElectronAdapter extends StorageAdapter {

  constructor() {
    super();
    this._userDataPath = null;
  }

  async save(stateSnapshot, name = null) {
    try {
      const filePath = await this._getStoragePath(name);
      const json = JSON.stringify(stateSnapshot, null, 2);
      const result = await window.electronAPI.writeFile(filePath, json);
      if (!result.ok)
        console.warn(`[ElectronAdapter] Failed to save ${name}:`, result.error);
      return result.ok;
    } catch (error) {
      console.warn('[ElectronAdapter] save() error:', error);
      return false;
    }
  }

  async load(name = null) {
    try {
      const filePath = await this._getStoragePath(name);
      const result = await window.electronAPI.readFile(filePath);
      if (!result.ok)
        return null;

      const parsed = JSON.parse(result.data);
      if(parsed && typeof parsed === 'object')
        return parsed;

      return null;
    } catch (error) {
      console.warn('[ElectronAdapter] load() error:', error);
      return null;
    }
  }

  async clear(name = null) {
    try {
      const filePath = await this._getStoragePath(name);
      const result = await window.electronAPI.deleteFile(filePath);
      if (!result.ok)
        console.warn(`[ElectronAdapter] Failed to clear ${name}:`, result.error);
      return result.ok;
    } catch (error) {
      console.warn('[ElectronAdapter] clear() error:', error);
      return false;
    }
  }

  async _getStoragePath(name) {
    this._userDataPath = await this._resolveUserDataPath();

    const raw = this._buildStorageKey(name) // "docforge:saves:slots:slot1"
      .replace(/:/g, '/');                   // "docforge/saves/slots/slot1"
  
    const index = raw.indexOf('/');
    const relative = 'data' + raw.slice(index); // "data/saves/slots/slot1"
  
    return window.electronAPI.joinPath(this._userDataPath, relative + '.json');
  }

  /**
   * @brief Resolves (and memoizes) the Electron userData path.
   *
   * `StorageManager._loadAll()` fires `load()` for every subscribed key
   * concurrently (`Promise.allSettled`), so on the very first call - before
   * `this._userDataPath` has ever been set - several `_getStoragePath()`
   * calls can land before any of them has resolved. The old code only cached
   * the *resolved value* (`if (!this._userDataPath) this._userDataPath =
   * await getUserDataPath()`), so every one of those concurrent calls saw an
   * empty cache and fired its own redundant `getUserDataPath()` IPC round-trip
   * instead of sharing one.
   *
   * This caches the *in-flight promise itself*, so every concurrent caller
   * awaits the exact same call - only one IPC round-trip ever happens, no
   * matter how many loads/saves race on startup.
   *
   * @returns {Promise<string>}
   * @internal
   */
  _resolveUserDataPath() {
    this._userDataPathPromise ??= getUserDataPath();
    return this._userDataPathPromise;
  }
}