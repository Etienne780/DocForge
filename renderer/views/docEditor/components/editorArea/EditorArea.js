import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { Component } from '@core/Component.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js'
import { eventBus } from '@core/EventBus.js';
import { ResizeController } from '@core/ResizeController';
import { componentLoader } from '@core/ComponentLoader.js';
import { findNode, getNodePath, notifyOpenProjectChange } from '@data/ProjectManager.js';
import { NODE_TYPE, NODE_TYPE_INFO, getNodeExportRole } from '@data/NodeTypes.js';
import { findNodeInProject, updateLinkUsagesForNode, findLinkBySlug, getLinkStatus } from '@data/LinkManager.js';
import { getCurrentTheme } from '@data/DocThemeManager.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { buildNodePreview } from '@core/HtmlBuilder.js';
import { debounce, setIframeContent } from '@common/Common.js'
import { addTabIndenting, addLineBreakIndenting } from '@common/UIUtils.js';
import { getWordWrapIcon } from '@ui/Icon.js';
import { applyEditorColors } from '@common/EditorColors.js';
import { EditorHighlighter } from './helpers/EditorHighlighter.js';
import { EditorAutocomplete } from './helpers/EditorAutocomplete.js';
import { EditorStructureEdit } from './helpers/EditorStructureEdit.js';

import {
  insertLinePrefix,
  wrapSelection,
  insertCodeBlock,
  insertTable,
  insertTree,
  insertLink,
  getSelectedText,
  syncScrollPosition,
  toggleComment,
  toggleCheckMark,
  continueListOnEnter,
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

    // find / replace (FindWidget, search tab of the right sidebar)
    this.subscribe('editor:select-range', options => this._selectRange(options));
    this.subscribe('editor:replace-content', ({ nodeId, content }) => this._replaceContent(nodeId, content));
    componentLoader.load(`${this.componentPath}/findWidget/FindWidget`, this.element('find-slot'), {
      textarea: this.element('editor-input'),
      highlighter: this._highlighter,
      getProject: () => this._activeProject,
    }).then(instance => {
      this._findWidget = instance;
    });

    this.subscribe('session:change:openProject:links', () => {
      this._highlighter.refresh();
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
    this.subscribe('state:change:editorColors', () => applyEditorColors(this.element('editor-input-container')));
    this.subscribe('state:change:isDarkMode', () => applyEditorColors(this.element('editor-input-container')));
    this.subscribe('session:change:openProject', ({ value, previousValue }) => {
      if (value?.id !== previousValue?.id)
        session.set('activeNodeId', null);
    });
  }

  onDestroy() {
    this._saveEntryScroll(this._lastNodeId);
    if (this._findWidget)
      componentLoader.destroy(this._findWidget.instanceId);
    this._linkModal?.remove();
    this._resize.destroy();
    this._autocomplete.destroy();
    this._structureEdit.destroy();
    this._highlighter.destroy();
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

  /**
   * Opens an entry (if needed) and selects a text range in it (search results).
   * @param {{ nodeId: string, start: number, end: number, focus?: boolean }} options
   */
  _selectRange({ nodeId, start, end, focus = false }) {
    if (nodeId !== session.get('activeNodeId')) {
      const found = findNodeInProject(this._activeProject, nodeId);
      if (!found)
        return;
      if (session.get('activeTabId') !== found.tab.id)
        session.set('activeTabId', found.tab.id);
      session.set('activeNodeId', nodeId);
    }

    const input = this.element('editor-input');
    if (focus)
      input.focus({ preventScroll: true });
    input.setSelectionRange(start, end);
    this._highlighter.scrollToPosition(start);
  }

  /**
   * Replaces the whole content of the open entry like typing it, so it is part of the undo history.
   * The scroll position and the cursor stay.
   */
  _replaceContent(nodeId, content) {
    const input = this.element('editor-input');
    if (nodeId !== session.get('activeNodeId') || input.disabled || input.value === content)
      return;

    const { scrollTop, selectionStart } = input;
    const focused = document.activeElement;

    input.focus({ preventScroll: true });
    input.select();
    const done = content
      ? document.execCommand('insertText', false, content)
      : document.execCommand('delete');
    if (!done) {
      input.value = content;
      this._onContentChange();
    }

    const caret = Math.min(selectionStart, content.length);
    input.setSelectionRange(caret, caret);
    input.scrollTop = scrollTop;
    if (focused && focused !== input)
      focused.focus({ preventScroll: true });
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
    // registered before the line break indenting: handles Enter in list items
    // (Shift+Enter keeps a plain line break)
    editorInput.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey)
        return;
      if (continueListOnEnter(editorInput)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    });
    addLineBreakIndenting(editorInput);

    // ── Highlighting ──────────────────────────────────────────────────────────
    this._highlighter = new EditorHighlighter(editorInput, {
      isRefValid: slug => {
        const link = findLinkBySlug(this._activeProject, slug);
        return Boolean(link && getLinkStatus(this._activeProject, link).ok);
      },
    });
    applyEditorColors(this.element('editor-input-container'));
    this._autocomplete = new EditorAutocomplete(editorInput, this._highlighter, {
      getProject: () => this._activeProject,
    });
    this._structureEdit = new EditorStructureEdit(editorInput, this._highlighter, this.element('editor-input-container'), {
      getProject: () => this._activeProject,
    });
    this.subscribe('editor:edit-structure', () => this._structureEdit.open());

    let syncPending = false;
    const syncPreview = () => {
      if (syncPending || state.get('projectEditorMode') !== 'split')
        return;
      syncPending = true;
      requestAnimationFrame(() => {
        syncPending = false;
        syncScrollPosition(editorInput, this.element('preview-pane'));
      });
    };
    // the preview follows the cursor line; after an edit the next render syncs
    // with up to date anchors instead
    const syncPreviewToCursor = () => {
      if (editorInput.value === this._renderedMarkdown)
        syncPreview();
    };
    editorInput.addEventListener('scroll', syncPreview);
    editorInput.addEventListener('keyup', syncPreviewToCursor);
    editorInput.addEventListener('mouseup', syncPreviewToCursor);

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

  /**
   * Remembers the scroll position of the editor and the preview of an entry
   * for the session (project.session.entryScroll), restored when it is opened again.
   * @param {string|null} nodeId
   */
  _saveEntryScroll(nodeId) {
    const projectSession = this._activeProject?.session;
    if (!nodeId || !projectSession)
      return;

    let previewTop = 0;
    try {
      previewTop = this.element('preview-pane')?.contentWindow?.docPreview?.getScrollPosition().scrollTop ?? 0;
    } catch (e) {}

    projectSession.entryScroll ??= new Map();
    projectSession.entryScroll.set(nodeId, { editor: this.element('editor-input').scrollTop, preview: previewTop });
  }

  _loadActiveNode() {
    const input = this.element('editor-input');
    const preview = this.element('preview-pane');
    const nodeId = session.get('activeNodeId');
    const node = nodeId ? findNode(nodeId) : null;

    if (!node) {
      this._saveEntryScroll(this._lastNodeId);
      this._lastNodeId = null;
      input.value    = '';
      input.disabled = true;
      input.placeholder = 'No entry selected';
      this._highlighter.update();
      preview.srcdoc = '';
      this._updateStats('');
      this._updateContentNotice();
      return;
    }

    const isNewNode = this._lastNodeId !== nodeId;
    this._autocomplete.close();
    if (isNewNode) {
      this._saveEntryScroll(this._lastNodeId);
      this._lastNodeId = nodeId;
      input.scrollTop = 0;
      // position of the last visit of this entry (session only), the preview follows on render
      const saved = state.get('rememberEntryScroll')
        ? this._activeProject?.session?.entryScroll?.get(nodeId)
        : null;
      this._pendingEntryScroll = saved ?? { editor: 0, preview: 0 };
    }

    input.disabled = false;
    input.placeholder = 'Enter Markdown here…';

    if (input.value !== node.content) {
      input.value = node.content ?? '';
    }
    if (isNewNode)
      input.scrollTop = this._pendingEntryScroll.editor;
    // link states can differ between projects
    if (isNewNode)
      this._highlighter.refresh();

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
    // every content change ends here, also the ones made from code
    this._highlighter.update();
    this._structureEdit?.update();

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
      this._renderedMarkdown = markdown;

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

        // in split mode the anchors keep the preview at the edited spot,
        // even if blocks above changed their height
        const entryScroll = this._pendingEntryScroll;
        this._pendingEntryScroll = null;
        const synced = state.get('projectEditorMode') === 'split'
          && syncScrollPosition(this.element('editor-input'), preview);
        if (!synced)
          preview.contentWindow.docPreview.setScrollPosition(entryScroll ? entryScroll.preview : prevScroll.scrollTop);
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
      case 'ordered-list':   insertLinePrefix(input, 'n. ', onChange);    break;
      case 'check-mark':     toggleCheckMark(input, onChange);            break;
      case 'blockquote':     insertLinePrefix(input, '> ', onChange);     break;
      case 'code-block':     insertCodeBlock(input, onChange);            break;
      case 'table':          insertTable(input, onChange);                break;
      case 'tree':           insertTree(input, onChange);                 break;
      case 'hr':             insertLinePrefix(input, '---\n', onChange);  break;
      case 'comment':        toggleComment(input, onChange);              break;
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