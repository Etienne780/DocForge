import { buildDoneModal, openModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { backupManager } from '@core/BackupManager.js';
import { state } from '@core/State.js';
import { storageManager } from '@core/storage/StorageManager.js';
import { addCheckboxEventListener, setCheckBox, toggleCheckBox } from '@common/UIUtils.js';

import { generateProjectId } from '@data/ProjectManager.js';
import { generateDocThemeId } from '@data/DocThemeManager.js';
import { generateSyntaxDefinitionId } from '@data/SyntaxDefinitionManager.js';

const SECTIONS = [
  // { key: 'state',     label: 'UI state'   },
  { key: 'projects',  label: 'Projects'   },
  { key: 'docThemes', label: 'Doc themes' },
  { key: 'languages', label: 'Languages'  },
];

export function buildBackupManagerModal() {

  const backupManagerModal = buildDoneModal('application-backup_manager-modal', {
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
  let selectAllRowHTML = null;//  needs to be delete after select slot

  const selectedIds = {
    projects:  new Set(),
    docThemes: new Set(),
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
      case 'projects':
        return [
          { label: 'Name',        value: item.name },
          { label: 'Tabs',        value: item.tabs?.length ?? 0 },
          { label: 'Created',     value: item.createdAt     ? new Date(item.createdAt).toLocaleDateString()     : null },
          { label: 'Last opened', value: item.lastOpenedAt  ? new Date(item.lastOpenedAt).toLocaleDateString()  : null },
          { label: 'Doc theme',   value: item.docThemeId ?? 'None' },
        ];

      case 'docThemes':
        return [
          { label: 'Name',      value: item.name },
          { label: 'Created',   value: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : null },
          { label: 'Entries',   value: item.settings?.entries?.length ?? 0 },
          { label: 'Mappings',  value: item.settings?.mapping?.length ?? 0 },
        ];

      case 'languages':
        return [
          { label: 'Name',      value: item.name },
          { label: 'Aliases',   value: item.aliases?.join(', ') || 'None' },
          { label: 'States',    value: item.states?.length ?? 0 },
          { label: 'Styles',    value: item.styles?.length ?? 0 },
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

  // Uncomment when state section is needed:
  // function renderStateSection(data) {
  //   const panel = backupManagerModal.querySelector('[data-list-panel]');
  //   panel.innerHTML = '';
  //   showListPanel();
  //
  //   const table = document.createElement('div');
  //   table.className = 'form-tabel';
  //
  //   const entries = [
  //     { label: 'Dark mode',    value: data.isDarkMode    ? 'On'  : 'Off' },
  //     { label: 'First launch', value: data.isFirstLaunch ? 'Yes' : 'No'  },
  //   ];
  //
  //   entries.forEach(({ label, value }) => {
  //     const row = document.createElement('div');
  //     row.className = 'row';
  //
  //     const lbl = document.createElement('span');
  //     lbl.className = 'text-muted';
  //     lbl.textContent = label;
  //
  //     const val = document.createElement('span');
  //     val.className = 'form-tag form--accent';
  //     val.textContent = value;
  //
  //     row.appendChild(lbl);
  //     row.appendChild(val);
  //     table.appendChild(row);
  //   });
  //
  //   panel.appendChild(table);
  //   updateScrollState(panel);
  // }

  function renderListSection(sectionKey, items, getName, getExtra = null) {
    const panel = backupManagerModal.querySelector('[data-list-panel]');
    panel.innerHTML = '';
    showListPanel();

    const itemList = !items
      ? []
      : Array.isArray(items) ? items : Object.values(items);

    if (itemList.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'form-tags-empty';
      empty.textContent = 'No entries in this backup';
      panel.appendChild(empty);
      return;
    }

    // ── select-all row ──
    selectAllRowHTML = document.createElement('div');
    selectAllRowHTML.className = 'backup-manager-select-all-row';

    const selectAllLabel = document.createElement('span');
    selectAllLabel.className = 'text-muted';
    selectAllLabel.textContent = 'Select all';

    const selectAllCheckbox = document.createElement('button');
    selectAllCheckbox.className = 'checkbox-element';
    const allSelected = itemList.every(item => selectedIds[sectionKey].has(item.id));
    setCheckBox(selectAllCheckbox, allSelected);

    const rowCheckboxes = new Map();

    addCheckboxEventListener(selectAllCheckbox, (checked) => {
      itemList.forEach(item => {
        if (checked) 
          selectedIds[sectionKey].add(item.id);
        else
          selectedIds[sectionKey].delete(item.id);

        const cb = rowCheckboxes.get(item.id);
        if (cb) 
          setCheckBox(cb, checked);
      });
    });

    selectAllRowHTML.appendChild(selectAllLabel);
    selectAllRowHTML.appendChild(selectAllCheckbox);

    const selectAllContainer = backupManagerModal.querySelector('[data-select-all]');
    selectAllContainer.appendChild(selectAllRowHTML);

    // ── item table ──
    const table = document.createElement('div');
    table.className = 'form-tabel';

    itemList.forEach(item => {
      const row = document.createElement('div');
      row.className = 'row backup-manager-list-row';

      // left: name
      const name = document.createElement('span');
      name.textContent = getName(item);

      // right: tags + arrow + checkbox
      const right = document.createElement('span');
      right.className = 'backup-manager-row-right';

      if (getExtra) {
        const extra = getExtra(item);
        if (extra) {
          const tag = document.createElement('span');
          tag.className = 'form-tag form-tag--small form--accent';
          tag.textContent = extra;
          right.appendChild(tag);
        }
      }

      const arrow = document.createElement('span');
      arrow.className = 'backup-manager-row-arrow text-muted';
      arrow.textContent = '›';
      right.appendChild(arrow);

      const rowCheckbox = document.createElement('button');
      rowCheckbox.className = 'checkbox-element';
      setCheckBox(rowCheckbox, selectedIds[sectionKey].has(item.id));
      rowCheckboxes.set(item.id, rowCheckbox);

      addCheckboxEventListener(rowCheckbox, (checked) => {
        if (checked) 
          selectedIds[sectionKey].add(item.id);
        else 
          selectedIds[sectionKey].delete(item.id);

        const cb = rowCheckboxes.get(item.id);
        if (cb) 
          setCheckBox(cb, checked);
      });

      rowCheckbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCheckBox(rowCheckbox);
      });

      right.appendChild(rowCheckbox);

      row.appendChild(name);
      row.appendChild(right);
      row.addEventListener('click', () => showItemDetail(sectionKey, item));
      table.appendChild(row);
    });

    panel.appendChild(table);
    updateScrollState(panel);
  }

  function renderSection(slot, sectionKey) {
    backupManagerModal.querySelectorAll('[data-section-tab]').forEach(btn => {
      btn.classList.toggle('backup-manager-section-tab--active', btn.dataset.sectionTab === sectionKey);
    });

    const data = slot.data?.[sectionKey];

    switch (sectionKey) {
      // case 'state':
      //   renderStateSection(data ?? {});
      //   break;

      case 'projects':
        renderListSection(
          'projects', data.projects,
          p => p.name,
          p => `${p.tabs?.length ?? 0} tab${(p.tabs?.length ?? 0) !== 1 ? 's' : ''}`
        );
        break;

      case 'docThemes':
        renderListSection('docThemes', data.docThemes, t => t.name, null);
        break;

      case 'languages':
        renderListSection(
          'languages', data.languages,
          l => l.name,
          l => l.aliases?.length ? l.aliases.slice(0, 2).join(', ') : null
        );
        break;
    }
  }

  // ─── Section tabs ───────────────────────────────────────────────────────────

  function renderSectionTabs(slot) {
    const tabs = backupManagerModal.querySelector('[data-section-tabs]');
    tabs.innerHTML = '';

    SECTIONS.forEach(s => {
      const v = slot.data?.[s.key][s.key];
      let count = 0;
      if (v) {
        count = Array.isArray(v) ? v.length : Object.keys(v).length;
      } 
      const btn = document.createElement('button');
      btn.className = 'backup-manager-section-tab';
      btn.dataset.sectionTab = s.key;

      const labelEl = document.createElement('span');
      labelEl.textContent = s.label;

      const badge = document.createElement('span');
      badge.className = 'backup-manager-section-badge';
      badge.textContent = count;

      btn.appendChild(labelEl);
      btn.appendChild(badge);
      btn.addEventListener('click', () => {
        activeSection = s.key;
        const selectAllContainer = backupManagerModal.querySelector('[data-select-all]');
        selectAllContainer.innerHTML = '';
        selectAllRowHTML = null; 
        renderSection(slot, s.key);
      });

      tabs.appendChild(btn);
    });
  }

  // ─── Slot selection ─────────────────────────────────────────────────────────

  function selectSlot(id) {
    selectedSlotId = id;
    activeSlot = backupManager.getSlot(id);
    if (!activeSlot)
      return;

    Object.keys(selectedIds).forEach(key => selectedIds[key].clear());

    backupManagerModal.querySelector('[data-detail-empty]').classList.add('hidden');
    backupManagerModal.querySelector('[data-detail-content]').classList.remove('hidden');

    backupManagerModal.querySelector('[data-detail-label]').textContent = activeSlot.label;
    backupManagerModal.querySelector('[data-detail-date]').textContent = formatDate(activeSlot.date);

    backupManagerModal.querySelectorAll('[data-slot-btn]').forEach(btn => {
      btn.classList.toggle('backup-manager-slot-btn--active', btn.dataset.slotBtn === id);
    });

    renderSectionTabs(activeSlot);
    activeSection = SECTIONS[0].key;
    
    const selectAllContainer = backupManagerModal.querySelector('[data-select-all]');
    selectAllContainer.innerHTML = '';
    selectAllRowHTML = null; 
    renderSection(activeSlot, activeSection);
  }

  // ─── Slot list ──────────────────────────────────────────────────────────────

  function renderSlotList() {
    const list = backupManagerModal.querySelector('[data-slot-list]');
    const slots = backupManager.getSlotInfos();
    list.innerHTML = '';

    if (slots.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'form-tags-empty';
      empty.textContent = 'No backups yet';

      list.appendChild(empty);
      return;
    }

    slots.forEach(slot => {
      const btn = document.createElement('button');
      btn.className = 'backup-manager-slot-btn';
      btn.dataset.slotBtn = slot.id;

      const label = document.createElement('span');
      label.className = 'backup-manager-slot-btn__label';
      label.textContent = slot.label;

      const date = document.createElement('span');
      date.className = 'backup-manager-slot-btn__date';
      date.textContent = formatDate(slot.date);

      btn.appendChild(label);
      btn.appendChild(date);
      btn.addEventListener('click', () => selectSlot(slot.id));
      list.appendChild(btn);
    });
  }

  function updateScrollState(panel) {
    panel.classList.toggle('form-tabel--has-scroll', panel.scrollHeight > panel.offsetHeight);
  }

  // ─── Restore ────────────────────────────────────────────────────────────────

  async function handleRestore() {
    if (!selectedSlotId) 
      return;
    
    const slot = backupManager.getSlot(selectedSlotId);
    if (!slot) 
      return;

    const projectsToRestore = slot.data.projects.projects?.filter(p => selectedIds.projects.has(p.id));
    const themesToRestore = slot.data.docThemes.docThemes?.filter(t => selectedIds.docThemes.has(t.id));
    const languagesToRestore = slot.data.languages.languages?.filter(l => selectedIds.languages.has(l.id));

    if (projectsToRestore?.length) {
      projectsToRestore.forEach((p) => { p.id = generateProjectId(); });
    
      // needs to fixed
      throw Error("NEEDS FIX");
      state.set('projects', [
        ...projectsToRestore,
        ...state.get('projects'),
      ]);
    }

    if (themesToRestore?.length) {
      themesToRestore.forEach((p) => { p.id = generateProjectId(); });
    
      state.set('docThemes', [
        ...themesToRestore,
        ...state.get('docThemes'),
      ]);
    }
 
    if (languagesToRestore?.length) {
      languagesToRestore.forEach((p) => { p.id = generateProjectId(); });
    
      state.set('languages', [
        ...languagesToRestore,
        ...state.get('languages'),
      ]);
    }

    eventBus.emit('toast:show', { message: 'Backup restored', type: 'success' });
  }

  backupManagerModal.querySelector('[data-action-restore]')?.addEventListener('click', handleRestore);

  eventBus.on('show:modal:backup_manager', async () => {
    await backupManager.loadSlots();
    renderSlotList();

    const slots = backupManager.getSlotInfos();
    if (Array.isArray(slots) && slots.length > 0)
      selectSlot(slots[0].id);

    openModal(backupManagerModal);
  });

  return backupManagerModal;
}