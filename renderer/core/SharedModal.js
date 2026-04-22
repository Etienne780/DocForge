import { APP_VERSION } from '@core/AppMeta.js';
import { buildStandardModal, buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus';

let aboutModal = null;
let updateModal = null;

export function initSharedModals() {
  _buildAboutModal();
  _buildUpdateModal();
}

function _buildAboutModal() {
  aboutModal = buildDoneModal('application-about-modal', {
    title: 'About',
    bodyHTML: `
<div class="form-group">

  <div class="form-section-label">Description</div>
  <p class="form-label">
    DocForge is a lightweight desktop application for creating, structuring, and managing technical documentation.
    It focuses on clarity, speed, and a clean editing experience for structured content.
  </p>

  <div class="form-section-label">Version</div>
  <div class="form-tags">
    <span class="form-tag">${APP_VERSION}</span>
  </div>

  <div class="form-section-label">Source Code</div>
  <p class="form-label">
    <a href="https://github.com/Etienne780/DocForge" target="_blank">
      https://github.com/Etienne780/DocForge
    </a>
  </p>

  <div class="form-section-label">Author</div>
  <div class="form-tags">
    <span class="form-tag">Etienne</span>
  </div>

  <div class="form-section-label">License</div>
  <p class="form-label">
    See repository for license details.
  </p>

</div>`,
    doneLabel: 'Done',
    wide: true,
  });

  eventBus.on('show:modal:about', () => openModal(aboutModal));
}

function _buildUpdateModal() {
  updateModal = buildStandardModal('application-update-modal', {
    title: 'Update available',
    bodyHTML: `
      <div class="form-group">
        <div class="form-section-label">New Version</div>
        <div class="form-tags">
          <span class="form-tag" id="update-modal-version">–</span>
        </div>

        <div class="form-section-label">Release Notes</div>
        <p class="form-label" id="update-modal-notes">–</p>
      </div>`,
    primaryLabel:   'Restart now',
    secondaryLabel: 'Later',
    onPrimary: () => updateManager.installNow(),
  });

  eventBus.on('show:modal:update', (info) => {
    const versionEl = document.getElementById('update-modal-version');
    const notesEl = document.getElementById('update-modal-notes');

    if (versionEl) 
      versionEl.textContent = info?.version ?? '–';
    if (notesEl)
      notesEl.textContent   = info?.releaseNotes ?? 'No Details available.';

    openModal(updateModal);
  });
}