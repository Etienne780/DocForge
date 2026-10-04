class InputManager {
  constructor() {
    this._pressed = new Set();
    this._listeners = new Map();

    this._listen();
  }

  /**
   * Checks whether a given key, or a set of keys in an array, is currently pressed.
   *
   * @param {string|string[]} key - A single key name, or an array of key names.
   * @param {Object} [opt] - Options for array matching behavior.
   * @param {'any'|'every'} [opt.mode='every'] - When key is an array: 'any' returns
   *   true if at least one key is pressed, 'every' returns true only if all are pressed.
   * @returns {boolean} True if the key (or the array condition) is currently pressed.
   */
  isKeyPressed(key, opt = {}) {
    const mode = opt.mode ?? 'every';
  
    if (Array.isArray(key)) {
      return mode === 'any'
        ? key.some((k) => this.isKeyPressed(k))
        : key.every((k) => this.isKeyPressed(k));
    }
    return this._pressed.has(this._normalize(key));
  }

  /**
   * Registers a callback to be invoked when a specific key or key combination
   * is pressed.
   *
   * @param {string|string[]} key - A single key name, or an array of key names
   *   representing a combination (order-independent).
   * @param {Function} callback - The function to invoke when the key/combo is triggered.
   * @returns {Function} An unsubscribe function that removes this listener.
   */
  onKey(key, callback) {
    const keyId = Array.isArray(key)
      ? key.map((k) => this._normalize(k)).sort().join('+')
      : this._normalize(key);

    if (!this._listeners.has(keyId)) {
      this._listeners.set(keyId, new Set());
    }
    this._listeners.get(keyId).add(callback);

    const unsub = () => {
      const set = this._listeners.get(keyId);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this._listeners.delete(keyId);
      }
    };

    return unsub;
  }

  _triggerListeners(keyId) {
    const set = this._listeners.get(keyId);
    if (set) {
      for (const cb of set) cb();
    }
  }

  /**
   * Normalizes a raw key name into a consistent lowercase identifier
   * (e.g. "Control" -> "ctrl", "A" -> "a").
   *
   * @param {string} key - The raw key name (e.g. from event.key).
   * @returns {string} The normalized key name.
   */
  _normalize(key) {
    const map = {
      control: 'ctrl',
      shift: 'shift',
      alt: 'alt',
      meta: 'meta',
    };
    const k = key.toLowerCase();
    return map[k] || k;
  }


  _listen() {
    document.addEventListener('keydown', (event) => {
      const key = this._normalize(event.key);
      this._pressed.add(key);

      if (event.ctrlKey)
        this._pressed.add('ctrl');
      if (event.shiftKey)
        this._pressed.add('shift');
      if (event.altKey)
        this._pressed.add('alt');
      if (event.metaKey)
        this._pressed.add('meta');

      this._triggerListeners(key);

      for (const keyId of this._listeners.keys()) {
        if (keyId.includes('+')) {
          const parts = keyId.split('+');
          if (parts.every((p) => this._pressed.has(p))) {
            this._triggerListeners(keyId);
          }
        }
      }
    });

    document.addEventListener('keyup', (event) => {
      const key = this._normalize(event.key);
      this._pressed.delete(key);

      if (!event.ctrlKey)
        this._pressed.delete('ctrl');
      if (!event.shiftKey) 
        this._pressed.delete('shift');
      if (!event.altKey)
        this._pressed.delete('alt');
      if (!event.metaKey)
        this._pressed.delete('meta');
    });

    window.addEventListener('blur', () => {
      this._pressed.clear();
    });
  }
}

export const inputManager = new InputManager();