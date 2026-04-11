import { buildStandardModal, buildConfirmModal, isModalOpen  } from '@core/ModalBuilder.js';
import { escapeHTML } from './Common.js'

/**
 * @brief Binds an "Enter" key action to a modal input or element.
 *
 * Triggers a click on the configured action element when Enter is pressed
 * inside the target element, if the modal is open.
 *
 * @param {HTMLElement} overlay - Modal root element
 * @param {Object} options
 * @param {string|null} [options.targetId=null]        - ID of the input element
 * @param {string|null} [options.targetSelector=null]  - Selector of the input element
 * @param {string|null} [options.actionId=null]        - ID of the action element
 * @param {string}      [options.actionSelector='[data-modal-primary]']
 * @returns {void}
 */
export function addModalEnterAction(overlay, {
  targetId = null,
  targetSelector = null,
  actionId = null,
  actionSelector = '[data-modal-primary]',
} = {}) {
  if (!targetId && !targetSelector) {
    console.error('addModalEnterAction: missing target');
    return;
  }

  const target = targetId
    ? document.getElementById(targetId)
    : overlay.querySelector(targetSelector);

  if (!target) {
    console.warn('addModalEnterAction: target not found');
    return;
  }

  target.addEventListener('keydown', e => {
    if (e.key === 'Enter' && isModalOpen(overlay)) {
      e.preventDefault();

      const action = actionId
        ? document.getElementById(actionId)
        : overlay.querySelector(actionSelector);

      action?.click();
    }
  });
}

/**
 * Builds a standardized "rename" modal dialog.
 *
 * Creates a modal containing a labeled text input field and primary/secondary actions.
 *
 * DOM structure notes:
 * - The label element is marked with `data-role="rename-label"`.
 * - The input element is marked with `data-role="rename-input"`.
 *   These attributes allow stable querying without relying on global IDs.
 *
 * Behavior:
 * - Pressing the Enter key inside the input triggers the primary action.
 *
 * @param {string} modalId - Unique DOM id for the modal container.
 * @param {Object} options - Configuration object.
 * @param {string} options.inputId - Unique DOM id for the input element.
 * @param {string} [options.title='Rename'] - Title displayed in the modal header.
 * @param {string} [options.placeholder='name...'] - Placeholder text for the input field (HTML-escaped).
 * @param {string|number} [options.zIndex='1000'] - z-index applied to the modal element.
 * @param {Function|null} [options.onPrimary=null] - Callback executed when the primary action is triggered.
 *
 * @returns {HTMLElement} The constructed modal DOM element.
 *
 * @example
 * const modal = buildRenameModal('rename-modal', {
 *   inputId: 'rename-input',
 *   title: 'Rename Tab',
 *   placeholder: 'Tab name...',
 *   onPrimary: () => {
 *     const input = modal.querySelector('[data-role="rename-input"]');
 *     const value = input.value.trim();
 *     if (!value) {
 *       return;
 *     }
 *
 *     closeModal(modal);
 *     handleRename(value);
 *   }
 * });
 */
export function buildRenameModal(modalId, { inputId, title = 'Rename', placeholder ='name...', zIndex = '1000', onPrimary = null }) {
  const element = buildStandardModal(modalId, {
    title: title,
    bodyHTML: 
    `<div class="form-group">
      <label class="form-label" data-role="rename-label" for="${inputId}">Name</label>
      <input type="text" class="form-input" id="${inputId}" autocomplete="off" data-role="rename-input" placeholder="${escapeHTML(placeholder)}">
    </div>`,
    primaryLabel:   'Save',
    secondaryLabel: 'Cancel',
    onPrimary: onPrimary,
  });

  addModalEnterAction(element, { targetSelector: '[data-role="rename-input"]'});
  element.style.zIndex = zIndex;

  return element;
}

/**
 * Builds a standardized confirmation modal for delete actions.
 *
 * Creates a modal with a message and confirm/cancel buttons.
 * The confirm action is typically used for destructive operations.
 *
 * @param {string} modalId - Unique DOM id for the modal container.
 * @param {Object} options - Configuration object.
 * @param {string} [options.title='Delete item'] - Title displayed in the modal header.
 * @param {string} [options.message='Are you sure you want to delete this item?'] - Confirmation message shown in the modal body.
 * @param {string|number} [options.zIndex='1000'] - z-index applied to the modal element.
 * @param {Function|null} [options.onConfirm=null] - Callback executed when the confirm action is triggered.
 *
 * @returns {HTMLElement} The constructed modal DOM element.
 *
 * @example
 * const modal = buildConfirmationDeleteModal('delete-modal', {
 *   title: 'Delete',
 *   message: 'Are you sure?',
 *   onConfirm: () => {
 *     performDelete();
 *     closeModal(modal);
 *   }
 * });
 */
export function buildConfirmationDeleteModal(modalId, { title = 'Delete item', message = 'Are you sure you want to delete this item?', zIndex = '1000',  onConfirm = null }) {
    const element = buildConfirmModal(modalId, {
      title: title,
      message: message,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      onConfirm: onConfirm,
    });

    element.style.zIndex = zIndex;
    return element;
}