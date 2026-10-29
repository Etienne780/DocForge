import { PROJECT_SCHEMA_VERSION } from '@core/AppMeta.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { storageManager } from '@core/storage/StorageManager.js';
import { isDevelopment } from '@core/Platform.js';
import { wrapEntity, unwrapEntity } from '@core/Envelope.js';
import { generateId } from '@common/Common.js';
import { getOpenProject, hasUnsavedChanges, cleanSaveProject, notifyProjectChange } from '@data/ProjectManager.js';
import { migrateProject } from '@migration/ProjectMigration.js';

export const BACKUP_VERSION = 2;

const _INTERVAL_SEC = 60 * 5;
const _MAX_SLOTS_PER_PROJECT = 10;
const _SECONDS_TO_MILLISECONDS = 1000;
const _INDEX_KEY = 'backups:index';
const _LEGACY_KEY = 'backup'; // version 1: every backup of every project in one slot

/**
 * Crash protection for the open project: while it has unsaved changes, a copy
 * is written every few minutes (only if it changed since the last backup).
 * Each project gets its own storage slot, `backups:index` lists them.
 * If the newest backup of a project was never followed by a save or a
 * "Don't save", the app most likely crashed and the backup can be restored.
 */

/**
 * @typedef {Object} BackupSlot
 * @property {string} id    - `"backup_<generateId()>"`
 * @property {string} date  - ISO 8601 creation timestamp
 * @property {string} label - e.g. `"Auto-Backup"`
 * @property {{ project: object }} data - `wrapEntity('project', …)` of the project (raw project in slots migrated from version 1)
 */

/**
 * @typedef {Object} BackupFile
 * @brief Stored under `backups:<fileId>`, one per project.
 * @property {number}       version - @see BACKUP_VERSION
 * @property {BackupSlot[]} slots   - newest first (max: _MAX_SLOTS_PER_PROJECT)
 */

/**
 * @typedef {Object} BackupIndexEntry
 * @property {string}      fileId       - storage slot of the project's BackupFile
 * @property {string}      projectKey   - @see getBackupProjectKey
 * @property {string}      projectName  - name at the newest backup
 * @property {string|null} sourcePath
 * @property {string}      lastBackupAt - ISO date of the newest backup
 * @property {string|null} resolvedAt   - ISO date of the last save / discard after a backup
 */

/**
 * @typedef {Object} BackupIndex
 * @brief Stored under `backups:index`.
 * @property {number}             version  - @see BACKUP_VERSION
 * @property {BackupIndexEntry[]} projects
 */

/**
 * Identifies a project across app starts: its file/folder on desktop, its id on web.
 * @param {Object} project
 * @returns {string}
 */
export function getBackupProjectKey(project) {
  return project?.sourcePath
    ? `${project.sourceKind}:${project.sourcePath}`
    : `id:${project?.id}`;
}

/**
 * The project stored in a slot, migrated to the current project schema.
 * @param {BackupSlot} slot
 * @returns {Object|null}
 */
export function getSlotProject(slot) {
  return unwrapEntity(slot?.data?.project, migrateProject, PROJECT_SCHEMA_VERSION);
}

/**
 * Replaces the content of the open project with a backup. The result counts as
 * unsaved until the user saves it.
 * @param {BackupSlot} slot
 * @returns {boolean}
 */
export function restoreBackupIntoOpenProject(slot) {
  const project = getOpenProject();
  const backupProject = getSlotProject(slot);
  if (!project || !backupProject)
    return false;

  const restored = {
    ...backupProject,
    id: project.id,
    sourcePath: project.sourcePath,
    sourceKind: project.sourceKind,
    session: project.session, // keeps the folder bookkeeping and the version
  };

  session.set('openProject', restored);
  notifyProjectChange(restored, () => {});
  return true;
}

class BackupManager {
  constructor() {
    this._initCalled = false;
    /** @type {BackupIndex} */
    this._index = { version: BACKUP_VERSION, projects: [] };
    /** @type {Map<string, BackupFile>} fileId -> loaded file */
    this._files = new Map();
    /** project -> version of its newest backup */
    this._backedUpVersions = new WeakMap();
    this._timer = null;
  }

  async init(intervalSec = _INTERVAL_SEC) {
    if (this._initCalled) {
      console.warn('[BackupManager] init() called more than once - ignoring.');
      return;
    }
    this._initCalled = true;

    await this._loadIndex();
    await this._migrateLegacyBackup();

    this._timer = setInterval(() => this.backupOpenProject(), intervalSec * _SECONDS_TO_MILLISECONDS);

    // saved -> the backups are no longer needed for a recovery
    eventBus.on('project:unsavedChange', ({ project, unsaved }) => {
      if (!unsaved)
        this.markResolved(project);
    });
  }

  /**
   * Backs up the open project if it has unsaved changes that aren't backed up yet.
   * @returns {Promise<boolean>} true if a backup was written
   */
  async backupOpenProject() {
    const project = getOpenProject();
    if (!hasUnsavedChanges(project))
      return false;

    const version = project.session.version;
    if (this._backedUpVersions.get(project) === version)
      return false;

    const ok = await this._createSlot(project);
    if (ok)
      this._backedUpVersions.set(project, version);
    return ok;
  }

  /**
   * Projects that have backups, newest backup first.
   * @returns {BackupIndexEntry[]}
   */
  getProjects() {
    return [...this._index.projects]
      .sort((a, b) => b.lastBackupAt.localeCompare(a.lastBackupAt));
  }

  /**
   * @param {string} fileId
   * @returns {Promise<BackupSlot[]>} newest first
   */
  async loadSlots(fileId) {
    const file = await this._loadFile(fileId);
    return file.slots;
  }

  /**
   * Removes a single backup slot and persists the change. Removes the project
   * from the index once its last slot is gone.
   * @param {string} fileId
   * @param {string} slotId
   * @returns {Promise<boolean>} true if the slot was found and removed
   */
  async removeSlot(fileId, slotId) {
    const file = await this._loadFile(fileId);
    const slots = file.slots.filter(s => s.id !== slotId);
    if (slots.length === file.slots.length)
      return false;

    file.slots = slots;
    if (slots.length > 0) {
      const ok = await storageManager.saveOnce(this._fileKey(fileId), file);
      eventBus.emit('backupManager:change');
      return ok;
    }

    this._index.projects = this._index.projects.filter(e => e.fileId !== fileId);
    this._files.delete(fileId);
    await storageManager.clearOnce(this._fileKey(fileId));
    const ok = await this._saveIndex();
    eventBus.emit('backupManager:change');
    return ok;
  }

  /**
   * The newest backup of the project if it was never followed by a save or a
   * discard, i.e. the app was most likely closed by a crash.
   * @param {Object} project
   * @returns {Promise<BackupSlot|null>}
   */
  async findRecoverySlot(project) {
    const entry = this._findEntry(getBackupProjectKey(project));
    if (!entry || (entry.resolvedAt && entry.resolvedAt >= entry.lastBackupAt))
      return null;

    const slots = await this.loadSlots(entry.fileId);
    return slots[0] ?? null;
  }

  /**
   * Marks the project's backups as handled (saved, discarded or recovery declined),
   * so no recovery is offered for them. The backups themselves are kept.
   * @param {Object} project
   */
  async markResolved(project) {
    const entry = this._findEntry(getBackupProjectKey(project));
    if (!entry || (entry.resolvedAt && entry.resolvedAt >= entry.lastBackupAt))
      return;

    entry.resolvedAt = new Date().toISOString();
    await this._saveIndex();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _fileKey(fileId) {
    return `backups:${fileId}`;
  }

  _findEntry(projectKey) {
    return this._index.projects.find(e => e.projectKey === projectKey) ?? null;
  }

  _getOrCreateEntry(project) {
    const projectKey = getBackupProjectKey(project);
    let entry = this._findEntry(projectKey);
    if (!entry) {
      entry = {
        fileId: 'project_' + generateId(),
        projectKey,
        projectName: project.name,
        sourcePath: project.sourcePath ?? null,
        lastBackupAt: '',
        resolvedAt: null,
      };
      this._index.projects.push(entry);
    }
    return entry;
  }

  async _createSlot(project) {
    const entry = this._getOrCreateEntry(project);
    const file = await this._loadFile(entry.fileId);

    /** @type {BackupSlot} */
    const slot = {
      id:    'backup_' + generateId(),
      date:  new Date().toISOString(),
      label: 'Auto-Backup',
      data:  { project: wrapEntity('project', PROJECT_SCHEMA_VERSION, structuredClone(cleanSaveProject(project))) },
    };

    file.slots = [slot, ...file.slots].slice(0, _MAX_SLOTS_PER_PROJECT);
    entry.projectName = project.name;
    entry.sourcePath = project.sourcePath ?? null;
    entry.lastBackupAt = slot.date;

    const ok = await storageManager.saveOnce(this._fileKey(entry.fileId), file) && await this._saveIndex();

    if (isDevelopment())
      eventBus.emit('toast:show', { message: `(dev): created backup of '${project.name}'`, type: 'info' });

    eventBus.emit('backupManager:change');
    return ok;
  }

  /** @returns {Promise<BackupFile>} */
  async _loadFile(fileId) {
    if (!this._files.has(fileId)) {
      const data = await storageManager.loadOnce(this._fileKey(fileId));
      this._files.set(fileId, {
        version: BACKUP_VERSION,
        slots: Array.isArray(data?.slots) ? data.slots : [],
      });
    }
    return this._files.get(fileId);
  }

  async _loadIndex() {
    const data = await storageManager.loadOnce(_INDEX_KEY);
    if (Array.isArray(data?.projects))
      this._index = { version: BACKUP_VERSION, projects: data.projects };
  }

  _saveIndex() {
    return storageManager.saveOnce(_INDEX_KEY, this._index);
  }

  /**
   * Version 1 kept every backup of every project in the `backup` slot.
   * Moves them into per-project files and removes the old slot. They never
   * trigger a recovery prompt.
   */
  async _migrateLegacyBackup() {
    const legacy = await storageManager.loadOnce(_LEGACY_KEY);
    if (!Array.isArray(legacy?.slots))
      return;

    const touched = new Set();
    // oldest first, so the newest ends up on top
    for (const slot of [...legacy.slots].reverse()) {
      const project = slot?.data?.project;
      if (!project)
        continue;

      const entry = this._getOrCreateEntry(project);
      const file = await this._loadFile(entry.fileId);
      file.slots = [slot, ...file.slots].slice(0, _MAX_SLOTS_PER_PROJECT);

      entry.projectName = project.name ?? entry.projectName;
      if (slot.date > entry.lastBackupAt)
        entry.lastBackupAt = slot.date;
      entry.resolvedAt = entry.lastBackupAt;
      touched.add(entry.fileId);
    }

    let ok = true;
    for (const fileId of touched)
      ok = await storageManager.saveOnce(this._fileKey(fileId), this._files.get(fileId)) && ok;
    ok = await this._saveIndex() && ok;

    if (ok)
      await storageManager.clearOnce(_LEGACY_KEY);
    else
      console.warn('[BackupManager] failed to migrate the old backups, keeping them.');
  }
}

export const backupManager = new BackupManager();

export async function initBackup() {
  await backupManager.init();
}
