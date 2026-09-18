import { insertHTML } from '@common/Common.js'

export class AsyncRenderer {
  constructor({ parent, itemCB, renderItemCB }) {
    this._parent = parent;
    this._itemCB = itemCB;
    this._renderItemCB = renderItemCB;

    this._isRendering = false;
    this._renderRequestId = 0;
    this._items = null;
  }

  async render() {
    this._items = this._itemCB();
    return this.reRender();
  }

  async reRender() {
    if (!this._items)
      return;

    if (this._isRendering)
      this.cancelRender();

    this.clear();

    const requestId = ++this._renderRequestId;
    this._isRendering = true;

    try {
      for (const item of this._items) {
        const html = await this._renderItemCB(item);
        if (requestId !== this._renderRequestId)
          return;
      
        insertHTML({ element: this._parent, html, type: 'end' });
        await new Promise(requestAnimationFrame);
      }
    } finally {
      if (requestId === this._renderRequestId)
        this._isRendering = false;
    }
  }

  cancelRender() {
    this._renderRequestId++;
    this._isRendering = false;
  }

  clear() {
    this._parent.innerHTML = '';
  }

  isRendering() {
    return this._isRendering;
  }
}