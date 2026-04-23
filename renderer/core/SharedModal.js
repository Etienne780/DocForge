import { APP_VERSION } from '@core/AppMeta.js';
import { eventBus } from '@core/EventBus';
import { updateManager } from '@core/UpdateManager.js';
import { buildStandardModal, buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { isDevelopment } from '@core/Platform.js';

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
        <div class="update-modal_release-notes" id="update-modal-notes"></p>
      </div>`,
    wide: false,
    primaryLabel:   'Restart now',
    secondaryLabel: 'Later',
    onPrimary: () => updateManager.installNow(),
  });

  eventBus.on('show:modal:update', (info) => {
    const versionEl = document.getElementById('update-modal-version');
    const notesEl = document.getElementById('update-modal-notes');

    if (versionEl) {
      let ver = info?.version;
      if(!ver && isDevelopment())
        ver = "9.9.9";

      versionEl.textContent = ver ?? '–';
    }
    if (notesEl) {
      let notes = info?.releaseNotes;
    
      if (!notes && isDevelopment()) {
        notes = `
          <h3>Debug Release Notes</h3>
          <p>This is a development fallback.</p>
          <ul>
            <li>Example change 1</li>
            <li>Example change 2</li>
            <li>Example change 3</li>
            <li>Example change 4</li>
            <li>Version: ${info?.version ?? 'unknown'}</li>
            </ul>
            `;
      }
    
      notesEl.innerHTML = notes ?? '<p class="form-label">No details available.</p>';
    }

    openModal(updateModal);
  });
}