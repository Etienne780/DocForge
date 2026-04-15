/**
 * DragDropHelper - generic placeholder-based drag & drop for lists.
 *
 * Handles all browser drag events and DOM manipulation.
 * The caller only provides:
 *   - itemSelector   : CSS selector that identifies draggable items
 *   - handleSelector : CSS selector for the drag handle within an item
 *   - idAttribute    : data-attribute that holds the item's unique ID
 *   - onReorder      : callback(fromIndex, toIndex) called on successful drop
 *
 * @example
 *   const dnd = new DragDropHelper(listEl, {
 *     itemSelector:   '.tab-element',
 *     handleSelector: '.tab-element__Drag',
 *     idAttribute:    'tabId',               // reads data-tab-id
 *     onReorder: (from, to, fromId, toId) => { ... },
 *   });
 *   dnd.destroy(); // call on teardown
 */
export class DragDropHelper {
  constructor(containerEl, { itemSelector, handleSelector, idAttribute, placeHolderClass = '', onReorder }) {
    this._container = containerEl;
    this._itemSelector = itemSelector;
    this._handleSelector = handleSelector;
    this._idAttr = idAttribute; // camelCase of data-* attribute
    this._placeHolderClass = placeHolderClass;
    this._onReorder = onReorder;

    // Drag state
    this._dragId  = null;
    this._targetId = null;
    this._startIndex = null;
    this._dragClone = null;
    this._placeholder = null;
    this._allowDrag = false;

    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onDragStart = this._handleDragStart.bind(this);
    this._onDragOver = this._handleDragOver.bind(this);
    this._onDragEnd = this._handleDragEnd.bind(this);

    this._container.addEventListener('mousedown', this._onMouseDown);
    this._container.addEventListener('dragstart', this._onDragStart);
    this._container.addEventListener('dragover',  this._onDragOver);
    this._container.addEventListener('dragend',   this._onDragEnd);
  }

  destroy() {
    this._container.removeEventListener('mousedown', this._onMouseDown);
    this._container.removeEventListener('dragstart', this._onDragStart);
    this._container.removeEventListener('dragover',  this._onDragOver);
    this._container.removeEventListener('dragend',   this._onDragEnd);
    this._removeDragClone();
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  _handleMouseDown(e) {
    this._allowDrag = !!e.target.closest(this._handleSelector);
  }

  _handleDragStart(e) {
    const item = e.target.closest(this._itemSelector);
    if (!item || !this._allowDrag) {
      e.preventDefault();
      return;
    }

    this._dragId = item.dataset[this._idAttr];
    this._startIndex = [...item.parentElement.children].indexOf(item);
    const offset = this._calculatePosOffset(e, item);

    // Invisible ghost so the browser default ghost doesn't show
    this._dragClone = item.cloneNode(true);

    Object.assign(this._dragClone.style, {
      position: 'absolute',
      top: '-9999px',
      left: '-9999px',
      width: item.getBoundingClientRect().width + 'px',
      pointerEvents: 'none',
    });
    document.body.appendChild(this._dragClone);
    e.dataTransfer.setDragImage(this._dragClone, offset.x, offset.y);

    // Placeholder holds the gap while dragging
    this._placeholder = document.createElement('div');
    this._placeholder.className = `drag-placeholder ${this._placeHolderClass}`;
    this._placeholder.style.height = item.offsetHeight + 'px';

    // setTimeout: let the browser register the drag before we hide the element
    setTimeout(() => {
      item.after(this._placeholder);
      item.style.display = 'none';
    }, 0);
  }

  _handleDragOver(e) {
    e.preventDefault();

    const target = e.target.closest(this._itemSelector);
    if (!target || target.dataset[this._idAttr] === this._dragId || !this._placeholder)
      return;

    const list = target.parentElement;
    const children = [...list.children];

    const placeholderIdx = children.indexOf(this._placeholder);
    const targetIdx = children.indexOf(target);

    if (placeholderIdx === targetIdx)
      return;

    if (placeholderIdx < targetIdx) {
      target.after(this._placeholder);
    } else {
      target.before(this._placeholder);
    }

    this._targetId = target.dataset[this._idAttr];
  }

  _handleDragEnd(e) {
    let dropIndex = null;
    if (this._placeholder) {
      const list     = this._placeholder.parentElement;
      if (list) {
        const allChildren = [...list.children];
        const placeholderPos = allChildren.indexOf(this._placeholder);

        dropIndex = allChildren
          .slice(0, placeholderPos)
          .filter(c => c !== this._placeholder && c.dataset[this._idAttr] !== this._dragId)
          .length;
      }
    }

    this._placeholder?.remove();
    this._placeholder = null;

    const dragEl = this._container.querySelector(
      `[data-${this._toKebab(this._idAttr)}="${this._dragId}"]`
    );
    if (dragEl) 
      dragEl.style.display = '';

    if (dropIndex !== null && dropIndex !== this._startIndex)
      this._onReorder?.(this._startIndex, dropIndex, this._dragId, this._targetId);

    this._reset();
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  _reset() {
    this._removeDragClone();
    this._dragId = null;
    this._targetId = null;
    this._startIndex = null;
    this._placeholder = null;
    this._allowDrag = false;
  }

  _removeDragClone() {
    this._dragClone?.remove();
    this._dragClone = null;
  }

  _calculatePosOffset(e, el) {
    const rect = el.getBoundingClientRect();

    const x = rect.left;
    const y = rect.top;
    const mX = e.clientX;
    const mY = e.clientY;

    return { x: (mX - x), y: (mY - y) };
  }

  /** tabId  →  tab-id   (for querySelector with data-* attributes) */
  _toKebab(camel) {
    return camel.replace(/([A-Z])/g, '-$1').toLowerCase();
  }
}
