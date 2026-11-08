import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { escapeHTML, setHTML } from '@common/Common.js';
import { isCheckedBoxActive, setCheckBox } from '@common/UIUtils.js';
import { EntryPicker } from '@common/EntryPicker.js';
import { t } from '@core/i18n/I18n.js';

const tx = (key, vars) => escapeHTML(t(`links.modal.${key}`, vars));
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
      title: t('links.modal.title'),
      bodyHTML: `
        <div class="form-group">
          <label class="form-label" for="${nameId}">${escapeHTML(t('common.name'))}</label>
          <input type="text" class="form-input" id="${nameId}" autocomplete="off" placeholder="${tx('namePlaceholder')}">
        </div>
        <div class="form-group form-group--spaced">
          <label class="form-label" for="${slugId}">${tx('slug')}</label>
          <input type="text" class="form-input" id="${slugId}" autocomplete="off" placeholder="${tx('slugPlaceholder')}">
          <span class="link-modal_hint" data-role="slug-hint"></span>
        </div>
        <div class="form-group form-group--spaced" data-role="target-group">
          <label class="form-label" for="${targetId}">${tx('target')}</label>
          <div data-role="target-picker"></div>
        </div>
        <div class="form-group form-group--spaced" data-role="anchor-select-group">
          <label class="form-label" for="${anchorSelectId}">${tx('anchor')}</label>
          <select id="${anchorSelectId}"></select>
          <span class="link-modal_hint">${tx('anchorHint')}</span>
        </div>
        <div class="form-group form-group--spaced hidden" data-role="anchor-input-group">
          <label class="form-label" for="${anchorInputId}">${tx('anchor')}</label>
          <input type="text" class="form-input" id="${anchorInputId}" autocomplete="off" placeholder="${tx('anchorPlaceholder')}">
          <span class="link-modal_hint">${tx('anchorInsertHint')}</span>
        </div>
        <div class="form-row form-group--spaced hidden" data-role="update-usages-group">
          <span data-role="update-usages-label"></span>
          <button id="${updateUsagesId}" class="checkbox-element checked" data-checkbox="true"></button>
        </div>
        <span class="body-label text-error invisible" data-role="error"></span>`,
      primaryLabel: t('common.save'),
      wide: 'm',
      zIndex: '1001',
      onPrimary: () => this._submit(),
    });

    const get = (id) => this._modal.querySelector(`[id="${id}"]`);
    this._nameInput = get(nameId);
    this._slugInput = get(slugId);
    this._anchorSelect = get(anchorSelectId);
    this._anchorInput = get(anchorInputId);
    this._updateUsages = get(updateUsagesId);
    this._role = (role) => this._modal.querySelector(`[data-role="${role}"]`);
    this._targetPicker = new EntryPicker(this._role('target-picker'), {
      getProject: () => this._project,
      id: targetId,
      onChange: () => {
        this._renderAnchorOptions(null);
        this._validate();
      },
    });

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

    addModalEnterAction(this._modal, { targetId: nameId });
    addModalEnterAction(this._modal, { targetId: slugId });
  }

  destroy() {
    this._targetPicker?.destroy();
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

    const title = t(this._link ? 'links.modal.editTitle' : (this._anchorAt ? 'links.modal.hereTitle' : 'links.modal.newTitle'));
    this._modal.querySelector('.modal__title').textContent = title;
    this._modal.querySelector('[data-modal-primary]').textContent = t(this._link ? 'common.save' : 'common.create');

    this._nameInput.value = this._link?.name ?? slug;
    this._slugInput.value = this._link?.slug ?? slug;
    this._anchorInput.value = slug;

    this._setTarget(this._link?.target?.nodeId ?? this._anchorAt);
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

  /** Shows `nodeId` in the target picker; a deleted entry shows as "(deleted entry)". */
  _setTarget(nodeId) {
    const found = nodeId ? findNodeInProject(this._project, nodeId) : null;
    this._targetPicker.setValue(found
      ? { tabId: found.tab.id, nodeId }
      : nodeId ? { tabId: null, nodeId } : null);
  }

  /** @returns {string} id of the chosen target entry, '' if none (or deleted) */
  _getTargetNodeId() {
    const nodeId = this._targetPicker.getValue()?.nodeId;
    return nodeId && findNodeInProject(this._project, nodeId) ? nodeId : '';
  }

  _renderAnchorOptions(selectedAnchor) {
    const node = findNodeInProject(this._project, this._getTargetNodeId())?.node;
    const anchors = [...new Set(findAnchorsInContent(node?.content))];
    const missing = selectedAnchor && !anchors.includes(selectedAnchor)
      ? `<option value="${escapeHTML(selectedAnchor)}" selected>${tx('notFound', { anchor: selectedAnchor })}</option>`
      : '';

    setHTML(this._anchorSelect, `
      <option value="">${tx('wholeEntry')}</option>
      ${missing}
      ${anchors.map(anchor => `<option value="${escapeHTML(anchor)}"${anchor === selectedAnchor ? ' selected' : ''}>#${escapeHTML(anchor)}</option>`).join('')}`);
  }

  // ─── Validation / Submit ──────────────────────────────────────────────────

  /** @returns {string|null} error message */
  _getError() {
    const name = this._nameInput.value.trim();
    const slug = this._slugInput.value.trim();

    if (!name)
      return t('links.modal.nameMissing');
    if (!isLinkSlugValid(slug))
      return t('links.modal.slugInvalid');

    const existing = findLinkBySlug(this._project, slug);
    if (existing && existing.id !== this._link?.id)
      return t('links.modal.slugUsed', { slug, name: existing.name });

    if (this._anchorAt) {
      if (!isLinkAnchorValid(this._anchorInput.value.trim()))
        return t('links.modal.anchorInvalid');
    } else if (!this._getTargetNodeId()) {
      return t('links.modal.chooseTarget');
    }

    return null;
  }

  _validate(showError = true) {
    const error = this._getError();
    const errorEl = this._role('error');
    errorEl.textContent = error ?? '';
    errorEl.classList.toggle('invisible', !error || !showError);

    const slug = this._slugInput.value.trim();
    this._role('slug-hint').textContent = isLinkSlugValid(slug) ? t('links.modal.useAs', { slug }) : '';

    const usages = this._link?.refs?.length ?? 0;
    const slugChanged = Boolean(this._link) && slug !== this._link.slug;
    this._role('update-usages-group').classList.toggle('hidden', !slugChanged || !usages);
    this._role('update-usages-label').textContent = t('links.modal.updateUsages', { count: usages });

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
        target: { nodeId: this._getTargetNodeId(), anchor: this._anchorSelect.value || null },
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
        target: { nodeId: this._getTargetNodeId(), anchor: this._anchorSelect.value || null },
      });
    }

    closeModal(this._modal);
  }
}
