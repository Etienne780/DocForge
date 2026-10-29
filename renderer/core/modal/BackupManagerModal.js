import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { isPlatformWeb, pathExists } from '@core/Platform.js';
import { combinePath } from '@core/Path.js';
import { RECENT_PROJECT_SOURCE_TYPE_FOLDER } from '@core/AppMeta.js';
import {
  backupManager,
  getBackupProjectKey,
  getSlotProject,
  restoreBackupIntoOpenProject,
} from '@core/BackupManager.js';
import { uniqueSlug } from '@core/DocumentManager.js';
import {
  createProject,
  createProjectSession,
  getOpenProject,
  hasUnsavedChanges,
  openProjectInEditor,
} from '@data/ProjectManager.js';
import { escapeHTML } from '@common/Common.js';
import { buildConfirmationDeleteModal, askChoice } from '@common/BaseModals.js';
import { saveProject } from '@common/ProjectPersistence.js';
import { confirmLeaveOpenProject } from '@common/UnsavedChangesGuard.js';

const SECTIONS = [
  { key: 'tabs',      label: 'Tabs'       },
  { key: 'themes',    label: 'Doc themes' },
  { key: 'languages', label: 'Languages'  },
];

let _backupDeleteCallback = null

export function buildBackupManagerModal() {
  const modalId = 'application-backup_manager-modal';
  const deleteBackupModalId = `${modalId}_delete_backup_modal`;

  const deleteBackupModal = buildConfirmationDeleteModal(deleteBackupModalId, {
    title: 'Delete',
    message: 'Are you sure you want to delete this backup?',
    zIndex: '1001',
    onConfirm: () => {
      _backupDeleteCallback?.();
      _backupDeleteCallback = null;
      closeModal(deleteBackupModal);
    }
  });

  const backupManagerModal = buildDoneModal(modalId, {
    title: 'Backup manager',
    doneLabel: 'Close',
    wide: 'xl',
    bodyHTML: `
      <div class="backup-manager">

        <div class="backup-manager__sidebar">
          <p class="form-section-label">Saved backups</p>
          <div class="backup-manager-slot-list" data-slot-list>
            <span class="form-tags-empty">No backups yet</span>
          </div>
        </div>

        <div class="backup-manager__detail">

          <div class="backup-manager-detail-empty" data-detail-empty>
            <span class="form-tags-empty">Select a backup to preview</span>
          </div>

          <div class="backup-manager-detail-content hidden" data-detail-content>

            <div class="backup-manager-detail-header">
              <div class="backup-manager-detail-header__left">
                <span class="form-label" data-detail-label></span>
                <span class="form-tags-empty" data-detail-date></span>
              </div>
              <button class="button button--primary" data-action-restore>Restore</button>
            </div>

            <p class="form-section-label">Contents</p>
            <div class="backup-manager-section-tabs" data-section-tabs></div>
            <div data-select-all></div>
            <div class="backup-manager-section-panel">
              <div class="backup-manager-section-panel-list" data-list-panel></div>
              <div class="hidden" data-item-detail>
                <button class="backup-manager-back-btn" data-action-back>← Back</button>
                <div data-item-detail-content></div>
              </div>
            </div>

          </div>

        </div>

      </div>`,
  });

  let expandedFileId = null; // project whose backups are listed in the sidebar
  let expandedSlots = [];
  let selectedSlotId = null;
  let activeSlot = null;
  let activeSlotProject = null;

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      + ' · '
      + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  /** True if the backups of `fileId` belong to the open project. */
  function isOpenProjectFile(fileId) {
    const openProject = getOpenProject();
    if (!openProject)
      return false;

    const key = getBackupProjectKey(openProject);
    return backupManager.getProjects().some(e => e.fileId === fileId && e.projectKey === key);
  }

  // ─── Item detail ────────────────────────────────────────────────────────────

  function getDetailRows(sectionKey, item) {
    switch (sectionKey) {
      case 'tabs':
        return [
          { label: 'Name', value: item.name },
          { label: 'Nodes', value: item.nodes?.length ?? 0 },
        ];

      case 'themes':
        return [
          { label: 'Name',     value: item.name },
          { label: 'Created',  value: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : null },
          { label: 'Entries',  value: item.settings?.entries?.length ?? 0 },
        ];

      case 'languages':
        return [
          { label: 'Name',      value: item.name },
          { label: 'Aliases',   value: item.aliases?.join(', ') || 'None' },
          { label: 'States',    value: item.states?.length ?? 0 },
          { label: 'Hoisting',  value: item.symbolHoisting ? 'Yes' : 'No' },
          { label: 'Created',   value: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : null },
        ];

      default:
        return [];
    }
  }

  function showItemDetail(sectionKey, item) {
    backupManagerModal.querySelector('[data-list-panel]').classList.add('hidden');
    backupManagerModal.querySelector('[data-select-all]').classList.add('hidden');
    backupManagerModal.querySelector('[data-item-detail]').classList.remove('hidden');

    const content = backupManagerModal.querySelector('[data-item-detail-content]');
    content.innerHTML = '';

    const table = document.createElement('div');
    table.className = 'form-tabel';

    getDetailRows(sectionKey, item).forEach(({ label, value }) => {
      if (value === null || value === undefined) return;

      const row = document.createElement('div');
      row.className = 'row';

      const lbl = document.createElement('span');
      lbl.className = 'text-muted';
      lbl.textContent = label;

      const val = document.createElement('span');
      val.className = 'form-tag form--accent';
      val.textContent = value;

      row.appendChild(lbl);
      row.appendChild(val);
      table.appendChild(row);
    });

    content.appendChild(table);
  }

  function showListPanel() {
    backupManagerModal.querySelector('[data-item-detail]').classList.add('hidden');
    backupManagerModal.querySelector('[data-list-panel]').classList.remove('hidden');
    backupManagerModal.querySelector('[data-select-all]').classList.remove('hidden');
  }

  backupManagerModal.querySelector('[data-action-back]')?.addEventListener('click', showListPanel);

  // ─── Section renderers ──────────────────────────────────────────────────────

  function renderListSection(sectionKey, items, getName, getExtra = null) {
    const panel = backupManagerModal.querySelector('[data-list-panel]');
    panel.innerHTML = '';
    showListPanel();

    const itemList = !items
      ? []
      : Array.isArray(items)
        ? items
        : Object.values(items);

    if (itemList.length === 0) {
      panel.innerHTML = `
        <span class="form-tags-empty">
          No entries in this backup
        </span>
      `;
      return;
    }

    panel.innerHTML = `
      <div class="form-tabel">
        ${itemList.map((item, index) => {
          const extra = getExtra?.(item);

          return `
            <div class="row backup-manager-list-row" data-item-index="${index}">
              <span>${escapeHTML(getName(item))}</span>

              <span class="backup-manager-row-right">
                ${extra ? `
                  <span class="form-tag form-tag--small form--accent">
                    ${escapeHTML(extra)}
                  </span>
                ` : ''}

                <span class="backup-manager-row-arrow text-muted">›</span>
              </span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    panel.querySelectorAll('[data-item-index]').forEach(row => {
      const index = Number(row.dataset.itemIndex);
      row.addEventListener('click', () => {
        showItemDetail(sectionKey, itemList[index]);
      });
    });

    updateScrollState(panel);
  }

  function renderSection(project, sectionKey) {
    backupManagerModal.querySelectorAll('[data-section-tab]').forEach(btn => {
      btn.classList.toggle('backup-manager-section-tab--active', btn.dataset.sectionTab === sectionKey);
    });

    switch (sectionKey) {
      case 'tabs':
        renderListSection(
          'tabs', project?.tabs,
          t => t.name,
          t => `${t.nodes?.length ?? 0} node${(t.nodes?.length ?? 0) !== 1 ? 's' : ''}`
        );
        break;

      case 'themes':
        renderListSection('themes', project?.themes, t => t.name, null);
        break;

      case 'languages':
        renderListSection(
          'languages', project?.languages,
          l => l.name,
          l => l.aliases?.length ? l.aliases.slice(0, 2).join(', ') : null
        );
        break;
    }
  }

  // ─── Section tabs ───────────────────────────────────────────────────────────

  function renderSectionTabs(project) {
    const tabs = backupManagerModal.querySelector('[data-section-tabs]');

    tabs.innerHTML = SECTIONS.map(s => {
      const value = project?.[s.key];
      const count = Array.isArray(value) ? value.length : 0;

      return `
        <button class="backup-manager-section-tab" data-section-tab="${s.key}" >
          <span>${s.label}</span>
          <span class="backup-manager-section-badge">${count}</span>
        </button>
      `;
    }).join('');

    tabs.querySelectorAll('[data-section-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        backupManagerModal.querySelector('[data-select-all]').innerHTML = '';
        renderSection(project, btn.dataset.sectionTab);
      });
    });
  }

  // ─── Slot selection ─────────────────────────────────────────────────────────

  function showDetailEmpty() {
    selectedSlotId = null;
    activeSlot = null;
    activeSlotProject = null;
    backupManagerModal.querySelector('[data-detail-content]').classList.add('hidden');
    backupManagerModal.querySelector('[data-detail-empty]').classList.remove('hidden');
  }

  function selectSlot(id) {
    const slot = expandedSlots.find(s => s.id === id);
    const project = getSlotProject(slot);
    if (!slot || !project) {
      showDetailEmpty();
      return;
    }

    selectedSlotId = id;
    activeSlot = slot;
    activeSlotProject = project;

    backupManagerModal.querySelector('[data-detail-empty]').classList.add('hidden');
    backupManagerModal.querySelector('[data-detail-content]').classList.remove('hidden');

    backupManagerModal.querySelector('[data-detail-label]').textContent = `${slot.label} — ${project.name}`;
    backupManagerModal.querySelector('[data-detail-date]').textContent = formatDate(slot.date);
    backupManagerModal.querySelector('[data-action-restore]').textContent =
      isOpenProjectFile(expandedFileId) ? 'Restore' : 'Restore as copy';

    backupManagerModal.querySelectorAll('[data-slot-btn]').forEach(btn => {
      btn.classList.toggle('backup-manager-slot-btn--active', btn.dataset.slotBtn === id);
    });

    renderSectionTabs(project);
    renderSection(project, SECTIONS[0].key);
  }

  // ─── Slot list ──────────────────────────────────────────────────────────────

  async function expandProject(fileId) {
    expandedFileId = fileId;
    expandedSlots = fileId ? await backupManager.loadSlots(fileId) : [];
    renderSlotList();

    if (expandedSlots.length > 0)
      selectSlot(expandedSlots[0].id);
    else
      showDetailEmpty();
  }

  function renderSlotList() {
    const list = backupManagerModal.querySelector('[data-slot-list]');
    const projects = backupManager.getProjects();

    if (projects.length === 0) {
      list.innerHTML = `
        <span class="form-tags-empty">
          No backups yet
        </span>
      `;
      return;
    }

    list.innerHTML = projects.map(entry => {
      const isExpanded = entry.fileId === expandedFileId;
      const slotsHTML = !isExpanded ? '' : expandedSlots.map(slot => `
        <div class="backup-manager-slot-btn button__actions-parent" data-slot-btn="${slot.id}">
          <div class="backup-manager-slot_container">
            <span class="backup-manager-slot-btn__label">
              ${escapeHTML(slot.label)}
            </span>
            <span class="backup-manager-slot-btn__date">
              ${formatDate(slot.date)}
            </span>
          </div>
          <div class="button__actions">
            <button class="button__actions-button--danger" data-remove-icon title="Delete backup">✕</button>
          </div>
        </div>
      `).join('');

      return `
        <button class="backup-manager-project-btn${isExpanded ? ' backup-manager-project-btn--expanded' : ''}"
                data-project-file="${entry.fileId}" title="${escapeHTML(entry.sourcePath ?? entry.projectName)}">
          <span>${escapeHTML(entry.projectName)}${isOpenProjectFile(entry.fileId) ? ' (open)' : ''}</span>
          <span class="text-muted">${isExpanded ? '▾' : '▸'}</span>
        </button>
        ${slotsHTML}
      `;
    }).join('');

    list.querySelectorAll('[data-project-file]').forEach(btn => {
      btn.addEventListener('click', () => {
        const fileId = btn.dataset.projectFile;
        expandProject(fileId === expandedFileId ? null : fileId);
      });
    });

    list.querySelectorAll('[data-slot-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectSlot(btn.dataset.slotBtn);
      });
    });

    list.querySelectorAll('[data-remove-icon]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotId = btn.closest('[data-slot-btn]')?.dataset.slotBtn;
        const fileId = expandedFileId;

        _backupDeleteCallback = () => {
          if (slotId)
            handleDeleteSlot(fileId, slotId);
        };
        openModal(deleteBackupModal);
      });
    });
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async function handleDeleteSlot(fileId, slotId) {
    const removed = await backupManager.removeSlot(fileId, slotId);
    if (!removed) {
      eventBus.emit('toast:show', { message: 'Failed to delete backup', type: 'error' });
      return;
    }

    eventBus.emit('toast:show', { message: 'Backup deleted', type: 'success' });
  }

  function updateScrollState(panel) {
    panel.classList.toggle('form-tabel--has-scroll', panel.scrollHeight > panel.offsetHeight);
  }

  // ─── Restore ────────────────────────────────────────────────────────────────

  async function handleRestore() {
    if (!activeSlot || !activeSlotProject)
      return;

    if (isOpenProjectFile(expandedFileId))
      await restoreIntoOpenProject();
    else
      await restoreAsCopy();
  }

  /** Same project: replaces its content, the user decides by saving. */
  async function restoreIntoOpenProject() {
    if (hasUnsavedChanges(getOpenProject())) {
      const choice = await askChoice({
        title: 'Restore backup',
        message: 'The open project has unsaved changes. Replace them with this backup?',
        choices: [
          { id: 'cancel',  label: 'Cancel' },
          { id: 'restore', label: 'Replace', style: 'danger' },
        ],
      });
      if (choice !== 'restore')
        return;
    }

    if (!restoreBackupIntoOpenProject(activeSlot)) {
      eventBus.emit('toast:show', { message: 'Backup contains no project data.', type: 'error' });
      return;
    }

    eventBus.emit('toast:show', { message: 'Backup restored. Save the project to keep it.', type: 'success' });
    closeModal(backupManagerModal);
  }

  /** Other project: restores it as a new project (desktop: new folder inside the chosen location). */
  async function restoreAsCopy() {
    const newProj = createProject(activeSlotProject.name);
    const restored = {
      ...activeSlotProject,
      id: newProj.id,
      createdAt: newProj.createdAt,
      sourcePath: null,
      sourceKind: null,
      session: createProjectSession(),
    };

    if (!isPlatformWeb()) {
      // ask where to put it before writing anything
      const { canceled, filePaths } = await window.electronAPI.openDialog({
        type: 'folder',
        title: 'Choose restore location',
        buttonLabel: 'Restore here',
      });

      if (canceled || !filePaths?.length)
        return;

      const targetPath = combinePath(filePaths[0], uniqueSlug(restored.name, new Set()));
      if (await pathExists(targetPath)) {
        eventBus.emit('toast:show', { message: `A folder named "${restored.name}" already exists there.`, type: 'error' });
        return;
      }

      restored.sourcePath = targetPath;
      restored.sourceKind = RECENT_PROJECT_SOURCE_TYPE_FOLDER;
    }

    if (!(await confirmLeaveOpenProject()))
      return;

    try {
      await saveProject(restored);
    } catch (error) {
      eventBus.emit('toast:show', { message: `Failed to restore backup: ${error.message}`, type: 'error' });
      return;
    }

    closeModal(backupManagerModal);
    openProjectInEditor(restored, { addToRecents: false });
    eventBus.emit('toast:show', { message: 'Backup restored.', type: 'success' });
  }

  backupManagerModal.querySelector('[data-action-restore]')?.addEventListener('click', handleRestore);

  async function setupModal() {
    const projects = backupManager.getProjects();
    const openKey = getOpenProject() ? getBackupProjectKey(getOpenProject()) : null;

    // keep the expanded project if it still has backups, otherwise prefer the open project
    const keep = projects.find(e => e.fileId === expandedFileId);
    const preferred = keep ?? projects.find(e => e.projectKey === openKey) ?? projects[0] ?? null;
    const previousSlotId = keep ? selectedSlotId : null;

    await expandProject(preferred?.fileId ?? null);
    if (previousSlotId && expandedSlots.some(s => s.id === previousSlotId))
      selectSlot(previousSlotId);
  }

  eventBus.on('backupManager:change', () => {
    setupModal();
  });

  eventBus.on('show:modal:backupManager', () => {
    setupModal();
    openModal(backupManagerModal);
  });

  return backupManagerModal;
}
