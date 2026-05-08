import { buildDoneModal, openModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { APP_VERSION } from '@core/AppMeta.js';

export function buildInfoModal() {
    
  const infoModal = buildDoneModal('application-info-modal', {
    title: 'Info',
    bodyHTML: `
<div class="form-group">

  <div class="form-tabel">

   <div class="row">
      <span class="form-label form--accent">Version: </span>
      <span class="form-tag">${APP_VERSION}</span>
    </div>

    <div class="row">
      <span class="form-label form--accent">Source Code: </span>
      <p class="form-label">
        <a href="https://github.com/Etienne780/DocForge" target="_blank">
          https://github.com/Etienne780/DocForge
        </a>
      </p>
    </div>

    <div class="row">
      <span class="form-label form--accent">Author: </span>
      <span class="form-tag">Etienne Richter</span>
    </div>

  </div>

  <div class="form-section-label">License</div>
  <p class="form-label">
    See repository for license details.
  </p>

</div>`,
    doneLabel: 'Done',
    wide: 'm',
  });

  eventBus.on('show:modal:info', () => openModal(infoModal));
  
  return infoModal;
}