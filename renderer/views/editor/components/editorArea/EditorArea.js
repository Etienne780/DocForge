import { buildDoneModal, buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { Component } from '@core/Component.js';
import { state } from '@core/State.js';
import { session } from '@core/SessionState.js'
import { eventBus } from '@core/EventBus.js';
import { getActiveDocTheme, findNode, getNodePath, getActiveTab } from '@data/ProjectManager.js';
import { applyDocFontSize, applyStoredDocTheme, applyDocCSSVariable, resetDocTheme  } from '@common/DocThemeHelper.js';
import { parseMarkdown } from '@common/MarkdownParser.js';
import { escapeHTML } from '@common/Common.js'
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
 *   - Live Markdown → HTML preview with scroll sync
 *   - Persisting edits back into the active node via state
 *   - Link insertion modal (created dynamically in onLoad)
 */
export default class EditorArea extends Component {

  onLoad() {
    this._buildThemeModal();
    this._buildLinkModal();

    applyStoredDocTheme();

    this._renderBreadcrumb();
    this._loadActiveNode();
    this._applyEditorMode(state.get('editorMode'));

    // ── Breadcrumb ────────────────────────────────────────────────────────────
    const breadcrumb = this.element('breadcrumb');
    breadcrumb.addEventListener('wheel', (e) => {
      if (e.deltaY === 0)
        return;
    
      e.preventDefault(); // prevent vertical scroll
      breadcrumb.scrollBy({
        left: e.deltaY,
        behavior: 'smooth'
      });
    }, { passive: false });

    // ── Toolbar ───────────────────────────────────────────────────────────────
    this.element('toolbar').addEventListener('click', event => {
      const button = event.target.closest('[data-toolbar-action]');
      if (button) {
        this._handleToolbarAction(button.dataset.toolbarAction);
        return;
      }
      const modeButton = event.target.closest('[data-mode]');
      if (modeButton) {
        state.set('editorMode', modeButton.dataset.mode);
      }
    });

    // ── Editor input ──────────────────────────────────────────────────────────
    this.element('editor-input').addEventListener('input', () => {
      this._onContentChange();
    });

    this.element('editor-input').addEventListener('scroll', () => {
      if (state.get('editorMode') === 'split') {
        syncScrollPosition(
          this.element('editor-input'),
          this.element('preview-pane'),
        );
      }
    });

    // ── State subscriptions ───────────────────────────────────────────────────
    this.subscribe('session:change:activeNodeId', () => {
      this._renderBreadcrumb();
      this._loadActiveNode();
    });
    this.subscribe('session:change:activeProjectId', () => {
      session.set('activeNodeId', null);
    });
    this.subscribe('state:change:activeTab', () => {
      this._renderBreadcrumb();
      this._loadActiveNode();
    });
    this.subscribe('state:change:editorMode', ({ value }) => {
      this._applyEditorMode(value);
    });
  }

  onDestroy() {
    this._linkModal?.remove();
  }

  // ─── Breadcrumb ───────────────────────────────────────────────────────────

  _renderBreadcrumb() {
    const breadcrumb = this.element('breadcrumb');
    const nodeId = session.get('activeNodeId');
    const activeTab = getActiveTab();

    if (!nodeId || !activeTab) {
      breadcrumb.innerHTML = '<span class="breadcrumb__placeholder">Select an entry</span>';
      return;
    }

    const path = getNodePath(nodeId) ?? [findNode(nodeId)].filter(Boolean);
    if (!path.length) {
      breadcrumb.innerHTML = '<span class="breadcrumb__placeholder">Select an entry</span>';
      return;
    }

    let html = `<span class="breadcrumb__segment">${escapeHTML(activeTab.name)}</span>`;
    path.forEach((node, index) => {
      html += '<span class="breadcrumb__separator"> › </span>';
      if (index < path.length - 1) {
        html += `<span class="breadcrumb__segment breadcrumb__segment--link" data-node-id="${node.id}">${escapeHTML(node.name)}</span>`;
      } else {
        html += `<span class="breadcrumb__segment breadcrumb__segment--current">${escapeHTML(node.name)}</span>`;
      }
    });

    breadcrumb.innerHTML = html;

    breadcrumb.querySelectorAll('[data-node-id]').forEach(el => {
      el.addEventListener('click', () => session.set('activeNodeId', el.dataset.nodeId));
    });
  }

  // ─── Node Loading ─────────────────────────────────────────────────────────

  _loadActiveNode() {
    const input = this.element('editor-input');
    const preview = this.element('preview-pane');
    const nodeId = session.get('activeNodeId');
    const node = nodeId ? findNode(nodeId) : null;

    if (!node) {
      input.value    = '';
      input.disabled = true;
      input.placeholder = 'No entry selected';
      preview.innerHTML = this._emptyStateHTML();
      this._updateStats('');
      return;
    }

    input.disabled = false;
    input.placeholder = 'Enter Markdown here…';

    if (input.value !== node.content) {
      input.value = node.content ?? '';
    }

    this._renderPreview(node.content ?? '');
  }

  // ─── Content Changes ──────────────────────────────────────────────────────

  _onContentChange() {
    const input = this.element('editor-input');
    const nodeId = session.get('activeNodeId');
    const node = nodeId ? findNode(nodeId) : null;

    if (!node) 
      return;

    node.content = input.value;
    state.set('projects', [...state.get('projects')]);

    this._renderPreview(input.value);
  }

  _renderPreview(markdown) {
    const preview = this.element('preview-pane');
    preview.innerHTML = parseMarkdown(markdown);
    this._updateStats(markdown);

    // Emit so SidebarRight can rebuild its TOC
    eventBus.emit('editor:content-changed', { markdown });
  }

  _updateStats(markdown) {
    const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
    eventBus.emit('editor:stats-updated', {
      wordCount: words,
      charCount: markdown.length,
    });
  }

  // ─── Toolbar Actions ──────────────────────────────────────────────────────

  _handleToolbarAction(action) {
    const input = this.element('editor-input');
    if (input.disabled && action !== 'theme') 
      return;

    const onChange = value => {
      const nodeId = session.get('activeNodeId');
      const node = nodeId ? findNode(nodeId) : null;
      if (node) 
        node.content = value;

      state.set('projects', [...state.get('projects')]);
      this._renderPreview(value);
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
      case 'theme':          this._openThemeModal();                      break;
    }
  }

  // ─── View Mode ────────────────────────────────────────────────────────────

  _applyEditorMode(mode) {
    const pane = this.element('split-pane');
    pane.className = `split-pane split-pane--${mode}`;

    ['split', 'editor', 'preview'].forEach(m => {
      this.element(`mode-${m}`)?.classList.toggle('mode-button--active', m === mode);
    });
  }

  // ─── Link Modal ───────────────────────────────────────────────────────────

  _buildLinkModal() {
    const overlayId   = this.elementId('link-modal-overlay');
    const textInputId = this.elementId('link-text-input');
    const urlInputId  = this.elementId('link-url-input');
    const insertBtnId = this.elementId('link-insert-button');
    const cancelBtnId = this.elementId('link-cancel-button');
    const closeBtnId  = this.elementId('link-close-button');

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
      wide: true,
      onPrimary: () => {
        const text = document.getElementById(textInputId)?.value || 'Link';
        const url = document.getElementById(urlInputId)?.value  || '#';
        closeModal(this._linkModal);

        const input = this.element('editor-input');
        if (input.disabled) 
          return;

        const onChange = value => {
          const nodeId = session.get('activeNodeId');
          const node = nodeId ? findNode(nodeId) : null;
          if (node) 
            node.content = value;
          state.set('projects', [...state.get('projects')]);
          this._renderPreview(value);
        };

        insertLink(input, text, url, onChange);
      }
    });

    document.getElementById(urlInputId)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') 
        document.getElementById(insertBtnId)?.click();
    });

    document.body.appendChild(this._linkModal);
  }

  _openLinkModal() {
    const input = this.element('editor-input');
    const selected = getSelectedText(input);
    const textEl = document.getElementById(this.elementId('link-text-input'));
    const urlEl = document.getElementById(this.elementId('link-url-input'));

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

  // ─── Theme Modal ─────────────────────────────────────────────────────────

  _buildThemeModal() {
    const colorFields = [
      { label: 'Background',      property: '--doc-background',  placeholder: '#0c0c12' },
      { label: 'Text',            property: '--doc-text',        placeholder: '#e0dbd0' },
      { label: 'Muted text',      property: '--doc-text-muted',  placeholder: '#9898b0' },
      { label: 'Headings',        property: '--doc-heading',     placeholder: '#f0ebe0' },
      { label: 'Accent',          property: '--doc-accent',      placeholder: '#22d4a8' },
      { label: 'Links',           property: '--doc-link',        placeholder: '#78a8ff' },
      { label: 'Italic',          property: '--doc-em',          placeholder: '#ffad45' },
      { label: 'Code background', property: '--doc-code-bg',     placeholder: '#07070f' },
      { label: 'Code text',       property: '--doc-code-text',   placeholder: '#80d89a' },
      { label: 'Borders',         property: '--doc-border',      placeholder: '#252538' },
    ];

    const colorGridHTML = colorFields.map(field => {
      const safeKey = field.property.replace(/--/g, '').replace(/-/g, '_');
      const pickerId = this.elementId(`color-picker-${safeKey}`);
      const textId   = this.elementId(`color-text-${safeKey}`);
      return `
        <div class="form-group">
          <label class="form-label">${field.label}</label>
          <div class="color-input-row">
            <input type="color" class="color-picker" id="${pickerId}" data-property="${field.property}">
            <input type="text" class="form-input" id="${textId}" placeholder="${field.placeholder}" data-property="${field.property}" data-is-text="true">
          </div>
        </div>`;
    }).join('');
    
    const resetButtonId   = this.elementId('theme-reset-button');
    const fontSizeRangeId = this.elementId('font-size-range');
    const fontSizeLabelId = this.elementId('font-size-label');
    
    this._themeModal = buildDoneModal(this.elementId('theme-modal-overlay'), {
      title: 'Customize Theme',
      bodyHTML: `
        <div class="form-section-label">Colors</div>
        <div class="color-grid">${colorGridHTML}</div>
        <div class="form-section-label">Typography</div>
        <div class="form-group">
          <label class="form-label">Preview font size</label>
          <div class="range-row">
            <input type="range" min="12" max="22" value="15" id="${fontSizeRangeId}">
            <span class="range-value" id="${fontSizeLabelId}">15px</span>
          </div>
        </div>
        <div class="form-section-label">Reset</div>
        <button class="button button--secondary" id="${resetButtonId}">Reset to defaults</button>`,
      wide: true,
    });
  
    document.getElementById(resetButtonId)?.addEventListener('click', () => {
      resetDocTheme();
      this._populateThemeModal();
      eventBus.emit('toast:show', { message: 'Theme reset to defaults.', type: 'success' });
    });
  
    this._themeModal.querySelectorAll('input[data-property]').forEach(input => {
      input.addEventListener('input', event => {
        const property = event.target.dataset.property;
        const value    = event.target.value;
        const isText   = !!event.target.dataset.isText;
        if (!value.match(/^#[0-9a-f]{6}$/i) && isText) return;
        applyDocCSSVariable(property, value);
        const safeKey  = property.replace(/--/g, '').replace(/-/g, '_');
        const pairedId = isText
          ? this.elementId(`color-picker-${safeKey}`)
          : this.elementId(`color-text-${safeKey}`);
        const paired = document.getElementById(pairedId);
        if (paired) paired.value = value;
      });
    });
  
    document.getElementById(fontSizeRangeId)?.addEventListener('input', event => {
      const size = Number(event.target.value);
      document.getElementById(fontSizeLabelId).textContent = `${size}px`;
      applyDocFontSize(size);
    });
  }

  _openThemeModal() {
    this._populateThemeModal(); 
    openModal(this._themeModal);
  }

  _populateThemeModal() {
    const theme = getActiveDocTheme();
    const previewEl  = document.querySelector('.preview-pane');

    this._themeModal.querySelectorAll('input[data-property]').forEach(input => {
      const property = input.dataset.property;

      const computed = previewEl
        ? getComputedStyle(previewEl).getPropertyValue(property).trim()
        : '';

      const value = (theme[property] || computed).trim();

      if (input.type === 'color') {
        if (value.match(/^#[0-9a-f]{6}$/i)) {
          input.value = value.toLowerCase();
        }
      } else {
        input.value = value;
      }
    });

    const storedFontSize = theme['--doc-font-size'] ?? 15;
    const rangeEl = document.getElementById(this.elementId('font-size-range'));
    const labelEl = document.getElementById(this.elementId('font-size-label'));
    if (rangeEl) rangeEl.value = storedFontSize;
    if (labelEl) labelEl.textContent = `${storedFontSize}px`;
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