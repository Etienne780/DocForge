import { state } from '@core/State.js';

/**
 * ResizeController
 * -----------------
 * Manages a draggable resize handle on one edge of a container.
 *
 * Core distinction the whole class is built around:
 *
 *   "CSS size"   -> a declarative size the stylesheet/markup controls
 *                   (e.g. "50%", "300px", or nothing set at all).
 *                   The browser lays this out; we don't fight it.
 *
 *   "pixel size" -> a concrete number of pixels that WE impose via
 *                   inline style, typically as a result of dragging.
 *
 * Once the user drags the handle, the container transitions from
 * "CSS-controlled" to "controller-controlled" (pixel) sizing. reset()
 * is what hands control back to CSS.
 *
 * `_sizeMode` tracks which of the two is currently active ('css' | 'pixel')
 * and is used to decide, among other things, whether window-resize should
 * reapply a ratio (only meaningful once we own the size in pixels).
 */
export class ResizeController {

  static DIRECTIONS = ['left', 'right', 'top', 'bottom'];

  // Minimal, deliberately small set of CSS size units we accept as
  // "reset targets" / explicit config. We do NOT try to resolve arbitrary
  // stylesheet rules (e.g. by scanning document.styleSheets) - that's
  // fragile and out of scope. If a size is only ever declared in an
  // external stylesheet (not inline, not via `initialSize`), we can't
  // recover its original CSS text, so reset() simply removes any inline
  // override and lets that stylesheet rule take over again.
  static CSS_SIZE_PATTERN = /^-?\d*\.?\d+(px|%)$/;

  static DEFAULTS = {
    enabled:         true,
    visible:         true,
    minSize:         null,
    maxSize:         null,
    initialSize:     null,   // number (px) OR css string (e.g. "50%") OR null
    stateName:       null,
    direction:       null,
    resetOnDblClick: true,
    keepRatio:       true,

    onResizeStart:   () => {},
    onResize:        () => {},
    onResizeEnd:     () => {},
  };

  constructor(container, flags = {}) {
    this._container = container;
    this._domHandle = null;
    this._isDragging = false;

    // --- size-related state -------------------------------------------
    this._size = 0;              // current size, ALWAYS a pixel number
    this._displayRatio = 1;      // current size / parent size
    this._sizeMode = 'css';      // 'css' | 'pixel' - who currently owns the size

    this._originalInlineSize = null; // literal inline style captured at construction, e.g. "50%"
    this._resetTarget = null;        // what reset() restores to (string | number | null)

    this._hasState = false;
    this._persistedSize = null;  // pixel value loaded from persisted state

    this._setSizeTimer = null;
    this._debounceDelay = 80;

    this._dragHandleStart = this._dragHandleStart.bind(this);
    this._dragHandleMove = this._dragHandleMove.bind(this);
    this._dragHandleEnd = this._dragHandleEnd.bind(this);
    this._windowResize = this._windowResize.bind(this);
    this._handleDblClick = () => this.reset();

    if(!this._container) {
      console.warn('[ResizeController] container is null');
    }

    for(const key in ResizeController.DEFAULTS) {
      this[`_${key}`] = flags[key] ?? ResizeController.DEFAULTS[key];
    }

    this._validateDirection();
    this._validateMinMax();
    this._loadState();

    this._createDOMHandle();
    this._initSize();

    window.addEventListener('resize', this._windowResize);
  }

  destroy() {
    window.removeEventListener('resize', this._windowResize);

    if(this._setSizeTimer) {
      clearTimeout(this._setSizeTimer);
      this._setSizeTimer = null;
    }

    if(this._isDragging) {
      // leave the document in a clean state even if destroyed mid-drag
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      this._isDragging = false;
    }

    this._destroyDOMHandle();
  }

  enable() {
    this._enabled = true;
    this._domHandle?.classList.remove('disabled');
  }

  disable() {
    this._enabled = false;
    this._domHandle?.classList.add('disabled');
  }

  /** Always returns the current *pixel* size, regardless of sizing mode. */
  getSize() {
    return this._size;
  }

  /** Current size expressed as a ratio of the parent's relevant dimension. */
  getRatio() {
    return this._displayRatio;
  }

  /** The CSS/initial size this controller will restore to on reset(), if any. */
  getOriginalCssSize() {
    return this._resetTarget;
  }

  /**
   * Sets an explicit size.
   *  - number -> treated as a runtime pixel size, clamped to min/max.
   *  - string ("50%", "300px", ...) -> treated as a CSS size, applied
   *    verbatim and NOT clamped (percentages can't be meaningfully
   *    compared against pixel min/max without knowing layout context).
   */
  setSize(size, save = true) {
    if(typeof size === 'number') {
      this._setContainerPixelSize(this._clamp(size), save);
      return;
    }

    if(typeof size === 'string' && this._isSupportedCssSize(size)) {
      this._applyCssSize(size);
      this._sizeMode = 'css';
      this._measureAndSyncRatio();
      if(save) {
        this._saveState();
      }
      return;
    }

    console.warn(`[ResizeController] setSize() received an unsupported value:`, size);
  }

  /**
   * Restores the controller's original/default sizing configuration
   * (as opposed to setSize(), which sets an explicit new size).
   *
   * Priority for what "original" means:
   *   1. the inline style that existed on the container before we touched it
   *   2. the `initialSize` option passed to the constructor
   *   3. nothing configured -> remove any inline override entirely and
   *      let the stylesheet decide again
   *
   * After restoring, we re-measure the actual rendered size so getSize()/
   * getRatio() stay accurate, and we treat the reset size as the new
   * persisted baseline (so re-initializing later doesn't jump back to a
   * stale manually-resized value).
   */
  reset() {
    if(typeof this._resetTarget === 'string') {
      this._applyCssSize(this._resetTarget);
      this._sizeMode = 'css';
    } else if(typeof this._resetTarget === 'number') {
      this._setContainerPixelSize(this._clamp(this._resetTarget), false);
      this._sizeMode = 'pixel';
    } else {
      this._applyCssSize(null); // remove inline override, defer to stylesheet
      this._sizeMode = 'css';
    }

    this._measureAndSyncRatio();
    this._saveState(); // reset becomes the new persisted baseline, saved immediately
  }

  // --- size resolution ---------------------------------------------------

  _isSupportedCssSize(value) {
    return typeof value === 'string' && ResizeController.CSS_SIZE_PATTERN.test(value.trim());
  }

  /** Only clamps numeric pixel sizes. CSS strings pass through untouched. */
  _clamp(size) {
    if(typeof size !== 'number' || !Number.isFinite(size)) {
      return size;
    }

    let clamped = size;
    if(this._minSize !== null) {
      clamped = Math.max(clamped, this._minSize);
    }
    if(this._maxSize !== null) {
      clamped = Math.min(clamped, this._maxSize);
    }
    return clamped;
  }

  _validateMinMax() {
    const isValidNumber = (v) => typeof v === 'number' && Number.isFinite(v);

    if(this._minSize !== null && !isValidNumber(this._minSize)) {
      console.warn(`[ResizeController] Invalid minSize (${this._minSize}), ignoring.`);
      this._minSize = null;
    }

    if(this._maxSize !== null && !isValidNumber(this._maxSize)) {
      console.warn(`[ResizeController] Invalid maxSize (${this._maxSize}), ignoring.`);
      this._maxSize = null;
    }

    if(this._minSize !== null && this._maxSize !== null && this._minSize > this._maxSize) {
      console.warn(`[ResizeController] minSize (${this._minSize}) > maxSize (${this._maxSize}); swapping.`);
      [this._minSize, this._maxSize] = [this._maxSize, this._minSize];
    }
  }

  _isVertical() {
    return this._direction === 'top' || this._direction === 'bottom';
  }

  // --- persisted state (always pixels) ------------------------------------

  _loadState() {
    if(!this._stateName) {
      return;
    }

    const saved = state.get(this._stateName);
    if(typeof saved === 'number' && Number.isFinite(saved)) {
      this._persistedSize = saved;
      this._hasState = true;
    }
  }

  _saveState() {
    if(!this._stateName) {
      return;
    }
    state.set(this._stateName, this._size);
  }

  _scheduleSaveState() {
    if(!this._stateName) {
      return;
    }

    if(this._setSizeTimer) {
      clearTimeout(this._setSizeTimer);
    }

    this._setSizeTimer = setTimeout(() => {
      this._saveState();
      this._setSizeTimer = null;
    }, this._debounceDelay);
  }

  // --- initialization ------------------------------------------------------

  /**
   * Determines the starting size, in priority order:
   *   1. persisted pixel state from a previous session
   *   2. explicit `initialSize` option (number or CSS string)
   *   3. an inline CSS size already present on the container
   *   4. fallback: whatever the stylesheet currently renders, untouched
   *
   * Also captures `_resetTarget`, which reset() later restores to.
   */
  _initSize() {
    if(!this._container) {
      return;
    }

    const prop = this._isVertical() ? 'height' : 'width';
    this._originalInlineSize = this._container.style[prop] || null;
    this._resetTarget = this._originalInlineSize ?? this._initialSize ?? null;

    if(this._hasState) {
      this._setContainerPixelSize(this._clamp(this._persistedSize), false);
      this._sizeMode = 'pixel';
      return;
    }

    if(typeof this._resetTarget === 'string') {
      this._applyCssSize(this._resetTarget);
      this._sizeMode = 'css';
      this._measureAndSyncRatio();
      return;
    }

    if(typeof this._resetTarget === 'number') {
      this._setContainerPixelSize(this._clamp(this._resetTarget), false);
      this._sizeMode = 'pixel';
      return;
    }

    // nothing configured at all - respect whatever CSS already renders
    this._sizeMode = 'css';
    this._measureAndSyncRatio();
  }

  // --- applying sizes --------------------------------------------------------

  /** Applies a CSS size string (or null to clear the inline override). */
  _applyCssSize(value) {
    if(!this._container) {
      return;
    }
    const prop = this._isVertical() ? 'height' : 'width';
    this._container.style[prop] = value ?? '';
  }

  /**
   * The only place that writes a concrete pixel size to the DOM.
   * Assumes `size` is already a valid, clamped number.
   */
  _setContainerPixelSize(size, save = true) {
    if(!this._container || typeof size !== 'number' || !Number.isFinite(size)) {
      return;
    }

    const parent = this._container.parentElement;
    const parentSize = this._isVertical() ? parent?.clientHeight : parent?.clientWidth;

    this._size = size;
    this._displayRatio = parentSize > 0 ? size / parentSize : this._displayRatio;
    this._sizeMode = 'pixel';

    this._container.style[this._isVertical() ? 'height' : 'width'] = `${size}px`;

    if(save) {
      this._scheduleSaveState();
    }
  }

  /** Re-measures the rendered size after a CSS-driven change and syncs state. */
  _measureAndSyncRatio() {
    const parent = this._container?.parentElement;
    if(!this._container || !parent) {
      return;
    }

    const rect = this._container.getBoundingClientRect();
    const measured = this._isVertical() ? rect.height : rect.width;
    const parentSize = this._isVertical() ? parent.clientHeight : parent.clientWidth;

    this._size = measured;
    this._displayRatio = parentSize > 0 ? measured / parentSize : this._displayRatio;
  }

  /** Re-applies the last known ratio as a pixel size (used on window resize). */
  _applySizeFromRatio() {
    const parent = this._container?.parentElement;
    if(!this._container || !parent) {
      return;
    }

    const parentSize = this._isVertical() ? parent.clientHeight : parent.clientWidth;
    this._setContainerPixelSize(this._clamp(parentSize * this._displayRatio), false);
  }

  // --- dragging (always pixel-based) ------------------------------------------

  _dragHandleStart(e) {
    if(!this._enabled || !this._direction) {
      return;
    }

    e.preventDefault();
    this._isDragging = true;

    const containerRect = this._container.getBoundingClientRect();

    if(this._direction === 'right') {
      this._dragOffset = e.clientX - (containerRect.left + this._container.clientWidth);
    } else if(this._direction === 'left') {
      this._dragOffset = e.clientX - containerRect.left;
    } else if(this._direction === 'bottom') {
      this._dragOffset = e.clientY - (containerRect.top + this._container.clientHeight);
    } else if(this._direction === 'top') {
      this._dragOffset = e.clientY - containerRect.top;
    }

    this._domHandle.setPointerCapture(e.pointerId);
    this._domHandle.classList.add('dragging');
    document.body.style.cursor = this._isVertical() ? 'ns-resize' : 'ew-resize';
    document.body.style.userSelect = 'none';

    this._onResizeStart?.(e);
  }

  _dragHandleMove(e) {
    if(!this._isDragging) {
      return;
    }

    const parentRect = this._container.parentElement.getBoundingClientRect();
    let newSize = 0;

    if(this._direction === 'right') {
      newSize = (e.clientX - this._dragOffset) - parentRect.left;
    } else if(this._direction === 'left') {
      newSize = parentRect.right - (e.clientX - this._dragOffset);
    } else if(this._direction === 'bottom') {
      newSize = (e.clientY - this._dragOffset) - parentRect.top;
    } else if(this._direction === 'top') {
      newSize = parentRect.bottom - (e.clientY - this._dragOffset);
    }

    // dragging always transitions the container into controller-controlled
    // (pixel) sizing, even if it started out as a CSS percentage
    newSize = this._clamp(newSize);
    this._setContainerPixelSize(newSize, true);
    this._onResize?.(e, newSize, this._displayRatio);
  }

  _dragHandleEnd(e) {
    if(!this._isDragging) {
      return;
    }

    this._isDragging = false;

    this._domHandle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    if(this._setSizeTimer) {
      clearTimeout(this._setSizeTimer);
      this._setSizeTimer = null;
    }
    this._saveState(); // flush immediately rather than waiting on the debounce

    this._onResizeEnd?.(e);
  }

  _windowResize() {
    if(!this._keepRatio) {
      return;
    }

    // CSS-controlled sizes (percentages, stylesheet rules) already respond
    // to layout changes on their own - only pixel-controlled sizes need us
    // to manually recompute and reapply based on the stored ratio.
    if(this._sizeMode !== 'pixel') {
      return;
    }

    this._applySizeFromRatio();
  }

  // --- DOM handle lifecycle -----------------------------------------------

  _createDOMHandle() {
    if(!this._container) {
      console.error('[ResizeController] Failed to create dom handle, container was null');
      return;
    }

    this._container.style.position = 'relative';

    const handle = document.createElement('div');
    handle.className = 'resize-handle';

    if(!this._visible) {
      handle.classList.add('hidden');
    }
    if(!this._enabled) {
      handle.classList.add('disabled');
    }
    if(this._direction) {
      handle.classList.add(`resize-${this._direction}`);
    }

    // pointer events cover mouse, touch, and pen in one consistent model
    handle.addEventListener('pointerdown',   this._dragHandleStart);
    handle.addEventListener('pointermove',   this._dragHandleMove);
    handle.addEventListener('pointerup',     this._dragHandleEnd);
    handle.addEventListener('pointercancel', this._dragHandleEnd);

    if(this._resetOnDblClick) {
      handle.addEventListener('dblclick', this._handleDblClick);
    }

    this._domHandle = handle;
    this._container.appendChild(handle);
  }

  _destroyDOMHandle() {
    if(!this._domHandle) {
      return;
    }

    this._domHandle.removeEventListener('pointerdown',   this._dragHandleStart);
    this._domHandle.removeEventListener('pointermove',   this._dragHandleMove);
    this._domHandle.removeEventListener('pointerup',     this._dragHandleEnd);
    this._domHandle.removeEventListener('pointercancel', this._dragHandleEnd);
    this._domHandle.removeEventListener('dblclick',      this._handleDblClick);

    this._domHandle.remove();
    this._domHandle = null;
  }

  _validateDirection() {
    if(!this._direction) {
      console.error(`[ResizeController] No direction was set. Use one of: ${ResizeController.DIRECTIONS.join(', ')}`);
      return;
    }

    if(typeof this._direction !== 'string') {
      console.error(`[ResizeController] direction must be a string, got: ${typeof this._direction}`);
      this._direction = null;
      return;
    }

    this._direction = this._direction.toLowerCase();

    if(!ResizeController.DIRECTIONS.includes(this._direction)) {
      console.error(`[ResizeController] Invalid direction "${this._direction}". Use one of: ${ResizeController.DIRECTIONS.join(', ')}`);
      this._direction = null;
    }
  }
}