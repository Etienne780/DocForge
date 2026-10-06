import { buildDoneModal, openModal, closeModal, onModalClose } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { session } from '@core/SessionState.js';
import { buildDocument } from '@core/HtmlBuilder.js';
import { ResolveProjectTheme } from '@data/DocThemeManager.js';
import { setIframeContent } from '@common/Common.js';
import { createLoadingOverlay } from '@common/UIUtils.js';

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
  const body = previewModal.querySelector('.modal__body');
  body.append(frame);

  const loading = createLoadingOverlay(body, { label: 'Building preview…' });
  let buildController = null;

  // Closing the modal cancels a running build
  onModalClose(previewModal, () => {
    buildController?.abort();
    loading.hide();
  });

  eventBus.on('show:modal:exportPreview', async ({ project }) => {
    if (!project) {
      eventBus.emit('toast:show', { message: 'No project open to preview.', type: 'error' });
      return;
    }

    buildController?.abort();
    const controller = new AbortController();
    buildController = controller;
    const isStale = () => controller.signal.aborted;

    frame.style.visibility = 'hidden';
    loading.show();
    openModal(previewModal);

    const fail = (msg) => {
      eventBus.emit('toast:show', { message: `Failed to build export preview: ${msg}`, type: 'error' });
      closeModal(previewModal);
    };

    let result;
    try {
      result = await buildDocument(project, ResolveProjectTheme(project), { signal: controller.signal });
    } catch (err) {
      if (err?.name !== 'AbortError' && !isStale())
        fail(err?.message ?? err);
      return;
    }

    if (isStale())
      return;

    if (!result.doc) {
      fail(result.msg);
      return;
    }

    // The spinner stays until the frame is revealed on the active node
    _navigateToActiveNode(frame, isStale, null);
    setIframeContent(frame, result.doc);
  });

  return previewModal;
}

/** Opens the active editor node once the document script is ready. */
function _navigateToActiveNode(frame, isStale, onReveal) {
  const nodeId = session.get('activeNodeId');

  const reveal = () => {
    window.removeEventListener('message', onMessage);
    clearTimeout(timeout);
    if (!isStale()) {
      frame.style.visibility = '';
      onReveal();
    }
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
