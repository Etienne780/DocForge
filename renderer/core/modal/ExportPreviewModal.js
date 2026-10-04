import { buildDoneModal, openModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { buildDocument } from '@core/HtmlBuilder.js';
import { ResolveProjectTheme } from '@data/DocThemeManager.js';
import { setIframeContent } from '@common/Common.js';

export function buildExportPreviewModal() {
  const previewModal = buildDoneModal('application-export_preview-modal', {
    title: 'Export Preview',
    bodyHTML: '',
    doneLabel: 'Close',
    wide: 'xxl',
  });

  // created directly bodyHTML is sanitized which strips <iframe>
  const frame = document.createElement('iframe');
  frame.className = 'export-preview-modal_frame';
  previewModal.querySelector('.modal__body').append(frame);
  let renderToken = 0;

  eventBus.on('show:modal:exportPreview', async ({ project }) => {
    if (!project) {
      eventBus.emit('toast:show', { message: 'No project open to preview.', type: 'error' });
      return;
    }

    const token = ++renderToken;

    const result = await buildDocument(project, ResolveProjectTheme(project));
    if (token !== renderToken)
      return;

    if (!result.doc) {
      eventBus.emit('toast:show', { message: `Failed to build export preview: ${result.msg}`, type: 'error' });
      return;
    }

    frame.style.visibility = 'hidden';
    _navigateToActiveNode(frame, () => token !== renderToken);
    setIframeContent(frame, result.doc);
    openModal(previewModal);
  });

  return previewModal;
}

/** Opens the active editor node once the document script is ready. */
function _navigateToActiveNode(frame, isStale) {
  const nodeId = session.get('activeNodeId');

  const reveal = () => {
    window.removeEventListener('message', onMessage);
    clearTimeout(timeout);
    if (!isStale())
      frame.style.visibility = '';
  };

  const onMessage = (e) => {
    if (isStale()) {
      reveal();
      return;
    }
    if (e.source !== frame.contentWindow)
      return;
    if (e.data?.source !== 'doc-nav' || e.data.type !== 'ready')
      return;

    if (nodeId) {
      try {
        frame.contentWindow.docNav.navigate({ nodeId });
      } catch (err) {}
    }
    reveal();
  };

  window.addEventListener('message', onMessage);
  const timeout = setTimeout(reveal, 1500);
}
