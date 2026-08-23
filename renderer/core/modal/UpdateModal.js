import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { isDevelopment } from '@core/Platform.js';
import { updateManager } from '@core/UpdateManager.js';

export function buildUpdateModal() {
  const modalId = 'application-update_modal';
  const updateVersionId = `${modalId}-version`;
  const updateNotesId = `${modalId}-notes`;
  const incompatNoteId = `${modalId}-incompat-note`;
  const skipBtnId = `${modalId}-skip-btn`;

  const updateModal = buildStandardModal('application-update-modal', {
    title: 'Update available',
    bodyHTML: `
      <div class="form-group">
        <div class="form-section-label">New Version</div>
        <div class="form-tags">
          <span class="form-tag" id="${updateVersionId}">–</span>
        </div>

        <div class="form-section-label">Release Notes</div>
        <div class="update-modal_release-notes" id="${updateNotesId}"></div>

        <div class="form-note form-note--warning hidden" id="${incompatNoteId}">
          This version is not compatible with your current version and cannot be
          installed automatically. Please download it manually.
        </div>

        <button type="button" class="btn btn--tertiary" id="${skipBtnId}">
          Skip this version
        </button>
      </div>`,
    wide: false,
    primaryLabel:   'Update',
    secondaryLabel: 'Cancel',
    onPrimary: () => updateManager.requestDownload(),
  });

  const skipBtn = updateModal.querySelector(`#${skipBtnId}`);
  skipBtn?.addEventListener('click', () => {
    updateManager.skipVersion();
    closeModal(updateModal);
  });

  const primaryBtn = updateModal.querySelector('[data-role="primary"]');

  function refreshButtonState() {
    const info = updateManager.pendingInfo;
    if (!info || !primaryBtn)
      return;

    primaryBtn.disabled = !info.isCompatible;
    primaryBtn.textContent = updateManager.status === 'downloaded' ? 'Restart now' : 'Update';
  }

  eventBus.on('show:modal:update', (info) => {
    const versionEl = document.getElementById(updateVersionId);
    const notesEl = document.getElementById(updateNotesId);
    const incompatEl = document.getElementById(incompatNoteId);

    if (versionEl) {
      let ver = info?.version;
      if (!ver && isDevelopment()) ver = '9.9.9';
      versionEl.textContent = ver ?? '–';
    }

    if (notesEl) {
      let notes = info?.releaseNotes;
      if (!notes && isDevelopment()) {
        notes = `<h3>Debug release notes</h3><p>This is a development fallback.</p><p>Line 1</p><p>Line 2</p><p>Line 3</p><p>Line 4</p><p>Line 5</p>`;
      }
      notesEl.innerHTML = notes ?? '<p class="form-label">No details available.</p>';
    }

    if (incompatEl) {
      incompatEl.classList.toggle('hidden', info?.isCompatible !== false);
      if (info?.isCompatible === false) {
        incompatEl.textContent = info?.incompatibilityNote
          ?? `This version requires at least version ${info.minCompatibleVersion}. ` +
             `Your current version (${info.currentVersion}) is too old for an automatic update. ` +
             `Please download the new version manually.`;
      }
    }

    refreshButtonState();
    openModal(updateModal);
  });

  eventBus.on('updater:status', refreshButtonState);

  return updateModal;
}