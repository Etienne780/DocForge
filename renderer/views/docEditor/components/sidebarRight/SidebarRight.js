import { Component } from '@core/Component.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { ResizeController } from '@core/ResizeController';
import { openModal, closeModal } from '@core/ModalBuilder.js';
import { escapeHTML, debounce } from '@common/Common.js'
import { buildConfirmationDeleteModal } from '@common/BaseModals.js';
import { createActionMenu } from '@common/UIUtils.js';
import { findNode, getOpenProject } from '@data/ProjectManager.js';
import {
  getProjectLinks,
  getLinkStatus,
  getUnknownLinkUsages,
  findLink,
  findNodeInProject,
  removeLink,
  stripLinkSyntax,
  getLinkAnchorElementId,
} from '@data/LinkManager.js';
import { LinkModal } from './helpers/LinkModalHelper.js';

/**
 * SidebarRight - table of contents, reference links and document statistics.
 *
 * Responsibilities:
 *   - "Contents" tab: TOC from Markdown headings in the active node's content
 *   - "Links" tab: all reference links of the project with their status
 *     (see @data/LinkManager.js), unknown [[slug]] usages, create/edit/delete
 *   - Displays live word count and character count
 */
export default class SidebarRight extends Component {

  onLoad() {
    this._resize = new ResizeController(this.container, {
      initialSize: 200,
      minSize: 150,
      maxSize: 500,
      keepRatio: false,
      direction: 'left',
    });

    this._linkModal = new LinkModal(localName => this.elementId(localName));
    this._buildDeleteModal();

    this._buildTOC('');
    this._updateStats(0, 0);
    this._renderLinks();

    // ── Tabs ──────────────────────────────────────────────────────────────────
    this.element('tabs').addEventListener('click', event => {
      const tab = event.target.closest('[data-tab-action]');
      if (tab)
        this._showPanel(tab.dataset.tabAction);
    });

    // ── TOC item clicks ───────────────────────────────────────────────────────
    this.element('toc-container').addEventListener('click', event => {
      const item = event.target.closest('[data-heading-index]');
      if (!item) return;
      this._scrollPreviewToHeading(Number(item.dataset.headingIndex));
    });

    // ── Links ─────────────────────────────────────────────────────────────────
    this.element('links-add').addEventListener('click', () => this._openLinkModal());
    this.element('links-container').addEventListener('click', event => {
      if (event.target.closest('.menu-item'))
        return;
      const nodeEl = event.target.closest('[data-open-node]');
      if (nodeEl) {
        eventBus.emit('editor:open-node', { nodeId: nodeEl.dataset.openNode });
        return;
      }
      const item = event.target.closest('[data-link-id]');
      if (item)
        this._goToTarget(item.dataset.linkId);
    });

    const renderLinks = debounce(() => this._renderLinks(), 200);
    [
      'session:change:openProject',
      'session:change:openProject:links',
      'session:change:openProject:tabs',
      'session:change:openProject:tabs:name',
      'session:change:openProject:tabs:nodes',
      'session:change:openProject:tabs:nodes:name',
      'session:change:openProject:tabs:nodes:type',
      'editor:content-changed',
    ].forEach(event => this.subscribe(event, renderLinks));

    this.subscribe('links:open-editor', (options = {}) => {
      this._showPanel('links');
      this._openLinkModal(options);
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
    this._linkModal?.destroy();
    this._deleteModal?.remove();
  }

  _showPanel(name) {
    this.element('tabs').querySelectorAll('[data-tab-action]').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tabAction === name);
    });
    this.element('panel-contents').classList.toggle('hidden', name !== 'contents');
    this.element('panel-links').classList.toggle('hidden', name !== 'links');
  }

  // ─── TOC ──────────────────────────────────────────────────────────────────

  _buildTOC(markdown) {
    const container = this.element('toc-container');

    // Strip fenced code blocks first so a '#'-led line inside code (a C
    // preprocessor directive, a shell shebang, a Python comment, ...) isn't
    // picked up as a Markdown heading. Keeps this in sync with how
    // MarkdownParser.js/HtmlBuilder.js resolve real headings for preview
    // and export.
    const withoutCode = markdown.replace(/```[\s\S]*?```/g, '');

    const headingPattern = /^(#{1,3}) (.+)$/gm;
    const headings = [...withoutCode.matchAll(headingPattern)];

    if (!headings.length) {
      container.innerHTML = '<div class="toc-empty">Headings (# H1, ## H2) appear here as navigation.</div>';
      return;
    }

    const project = getOpenProject();
    container.innerHTML = headings.map((match, index) => {
      const level = match[1].length;
      const title = escapeHTML(stripLinkSyntax(match[2], project).trim());
      return `<div class="toc-item toc-item--h${level}" data-heading-index="${index}">
        <span class="toc-item__dot"></span>
        <span class="toc-item__label">${title}</span>
      </div>`;
    }).join('');
  }

  _scrollPreviewToHeading(headingIndex) {
    // Query the preview pane rendered by EditorArea (lives in the editor slot)
    const previewPane = document.querySelector('.editor-area-preview-pane');
    if (!previewPane)
      return;

    const headingElements = previewPane.querySelectorAll('h1, h2, h3');
    const target = headingElements[headingIndex];
    if (!target)
      return;

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Brief highlight flash
    const originalBackground = target.style.background;
    target.style.background = 'var(--accent-bg)';
    target.style.transition = 'background 0.6s';
    setTimeout(() => {
      target.style.background = originalBackground;
    }, 900);
  }

  // ─── Links ────────────────────────────────────────────────────────────────

  _renderLinks() {
    const container = this.element('links-container');
    const project = getOpenProject();
    if (!container || !project)
      return;

    const entries = getProjectLinks(project)
      .map(link => ({ link, status: getLinkStatus(project, link) }))
      .sort((a, b) => (a.status.ok - b.status.ok) || a.link.name.localeCompare(b.link.name));
    const unknown = getUnknownLinkUsages(project);
    const brokenCount = entries.filter(e => !e.status.ok).length + unknown.length;

    this.element('links-summary').textContent = brokenCount
      ? `${entries.length} links · ${brokenCount} broken`
      : `${entries.length} links`;

    if (!entries.length && !unknown.length) {
      container.innerHTML = `<div class="toc-empty">No links yet. Create one with + or mark a place with {#} in the editor toolbar, then use it as [[slug]].</div>`;
      return;
    }

    container.innerHTML = entries.map(({ link, status }) => this._linkItemHTML(project, link, status)).join('')
      + (unknown.length ? `
        <div class="links-section-label">Unknown links</div>
        ${unknown.map(u => this._unknownItemHTML(u)).join('')}` : '');

    container.querySelectorAll('[data-link-id]').forEach(item => {
      const linkId = item.dataset.linkId;
      item.querySelector('.link-item__actions').append(createActionMenu([
        { name: 'Insert', description: 'Insert at the cursor', action: () => this._insertLink(linkId) },
        { name: 'Go to target', action: () => this._goToTarget(linkId) },
        { name: 'Edit', action: () => this._openLinkModal({ linkId }) },
        { name: 'Delete', danger: true, action: () => this._confirmDelete(linkId) },
      ]));
    });

    container.querySelectorAll('[data-unknown-slug]').forEach(item => {
      const slug = item.dataset.unknownSlug;
      item.querySelector('.link-item__actions').append(createActionMenu([
        { name: 'Create link', action: () => this._openLinkModal({ slug }) },
      ]));
    });
  }

  _linkItemHTML(project, link, status) {
    const found = findNodeInProject(project, link.target?.nodeId);
    const target = found
      ? `${found.tab.name} › ${found.path.map(n => n.name).join(' › ')}${link.target.anchor ? ` #${link.target.anchor}` : ''}`
      : '(deleted entry)';
    const uses = link.refs?.length ?? 0;
    const statusText = status.ok
      ? `${status.warning ? '⚠ ' + status.warning + ' · ' : ''}${uses} ${uses === 1 ? 'use' : 'uses'}`
      : `⚠ ${status.reason}`;

    return `
      <div class="link-item button__actions-parent${status.ok ? '' : ' link-item--broken'}" data-link-id="${escapeHTML(link.id)}" title="${escapeHTML(target)}">
        <div class="link-item__content">
          <span class="link-item__name">${escapeHTML(link.name)}</span>
          <span class="link-item__slug">[[${escapeHTML(link.slug)}]]</span>
          <span class="link-item__target">${escapeHTML(target)}</span>
          <span class="link-item__status">${escapeHTML(statusText)}</span>
        </div>
        <div class="button__actions link-item__actions"></div>
      </div>`;
  }

  _unknownItemHTML({ slug, nodes }) {
    return `
      <div class="link-item button__actions-parent link-item--broken" data-unknown-slug="${escapeHTML(slug)}">
        <div class="link-item__content">
          <span class="link-item__slug">[[${escapeHTML(slug)}]]</span>
          <span class="link-item__status">⚠ No link with this slug. Used in:</span>
          ${nodes.map(n => `<span class="link-item__usage" data-open-node="${escapeHTML(n.id)}">${escapeHTML(n.name)}</span>`).join('')}
        </div>
        <div class="button__actions link-item__actions"></div>
      </div>`;
  }

  _openLinkModal(options = {}) {
    const project = getOpenProject();
    if (project)
      this._linkModal.open(project, options);
  }

  _insertLink(linkId) {
    const link = findLink(getOpenProject(), linkId);
    if (link)
      eventBus.emit('editor:insert', { text: `[[${link.slug}]]` });
  }

  _goToTarget(linkId) {
    const link = findLink(getOpenProject(), linkId);
    if (!link?.target?.nodeId)
      return;

    const anchor = link.target.anchor ? getLinkAnchorElementId(link.target.nodeId, link.target.anchor) : null;
    eventBus.emit('editor:open-node', { nodeId: link.target.nodeId, anchor });
  }

  _buildDeleteModal() {
    this._deleteModal = buildConfirmationDeleteModal(this.elementId('link-delete-modal'), {
      title: 'Delete link',
      zIndex: '1001',
      onConfirm: () => {
        closeModal(this._deleteModal);
        const project = getOpenProject();
        if (project && this._deleteLinkId)
          removeLink(project, this._deleteLinkId);
        this._deleteLinkId = null;
      },
    });
  }

  _confirmDelete(linkId) {
    const link = findLink(getOpenProject(), linkId);
    if (!link)
      return;

    const uses = link.refs?.length ?? 0;
    this._deleteLinkId = linkId;
    this._deleteModal.querySelector('.modal__confirm-message').textContent = uses
      ? `'${link.name}' is used in ${uses} ${uses === 1 ? 'entry' : 'entries'}. These usages will show as broken links.`
      : `Delete the link '${link.name}'?`;
    openModal(this._deleteModal);
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  _updateStats(wordCount, charCount) {
    const wordEl = this.element('word-count');
    const charEl = this.element('char-count');
    if (wordEl)
      wordEl.textContent = `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`;
    if (charEl)
      charEl.textContent = `${charCount} ${charCount === 1 ? 'char' : 'chars'}`;
  }
}
