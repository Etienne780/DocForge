import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { escapeHTML, setHTML } from '@common/Common.js';
import { getInfoIcon } from '@ui/Icon.js';
import {
  NODE_TYPE,
  NODE_TYPE_INFO,
  NODE_MERGE_MODE_INFO,
  MAX_SECTION_HEADING_LEVEL,
  getNodeType,
  getNodeMergeMode,
  resolveExportTree,
} from '@data/NodeTypes.js';

const PREVIEW_MAX_NAV_ITEMS = 20;
const PREVIEW_MAX_PAGES = 6;
const PREVIEW_MAX_SECTIONS = 12;

// shown in the preview when the entry has no children (yet)
const SAMPLE_CHILDREN = [
  {
    id: '__sample_a', name: 'Child A', type: NODE_TYPE.PAGE,
    children: [{ id: '__sample_a1', name: 'Grandchild', type: NODE_TYPE.PAGE, children: [] }],
  },
  { id: '__sample_b', name: 'Child B', type: NODE_TYPE.PAGE, children: [] },
];

/**
 * Modal to pick the name and/or type of an entry (create + change type).
 * The info button next to "Type" shows the navigation and pages the export would get.
 */
export class NodeTypeModal {

  /**
   * @param {(localName: string) => string} elementId - instance-prefixed id builder of the owning component
   */
  constructor(elementId) {
    const nameId = elementId('node-type-name');
    const mergeId = elementId('node-type-merge');

    this._modal = buildStandardModal(elementId('node-type-modal'), {
      title: 'Entry',
      bodyHTML: `
        <div class="form-group" data-role="name-group">
          <label class="form-label" for="${nameId}">Name</label>
          <input type="text" class="form-input" id="${nameId}" autocomplete="off" placeholder="Entry name...">
        </div>
        <div class="form-group form-group--spaced">
          <div class="node-type-modal_label-row">
            <span class="form-label">Type</span>
            <button type="button" class="icon-button icon-button--small node-type-modal_info" data-role="preview-info"
              title="Show how the export looks with this type" aria-label="Show export preview" aria-expanded="false">
              ${getInfoIcon()}
            </button>
          </div>
          <div class="node-type-modal_preview hidden" data-role="preview"></div>
          <div class="node-type-modal_options">
            ${Object.entries(NODE_TYPE_INFO).map(([type, info]) => `
              <button type="button" class="node-type-modal_option" data-type="${type}">
                <span class="node-type-modal_option-title">${escapeHTML(info.label)}</span>
                <span class="node-type-modal_option-description">${escapeHTML(info.description)}</span>
              </button>`).join('')}
          </div>
        </div>
        <div class="form-group form-group--spaced" data-role="merge-group">
          <label class="form-label" for="${mergeId}">Children of children</label>
          <select id="${mergeId}">
            ${Object.entries(NODE_MERGE_MODE_INFO).map(([mode, info]) =>
              `<option value="${mode}">${escapeHTML(info.label)}</option>`).join('')}
          </select>
          <span class="node-type-modal_hint" data-role="merge-description"></span>
        </div>`,
      primaryLabel: 'Save',
      wide: 'm',
      zIndex: '1001',
      onPrimary: () => this._submit(),
    });

    this._nameInput = this._modal.querySelector(`[id="${nameId}"]`);
    this._mergeSelect = this._modal.querySelector(`[id="${mergeId}"]`);
    this._previewInfo = this._modal.querySelector('[data-role="preview-info"]');
    this._nameGroup = this._modal.querySelector('[data-role="name-group"]');
    this._mergeGroup = this._modal.querySelector('[data-role="merge-group"]');
    this._mergeDescription = this._modal.querySelector('[data-role="merge-description"]');
    this._preview = this._modal.querySelector('[data-role="preview"]');

    this._modal.querySelectorAll('.node-type-modal_option').forEach(option => {
      option.addEventListener('click', () => {
        this._type = option.dataset.type;
        this._render();
      });
    });
    this._mergeSelect.addEventListener('change', () => {
      this._mergeDescendants = this._mergeSelect.value;
      this._render();
    });
    this._nameInput.addEventListener('input', () => this._renderPreview());
    this._previewInfo.addEventListener('click', () => {
      this._previewVisible = !this._previewVisible;
      this._render();
    });
    addModalEnterAction(this._modal, { targetId: nameId });
  }

  destroy() {
    this._modal?.remove();
  }

  /**
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.primaryLabel
   * @param {boolean} options.showName - show the name input (create)
   * @param {string} [options.name]
   * @param {Object|null} [options.node] - existing node (its type, merge mode and children are used)
   * @param {(result: { name: string, type: string, mergeDescendants: string }) => void} options.onSubmit
   */
  open({ title, primaryLabel, showName, name = '', node = null, onSubmit }) {
    this._node = node;
    this._showName = showName;
    this._onSubmit = onSubmit;
    this._type = getNodeType(node);
    this._mergeDescendants = getNodeMergeMode(node);
    this._previewVisible = false;

    this._modal.querySelector('.modal__title').textContent = title;
    this._modal.querySelector('[data-modal-primary]').textContent = primaryLabel;
    this._nameGroup.classList.toggle('hidden', !showName);
    this._nameInput.value = name;
    this._mergeSelect.value = this._mergeDescendants;

    this._render();
    openModal(this._modal);

    if (showName) {
      setTimeout(() => {
        this._nameInput.focus();
        this._nameInput.select();
      }, 80);
    }
  }

  _submit() {
    const name = this._nameInput.value.trim();
    if (this._showName && !name)
      return;

    closeModal(this._modal);
    this._onSubmit?.({ name, type: this._type, mergeDescendants: this._mergeDescendants });
    this._onSubmit = null;
  }

  _render() {
    this._modal.querySelectorAll('.node-type-modal_option').forEach(option => {
      option.classList.toggle('is-active', option.dataset.type === this._type);
    });

    this._mergeGroup.classList.toggle('hidden', this._type !== NODE_TYPE.MERGED);
    this._mergeDescription.textContent = NODE_MERGE_MODE_INFO[this._mergeDescendants]?.description ?? '';

    this._preview.classList.toggle('hidden', !this._previewVisible);
    this._previewInfo.classList.toggle('is-active', this._previewVisible);
    this._previewInfo.setAttribute('aria-expanded', String(this._previewVisible));
    this._renderPreview();
  }

  // ─── Preview ──────────────────────────────────────────────────────────────

  _renderPreview() {
    if (!this._previewVisible)
      return;

    const hasChildren = this._node?.children?.length > 0;
    const previewNode = {
      id: '__preview',
      name: (this._showName ? this._nameInput.value.trim() : this._node?.name) || 'Entry',
      type: this._type,
      mergeDescendants: this._mergeDescendants,
      children: hasChildren ? this._node.children : SAMPLE_CHILDREN,
    };
    const tree = resolveExportTree([previewNode]);

    const navCounter = { count: 0 };
    const navHTML = this._renderNav(tree.nav, previewNode.id, navCounter);
    const pagesHTML = tree.pages.length
      ? tree.pages.slice(0, PREVIEW_MAX_PAGES).map(page => this._renderPage(page, previewNode.id)).join('')
        + (tree.pages.length > PREVIEW_MAX_PAGES ? '<div class="node-type-preview_more">…</div>' : '')
      : '<div class="node-type-preview_empty">No pages</div>';

    setHTML(this._preview, `
      ${hasChildren ? '' : '<div class="node-type-preview_note">Shown with example children.</div>'}
      <div class="node-type-preview_columns">
        <div class="node-type-preview_column">
          <div class="form-section-label">Navigation</div>
          <ul class="node-type-preview_nav">${navHTML}</ul>
        </div>
        <div class="node-type-preview_column">
          <div class="form-section-label">Pages</div>
          ${pagesHTML}
        </div>
      </div>`);
  }

  _renderNav(items, rootId, counter) {
    return items.map(item => {
      if (counter.count >= PREVIEW_MAX_NAV_ITEMS)
        return '';
      counter.count++;

      const classes = ['node-type-preview_nav-item'];
      if (item.kind === 'folder')
        classes.push('node-type-preview_nav-item--folder');
      if (item.node.id === rootId)
        classes.push('node-type-preview_nav-item--current');

      const suffix = item.kind === 'folder' ? ' <span class="node-type-preview_tag">folder</span>' : '';
      const children = item.children.length
        ? `<ul class="node-type-preview_nav">${this._renderNav(item.children, rootId, counter)}</ul>`
        : '';
      return `<li class="${classes.join(' ')}">${escapeHTML(item.node.name)}${suffix}${children}</li>`;
    }).join('');
  }

  _renderPage(page, rootId) {
    const sections = page.sections.slice(0, PREVIEW_MAX_SECTIONS).map(section => {
      const level = Math.min(1 + section.depth, MAX_SECTION_HEADING_LEVEL);
      const note = section.showContent ? '' : ' <span class="node-type-preview_tag">heading only</span>';
      return `
        <li class="node-type-preview_section node-type-preview_section--depth-${Math.min(section.depth, 4)}">
          <span class="node-type-preview_tag">H${level}</span> ${escapeHTML(section.node.name)}${note}
        </li>`;
    }).join('');
    const more = page.sections.length > PREVIEW_MAX_SECTIONS ? '<li class="node-type-preview_more">…</li>' : '';
    const currentClass = page.node.id === rootId ? ' node-type-preview_page--current' : '';

    return `
      <div class="node-type-preview_page${currentClass}">
        <ul class="node-type-preview_sections">${sections}${more}</ul>
      </div>`;
  }
}
