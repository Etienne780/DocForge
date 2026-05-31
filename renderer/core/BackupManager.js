import { state } from '@core/State.js'; 
import { storageManager } from '@core/storage/StorageManager.js';
import { generateId, debounce } from '@common/Common.js';

export const BACKUP_VERSION = 1;

const _MAX_SLOTS = 10;
const _SECONDS_TO_MILLISECONDS = 1000;
const _STORAGE_KEY = 'backup';

class BackupManager {
  constructor() {
    this._initCalled = false;
    this._debounceTimeSec = null;
    this._backupData = null;
    this._backupGetCB = [];
    this._scheduledSave = null;
  }

  init(debounceTimeSec = 60 * 30) {
    if (this._initCalled) {
      console.warn('[BackupManager] init() called more than once - ignoring.');
      return;
    }

    this._debounceTimeSec = debounceTimeSec;
    storageManager.subscribe(_STORAGE_KEY, {
      save: () => this._saveBackup(),
      load: (data) => this._loadBackup(data),
      reset: () => this._resetBackup(),
      merge: null,
    }, {
      autoSaveOnChange: false,
    });

    this._scheduleAutoSave(debounceTimeSec);
    this._initCalled = true;
  }

  /**
   * @param {string} key
   * @param {{ save: () => object }} handlers
   */
  subscribe(key, { save }) {
    if (typeof save !== 'function') {
      console.error(`[BackupManager] subscribe() failed for '${key}' — save must be a function.`);
      return;
    }
    this._backupGetCB.push({ key, save });
  }

  /**
   * Loads the slots 
   * @returns backup data
   */
  async loadSlots() {
    await storageManager.loadNow(_STORAGE_KEY);
    this._scheduleAutoSave(this._debounceTimeSec);
    return this._backupData;
  }

  /**
   * Returns a list of available backup slots for the UI.
   * @returns {{ id: string, label: string, date: Date }[]}
   */
  getSlotInfos() {
    return this._backupData?.slots?.map(s => ({
      id: s.id,
      label: s.label,
      date: new Date(s.id),
    })) ?? [];
  }

  /**
   * Gets the slot with the corresponding id
   * @param {number} slotId
   * @returns {{ id: string, label: string, data: data }[]}
   */
  getSlot(slotId) {
    const slot = this._backupData?.slots?.find(s => s.id === slotId);
    if (!slot) {
      console.error(`[BackupManager] restore() slot '${slotId}' not found`);
      return null;
    }

    return slot;
  }

  _scheduleAutoSave(debounceTimeSec) {
    if (this._scheduledSave)
      this._scheduledSave.cancel();

    this._scheduledSave = debounce(async () => {
      await this._createSnapshot();
      this._scheduleAutoSave(debounceTimeSec);
    }, debounceTimeSec * _SECONDS_TO_MILLISECONDS);

    this._scheduledSave();
  }

  async _createSnapshot() {
    const snapshot = {};

    for (const e of this._backupGetCB) {
      const d = await e.save();
      if (d) snapshot[e.key] = d;
    }

    if (Object.keys(snapshot).length === 0)
      return;

    const existing = this._backupData?.slots ?? [];
    this._backupData = {
      version: BACKUP_VERSION,
      slots: [
        { id: 'backup_' + generateId(), date: new Date().toISOString(), label: 'Auto-Backup', data: snapshot },
        ...existing,
      ].slice(0, _MAX_SLOTS),
    };

    await storageManager.saveNow(_STORAGE_KEY);
  }

  // Called by StorageManager to persist _backupData
  _saveBackup() {
    return this._backupData ?? null;
  }

  _loadBackup(data) {
    this._backupData = data;
  }

  _resetBackup() {
    this._backupData = null;
  }
}

export const backupManager = new BackupManager();

export async function initBackup() {
  backupManager.init();

  backupManager.subscribe('state',     { save: () => state.uiStateSnapshot() });
  backupManager.subscribe('projects',  { save: () => state.projectSnapshot() });
  backupManager.subscribe('docThemes', { save: () => state.docThemeSnapshot() });
  backupManager.subscribe('languages', { save: () => state.languagesSnapshot() });
}