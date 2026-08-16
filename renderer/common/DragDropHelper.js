/**
 * DragDropHelper - generic drag & drop for lists, with an optional
 * "nestable" mode for hierarchical trees.
 *
 * Two modes:
 *
 *   FLAT (default, nestable: false). Live
 *   placeholder-based reordering within a single flat list. Used by things
 *   like the tab manager, where items never have children.
 *
 *   NESTABLE (nestable: true). Instead of moving
 *   DOM elements around and inferring the drop target from where the
 *   placeholder ends up (which is ambiguous whenever there's no following
 *   sibling to anchor on, and unsafe when the hovered item is inside the
 *   dragged item's own subtree), this mode computes an explicit intent on
 *   every dragover: which item is hovered, and whether the pointer is in
 *   the top/middle/bottom band of that item. That intent is passed
 *   straight to the caller as `onReorder(draggedId, targetId, position)`
 *   where position is 'before' | 'after' | 'into'. No DOM elements are
 *   moved during the drag — the caller re-renders after mutating its own
 *   data, which is safer for a tree that can be arbitrarily deep.
 *
 *   Dropping onto the dragged item itself, or onto any of its own
 *   descendants, is rejected at the DOM level (via `dragEl.contains(target)`)
 *   so the drop is never even offered. The caller should still re-check
 *   this at the data level (ids don't always map 1:1 to a single DOM
 *   subtree) — see SidebarLeft._isDescendant.
 *
 * @example flat
 *   const dnd = new DragDropHelper(listEl, {
 *     itemSelector:   '.tab-element',
 *     handleSelector: '.tab-element__Drag',
 *     idAttribute:    'tabId',               // reads data-tab-id
 *     onReorder: (fromIndex, toIndex, fromId, toId) => { ... },
 *   });
 *
 * @example nestable
 *   const dnd = new DragDropHelper(treeEl, {
 *     itemSelector:   '.tree-node-element',
 *     handleSelector: '.tree-node-element',
 *     idAttribute:    'nodeId',              // reads data-node-id
 *     nestable: true,
 *     onReorder: (draggedId, targetId, position) => { ... },
 *   });
 */
export class DragDropHelper {
  constructor(containerEl, {
    itemSelector,
    handleSelector,
    idAttribute,
    placeHolderClass = '',
    nestable = false,
    nestZoneRatio = 0.25, // size of the top/bottom "before"/"after" bands, as a fraction of item height
    onReorder,
  }) {
    this._container = containerEl;
    this._itemSelector = itemSelector;
    this._handleSelector = handleSelector;
    this._idAttr = idAttribute; // camelCase of data-* attribute
    this._placeHolderClass = placeHolderClass;
    this._nestable = nestable;
    this._nestZoneRatio = nestZoneRatio;
    this._onReorder = onReorder;

    // Drag state
    this._dragEl = null;
    this._dragId = null;
    this._targetId = null;
    this._startIndex = null;
    this._dragClone = null;
    this._placeholder = null;
    this._allowDrag = false;

    // Nestable-mode drop indicator state
    this._dropTargetEl = null;
    this._dropPosition = null; // 'before' | 'after' | 'into'

    this._onMouseDown = this._handleMouseDown.bind(this);
    this._onDragStart = this._handleDragStart.bind(this);
    this._onDragOver = this._nestable ? this._handleDragOverNestable.bind(this) : this._handleDragOver.bind(this);
    this._onDragEnd = this._nestable ? this._handleDragEndNestable.bind(this) : this._handleDragEnd.bind(this);
    this._onDragLeave = this._handleDragLeave.bind(this);

    this._container.addEventListener('mousedown', this._onMouseDown);
    this._container.addEventListener('dragstart', this._onDragStart);
    this._container.addEventListener('dragover',  this._onDragOver);
    this._container.addEventListener('dragend',   this._onDragEnd);
    if (this._nestable)
      this._container.addEventListener('dragleave', this._onDragLeave);
  }

  destroy() {
    this._container.removeEventListener('mousedown', this._onMouseDown);
    this._container.removeEventListener('dragstart', this._onDragStart);
    this._container.removeEventListener('dragover',  this._onDragOver);
    this._container.removeEventListener('dragend',   this._onDragEnd);
    if (this._nestable)
      this._container.removeEventListener('dragleave', this._onDragLeave);
    this._removeDragClone();
    this._clearDropIndicator();
  }

  // ─── Shared handlers ──────────────────────────────────────────────────────

  _handleMouseDown(e) {
    this._allowDrag = !!e.target.closest(this._handleSelector);
  }

  _handleDragStart(e) {
    const item = e.target.closest(this._itemSelector);
    if (!item || !this._allowDrag) {
      e.preventDefault();
      return;
    }

    this._removeDragClone();

    this._dragEl = item;
    this._dragId = item.dataset[this._idAttr];
    this._startIndex = [...item.parentElement.children].indexOf(item);
    const offset = this._calculatePosOffset(e, item);

    // Invisible ghost so the browser default ghost doesn't show
    this._dragClone = item.cloneNode(true);

    Object.assign(this._dragClone.style, {
      position: 'fixed',
      top: '0px',
      left: '0px',
      transform: 'translate(-9999px, -9999px)',
      width: item.offsetWidth + 'px',
      height: item.offsetHeight + 'px',
      overflow: 'visible',
      pointerEvents: 'none',
    });
    document.body.appendChild(this._dragClone);
    e.dataTransfer.setDragImage(this._dragClone, offset.x, offset.y);

    if (this._nestable)
      return; // nestable mode never moves DOM elements, see below

    // Placeholder holds the gap while dragging (flat mode only)
    this._placeholder = document.createElement('div');
    this._placeholder.className = `drag-placeholder ${this._placeHolderClass}`;
    this._placeholder.style.height = item.offsetHeight + 'px';

    // setTimeout: let the browser register the drag before we hide the element
    setTimeout(() => {
      item.after(this._placeholder);
      item.style.display = 'none';
    }, 0);
  }

  // ─── Flat mode (unchanged) ────────────────────────────────────────────────

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
  }

  _handleDragEnd(e) {
    let dropIndex = null;
    if (this._placeholder) {
      const list = this._placeholder.parentElement;
      if (list) {
        const allChildren = [...list.children];
        const placeholderPos = allChildren.indexOf(this._placeholder);

        dropIndex = allChildren
          .slice(0, placeholderPos)
          .filter(c => c !== this._placeholder && c.dataset[this._idAttr] !== this._dragId)
          .length;
      }

      let next = this._placeholder.nextElementSibling;
      while (next && next.dataset[this._idAttr] === this._dragId) {
        next = next.nextElementSibling;
      }
      this._targetId = next ? next.dataset[this._idAttr] : null;
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

  // ─── Nestable mode (tree) ─────────────────────────────────────────────────

  /**
   * On every dragover, figures out which item is hovered and which band of
   * it the pointer is in, then just records that as the current intent.
   * Nothing in the DOM moves — the actual tree mutation happens in the
   * caller's onReorder, after which the caller re-renders from data.
   */
  _handleDragOverNestable(e) {
    const target = e.target.closest(this._itemSelector);

    // No valid target, hovering the dragged item itself, or hovering one of
    // its own descendants (which would create a cycle) → refuse the drop
    // here by *not* calling preventDefault, so the browser shows a
    // "not allowed" cursor and our own indicator stays cleared.
    if (!target || target.dataset[this._idAttr] === this._dragId || (this._dragEl && this._dragEl.contains(target))) {
      this._clearDropIndicator();
      return;
    }

    e.preventDefault();

    const rect = target.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;

    let position;
    if (ratio < this._nestZoneRatio) {
      position = 'before';
    } else if (ratio > 1 - this._nestZoneRatio) {
      position = 'after';
    } else {
      position = 'into';
    }

    this._setDropIndicator(target, position);
  }

  _handleDragLeave(e) {
    // dragleave also fires when moving between child elements of the same
    // item; only clear once the pointer actually leaves the container.
    if (!this._container.contains(e.relatedTarget)) {
      this._clearDropIndicator();
    }
  }

  _handleDragEndNestable() {
    const targetEl = this._dropTargetEl;
    const position = this._dropPosition;
    this._clearDropIndicator();

    if (targetEl && position) {
      const targetId = targetEl.dataset[this._idAttr];
      this._onReorder?.(this._dragId, targetId, position);
    }

    this._removeDragClone();
    this._dragEl = null;
    this._dragId = null;
    this._startIndex = null;
    this._allowDrag = false;
  }

  _setDropIndicator(target, position) {
    if (this._dropTargetEl === target && this._dropPosition === position)
      return;

    this._clearDropIndicator();
    target.classList.add(`drag-over-${position}`);
    this._dropTargetEl = target;
    this._dropPosition = position;
  }

  _clearDropIndicator() {
    this._dropTargetEl?.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-into');
    this._dropTargetEl = null;
    this._dropPosition = null;
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  _reset() {
    this._removeDragClone();
    this._dragEl = null;
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