import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { Component } from '@core/Component.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js'
import { eventBus } from '@core/EventBus.js';
import { ResizeController } from '@core/ResizeController';
import { findNode, getNodePath, notifyOpenProjectChange } from '@data/ProjectManager.js';
import { NODE_TYPE, NODE_TYPE_INFO, getNodeExportRole } from '@data/NodeTypes.js';
import { findNodeInProject, updateLinkUsagesForNode } from '@data/LinkManager.js';
import { getCurrentTheme } from '@data/DocThemeManager.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { buildNodePreview } from '@core/HtmlBuilder.js';
import { debounce, setIframeContent } from '@common/Common.js'
import { addTabIndenting, addLineBreakIndenting } from '@common/UIUtils.js';
import { getWordWrapIcon } from '@ui/Icon.js';

import {
  insertLinePrefix,
  wrapSelection,
  insertCodeBlock,
  insertTable,
  insertLink,
  getSelectedText,
  syncScrollPosition,
} from './helpers/ToolbarHelper.js';

/**
 * EditorArea - main editing surface.
 *
 * Responsibilities:
 *   - Breadcrumb trail showing path to the active node
 *   - Markdown toolbar (headings, bold/italic, lists, code, links, tables, HR)
 *   - Split / editor-only / preview-only view modes
 *   - Live Markdown -> HTML preview with scroll sync
 *   - Persisting edits back into the active node via state
 *   - Link insertion modal (created dynamically in onLoad)
 */
export default class EditorArea extends Component {

  onLoad() {
    this._lastNodeId = null
    this._activeProject = this.props.project;
    this._resize = new ResizeController(this.element('editor-input-wrapper'), { 
      keepRatio: true,
      initialSize: '50%',
      direction: 'right',
    });

    this._buildLinkModal();
    this._setupElementEvents();

    this._loadActiveNode();
    this._applyEditorMode(state.get('projectEditorMode'));

    // ── State subscriptions ───────────────────────────────────────────────────
    this.subscribe('session:change:openProject', ({ value }) => {
      if (value === this._activeProject)
        return;

      this._activeProject = value;
      this._loadActiveNode();
    });
    this.subscribe('session:change:activeNodeId', ({ value, previousValue }) => {
      if (value != null && value === previousValue) {
        this.element('editor-input').scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      this._loadActiveNode();
    });
    this.subscribe('session:change:activeProjectId', () => {
      session.set('activeNodeId', null);
    });
    this.subscribe('session:change:activeTabId', () => {
      this._loadActiveNode();
    });
    this.subscribe('editor:format', ({ action }) => {
      if (document.activeElement === this.element('editor-input'))
        this._handleToolbarAction(action);
    });

    // reference links
    this.subscribe('editor:insert', ({ text }) => this._insertText(text));
    this.subscribe('editor:open-node', ({ nodeId, anchor }) => this._openNode(nodeId, anchor));
    this.subscribe('session:change:openProject:links', () => {
      const input = this.element('editor-input');
      if (!input.disabled)
        this._renderPreview(input.value);
    });
    this._onPreviewMessage = (e) => this._handlePreviewMessage(e);
    window.addEventListener('message', this._onPreviewMessage);

    // type changes and moves can change how the entry is exported
    this.subscribe('session:change:openProject:tabs:nodes:type', () => this._updateContentNotice());
    // also reloads content changed elsewhere (e.g. renamed link slugs in usages)
    this.subscribe('session:change:openProject:tabs:nodes', () => this._loadActiveNode());
    this.subscribe('state:change:projectEditorMode', ({ value }) => {
      this._applyEditorMode(value);
    });
    this.subscribe('session:change:openProject', ({ value, previousValue }) => {
      if (value?.id !== previousValue?.id)
        session.set('activeNodeId', null);
    });
  }

  onDestroy() {
    this._linkModal?.remove();
    this._resize.destroy();
    window.removeEventListener('message', this._onPreviewMessage);
  }

  // ─── Reference links ──────────────────────────────────────────────────────

  /** Clicks on [[slug]] links in the preview: select the target entry and scroll to the anchor. */
  _handlePreviewMessage(e) {
    const preview = this.element('preview-pane');
    if (!preview || e.source !== preview.contentWindow)
      return;
    if (e.data?.source !== 'doc-preview' || e.data.type !== 'ref')
      return;

    this._openNode(e.data.nodeId, e.data.anchor);
  }

  /** Selects an entry in any tab and scrolls the preview to an anchor element id. */
  _openNode(nodeId, anchor = null) {
    const preview = this.element('preview-pane');
    if (nodeId === session.get('activeNodeId')) {
      if (anchor)
        preview?.contentWindow?.postMessage({ source: 'doc-preview', type: 'scroll:anchor', anchor }, '*');
      return;
    }

    const found = findNodeInProject(this._activeProject, nodeId);
    if (!found)
      return;

    this._pendingAnchor = anchor || null;
    if (session.get('activeTabId') !== found.tab.id)
      session.set('activeTabId', found.tab.id);
    session.set('activeNodeId', nodeId);
  }

  /** Inserts text at the cursor of the editor input (e.g. [[slug]] from the links tab). */
  _insertText(text) {
    const input = this.element('editor-input');
    if (input.disabled || !text)
      return;

    input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
    input.focus();
    this._onContentChange();
  }

  _setupElementEvents() {
    // ── Toolbar ───────────────────────────────────────────────────────────────
    // (shortcut tooltips come from the data-shortcut-* attributes, see ShortcutManager)

    this.element('toolbar').addEventListener('click', event => {
      const button = event.target.closest('[data-toolbar-action]');
      if (button) {
        this._handleToolbarAction(button.dataset.toolbarAction);
        return;
      }
      const modeButton = event.target.closest('[data-mode]');
      if (modeButton) {
        state.set('projectEditorMode', modeButton.dataset.mode);
      }
    });

    // ── Editor input ──────────────────────────────────────────────────────────
    const editorInput = this.element('editor-input');
    editorInput.addEventListener('input', () => {
      this._onContentChange();
    });
    
    addTabIndenting(editorInput);
    addLineBreakIndenting(editorInput);

    this.element('editor-input').addEventListener('scroll', () => {
      if (state.get('projectEditorMode') === 'split') {
        syncScrollPosition(
          this.element('editor-input'),
          this.element('preview-pane'),
        );
      }
    });

    // ── Word wrap ──────────────────────────────────────────────────────────
    const wordWrapBtn = this.element('word-wrap-btn');
    wordWrapBtn.innerHTML = getWordWrapIcon();
    
    const setWordWrap = (wordWrapEnabled) => {
      const newState = wordWrapEnabled;
      state.set('docEditorWordWrapEnabled', newState);
      wordWrapBtn.classList.toggle('editor-mode-button--active', newState);
      editorInput.classList.toggle('editor-input-nowrap', !newState);
    }

    setWordWrap(Boolean(state.get('docEditorWordWrapEnabled')));
    wordWrapBtn.addEventListener('click', () => {
      // toggle word wrappe
      const value = Boolean(state.get('docEditorWordWrapEnabled'));
      setWordWrap(!value);
    });
  }

  // ─── Node Loading ─────────────────────────────────────────────────────────

  _loadActiveNode() {
    const input = this.element('editor-input');
    const preview = this.element('preview-pane');
    const nodeId = session.get('activeNodeId');
    const node = nodeId ? findNode(nodeId) : null;

    if (!node) {
      this._lastNodeId = null;
      input.value    = '';
      input.disabled = true;
      input.placeholder = 'No entry selected';
      preview.srcdoc = '';
      this._updateStats('');
      this._updateContentNotice();
      return;
    }

    if (this._lastNodeId !== nodeId) {
      this._lastNodeId = nodeId;
      input.scrollTop = 0;
    }

    input.disabled = false;
    input.placeholder = 'Enter Markdown here…';

    if (input.value !== node.content) {
      input.value = node.content ?? '';
    }

    this._renderPreview(node.content ?? '');
    this._updateContentNotice();
  }

  /**
   * Shows a notice above the editor when the entry's type changes how its
   * content ends up in the export (see @data/NodeTypes.js).
   */
  _updateContentNotice() {
    const notice = this.element('content-notice');
    const nodeId = session.get('activeNodeId');
    const path = nodeId ? getNodePath(nodeId) : null;

    const message = path ? this._getContentNoticeMessage(getNodeExportRole(path)) : null;
    notice.classList.toggle('hidden', !message);
    notice.textContent = message ?? '';
  }

  _getContentNoticeMessage({ type, embedded, mergedInto }) {
    const parentName = mergedInto?.name ?? '';

    if (type === NODE_TYPE.FOLDER) {
      return embedded
        ? `Folder: the content of this entry is not exported. Only its name is shown as a heading on the page '${parentName}'.`
        : 'Folder: the content of this entry is not exported. It only groups its children in the navigation.';
    }

    if (embedded) {
      const ignored = type !== NODE_TYPE.PAGE
        ? ` Its own type '${NODE_TYPE_INFO[type].label}' is ignored there.`
        : '';
      return `Merged: this entry is shown as a section on the page '${parentName}' in the export.${ignored}`;
    }

    return null;
  }

  // ─── Content Changes ──────────────────────────────────────────────────────

  _onContentChange() {
    const input = this.element('editor-input');
    const nodeId = session.get('activeNodeId');

    notifyOpenProjectChange((_) => {
      const node = nodeId ? findNode(nodeId) : null;

      if (node)
        node.content = input.value;
    });

    this._renderPreview(input.value);
  }

  async _renderPreview(markdown) {
    if (!this._debounceRenderPreview) {
      this._debounceRenderPreview = debounce(
        async markdown => await this._renderPreviewInternal(markdown),
        300
      );
    }

    this._debounceRenderPreview(markdown);
  }

  async _renderPreviewInternal(markdown) {
    const preview = this.element('preview-pane');
    if (!preview)
      return;

    const prevTransition = preview.style.transition;
    preview.style.transition = 'none';
    preview.style.opacity = '0';
    void preview.offsetHeight;

    if (this._pendingNodePreviewListener) {
      window.removeEventListener('message', this._pendingNodePreviewListener);
      this._pendingNodePreviewListener = null;
    }

    if (this._pendingNodePreviewTimeout) {
      clearTimeout(this._pendingNodePreviewTimeout);
      this._pendingNodePreviewTimeout = null;
    }

    const prevScroll = preview.contentWindow?.docPreview?.getScrollPosition() ?? { scrollTop: 0 };

    const theme = getCurrentTheme(this._activeProject);
    const nodeId = session.get('activeNodeId');
    const html = await buildNodePreview(
      markdown,
      this._activeProject.session.codeBlockCache,
      theme,
      this._activeProject,
      nodeId
    );

    const reveal = () => {
      preview.style.transition = prevTransition;
      preview.style.opacity = '1';
    };

    if (!html) {
      eventBus.emit('toast:show', { message: 'Failed to render entry preview', type: 'error' });
      reveal();
    } else {
      setIframeContent(preview, html);

      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        clearTimeout(this._pendingNodePreviewTimeout);
        this._pendingNodePreviewListener = null;
        this._pendingNodePreviewTimeout = null;
      };

      const onMessage = (e) => {
        if (e.source !== preview.contentWindow)
          return;
        if (e.data?.source !== 'doc-preview' || e.data.type !== 'ready')
          return;

        preview.contentWindow.docPreview.setScrollPosition(prevScroll.scrollTop);
        if (this._pendingAnchor) {
          preview.contentWindow.docPreview.scrollToAnchor?.(this._pendingAnchor);
          this._pendingAnchor = null;
        }
        reveal();
        cleanup();
      };

      this._pendingNodePreviewListener = onMessage;
      window.addEventListener('message', onMessage);

      // safty trigger
      this._pendingNodePreviewTimeout = setTimeout(() => {
        reveal();
        cleanup();
      }, 1500);
    }

    this._updateStats(markdown);
    eventBus.emit('editor:content-changed', { markdown });

    // keep link.refs in sync with the edited content
    if (nodeId)
      updateLinkUsagesForNode(this._activeProject, nodeId);
  }

  _updateStats(markdown) {
    const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
    eventBus.emit('editor:stats-updated', {
      wordCount: words,
      charCount: markdown.length,
    });
  }

  // ─── Toolbar Actions ──────────────────────────────────────────────────────

  async _handleToolbarAction(action) {
    const input = this.element('editor-input');
    if (input.disabled && action !== 'theme') 
      return;

    const onChange = async value => {
      const nodeId = session.get('activeNodeId');

      notifyOpenProjectChange(() => {
        const node = nodeId ? findNode(nodeId) : null;
      
        if (node)
          node.content = value;
      });

      await this._renderPreview(value);
    };

    switch (action) {
      case 'h1':             insertLinePrefix(input, '# ', onChange);     break;
      case 'h2':             insertLinePrefix(input, '## ', onChange);    break;
      case 'h3':             insertLinePrefix(input, '### ', onChange);   break;
      case 'bold':           wrapSelection(input, '**', '**', onChange);  break;
      case 'italic':         wrapSelection(input, '*', '*', onChange);    break;
      case 'inline-code':    wrapSelection(input, '`', '`', onChange);    break;
      case 'unordered-list': insertLinePrefix(input, '- ', onChange);     break;
      case 'ordered-list':   insertLinePrefix(input, '1. ', onChange);    break;
      case 'blockquote':     insertLinePrefix(input, '> ', onChange);     break;
      case 'code-block':     insertCodeBlock(input, onChange);            break;
      case 'table':          insertTable(input, onChange);                break;
      case 'hr':             insertLinePrefix(input, '---\n', onChange);  break;
      case 'link':           this._openLinkModal();                       break;
      case 'ref-anchor':     eventBus.emit('links:open-editor', { anchorAt: session.get('activeNodeId') }); break;
    }
  }

  // ─── View Mode ────────────────────────────────────────────────────────────

  _applyEditorMode(mode) {
    const pane = this.element('split-pane');
    pane.className = `split-pane split-pane--${mode}`;

    ['split', 'editor', 'preview'].forEach(m => {
      this.element(`mode-${m}`)?.classList.toggle('editor-mode-button--active', m === mode);
    });
  }

  // ─── Link Modal ───────────────────────────────────────────────────────────

  _buildLinkModal() {
    const overlayId = this.elementId('link-modal-overlay');
    const textInputId = this.elementId('link-text-input');
    const urlInputId = this.elementId('link-url-input');

    this._linkModal = buildStandardModal(overlayId, {
      title: 'Insert Link',
      bodyHTML: 
        `<div class="form-group">
            <label class="form-label" for="${textInputId}">Link text</label>
            <input type="text" class="form-input" id="${textInputId}" placeholder="Display text" autocomplete="off">
          </div>
          <div class="form-group form-group--spaced">
            <label class="form-label" for="${urlInputId}">URL</label>
            <input type="url" class="form-input" id="${urlInputId}" placeholder="https://" autocomplete="off">
          </div>`,
      primaryLabel: 'Insert',
      wide: 'm',
      onPrimary: () => {
        const text = this.globalElement('link-text-input',this._linkModal)?.value || 'Link';
        const url = this.globalElement('link-url-input', this._linkModal)?.value  || '#';
        closeModal(this._linkModal);

        const input = this.element('editor-input');
        if (input.disabled) 
          return;

        const onChange = value => {
          const nodeId = session.get('activeNodeId');

          notifyOpenProjectChange(() => {
            const node = nodeId ? findNode(nodeId) : null;

            if (node)
              node.content = value;
          });

          this._renderPreview(value);
        };

        insertLink(input, text, url, onChange);
      }
    });

    addModalEnterAction(this._linkModal, { 
      targetId: textInputId,
      actionId: urlInputId,
      actionFunc: (action) => { action?.focus(); },
    });

    addModalEnterAction(this._linkModal, { 
      targetId: urlInputId,
      actionSelector: '[data-modal-primary]',
    });
  }

  _openLinkModal() {
    const input = this.element('editor-input');
    const selected = getSelectedText(input);
    const textEl = this.globalElement('link-text-input', this._linkModal);
    const urlEl = this.globalElement('link-url-input', this._linkModal);

    if (textEl) 
      textEl.value = selected;
    if (urlEl)  
      urlEl.value  = 'https://';

    openModal(this._linkModal);
    setTimeout(() => {
      const focusTarget = selected ? urlEl : textEl;
      focusTarget?.focus();
    }, 80);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _emptyStateHTML() {
    return `<div class="editor-empty-state">
      <div class="editor-empty-state__icon">📄</div>
      <div class="editor-empty-state__title">No entry selected</div>
      <div class="editor-empty-state__subtitle">
        Select an entry from the sidebar or create a new one.
      </div>
    </div>`;
  }
}