import { state } from '@core/State.js'; 
import { eventBus } from '@core/EventBus.js'; 
import { storageManager } from '@core/storage/StorageManager.js';
import { isDevelopment } from '@core/Platform.js';
import { generateId, debounce } from '@common/Common.js';

export const BACKUP_VERSION = 1;

const _MAX_SLOTS = 10;
const _SECONDS_TO_MILLISECONDS = 1000;
const _STORAGE_KEY = 'backup';

/**
 * @typedef {Object} BackupSlotData
 * @brief Snapshot of all subscribed modules at the time of backup creation.
 * @property {object} state      - UI state snapshot (@see State.uiStateSnapshot)
 * @property {object} projects   - Projects snapshot (@see State.projectSnapshot)
 * @property {object} docThemes  - Doc themes snapshot (@see State.docThemeSnapshot)
 * @property {object} languages  - Languages snapshot (@see State.languagesSnapshot)
 */

/**
 * @typedef {Object} BackupSlot
 * @brief A single versioned backup entry stored in the slots array.
 * @property {string}         id     - Unique slot identifier, format: `"backup_<generateId()>"`
 * @property {string}         date   - ISO 8601 creation timestamp, e.g. `"2026-05-31T14:23:00.000Z"`
 * @property {string}         label  - Human-readable label, e.g. `"Auto-Backup"`
 * @property {BackupSlotData} data   - Full state snapshot at time of creation
 */

/**
 * @typedef {Object} BackupData
 * @brief Root structure persisted to storage under the `"backup"` key.
 * @property {number}       version - Schema version (@see BACKUP_VERSION)
 * @property {BackupSlot[]} slots   - Ordered list of snapshots, newest first (max: _MAX_SLOTS)
 */

/**
 * @typedef {Object} BackupSlotInfo
 * @brief Lightweight slot descriptor for UI display — no state data included.
 * @property {string} id    - Unique slot identifier (matches BackupSlot.id)
 * @property {string} label - Human-readable label (matches BackupSlot.label)
 * @property {Date}   date  - Parsed Date object from BackupSlot.date
 */

class BackupManager {
  constructor() {
    this._initCalled = false;
    this._debounceTimeSec = null;
    /** @type {BackupData|null} */
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
      save:  () => this._saveBackup(),
      load:  (data) => this._loadBackup(data),
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
   * @brief Loads persisted backup slots from storage.
   * @returns {Promise<BackupData|null>}
   */
  async loadSlots() {
    await storageManager.loadNow(_STORAGE_KEY);
    this._scheduleAutoSave(this._debounceTimeSec);
    return this._backupData;
  }

  /**
   * @brief Returns lightweight slot descriptors for UI display.
   * @returns {BackupSlotInfo[]}
   */
  getSlotInfos() {
    return this._backupData?.slots?.map(s => ({
      id: s.id,
      label: s.label,
      date: new Date(s.date),
    })) ?? [];
  }

  /**
   * @brief Returns the full slot including state data for a given ID.
   * @param {string} slotId  Slot ID in the format `"backup_<id>"`.
   * @returns {BackupSlot|null}
   */
  getSlot(slotId) {
    const slot = this._backupData?.slots?.find(s => s.id === slotId);
    if (!slot) {
      console.error(`[BackupManager] getSlot() slot '${slotId}' not found`);
      return null;
    }
    return slot;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

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
    /** @type {BackupSlotData} */
    const snapshot = {};

    for (const e of this._backupGetCB) {
      const d = await e.save();
      if (d) snapshot[e.key] = d;
    }

    if (Object.keys(snapshot).length === 0)
      return;

    /** @type {BackupSlot} */
    const slot = {
      id:    'backup_' + generateId(),
      date:  new Date().toISOString(),
      label: 'Auto-Backup',
      data:  snapshot,
    };

    const existing = this._backupData?.slots ?? [];
    this._backupData = {
      version: BACKUP_VERSION,
      slots: [slot, ...existing].slice(0, _MAX_SLOTS),
    };

    if (isDevelopment())
      eventBus.emit('toast:show', { message: `(dev): created backup (interval ${this._debounceTimeSec} sec)`, type: 'info' });

    await storageManager.saveNow(_STORAGE_KEY);
  }

  /** @returns {BackupData|null} */
  _saveBackup() {
    return this._backupData ?? null;
  }

  /** @param {BackupData} data */
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