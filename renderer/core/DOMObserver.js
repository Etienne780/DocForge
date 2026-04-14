/**
 * Observes the entire document body for DOM mutations.
 * Notifies registered callbacks when elements are added or removed,
 * including elements in the subtree of the changed node.
 *
 * Usage:
 *   const off = domObserver.register({ type: 'added', selector = '.button', callback: (node, isChild) => {} });
 *   off(); // unregister
 */
class DOMObserver {
  constructor() {
    /** @type {Map<'added'|'removed', Set<{selector: string|null, cb: Function}>>} */
    this._handlers = new Map();
  }

  /**
   * Starts the MutationObserver on document.body.
   * Call once on app init.
   */
  init() {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        this._processNodes(mutation.addedNodes,   'added');
        this._processNodes(mutation.removedNodes, 'removed');
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Registers a callback for a mutation type.
   *
   * @param {Object}            options
   * @param {'added'|'removed'} options.type      - which mutation to listen
   * @param {'String'|'null'}   options.selector  - which elements to listen to (optinal)
   * @param {Function}          options.callback  - called as callback(node, isChild)
   * @param {HTMLElement} node     - the element that was added or removed
   * @param {boolean}    isChild  - true if node is a descendant of the mutated root,
   *                                  false if it is the root itself
   *
   * @returns {Function} unregister — call to stop receiving events
   *
   * @example
   * const off = domObserver.register({
   *   type: 'added',
   *   callback: (node, isChild) => {
   *     if (node.matches('.my-component')) init(node);
   *   }
   * });
   * off(); // stop listening
   */
  register({ type, selector = null, callback }) {
    if (!type || typeof callback !== 'function') {
      console.warn('[DOMObserver] register() requires { type, selector, callback }');
      return () => {};
    }

    if (!this._handlers.has(type))
      this._handlers.set(type, new Set());

    const set = this._handlers.get(type);
    const obj = { selector: selector, cb: callback };
    set.add(obj);

    return () => set.delete(obj);
  }

  /**
   * Registers a callback that fires once for the next matching mutation, then unregisters.
   *
   * @param {'added'|'removed'} type
   * @param {'String'|'null'}   options.selector  - which elements to listen to (optinal)
   * @param {Function}          callback  - same signature as register: (node, isChild)
   * @returns {Function} unregister
   */
  once(type, selector = null, callback) {
    const off = this.register({
      type,
      selector: selector,
      callback: (node, isChild) => {
        callback(node, isChild);
        off();
      },
    });
    return off;
  }

  /**
   * Removes all registered handlers for a given type, or all handlers if no type given.
   * @param {'added'|'removed'} [type]
   */
  clear(type) {
    if (type) {
      this._handlers.get(type)?.clear();
    } else {
      this._handlers.clear();
    }
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /**
   * @param {NodeList}          nodeList
   * @param {'added'|'removed'} type
   */
  _processNodes(nodeList, type) {
    for (const node of nodeList) {
      if (!(node instanceof HTMLElement)) 
        continue;

      this._notify(node, type, false);
      node.querySelectorAll('*').forEach(child => 
        this._notify(child, type, true));
    }
  }

  /**
   * @param {HTMLElement}       node
   * @param {'added'|'removed'} type
   * @param {boolean}           isChild
   */
  _notify(node, type, isChild) {
    const handlers = this._handlers.get(type);
    if (!handlers)
      return;

    for (const obj of handlers) {
      if (!obj.selector || node.matches(obj.selector)) {
        obj.cb(node, isChild);
      }
    }
  }
}

export const domObserver = new DOMObserver();