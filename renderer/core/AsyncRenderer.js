import { insertHTML } from '@common/Common.js'
import { sanitizeHTML } from '@common/Dom.js'

/**
 * Renders a list of items one by one (one item per animation frame).
 *
 * With `keyCB` the renderer is keyed: each rendered element is cached by its
 * key and only rebuilt when the item is new or its `hashCB` value changed.
 * Elements are moved into the order of `itemCB()` on every render, items no
 * longer in the list are detached (and stay cached).
 * Without `keyCB` every render rebuilds the whole list.
 */
export class AsyncRenderer {
  constructor({ parent, itemCB, renderItemCB, keyCB = null, hashCB = null }) {
    this._parent = parent;
    this._itemCB = itemCB;
    this._renderItemCB = renderItemCB;
    this._keyCB = keyCB;
    this._hashCB = hashCB;

    this._isRendering = false;
    this._renderRequestId = 0;
    this._items = null;
    this._cache = new Map(); // key -> { element, hash }
    this._elementKeys = new WeakMap(); // element -> key
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

    const requestId = ++this._renderRequestId;
    this._isRendering = true;

    try {
      if (this._keyCB)
        await this._renderKeyed(requestId);
      else
        await this._renderAll(requestId);
    } finally {
      if (requestId === this._renderRequestId)
        this._isRendering = false;
    }
  }

  async _renderAll(requestId) {
    this._parent.innerHTML = '';

    for (const item of this._items) {
      const html = await this._renderItemCB(item);
      if (requestId !== this._renderRequestId)
        return;

      insertHTML({ element: this._parent, html, type: 'end' });
      await new Promise(requestAnimationFrame);
    }
  }

  async _renderKeyed(requestId) {
    const keys = new Set(this._items.map(item => this._keyCB(item)));

    // detach elements that are not part of the list anymore
    Array.from(this._parent.children).forEach(child => {
      if (!keys.has(this._elementKeys.get(child)))
        child.remove();
    });

    for (let i = 0; i < this._items.length; i++) {
      const item = this._items[i];
      const key = this._keyCB(item);
      const hash = this._hashCB ? this._hashCB(item) : null;

      let entry = this._cache.get(key);
      if (!entry || entry.hash !== hash) {
        const html = await this._renderItemCB(item);
        if (requestId !== this._renderRequestId)
          return;

        const element = this._createElement(html);
        if (!element)
          continue;

        entry?.element.remove();
        entry = { element, hash };
        this._cache.set(key, entry);
        this._elementKeys.set(element, key);
        await new Promise(requestAnimationFrame);
        if (requestId !== this._renderRequestId)
          return;
      }

      // everything before index i is already in order
      const current = this._parent.children[i];
      if (current !== entry.element)
        this._parent.insertBefore(entry.element, current ?? null);
    }
  }

  _createElement(html) {
    const template = document.createElement('template');
    template.innerHTML = sanitizeHTML(html.trim());
    return template.content.firstElementChild;
  }

  cancelRender() {
    this._renderRequestId++;
    this._isRendering = false;
  }

  clear() {
    this._parent.innerHTML = '';
    this._cache.clear();
  }

  isRendering() {
    return this._isRendering;
  }
}
