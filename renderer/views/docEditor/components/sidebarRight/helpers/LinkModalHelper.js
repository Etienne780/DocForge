import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { escapeHTML, setHTML } from '@common/Common.js';
import { isCheckedBoxActive, setCheckBox } from '@common/UIUtils.js';
import {
  createLink,
  updateLink,
  findLink,
  findLinkBySlug,
  findNodeInProject,
  findAnchorsInContent,
  slugifyLinkName,
  isLinkSlugValid,
  isLinkAnchorValid,
} from '@data/LinkManager.js';

/**
 * Modal to create or edit a reference link (see @data/LinkManager.js).
 *
 * Modes:
 *   create   - name, slug, target entry, anchor (from the anchors in the entry)
 *   anchorAt - "Link here": target is fixed to an entry, a new {#anchor} is
 *              inserted at the editor cursor
 *   edit     - like create; a slug change can rewrite all usages
 */
export class LinkModal {

  /**
   * @param {(localName: string) => string} elementId - instance-prefixed id builder of the owning component
   */
  constructor(elementId) {
    const nameId = elementId('link-name');
    const slugId = elementId('link-slug');
    const targetId = elementId('link-target');
    const anchorSelectId = elementId('link-anchor-select');
    const anchorInputId = elementId('link-anchor-input');
    const updateUsagesId = elementId('link-update-usages');

    this._modal = buildStandardModal(elementId('link-modal'), {
      title: 'Link',
      bodyHTML: `
        <div class="form-group">
          <label class="form-label" for="${nameId}">Name</label>
          <input type="text" class="form-input" id="${nameId}" autocomplete="off" placeholder="Display name...">
        </div>
        <div class="form-group form-group--spaced">
          <label class="form-label" for="${slugId}">Slug</label>
          <input type="text" class="form-input" id="${slugId}" autocomplete="off" placeholder="name-in-text">
          <span class="link-modal_hint" data-role="slug-hint"></span>
        </div>
        <div class="form-group form-group--spaced" data-role="target-group">
          <label class="form-label" for="${targetId}">Target entry</label>
          <select id="${targetId}"></select>
        </div>
        <div class="form-group form-group--spaced" data-role="anchor-select-group">
          <label class="form-label" for="${anchorSelectId}">Anchor</label>
          <select id="${anchorSelectId}"></select>
          <span class="link-modal_hint">Mark a place in the entry with {#name} to link to it.</span>
        </div>
        <div class="form-group form-group--spaced hidden" data-role="anchor-input-group">
          <label class="form-label" for="${anchorInputId}">Anchor</label>
          <input type="text" class="form-input" id="${anchorInputId}" autocomplete="off" placeholder="anchor-name">
          <span class="link-modal_hint">Inserted at the cursor as {#anchor-name}.</span>
        </div>
        <div class="form-row form-group--spaced hidden" data-role="update-usages-group">
          <span data-role="update-usages-label"></span>
          <button id="${updateUsagesId}" class="checkbox-element checked" data-checkbox="true"></button>
        </div>
        <span class="body-label text-error invisible" data-role="error"></span>`,
      primaryLabel: 'Save',
      wide: 'm',
      zIndex: '1001',
      onPrimary: () => this._submit(),
    });

    const get = (id) => this._modal.querySelector(`[id="${id}"]`);
    this._nameInput = get(nameId);
    this._slugInput = get(slugId);
    this._targetSelect = get(targetId);
    this._anchorSelect = get(anchorSelectId);
    this._anchorInput = get(anchorInputId);
    this._updateUsages = get(updateUsagesId);
    this._role = (role) => this._modal.querySelector(`[data-role="${role}"]`);

    this._nameInput.addEventListener('input', () => {
      if (!this._slugEdited)
        this._slugInput.value = slugifyLinkName(this._nameInput.value);
      if (this._anchorAt && !this._anchorEdited)
        this._anchorInput.value = this._slugInput.value;
      this._validate();
    });
    this._slugInput.addEventListener('input', () => {
      this._slugEdited = true;
      if (this._anchorAt && !this._anchorEdited)
        this._anchorInput.value = this._slugInput.value;
      this._validate();
    });
    this._anchorInput.addEventListener('input', () => {
      this._anchorEdited = true;
      this._validate();
    });
    this._targetSelect.addEventListener('change', () => {
      this._renderAnchorOptions(null);
      this._validate();
    });

    addModalEnterAction(this._modal, { targetId: nameId });
    addModalEnterAction(this._modal, { targetId: slugId });
  }

  destroy() {
    this._modal?.remove();
  }

  /**
   * @param {Object} project
   * @param {Object} [options]
   * @param {string} [options.linkId] - edit this link
   * @param {string} [options.anchorAt] - "Link here": node id the new anchor is inserted into
   * @param {string} [options.slug] - prefill (e.g. from an unknown link)
   */
  open(project, { linkId = null, anchorAt = null, slug = '' } = {}) {
    this._project = project;
    this._link = linkId ? findLink(project, linkId) : null;
    this._anchorAt = this._link ? null : anchorAt;
    this._slugEdited = Boolean(this._link || slug);
    this._anchorEdited = false;

    const title = this._link ? 'Edit link' : (this._anchorAt ? 'Link here' : 'New link');
    this._modal.querySelector('.modal__title').textContent = title;
    this._modal.querySelector('[data-modal-primary]').textContent = this._link ? 'Save' : 'Create';

    this._nameInput.value = this._link?.name ?? slug;
    this._slugInput.value = this._link?.slug ?? slug;
    this._anchorInput.value = slug;

    this._renderTargetOptions(this._link?.target?.nodeId ?? this._anchorAt);
    this._renderAnchorOptions(this._link?.target?.anchor ?? null);

    this._role('target-group').classList.toggle('hidden', Boolean(this._anchorAt));
    this._role('anchor-select-group').classList.toggle('hidden', Boolean(this._anchorAt));
    this._role('anchor-input-group').classList.toggle('hidden', !this._anchorAt);
    setCheckBox(this._updateUsages, true);

    this._validate(false);
    openModal(this._modal);
    setTimeout(() => {
      this._nameInput.focus();
      this._nameInput.select();
    }, 80);
  }

  // ─── Options ──────────────────────────────────────────────────────────────

  _renderTargetOptions(selectedNodeId) {
    const optionHTML = (node, depth) => {
      const indent = '  '.repeat(depth);
      const selected = node.id === selectedNodeId ? ' selected' : '';
      return `<option value="${escapeHTML(node.id)}"${selected}>${indent}${escapeHTML(node.name)}</option>`
        + (node.children ?? []).map(child => optionHTML(child, depth + 1)).join('');
    };

    const missing = selectedNodeId && !findNodeInProject(this._project, selectedNodeId)
      ? '<option value="" selected>(deleted entry)</option>'
      : '';

    setHTML(this._targetSelect, missing + (this._project?.tabs ?? []).map(tab => `
      <optgroup label="${escapeHTML(tab.name)}">
        ${(tab.nodes ?? []).map(node => optionHTML(node, 0)).join('')}
      </optgroup>`).join(''));
  }

  _renderAnchorOptions(selectedAnchor) {
    const node = findNodeInProject(this._project, this._targetSelect.value)?.node;
    const anchors = [...new Set(findAnchorsInContent(node?.content))];
    const missing = selectedAnchor && !anchors.includes(selectedAnchor)
      ? `<option value="${escapeHTML(selectedAnchor)}" selected>#${escapeHTML(selectedAnchor)} (not found)</option>`
      : '';

    setHTML(this._anchorSelect, `
      <option value="">Whole entry</option>
      ${missing}
      ${anchors.map(anchor => `<option value="${escapeHTML(anchor)}"${anchor === selectedAnchor ? ' selected' : ''}>#${escapeHTML(anchor)}</option>`).join('')}`);
  }

  // ─── Validation / Submit ──────────────────────────────────────────────────

  /** @returns {string|null} error message */
  _getError() {
    const name = this._nameInput.value.trim();
    const slug = this._slugInput.value.trim();

    if (!name)
      return 'Name is missing.';
    if (!isLinkSlugValid(slug))
      return 'Slug may only contain a-z, 0-9 and single dashes.';

    const existing = findLinkBySlug(this._project, slug);
    if (existing && existing.id !== this._link?.id)
      return `Slug '${slug}' is already used by '${existing.name}'.`;

    if (this._anchorAt) {
      if (!isLinkAnchorValid(this._anchorInput.value.trim()))
        return 'Anchor may only contain a-z, 0-9 and single dashes.';
    } else if (!this._targetSelect.value) {
      return 'Choose a target entry.';
    }

    return null;
  }

  _validate(showError = true) {
    const error = this._getError();
    const errorEl = this._role('error');
    errorEl.textContent = error ?? '';
    errorEl.classList.toggle('invisible', !error || !showError);

    const slug = this._slugInput.value.trim();
    this._role('slug-hint').textContent = isLinkSlugValid(slug) ? `Use it as [[${slug}]] or [[${slug}|Text]].` : '';

    const usages = this._link?.refs?.length ?? 0;
    const slugChanged = Boolean(this._link) && slug !== this._link.slug;
    this._role('update-usages-group').classList.toggle('hidden', !slugChanged || !usages);
    this._role('update-usages-label').textContent = `Update ${usages} ${usages === 1 ? 'usage' : 'usages'}: `;

    return !error;
  }

  _submit() {
    if (!this._validate())
      return;

    const name = this._nameInput.value.trim();
    const slug = this._slugInput.value.trim();

    if (this._link) {
      updateLink(this._project, this._link.id, {
        name,
        slug,
        target: { nodeId: this._targetSelect.value, anchor: this._anchorSelect.value || null },
      }, { updateUsages: isCheckedBoxActive(this._updateUsages) });
    } else if (this._anchorAt) {
      const anchor = this._anchorInput.value.trim();
      const node = findNodeInProject(this._project, this._anchorAt)?.node;
      if (!findAnchorsInContent(node?.content).includes(anchor))
        eventBus.emit('editor:insert', { text: `{#${anchor}}` });
      createLink(this._project, { name, slug, target: { nodeId: this._anchorAt, anchor } });
    } else {
      createLink(this._project, {
        name,
        slug,
        target: { nodeId: this._targetSelect.value, anchor: this._anchorSelect.value || null },
      });
    }

    closeModal(this._modal);
  }
}
