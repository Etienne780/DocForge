import { buildInfoModal } from './modal/InfoModal.js';
import { buildUpdateModal } from './modal/UpdateModal.js';
import { buildCreateProjectModal } from './modal/CreateProjectModal.js';
import { buildCreateTemplateModal } from './modal/CreateTemplateModal.js';
import { buildOverviewModal } from './modal/OverviewModal.js';
import { buildChangelogModal } from './modal/ChangelogModal.js';
import { buildExportPreviewModal } from './modal/ExportPreviewModal.js';
import { buildBackupManagerModal } from './modal/BackupManagerModal.js';
import { buildExportProjectModal } from './modal/export/ExportProjectModal.js';
import { buildImportProjectModal } from './modal/import/ImportProjectModal.js';
import { buildExportDocThemeModal } from './modal/export/ExportDocThemeModal.js';
import { buildExportLanguageModal } from './modal/export/ExportLanguageModal.js';
import { buildExportLanguageStyleModal } from './modal/export/ExportLanguageStyleModal.js';
import { buildImportDocThemeModal } from './modal/import/ImportDocThemeModal.js';
import { buildImportLanguageModal } from './modal/import/ImportLanguageModal.js';
import { buildImportLanguageStyleModal } from './modal/import/ImportLanguageStyleModal.js';

/* 
  Call following events to open a specific modal:

  name | events | payload | html-id
  ---|---|---|---
  InfoModal | show:modal:info | {} | application-info-modal
  UpdateModal | show:modal:update | {} | application-update-modal
  CreateProjectModal | show:modal:createProject | {} | application-create_project-modal
  CreateTemplateModal | show:modal:createTemplate | { project? , recentProjectId? } | application-create_template-modal
  OverviewModal | show:modal:overview | {} | application-overview-modal
  ChangelogModal | show:modal:changelog | {} | application-changelog-modal
  BackupModal | show:modal:backupManager | {} | application-backup_manager-modal
  ExportProjectModal | show:modal:exportProject | { Project: Object } | application-export_project-modal
  ExportPreviewModal | show:modal:exportPreview | { project: Object } | application-export_preview-modal
  ImportProjectModal | show:modal:importProject | { } | application-import_project-modal
  ExportDocThemeModal | show:modal:exportDocTheme | { project, themeId } | application-export_doc_theme-modal
  ExportLanguageModal | show:modal:exportLanguage | { project, langId } | application-export_language-modal
  ExportLanguageStyleModal | show:modal:exportLanguageStyle | { project, styleId } | application-export_language_style-modal
  ImportDocThemeModal | show:modal:importDocTheme | { projectId?, data?, filePath? } | application-import_doc_theme-modal
  ImportLanguageModal | show:modal:importLanguage | { projectId?, data?, filePath? } | application-import_language-modal
  ImportLanguageStyleModal | show:modal:importLanguageStyle | { projectId?, langId?, data?, filePath? } | application-import_language_style-modal

*/

const _sharedModals = {
  info: null,
  update: null,
  createProject: null,
  createTemplate: null,
  overview: null,
  changelog: null,
  backupManager: null,
  exportProject: null,
  exportPreview: null,
  importProject: null,
  exportDocTheme: null,
  exportLanguage: null,
  exportLanguageStyle: null,
  importDocTheme: null,
  importLanguage: null,
  importLanguageStyle: null,
};

export function initSharedModals() {
  _sharedModals.info = buildInfoModal();
  _sharedModals.update = buildUpdateModal();
  _sharedModals.createProject = buildCreateProjectModal();
  _sharedModals.createTemplate = buildCreateTemplateModal();
  _sharedModals.overview = buildOverviewModal();
  _sharedModals.changelog = buildChangelogModal();
  _sharedModals.backupManager = buildBackupManagerModal();
  _sharedModals.exportProject = buildExportProjectModal();
  _sharedModals.exportPreview = buildExportPreviewModal();
  _sharedModals.importProject = buildImportProjectModal();
  _sharedModals.exportDocTheme = buildExportDocThemeModal();
  _sharedModals.exportLanguage = buildExportLanguageModal();
  _sharedModals.exportLanguageStyle = buildExportLanguageStyleModal();
  _sharedModals.importDocTheme = buildImportDocThemeModal();
  _sharedModals.importLanguage = buildImportLanguageModal();
  _sharedModals.importLanguageStyle = buildImportLanguageStyleModal();
}

export function getSharedModal(name) {
  const modal = _sharedModals[name];
  if (!modal) 
    throw new Error(`[SharedModals] Modal '${name}' not found or not yet initialized`);
  return modal;
}