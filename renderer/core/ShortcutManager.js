import { isPlatformMacOS } from '@core/Platform.js';
import { domObserver } from '@core/DOMObserver';

/**
 * @typedef {Object} ShortcutOptions
 * @property {string} [context='global'] - Scope in which the shortcut is active.
 * @property {string} [name]             - Human-readable label  (e.g. "Save").
 * @property {string} [description]      - Longer description for settings UI.
 */

/**
 * @typedef {Object} ShortcutEntry
 * @property {string}        context
 * @property {string}        name
 * @property {string}        description
 * @property {string}        keyCombo      - Normalised, platform-independent combo (e.g. "ctrl+s").
 * @property {string}        displayCombo  - Formatted for the current platform (e.g. "Ctrl + S").
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
   * @param {Function|null}   action
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
    const context = opts.context ?? 'global';
    const name = opts.name ?? keyCombo;
    const description = opts.description ?? '';

    const combo = this._normaliseCombo(keyCombo);
    const key = this._buildKey(context, combo);

    const entry = {
      context,
      name,
      description,
      keyCombo:     combo,
      displayCombo: this._formatCombo(combo),
      action,
    };

    this._shortcuts.set(key, entry);
    this._updateLabels(context, combo);

    return this;
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
    return Array.from(this._shortcuts.values());
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
    for (const entry of this._shortcuts.values()) {
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
   * Reassign the key combination for an existing shortcut.
   * Updates the internal maps and all DOM labels automatically.
   *
   * @param {string} oldCombo
   * @param {string} newCombo
   * @param {string} [context='global']
   */
  setKeyComb(oldCombo, newCombo, context = 'global') {
    oldCombo = this._normaliseCombo(oldCombo);
    newCombo = this._normaliseCombo(newCombo);

    const oldKey = this._buildKey(context, oldCombo);
    const entry = this._shortcuts.get(oldKey);

    if (!entry) {
      console.warn(`[ShortcutManager] setKeyComb(): "${context}:${oldCombo}" not found.`);
      return;
    }

    this._shortcuts.delete(oldKey);

    entry.keyCombo = newCombo;
    entry.displayCombo = this._formatCombo(newCombo);

    this._shortcuts.set(this._buildKey(context, newCombo), entry);

    // Move label-el tracking to new key.
    const els = this._labelEls.get(oldKey);
    if (els) {
      this._labelEls.delete(oldKey);
      this._labelEls.set(this._buildKey(context, newCombo), els);
    }

    this._updateLabels(context, newCombo);
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
   * ```html
   * <kbd data-shortcut-context="editor" data-shortcut-combo="ctrl+f"></kbd>
   * ```
   */
  _scanDOM() {
    document.querySelectorAll('[data-shortcut-combo]').forEach(el => this._bindLabelEl(el));
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

    el.textContent = entry.displayCombo;
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
    const entries = Array.from(this._shortcuts.values()).filter(
      e => e.context === context &&
        (e.keyCombo === keyComboOrName || e.name === keyComboOrName)
    );  

    for (const entry of entries) {
      const key = this._buildKey(context, entry.name);
      const els = this._labelEls.get(key);
      if (!els?.size) 
        continue; 

      for (const el of els)
        el.textContent = entry.displayCombo;
    }
  }

  _listen() {
    document.addEventListener('keydown', event => {
      const combo = this._eventToCombo(event);

      const entry =
        this._shortcuts.get(this._buildKey(this._context, combo)) ??
        this._shortcuts.get(this._buildKey('global',       combo));

      if (!entry?.action) 
        return;

      event.preventDefault();
      entry.action(event);
    });
  }

  _getEntryCombo(context, combo) {
    return this._shortcuts.get(this._buildKey(context ?? 'global', combo)) ?? null;
  }

  _getEntryName(context, name) {
    return Array.from(this._shortcuts.values()).find(
        e => e.name === name && e.context === (context ?? 'global'));
  }

  _buildKey(context, segment) {
    return `${context ?? 'global'}:${segment}`;
  }

  /**
   * Normalise to lowercase, modifiers sorted: ctrl → shift → alt → key.
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