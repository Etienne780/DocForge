import { buildStandardModal, openModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus';
import { isDevelopment } from '@core/Platform.js';

let _updateModal = null;

export function buildUpdateModal() {
    
  const updateModal = buildStandardModal('application-update-modal', {
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

  return updateModal;
}