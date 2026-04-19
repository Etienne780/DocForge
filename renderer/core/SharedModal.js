import { APP_VERSION } from '@core/AppMeta.js';
import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';

let aboutModal = null;

export function buildSharedModals() {
  _buildAboutModal();
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
}

export function openAboutModal() {
  openModal(aboutModal);
}