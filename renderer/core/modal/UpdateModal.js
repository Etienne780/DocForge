import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { isDevelopment } from '@core/Platform.js';
import { updateManager } from '@core/UpdateManager.js';
import { escapeHTML } from '@common/Common.js';
import { t } from '@core/i18n/I18n.js';

const tx = key => escapeHTML(t(`appModals.update.${key}`));

export function buildUpdateModal() {
  const modalId = 'application-update_modal';
  const updateVersionId = `${modalId}-version`;
  const updateNotesId = `${modalId}-notes`;
  const incompatNoteId = `${modalId}-incompat-note`;
  const skipBtnId = `${modalId}-skip-btn`;

  const updateModal = buildStandardModal('application-update-modal', {
    title: t('appModals.update.title'),
    bodyHTML: `
      <div class="form-group">
        <div class="form-section-label">${tx('newVersion')}</div>
        <div class="form-tags">
          <span class="form-tag" id="${updateVersionId}">–</span>
        </div>

        <div class="form-section-label">${tx('releaseNotes')}</div>
        <div class="update-modal_release-notes" id="${updateNotesId}"></div>

        <div class="form-note form-note--warning hidden" id="${incompatNoteId}">
          ${tx('incompatible')}
        </div>

        <button type="button" class="btn btn--tertiary" id="${skipBtnId}">
          ${tx('skip')}
        </button>
      </div>`,
    wide: 'm',
    primaryLabel:   t('appModals.update.update'),
    secondaryLabel: t('common.cancel'),
    onPrimary: () => updateManager.requestDownload(),
  });

  const skipBtn = updateModal.querySelector(`#${skipBtnId}`);
  skipBtn?.addEventListener('click', () => {
    updateManager.skipVersion();
    closeModal(updateModal);
  });

  const primaryBtn = updateModal.querySelector('[data-modal-primary]');

  function refreshButtonState(percent = null) {
    const info = updateManager.pendingInfo;
    if (!info || !primaryBtn)
      return;

    const status = updateManager.status;
    primaryBtn.disabled = !info.isCompatible || status === 'downloading';

    if (status === 'downloaded')
      primaryBtn.textContent = t('appModals.update.restart');
    else if (status === 'downloading')
      primaryBtn.textContent = percent !== null ? t('appModals.update.downloadingPercent', { percent }) : t('appModals.update.downloading');
    else
      primaryBtn.textContent = t('appModals.update.update');
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
        notes = `<h3>Debug release notes</h3><p>This is a development fallback.</p><p>Line 1</p><p>Line 2</p><p>Line 3</p><p>Line 4</p><p>Line 5</p><p>Line 6</p><p>Line 7</p><p>Line 8</p><p>Line 9</p><p>Line 10</p>`;
      }
      notesEl.innerHTML = notes ?? `<p class="form-label">${tx('noDetails')}</p>`;
    }

    if (incompatEl) {
      incompatEl.classList.toggle('hidden', info?.isCompatible !== false);
      if (info?.isCompatible === false) {
        incompatEl.textContent = info?.incompatibilityNote
          ?? t('appModals.update.requiresVersion', { min: info.minCompatibleVersion, current: info.currentVersion });
      }
    }

    refreshButtonState();
    openModal(updateModal);
  });

  eventBus.on('updater:status', () => refreshButtonState());
  eventBus.on('updater:progress', (percent) => refreshButtonState(percent));

  return updateModal;
}