import { isPlatformMacOS } from '@core/Platform.js';
import { domObserver } from '@core/DOMObserver';

/**
 * @typedef {Object} ShortcutOptions
 * @property {string|string[]} [context='global'] - Scope in which the shortcut is active.
 * @property {string} [name]             - Human-readable label  (e.g. "Save").
 * @property {string} [description]      - Longer description for settings UI.
 */

/**
 * @typedef {Object} ShortcutEntry
 * @property {string}        context
 * @property {string}        name
 * @property {string}        description
 * @property {string}        keyCombo      - Normalised, platform-independent combo (e.g. "ctrl+s"), '' = no key.
 * @property {string}        defaultCombo  - Combo it was registered with.
 * @property {string}        displayCombo  - Formatted for the current platform (e.g. "Ctrl + S"), '' = no key.
 * @property {Function|null} action
 */

const KEY_ORDER = ['meta', 'ctrl', 'shift', 'alt'];

// ─────────────────────────────────────────────────────────────────────────────

class ShortcutManager {
  constructor() {
    /**
     * Primary store.
     * @type {Map<string, ShortcutEntry>}  key = "context:combo"
     */
    this._shortcuts = new Map();

    /**
     * DOM elements that display a shortcut label, grouped by "context:name".
     * @type {Map<string, Set<HTMLElement>>}
     */
    this._labelEls = new Map();

    /**
     * Shortcuts the user removed the key from, key = "context:name".
     * @type {Map<string, ShortcutEntry>}
     */
    this._unbound = new Map();

    /**
     * User combos by "context:name" ('' = no key), applied on register (see setOverrides).
     * @type {Object<string, string>}
     */
    this._overrides = {};

    /** @type {Set<(overrides: Object<string, string>) => void>} */
    this._changeListeners = new Set();

    /** @type {string} Currently active context. */
    this._context = 'global';
  }

  init() {
    this._scanDOM();
    this._listen();
    this._registerDOMObserver();
    return this;
  }

  /**
   * Register a shortcut.
   *
   * @param {string}          keyCombo  Platform-independent combo, e.g. "ctrl+s".
   *                                    Use "ctrl" for the primary modifier on every OS
   *                                    (maps to ⌘ on macOS, Ctrl everywhere else).
   * @param {Function|null}   action    Returning `false` leaves the key to the browser (no preventDefault).
   * @param {ShortcutOptions} [opts]
   * @returns {this}
   *
   * @example
   * shortcutManager.register('ctrl+s', () => eventBus.emit('save:request'), {
   *   context:     'global',
   *   name:        'Save',
   *   description: 'Save current state',
   * });
   */
  register(keyCombo, action = null, opts = {}) {
    const contexts = Array.isArray(opts.context)
      ? opts.context
      : [opts.context ?? 'global'];

    const name = opts.name ?? keyCombo;
    const description = opts.description ?? '';
    const defaultCombo = this._normaliseCombo(keyCombo);

    for (const context of contexts) {
      const override = this._overrides[this._buildKey(context, name)];
      const combo = override !== undefined ? override : defaultCombo;

      const entry = {
        context,
        name,
        description,
        order:        this._nextOrder = (this._nextOrder ?? 0) + 1, // registration order (lists)
        keyCombo:     combo,
        defaultCombo,
        displayCombo: combo ? this._formatCombo(combo) : '',
        action,
      };

      this._store(entry);
      this._updateLabels(context, name);
    }

    return this;
  }

  // ─── User key combos (preferences) ────────────────────────────────────

  /**
   * Sets the user combos, e.g. loaded from the app state. Applies them to the registered
   * shortcuts (shortcuts registered later get them on register).
   * @param {Object<string, string>} overrides - { "context:name": combo | '' (no key) }
   */
  setOverrides(overrides) {
    this._overrides = { ...(overrides ?? {}) };
    for (const entry of this.getAll()) {
      const override = this._overrides[this._buildKey(entry.context, entry.name)];
      this._setCombo(entry, override !== undefined ? override : entry.defaultCombo);
    }
  }

  /** @returns {Object<string, string>} the user combos (only the ones that differ from the default) */
  getOverrides() {
    return { ...this._overrides };
  }

  /**
   * Changes the key of a shortcut and stores it as a user combo.
   * @param {string} context
   * @param {string} name
   * @param {string} combo - '' removes the key
   */
  setShortcutCombo(context, name, combo) {
    const entry = this._getEntryName(context, name);
    if (!entry)
      return;

    const normalised = combo ? this._normaliseCombo(combo) : '';
    const key = this._buildKey(context, name);
    if (normalised === entry.defaultCombo)
      delete this._overrides[key];
    else
      this._overrides[key] = normalised;

    this._setCombo(entry, normalised);
    this._emitChange();
  }

  /** Back to the registered combo. */
  resetShortcut(context, name) {
    const entry = this._getEntryName(context, name);
    if (entry)
      this.setShortcutCombo(context, name, entry.defaultCombo);
  }

  /** Every shortcut back to its registered combo. */
  resetAllShortcuts() {
    this._overrides = {};
    for (const entry of this.getAll())
      this._setCombo(entry, entry.defaultCombo);
    this._emitChange();
  }

  /**
   * Shortcuts that react to `combo` together with a shortcut of `context`: the same
   * context, and global ones (a context shortcut hides a global one with the same key).
   * @param {string} context
   * @param {string} combo
   * @param {string} [exceptName] - the shortcut that gets the combo
   * @returns {ShortcutEntry[]}
   */
  findConflicts(context, combo, exceptName = null) {
    const normalised = combo ? this._normaliseCombo(combo) : '';
    if (!normalised)
      return [];
    return Array.from(this._shortcuts.values()).filter(entry =>
      entry.keyCombo === normalised
      && !(entry.context === context && entry.name === exceptName)
      && (entry.context === context || entry.context === 'global' || context === 'global'));
  }

  /**
   * The combo of a key event in the format of register(), e.g. for recording a new key.
   * @param {KeyboardEvent} event
   * @returns {string} '' for a pure modifier press
   */
  comboFromEvent(event) {
    return this._eventToCombo(event) ?? '';
  }

  /** @param {string} combo @returns {string} formatted for the current platform, e.g. "Ctrl + S" */
  formatCombo(combo) {
    return combo ? this._formatCombo(this._normaliseCombo(combo)) : '';
  }

  /**
   * Called with the user combos after every change (setShortcutCombo, resets).
   * @param {(overrides: Object<string, string>) => void} listener
   * @returns {() => void} removes the listener
   */
  onChange(listener) {
    this._changeListeners.add(listener);
    return () => this._changeListeners.delete(listener);
  }

  _emitChange() {
    const overrides = this.getOverrides();
    this._changeListeners.forEach(listener => listener(overrides));
  }

  /** Stores an entry under its combo, or as unbound without one. */
  _store(entry) {
    // a registration with the same name replaces the old one
    for (const [key, existing] of this._shortcuts) {
      if (existing.context === entry.context && existing.name === entry.name)
        this._shortcuts.delete(key);
    }
    const nameKey = this._buildKey(entry.context, entry.name);
    this._unbound.delete(nameKey);

    if (entry.keyCombo)
      this._shortcuts.set(this._buildKey(entry.context, entry.keyCombo), entry);
    else
      this._unbound.set(nameKey, entry);
  }

  _setCombo(entry, combo) {
    entry.keyCombo = combo;
    entry.displayCombo = combo ? this._formatCombo(combo) : '';
    this._store(entry);
    this._updateLabels(entry.context, entry.name);
  }

  /**
   * Replace the action of an existing shortcut.
   *
   * @param {string}   keyCombo
   * @param {Function} fn
   * @param {string}   [context='global']
   * @returns {this}
   */
  action(keyCombo, fn, context = 'global') {
    const entry = this._getEntryCombo(context, this._normaliseCombo(keyCombo));
    if (!entry) {
      console.warn(`[ShortcutManager] action(): "${context}:${keyCombo}" is not registered.`);
      return this;
    }
    entry.action = fn;
    return this;
  }

  /**
   * Dispatches a registered shortcut action for a given context and name.
   *
   * Looks up the shortcut entry by context and name. If an action function
   * exists, it is executed and `true` is returned. Otherwise, returns `false`.
   *
   * @param {string} context - The context in which the shortcut is registered (e.g., 'global', 'project').
   * @param {string} name - The name of the shortcut to dispatch.
   * @param {KeyboardEvent|null} [event=null] - Optional keyboard event to pass to the action.
   * @returns {boolean} True if the action was successfully dispatched; false otherwise.
   */
  dispatch(context, name, event = null) {
    const entry = this._getEntryName(context, name);
    if (!entry) return false;

    if (entry.action && typeof entry.action === 'function') {
      entry.action(event);
      return true;
    }
    return false;
  }

  /**
   * @param {string} keyCombo
   * @param {string} [context='global']
   * @returns {boolean}
   */
  has(keyCombo, context = 'global') {
    return this._shortcuts.has(this._buildKey(context, this._normaliseCombo(keyCombo)));
  }

  /**
   * @param {string} keyCombo
   * @param {string} [context='global']
   * @returns {ShortcutEntry|null}
   */
  get(keyCombo, context = 'global') {
    return this._getEntryCombo(context, this._normaliseCombo(keyCombo));
  }

  /**
   * All registered shortcuts as a flat array.
   * Useful for building a "all shortcuts" list in your settings UI.
   *
   * @returns {ShortcutEntry[]}
   */
  getAll() {
    return [...this._shortcuts.values(), ...this._unbound.values()];
  }

  /**
   * All registered shortcuts grouped by context.
   * Useful for rendering a context-sectioned shortcuts overview.
   *
   * @returns {Map<string, ShortcutEntry[]>}
   *
   * @example
   * for (const [context, entries] of shortcutManager.getAllByContext()) {
   *   renderSection(context, entries);
   * }
   */
  getAllByContext() {
    const map = new Map();
    for (const entry of this.getAll()) {
      if (!map.has(entry.context)) map.set(entry.context, []);
      map.get(entry.context).push(entry);
    }
    return map;
  }

  /**
   * All shortcuts for a single context.
   *
   * @param {string} context
   * @returns {ShortcutEntry[]}
   */
  getByContext(context) {
    return this.getAllByContext().get(context) ?? [];
  }

  /**
   * Reassign the key combination for an existing shortcut (by its current combo).
   * Same as setShortcutCombo(): stored as a user combo, DOM labels follow.
   *
   * @param {string} oldCombo
   * @param {string} newCombo
   * @param {string} [context='global']
   */
  setKeyComb(oldCombo, newCombo, context = 'global') {
    const entry = this._getEntryCombo(context, this._normaliseCombo(oldCombo));
    if (!entry) {
      console.warn(`[ShortcutManager] setKeyComb(): "${context}:${oldCombo}" not found.`);
      return;
    }
    this.setShortcutCombo(context, entry.name, newCombo);
  }

  /** @param {string} context @returns {this} */
  setContext(context) {
    this._context = context ?? 'global';
    return this;
  }

  /** @returns {string} */
  getContext() {
    return this._context;
  }

  /**
   * Serialise to a JSON-safe object.
   *
   * ```json
   * {
   *   "global": { "ctrl+s": "ctrl+shift+s" },
   *   "editor": { "ctrl+f": "ctrl+f" }
   * }
   * ```
   * Format: `{ [context]: { [originalCombo]: currentCombo } }`
   *
   * @returns {Object}
   */
  toJSON() {
    const out = {};
    for (const entry of this._shortcuts.values()) {
      if(!out[entry.context])
        out[entry.context] = {};
      out[entry.context][entry.keyCombo] = entry.keyCombo;
    }
    return out;
  }

  /**
   * Restore combos from a saved JSON object.
   * Existing shortcuts get their combo updated; unknown ones are ignored.
   *
   * @param {Object} json
   */
  fromJSON(json) {
    for (const [context, shortcuts] of Object.entries(json)) {
      for (const [oldCombo, newCombo] of Object.entries(shortcuts)) {
        if (oldCombo !== newCombo && this.has(oldCombo, context)) {
          this.setKeyComb(oldCombo, newCombo, context);
        }
      }
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────

  /**
   * Label elements show the current combo of a shortcut (by name) and are
   * updated whenever it changes:
   * ```html
   * <kbd data-shortcut-context="editor" data-shortcut-label="Search"></kbd>
   * ```
   * With `data-shortcut-target="title"` the combo is put into the title
   * (tooltip) instead, appended to `data-shortcut-title`:
   * ```html
   * <button data-shortcut-context="docEditor" data-shortcut-label="Format:bold"
   *   data-shortcut-target="title" data-shortcut-title="Bold"><b>B</b></button>
   * ```
   */
  _scanDOM() {
    document.querySelectorAll('[data-shortcut-label]').forEach(el => this._bindLabelEl(el));
  }

  _applyLabel(el, entry) {
    if (el.dataset.shortcutTarget === 'title') {
      const base = el.dataset.shortcutTitle;
      el.title = base && entry.displayCombo ? `${base} (${entry.displayCombo})` : (base || entry.displayCombo);
      return;
    }

    el.textContent = entry.displayCombo;
  }

  _bindLabelEl(el) {
    const shortcutName = el.dataset.shortcutLabel;
    const context = el.dataset.shortcutContext ?? 'global';

    if (!shortcutName)
        return;

    const entry = this._getEntryName(context, shortcutName);
    if (!entry)
        return;

    const key = this._buildKey(context, shortcutName);
    if (!this._labelEls.has(key)) 
      this._labelEls.set(key, new Set());
    this._labelEls.get(key).add(el);

    this._applyLabel(el, entry);
  }

  _registerDOMObserver() {
    domObserver.register({
      type: 'added',
      callback: node => {
        if (node.dataset.shortcutLabel)
          this._bindLabelEl(node);
      }
    });

    domObserver.register({
      type: 'removed',
      callback: node => {
        this._unbindLabelEl(node);
      }
    });
  }

  _unbindLabelEl(el) {
    const shortcutName = el.dataset?.shortcutLabel;
    const context = el.dataset?.shortcutContext ?? 'global';
    if (!shortcutName) 
      return;
    
    this._labelEls.get(this._buildKey(context, shortcutName))?.delete(el);
  }

  _updateLabels(context, keyComboOrName) {
    const entries = this.getAll().filter(
      e => e.context === context &&
        (e.keyCombo === keyComboOrName || e.name === keyComboOrName)
    );  

    for (const entry of entries) {
      const key = this._buildKey(context, entry.name);
      const els = this._labelEls.get(key);
      if (!els?.size) 
        continue; 

      for (const el of els)
        this._applyLabel(el, entry);
    }
  }

  _listen() {
    document.addEventListener('keydown', event => {
      // Chromium fires keydown without a key when a datalist / autofill suggestion is picked
      if (typeof event.key !== 'string')
        return;

      const combo = this._eventToCombo(event);

      if (combo === 'ctrl+s') {
        const ads = 'das';
      }

      const entry =
        this._shortcuts.get(this._buildKey(this._context, combo)) ??
        this._shortcuts.get(this._buildKey('global',       combo));

      if (!entry?.action)
        return;

      if (entry.action(event) !== false)
        event.preventDefault();
    });
  }

  _getEntryCombo(context, combo) {
    return this._shortcuts.get(this._buildKey(context ?? 'global', combo)) ?? null;
  }

  _getEntryName(context, name) {
    return this.getAll().find(
        e => e.name === name && e.context === (context ?? 'global')) ?? null;
  }

  _buildKey(context, segment) {
    return `${context ?? 'global'}:${segment}`;
  }

  /**
   * Normalise to lowercase, modifiers sorted: ctrl -> shift -> alt -> key.
   * "ctrl" is the canonical primary-modifier token on all platforms.
   *
   * @param {string} combo
   * @returns {string}
   */
  _normaliseCombo(combo) {
    const parts = combo.toLowerCase().split('+').map(p => p.trim());
    const mods = KEY_ORDER.filter(m => parts.includes(m));
    const key = parts.find(p => !KEY_ORDER.includes(p)) ?? '';
    return [...mods, key].join('+');
  }

  /**
   * Build a normalised combo string from a KeyboardEvent.
   *
   * Platform mapping:
   *   macOS -> Cmd  (metaKey)  is treated as the canonical "ctrl" token.
   *   Win/Linux -> Ctrl (ctrlKey) is the canonical "ctrl" token.
   *
   * This means a shortcut registered as "ctrl+s" fires on:
   *   ⌘+S on macOS
   *   Ctrl+S on Windows / Linux
   * 
   * @param {KeyboardEvent} event
   * @returns {string}
   */
  _eventToCombo(event) {
    const parts = [];

    const isMac = isPlatformMacOS();
    const primaryMod = isMac ? event.metaKey : event.ctrlKey;

    if(!isMac && event.metaKey)
      return;
    else if(isMac && event.ctrlKey)
      return;

    if (primaryMod) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');

    let key = event.key;

    const KEY_MAP = {
      ' ': 'space',
      'arrowup': 'arrowup',
      'arrowdown': 'arrowdown',
      'arrowleft': 'arrowleft',
      'arrowright': 'arrowright',
      'escape': 'escape',
      'esc': 'escape',
      'enter': 'enter',
      'backspace': 'backspace',
      'delete': 'delete',
      'tab': 'tab'
    };

    key = key.toLowerCase();

    // Skip pure modifier presses
    if (key === 'shift' || key === 'control' || key === 'meta' || key === 'alt')
      return '';

    key = KEY_MAP[key] ?? key;
    parts.push(key);
    return parts.join('+');
  }

  /**
   * Format a normalised combo for display.
   * Uses platform-appropriate symbols / labels.
   *
   * | token | macOS | Win / Linux |
   * |-------|-------|-------------|
   * | meta  | ⌘    | Win         |
   * | ctrl  | Ctrl  | Ctrl        |
   * | shift | Shift | Shift       |
   * | alt   | Alt   | Alt         |
   *
   * @param {string} combo  e.g. "ctrl+shift+s"
   * @returns {string}       e.g. "⌘ + Shift + S"  |  "Ctrl + Shift + S"
   */
  _formatCombo(combo) {
    const MAC_LABELS = {
      meta: '⌘',
      ctrl: 'Ctrl',
      shift: 'Shift',
      alt: 'Alt'
    };

    const WIN_LABELS = {
      meta: 'Win',
      ctrl: 'Ctrl',
      shift: 'Shift',
      alt: 'Alt'
    };

    const SPECIAL_KEYS = {
      arrowup: 'Up',
      arrowdown: 'Down',
      arrowleft: 'Left',
      arrowright: 'Right',
      escape: 'Esc',
      enter: 'Enter',
      backspace: 'Backspace',
      delete: 'Del',
      tab: 'Tab',
      space: 'Space'
    };

    const isMac = isPlatformMacOS();
    const labels = isMac ? MAC_LABELS : WIN_LABELS;

    const parts = combo
      .split('+')
      .map(k => k.trim().toLowerCase());

    // Sort modifiers first, keep unknown keys at the end
    parts.sort((a, b) => {
      const ia = KEY_ORDER.indexOf(a);
      const ib = KEY_ORDER.indexOf(b);

      if (ia === -1 && ib === -1)
        return 0;

      if (ia === -1)
        return 1;

      if (ib === -1)
        return -1;

      return ia - ib;
    });

    return parts
      .map(key => {
        return labels[key]
          ?? SPECIAL_KEYS[key]
          ?? (key.charAt(0).toUpperCase() + key.slice(1));
      })
      .join(' + ');
  }
}

export const shortcutManager = new ShortcutManager();