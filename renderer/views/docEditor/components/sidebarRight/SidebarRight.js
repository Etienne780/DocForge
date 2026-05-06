import { Component } from '@core/Component.js';
import { session } from '@core/SessionState.js';
import { ResizeController } from '@core/ResizeController';
import { escapeHTML } from '@common/Common.js'
import { findNode } from '@data/ProjectManager.js';

/**
 * SidebarRight - table of contents and document statistics.
 *
 * Responsibilities:
 *   - Builds a TOC from Markdown headings in the active node's content
 *   - Allows click-to-scroll within the preview pane (via DOM query in editor slot)
 *   - Displays live word count and character count
 *   - Rebuilds TOC whenever the editor emits a content-changed event
 */
export default class SidebarRight extends Component {

  onLoad() {
    this._activeProject = this.props.project;
    this._resize = new ResizeController(this.container, { 
      initialSize: 200,
      minSize: 150,
      maxSize: 500,
      keepRatio: false,
      direction: 'left',
    });

    this._buildTOC('');
    this._updateStats(0, 0);

    // ── TOC item clicks ───────────────────────────────────────────────────────
    this.element('toc-container').addEventListener('click', event => {
      const item = event.target.closest('[data-heading-index]');
      if (!item) return;
      this._scrollPreviewToHeading(Number(item.dataset.headingIndex));
    });

    // ── Listen for content changes from EditorArea ────────────────────────────
    this.subscribe('editor:content-changed', ({ markdown }) => {
      this._buildTOC(markdown);
    });

    this.subscribe('editor:stats-updated', ({ wordCount, charCount }) => {
      this._updateStats(wordCount, charCount);
    });

    // ── Rebuild on node switch ────────────────────────────────────────────────
    this.subscribe('session:change:activeNodeId', () => {
      const nodeId = session.get('activeNodeId');
      const node = nodeId ? findNode(nodeId) : null;
      this._buildTOC(node?.content ?? '');
      if (!node) this._updateStats(0, 0);
    });
  }

  onDestroy() {
    this._resize.destroy();
  }

  // ─── TOC ──────────────────────────────────────────────────────────────────

  _buildTOC(markdown) {
    const container = this.element('toc-container');
    const headingPattern = /^(#{1,3}) (.+)$/gm;
    const headings = [...markdown.matchAll(headingPattern)];

    if (!headings.length) {
      container.innerHTML = '<div class="toc-empty">Headings (# H1, ## H2) appear here as navigation.</div>';
      return;
    }

    container.innerHTML = headings.map((match, index) => {
      const level = match[1].length;
      const title = escapeHTML(match[2]);
      return `<div class="toc-item toc-item--h${level}" data-heading-index="${index}">
        <span class="toc-item__dot"></span>
        <span class="toc-item__label">${title}</span>
      </div>`;
    }).join('');
  }

  _scrollPreviewToHeading(headingIndex) {
    // Query the preview pane rendered by EditorArea (lives in the editor slot)
    const previewPane = document.querySelector('.preview-pane');
    if (!previewPane) return;

    const headingElements = previewPane.querySelectorAll('h1, h2, h3');
    const target = headingElements[headingIndex];
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Brief highlight flash
    const originalBackground = target.style.background;
    target.style.background = 'var(--accent-bg)';
    target.style.transition = 'background 0.6s';
    setTimeout(() => {
      target.style.background = originalBackground;
    }, 900);
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  _updateStats(wordCount, charCount) {
    const wordEl = this.element('word-count');
    const charEl = this.element('char-count');
    if (wordEl) wordEl.textContent = `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`;
    if (charEl) charEl.textContent = `${charCount} ${charCount === 1 ? 'char' : 'chars'}`;
  }
}