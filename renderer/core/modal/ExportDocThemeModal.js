import { buildDoneModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { FILE_EXTENSION_DOCTHEME } from '@core/AppMeta.js';
import { unwrapEntity } from '@core/Envelope.js';
import { eventBus } from '@core/EventBus.js';

// ─── IDs ──────────────────────────────────────────────────────────
const modalId = 'application-import_project-modal';

export function buildExportDocThemeModal() {
  const exportModal = buildDoneModal(modalId, {
    title: 'Export Theme',
    bodyHTML: ``,
    doneLabel: 'Export',
    wide: 'm',
    doneCallback: () => {
        
    }
  });

  eventBus.on('show:modal:backupManager', () => {
    _setupModal();
    openModal(exportModal);
  });
}

function _setupModal() {

}