import { escapeHTML } from "@common/Common.js";

/**
 * ModalBuilder - reusable modal factory.
 *
 * Layered API:
 *   buildModal()          - low-level base: accepts raw HTML for header/body/footer
 *   buildStandardModal()  - preset: title + Cancel + primary action button
 *   buildDoneModal()      - preset: title + single Done button (settings, info)
 *   buildConfirmModal()   - preset: title + message + Cancel + destructive confirm
 *
 * All modals are appended to document.body to avoid z-index / overflow clipping issues.
 * Call the returned element's remove() in the component's onDestroy() to clean up.
 *
 * Opening / closing:
 *   openModal(overlay)   - makes the overlay visible
 *   closeModal(overlay)  - hides the overlay
 *
 * Wiring (handled automatically inside buildModal):
 *   - Any element with [data-modal-close]   → calls closeModal on click
 *   - Any element with [data-modal-primary] → calls onPrimary on click (if provided)
 *   - Clicking the backdrop                 → calls closeModal
 */

/**
 * Creates a modal overlay with arbitrary header / body / footer HTML.
 * Wires up backdrop-click, [data-modal-close] buttons, and the [data-modal-primary] button.
 *
 * @param {string}   overlayId           - Unique DOM id for the overlay element
 * @param {Object}   options
 * @param {string}   options.headerHTML  - Full HTML for the modal header section
 * @param {string}   options.bodyHTML    - Full HTML for the modal body section
 * @param {string}   options.footerHTML  - Full HTML for the modal footer section
 * @param {Function} [options.onPrimary] - Callback fired when [data-modal-primary] is clicked
 * @param {string}   [options.extraClass]- Extra CSS class on .modal (e.g. "modal--wide")
 * @returns {HTMLElement} The overlay element (already appended to document.body)
 */
export function buildModal(overlayId, {
  headerHTML,
  bodyHTML,
  footerHTML,
  onPrimary  = null,
  extraClass = '',
}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = overlayId;

  const modal = document.createElement('div');
  modal.className = ['modal', extraClass].filter(Boolean).join(' ');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'modal__header';
  setHTML(header, headerHTML);

  const body = document.createElement('div');
  body.className = 'modal__body';
  setHTML(body, bodyHTML);

  const footer = document.createElement('div');
  footer.className = 'modal__footer';
  setHTML(footer, footerHTML);

  modal.append(header, body, footer);
  overlay.appendChild(modal);

  // Wire close buttons
  overlay.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(overlay));
  });

  // Wire backdrop click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay);
  });

  // Wire primary action
  if (onPrimary) {
    overlay.querySelector('[data-modal-primary]')
      ?.addEventListener('click', onPrimary);
  }

  // In main.js is defined to close every modal with the 'escape' key

  document.body.appendChild(overlay);
  return overlay;
}

/**
 * CSP-safe alternative to setting innerHTML directly.
 * Inline styles in the HTML string are stripped from the attribute
 * and re-applied via the DOM style API, which is CSP-compliant.
 *
 * @param {Element} element - Target DOM element
 * @param {string}  html    - HTML string, may contain inline style attributes
 */
export function setHTML(element, html) {
  element.innerHTML = html;

  element.querySelectorAll('[style]').forEach(el => {
    const raw = el.getAttribute('style');
    el.removeAttribute('style');

    // Re-apply each declaration via the DOM API (not blocked by CSP)
    raw.split(';').forEach(declaration => {
      const colonIndex = declaration.indexOf(':');
      if (colonIndex === -1) 
        return;

      const property = declaration.slice(0, colonIndex).trim();
      const value = declaration.slice(colonIndex + 1).trim();

      if (property && value) {
        el.style.setProperty(property, value);
      }
    });
  });
}

/**
 * Makes a modal overlay visible.
 * @param {HTMLElement} overlay
 */
export function openModal(overlay) {
  overlay?.classList.add('modal-overlay--open');
}

/**
 * Hides a modal overlay.
 * @param {HTMLElement} overlay
 */
export function closeModal(overlay) {
  overlay?.classList.remove('modal-overlay--open');
}

/**
 * Preset: standard dialog with a title, a secondary Cancel button, and a primary action button.
 * Use for: rename, create, edit dialogs.
 *
 * @param {string}   overlayId
 * @param {Object}   options
 * @param {string}   options.title
 * @param {string}   options.bodyHTML
 * @param {string}   [options.primaryLabel="Save"]
 * @param {string}   [options.secondaryLabel="Cancel"]
 * @param {Function} [options.onPrimary]
 * @returns {HTMLElement}
 */
export function buildStandardModal(overlayId, {
  title,
  bodyHTML,
  primaryLabel   = 'Save',
  secondaryLabel = 'Cancel',
  wide           = false,
  onPrimary      = null,
}) {
  const titleId = `${overlayId}-title`;

  return buildModal(overlayId, {
    headerHTML: `
      <span class="modal__title" id="${titleId}">${escapeHTML(title)}</span>
      <button class="icon-button" data-modal-close>✕</button>`,
    bodyHTML,
    footerHTML: `
      <button class="button button--secondary" data-modal-close>${escapeHTML(secondaryLabel)}</button>
      <button class="button button--primary"   data-modal-primary>${escapeHTML(primaryLabel)}</button>`,
    extraClass: wide ? 'modal--wide' : '',
    onPrimary,
  });
}

/**
 * Preset: single Done button - no cancel, just close.
 * Use for: settings panels, info dialogs, theme customization.
 *
 * @param {string}   overlayId
 * @param {Object}   options
 * @param {string}   options.title
 * @param {string}   options.bodyHTML
 * @param {string}   [options.doneLabel="Done"]
 * @param {boolean}  [options.wide=false]   - Applies "modal--wide" class for wider content
 * @param {Function} [options.doneCallback] - Callback fired when Done is clicked (after closing)
 * @returns {HTMLElement}
 */
export function buildDoneModal(overlayId, {
  title,
  bodyHTML,
  doneLabel     = 'Done',
  wide          = false,
  doneCallback  = null,
}) {
  const titleId = `${overlayId}-title`;

  return buildModal(overlayId, {
    headerHTML: `
      <span class="modal__title" id="${titleId}">${escapeHTML(title)}</span>
      <button class="icon-button" data-modal-close>✕</button>`,
    bodyHTML,
    footerHTML: `
      <button class="button button--primary" data-modal-primary data-modal-close>
        ${escapeHTML(doneLabel)}
      </button>`,
    extraClass: wide ? 'modal--wide' : '',
    onPrimary: doneCallback,
  });
}

/**
 * Preset: confirmation dialog with a message and a destructive confirm button.
 * Use for: delete confirmations, irreversible actions.
 *
 * @param {string}   overlayId
 * @param {Object}   options
 * @param {string}   options.title
 * @param {string}   options.message        - Plain text message shown in the body
 * @param {string}   [options.confirmLabel="Delete"]
 * @param {string}   [options.cancelLabel="Cancel"]
 * @param {Function} [options.onConfirm]
 * @returns {HTMLElement}
 */
export function buildConfirmModal(overlayId, {
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel  = 'Cancel',
  wide         = false,
  onConfirm    = null,
}) {
  const titleId = `${overlayId}-title`;

  return buildModal(overlayId, {
    headerHTML: `
      <span class="modal__title" id="${titleId}">${escapeHTML(title)}</span>
      <button class="icon-button" data-modal-close>✕</button>`,
    bodyHTML: `<p class="modal__confirm-message">${escapeHTML(message)}</p>`,
    footerHTML: `
      <button class="button button--secondary" data-modal-close>${escapeHTML(cancelLabel)}</button>
      <button class="button button--danger"    data-modal-primary>${escapeHTML(confirmLabel)}</button>`,
    extraClass: wide ? 'modal--wide' : '',
    onPrimary: onConfirm,
  });
}