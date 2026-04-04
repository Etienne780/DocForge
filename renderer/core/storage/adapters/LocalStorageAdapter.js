import { StorageAdapter } from "../StorageAdapter";

export class LocalStorageAdapter extends StorageAdapter {
  save(stateSnapshot, name = null) {
    try {
      const json = JSON.stringify(stateSnapshot);
      localStorage.setItem(this._buildStorageKey(name), json);
      return true;
    } catch (error) {
      console.warn('[LocalStorageAdapter] Failed to save to localStorage:', error);
      return false;
    }
  }

  load(name = null) {
    const stored = localStorage.getItem(this._buildStorageKey(name));
    if (!stored)
      return null;

    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object')
        return parsed;

      return null;
    } catch (error) {
      if (error?.name === 'QuotaExceededError') {
        console.warn('[LocalStorageAdapter] Storage quota exceeded');
      } else {
        console.warn('[LocalStorageAdapter] Failed to load from localStorage:', error);
      }
      return null;
    }
  }

  clear(name = null) {
    try {
      localStorage.removeItem(this._buildStorageKey(name));
      return true;
    } catch (error) {
      console.warn('[LocalStorageAdapter] Failed to clear localStorage:', error);
      return false;
    }
  }
}