import { state } from '@core/State.js';

export class ResizeController {

  static DIRECTIONS = ['left', 'right', 'top', 'bottom'];

  static DEFAULTS = {
    enabled:         true,
    visible:         true,
    minSize:         null,
    maxSize:         null,
    initialSize:     null,
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

    this._size = 0;
    this._displayRatio = 1;
    this._hasState = false;

    this._setSizeTimer = null;
    this._debounceDelay = 80;

    this._dragHandleStart = this._dragHandleStart.bind(this);
    this._dragHandleMove = this._dragHandleMove.bind(this);
    this._dragHandleEnd = this._dragHandleEnd.bind(this);
    this._windowResize = this._windowResize.bind(this);

    if(!this._container)
      console.warn('[ResizeController] container is null');

    for(const key in ResizeController.DEFAULTS)
      this[`_${key}`] = flags[key] ?? ResizeController.DEFAULTS[key];

    this._validateDirection();
    this._loadState();

    this._createDOMHandle();
    this._initSize(); 
    
    window.addEventListener('resize', this._windowResize);
  }

  destroy() {
    window.removeEventListener('resize', this._windowResize);
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

  getSize() { 
    return this._size; 
  }

  getRatio() { 
    return this._displayRatio; 
  }

  setSize(px, save = true) {
    this._setContainerSize(this._clamp(px), save);
  }

  reset() {
    this.setSize(this._initialSize ?? this._cssSize);
  }

  _clamp(size) {
    if(this._minSize !== null) 
      size = Math.max(size, this._minSize);
    if(this._maxSize !== null) 
      size = Math.min(size, this._maxSize);
    return size;
  }

  _isVertical() {
    return this._direction === 'top' || this._direction === 'bottom';
  }

  _loadState() {
  if(!this._stateName)
    return;

    const saved = state.get(this._stateName);

    if(typeof saved === 'number') {
      this._size = saved;
      this._hasState = true;
    }
  }

  _saveState() {
    if(!this._stateName)
      return;

    state.set(this._stateName, this._size);
  }

  _initSize() {
    const parent = this._container?.parentElement;
    if(!parent)
      return;

    const parentSize = this._isVertical() ? 
      parent.clientHeight :
      parent.clientWidth;

    const rect = this._container.getBoundingClientRect();
    const cssSize = this._isVertical() ? rect.height : rect.width;

    this._cssSize = cssSize;

    if(this._hasState) {
      this._setContainerSize(this._clamp(parentSize * this._displayRatio), false);
      return;
    }

    if(this._initialSize !== null) {
      this._setContainerSize(this._clamp(this._initialSize), false);
      return;
    }

    this._size = cssSize;
    this._displayRatio = cssSize / (parentSize || 1);
  }

  _applySizeFromRatio() {
    const parent = this._container?.parentElement;
    if(!parent)
      return;
  
    const parentSize = this._isVertical() ? 
      parent.clientHeight : 
      parent.clientWidth;

    this._setContainerSize(this._clamp(parentSize * this._displayRatio), false);
  }

  _setContainerSize(size, saveRatio = true) {
    if(!this._container)
      return;

    const parent = this._container.parentElement;
    const parentSize = this._isVertical() ? 
      parent.clientHeight : 
      parent.clientWidth;

    this._size = size;
    this._displayRatio = size / (parentSize || 1);

    this._container.style[this._isVertical() ? 'height' : 'width'] = `${size}px`;

    if(this._setSizeTimer)
      clearTimeout(this._setSizeTimer);

    this._setSizeTimer = setTimeout(() => {
      if(saveRatio)
        this._saveState();
    }, this._debounceDelay);
  }

  _dragHandleStart(e) {
    if(!this._enabled)
      return;

    e.preventDefault();
    this._isDragging = true;

    const containerRect = this._container.getBoundingClientRect();

    if(this._direction === 'right')
      this._dragOffset = e.clientX - (containerRect.left + this._container.clientWidth);
    else if(this._direction === 'left')
      this._dragOffset = e.clientX - containerRect.left;
    else if(this._direction === 'bottom')
      this._dragOffset = e.clientY - (containerRect.top + this._container.clientHeight);
    else if(this._direction === 'top')
      this._dragOffset = e.clientY - containerRect.top;

    this._domHandle.setPointerCapture(e.pointerId);
    this._domHandle.classList.add('dragging');
    document.body.style.cursor = this._isVertical() ? 'ns-resize' : 'ew-resize';
    document.body.style.userSelect = 'none';

    this._onResizeStart?.(e);
  }

  _dragHandleMove(e) {
    if(!this._isDragging)
      return;

    const parentRect = this._container.parentElement.getBoundingClientRect();
    const containerRect = this._container.getBoundingClientRect();

    let newSize = 0;

    if(this._direction === 'right')
      newSize = (e.clientX - this._dragOffset) - parentRect.left;
    else if(this._direction === 'left')
      newSize = parentRect.right - (e.clientX - this._dragOffset);
    else if(this._direction === 'bottom')
      newSize = (e.clientY - this._dragOffset) - parentRect.top;
    else if(this._direction === 'top')
      newSize = parentRect.bottom - (e.clientY - this._dragOffset);

    newSize = this._clamp(newSize);
    this._setContainerSize(newSize);
    this._onResize?.(e, newSize, this._displayRatio);
  }

  _dragHandleEnd(e) {
    if(!this._isDragging)
      return;
  
    this._isDragging = false;

    this._domHandle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    this._saveState();

    this._onResizeEnd?.(e);
  }

  _windowResize() {
    if(!this._keepRatio)
      return;
    this._applySizeFromRatio();
  }

  _createDOMHandle() {
    if(!this._container) {
      console.error('[ResizeController] Failed to create dom handle, container was null');
      return;
    }

    this._container.style.position = 'relative';

    const handle = document.createElement('div');
    handle.className = 'resize-handle';

    if(!this._visible)
      handle.classList.add('hidden');
    if(!this._enabled)
      handle.classList.add('disabled');
    if(this._direction) 
      handle.classList.add(`resize-${this._direction}`);

    handle.addEventListener('mousedown', this._dragHandleStart);

    if(this._resetOnDblClick)
      handle.addEventListener('dblclick', () => this.reset());

    handle.addEventListener('pointerdown',   this._dragHandleStart);
    handle.addEventListener('pointermove',   this._dragHandleMove);
    handle.addEventListener('pointerup',     this._dragHandleEnd);
    handle.addEventListener('pointercancel', this._dragHandleEnd);

    this._domHandle = handle;
    this._container.appendChild(handle);
  }

  _destroyDOMHandle() {
    if(!this._domHandle)
      return;

    this._domHandle.removeEventListener('pointerdown',   this._dragHandleStart);
    this._domHandle.removeEventListener('pointermove',   this._dragHandleMove);
    this._domHandle.removeEventListener('pointerup',     this._dragHandleEnd);
    this._domHandle.removeEventListener('pointercancel', this._dragHandleEnd);
    this._domHandle.remove();
    this._domHandle = null;
  }

  _validateDirection() {
    if(!this._direction) {
      console.error(`[ResizeController] No direction was set.  Use one of: ${ResizeController.DIRECTIONS.join(', ')}`);
      return;
    }

    if(typeof this._direction !== 'string') {
      this._direction = null;
      console.error(`[ResizeController] direction must be a string, got: ${typeof this._direction}`);
      return;
    }

    this._direction = this._direction.toLowerCase();

    if(!ResizeController.DIRECTIONS.includes(this._direction)) {
      console.error(`[ResizeController] Invalid direction "${this._direction}". Use one of: ${ResizeController.DIRECTIONS.join(', ')}`);
      this._direction = null;
    }
  }
}