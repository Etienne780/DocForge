import { buildInfoModal } from './modal/InfoModal.js';
import { buildUpdateModal } from './modal/UpdateModal.js';
import { buildCreateProjectModal } from './modal/CreateProjectModal.js';
import { buildOverviewModal } from './modal/OverviewModal.js';
import { buildBackupManagerModal } from './modal/BackupManagerModal.js';
import { buildExportProjectModal } from './modal/ExportProjectModal.js';
import { buildImportProjectModal } from './modal/ImportProjectModal.js';

/* 
  Call following events to open a specific modal:

  name | events | payload | html-id
  ---|---|---|---
  InfoModal | show:modal:info | {} | application-info-modal
  UpdateModal | show:modal:update | {} | application-update-modal
  CreateProjectModal | show:modal:createProject | {} | application-create_project-modal
  OverviewModal | show:modal:overview | {} | application-overview-modal
  ExportProjectModal | show:modal:exportProject | { Project: Object } | application-export_project-modal
  ImportProjectModal | show:modal:importProject | { } | application-import_project-modal

*/

const _sharedModals = {
  info: null,
  update: null,
  createProject: null,
  overview: null,
  backupManager: null,
  exportProject: null,
  importProject: null,
};

export function initSharedModals() {
  _sharedModals.info = buildInfoModal();
  _sharedModals.update = buildUpdateModal();
  _sharedModals.createProject = buildCreateProjectModal();
  _sharedModals.overview = buildOverviewModal();
  _sharedModals.backupManager = buildBackupManagerModal();
  _sharedModals.exportProject = buildExportProjectModal();
  _sharedModals.importProject = buildImportProjectModal();
}

export function getSharedModal(name) {
  const modal = _sharedModals[name];
  if (!modal) 
    throw new Error(`[SharedModals] Modal '${name}' not found or not yet initialized`);
  return modal;
}