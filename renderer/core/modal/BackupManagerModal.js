import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { isPlatformWeb } from '@core/Platform.js';
import { backupManager } from '@core/BackupManager.js';
import { saveDocument } from '@core/DocumentManager.js';
import { createProject, addRecentProject, openProject } from '@data/ProjectManager.js';
import { buildConfirmationDeleteModal } from '@common/BaseModals.js';

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

  let selectedSlotId = null;
  let activeSection = null;
  let activeSlot = null;
  let selectAllRowHTML = null; // needs to be deleted after select slot

  const selectedIds = {
    tabs:      new Set(),
    themes:    new Set(),
    languages: new Set(),
  };

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      + ' · '
      + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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
              <span>${getName(item)}</span>

              <span class="backup-manager-row-right">
                ${extra ? `
                  <span class="form-tag form-tag--small form--accent">
                    ${extra}
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

  function renderSection(slot, sectionKey) {
    backupManagerModal.querySelectorAll('[data-section-tab]').forEach(btn => {
      btn.classList.toggle('backup-manager-section-tab--active', btn.dataset.sectionTab === sectionKey);
    });

    const project = slot.data?.project;

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

  function renderSectionTabs(slot) {
    const tabs = backupManagerModal.querySelector('[data-section-tabs]');
    const project = slot.data?.project;

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
        const sectionKey = btn.dataset.sectionTab;

        activeSection = sectionKey;

        const selectAllContainer = backupManagerModal.querySelector('[data-select-all]');
        selectAllContainer.innerHTML = '';
        selectAllRowHTML = null;

        renderSection(slot, sectionKey);
      });
    });
  }
  // ─── Slot selection ─────────────────────────────────────────────────────────

  function selectSlot(id) {
    selectedSlotId = id;
    activeSlot = backupManager.getSlot(id);
    if (!activeSlot)
      return;

    backupManagerModal.querySelector('[data-detail-empty]').classList.add('hidden');
    backupManagerModal.querySelector('[data-detail-content]').classList.remove('hidden');

    const projectName = activeSlot.data?.project?.name;
    backupManagerModal.querySelector('[data-detail-label]').textContent =
      projectName ? `${activeSlot.label} — ${projectName}` : activeSlot.label;
    backupManagerModal.querySelector('[data-detail-date]').textContent = formatDate(activeSlot.date);

    backupManagerModal.querySelectorAll('[data-slot-btn]').forEach(btn => {
      btn.classList.toggle('backup-manager-slot-btn--active', btn.dataset.slotBtn === id);
    });

    renderSectionTabs(activeSlot);
    activeSection = SECTIONS[0].key;
    renderSection(activeSlot, activeSection);
  }

  // ─── Slot list ──────────────────────────────────────────────────────────────

  function renderSlotList() {
    const list = backupManagerModal.querySelector('[data-slot-list]');
    const slots = backupManager.getSlotInfos();

    if (slots.length === 0) {
      list.innerHTML = `
        <span class="form-tags-empty">
          No backups yet
        </span>
      `;
      return;
    }

    list.innerHTML = slots.map(slot => `
      <div class="backup-manager-slot-btn button__actions-parent" data-slot-btn="${slot.id}">
        <div class="backup-manager-slot_container">
          <span class="backup-manager-slot-btn__label">
            ${slot.label}
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

    list.querySelectorAll('[data-slot-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectSlot(btn.dataset.slotBtn);
      });
    });

    list.querySelectorAll('[data-remove-icon]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotId = btn.closest('[data-slot-btn]')?.dataset.slotBtn;
        
        _backupDeleteCallback = () => {
          if (slotId)
            handleDeleteSlot(slotId);
        };
        openModal(deleteBackupModal);
      });
    });
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async function handleDeleteSlot(slotId) {
    const removed = await backupManager.removeSlot(slotId);
    if (!removed) {
      eventBus.emit('toast:show', { message: 'Failed to delete backup', type: 'error' });
      return;
    }

    if (selectedSlotId === slotId) {
      selectedSlotId = null;
      activeSlot = null;
      backupManagerModal.querySelector('[data-detail-content]').classList.add('hidden');
      backupManagerModal.querySelector('[data-detail-empty]').classList.remove('hidden');
    }

    renderSlotList();
    eventBus.emit('toast:show', { message: 'Backup deleted', type: 'success' });
  }

  function updateScrollState(panel) {
    panel.classList.toggle('form-tabel--has-scroll', panel.scrollHeight > panel.offsetHeight);
  }

  // ─── Restore ────────────────────────────────────────────────────────────────

  async function handleRestore() {
    if (!selectedSlotId)
      return;

    const slot = backupManager.getSlot(selectedSlotId);
    const backupProject = slot?.data?.project;
    if (!backupProject) {
      eventBus.emit('toast:show', { message: 'Backup contains no project data.', type: 'error' });
      return;
    }

    const newProj = createProject(backupProject.name);

    const restored = {
      ...newProj,
      ...backupProject,
      id: newProj.id,
      lastOpenedAt: newProj.lastOpenedAt
    };

    if (isPlatformWeb()) {
      // Web: no filesystem, the project itself lives inside the recent entry.
      addRecentProject(restored);
      openProject(restored);
      eventBus.emit('toast:show', { message: 'Backup restored.', type: 'success' });
      closeModal(backupManagerModal);
      return;
    }

    // Desktop: ask where to put it before writing anything.
    const { canceled, filePaths } = await window.electronAPI.openDialog({
      type: 'folder',
      title: 'Choose restore location',
      buttonLabel: 'Restore here',
    });

    if (canceled || !filePaths?.length)
      return;

    restored.sourcePath = filePaths[0];
    restored.sourceKind = 'folder';

    const saveOk = await saveDocument(restored);
    if (!saveOk) {
      eventBus.emit('toast:show', { message: 'Failed to write restored project to disk.', type: 'error' });
      return;
    }

    addRecentProject(restored);
    openProject(restored);
    eventBus.emit('toast:show', { message: 'Backup restored.', type: 'success' });
    closeModal(backupManagerModal);
  }

  backupManagerModal.querySelector('[data-action-restore]')?.addEventListener('click', handleRestore);

  async function setupModal() {
    await backupManager.loadSlots();
    renderSlotList();

    const slots = backupManager.getSlotInfos();
    if (Array.isArray(slots) && slots.length > 0)
      selectSlot(slots[0].id);
  }

  eventBus.on('backupManager:change', async () => {
    setupModal();
  });

  eventBus.on('show:modal:backup_manager', async () => {
    setupModal();
    openModal(backupManagerModal);
  });

  return backupManagerModal;
}