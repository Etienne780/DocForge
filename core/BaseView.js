export class BaseView {
  /**
   * @param {HTMLElement} el      - the DOM element created by ViewManager
   * @param {Object}      props   - optional props from the switchTo() call
   */
  constructor(el, props = {}) {
    this.el = el;
    this.props = props;
    this._instanceIds = [];
    this._subscriptions = [];
  }

  /**
   * Called by ViewManager. Loads HTML, CSS, then mount().
   * Subclasses override mount() - not initialize().
   */
  async initialize(componentLoader) {
    await this._injectCSS();
    await this._loadHTML();
    await this.mount(componentLoader);
  }

  /**
   * Subclasses implement this: load components, set up listeners, etc.
   * @param {ComponentLoader} componentLoader
   */
  async mount(componentLoader) {}

  /**
   * Cleanup - called by ViewManager before removing the view.
   * Subclasses can override onDestroy() for additional cleanup logic.
   */
  destroy() {
    this._instanceIds.forEach(id => componentLoader.destroy(id));
    this._subscriptions.forEach(unsub => unsub());
    this._instanceIds = [];
    this._subscriptions = [];
    this.onDestroy();
  }

  /** Override for custom cleanup logic */
  onDestroy() {}

  // ─── Helpers for subclasses ───────────────────────────────────────────────

  /**
   * Like Component.subscribe() - automatically unsubscribed on destroy().
   * @param {string}   event
   * @param {Function} handler
   */
  subscribe(event, handler) {
    const unsub = eventBus.on(event, handler);
    this._subscriptions.push(unsub);
    return unsub;
  }

  /**
   * Finds a slot element within this view.
   * Equivalent to this.element() / this.query() from Component.
   */
  slot(name) {
    return this.el.querySelector(`[data-slot="${name}"]`);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Must be implemented by subclasses - returns the base file path for this view.
   * e.g. EditorView → 'views/editor/EditorView'
   * JS has no reliable way to derive the file path from a class name at runtime.
   */
  _viewPath() {
    throw new Error(`[BaseView] _viewPath() must be implemented by ${this.constructor.name}`);
  }

  _getViewPath() {
    const parts = this._viewPath().split('/');
    parts.pop();
    return parts.join('/');
  }

  async _injectCSS() {
    const path = this._viewPath();
    const cssPath = `${path}.css`;

    // Only inject once per view type
    const styleId = `view-style-${this.constructor.name}`;
    if (document.getElementById(styleId)) return;

    return new Promise(resolve => {
      const link = document.createElement('link');
      link.id = styleId;
      link.rel = 'stylesheet';
      link.href = cssPath;
      link.onload = resolve;
      link.onerror = () => {
        console.warn(`[BaseView] No CSS found at "${cssPath}" - continuing.`);
        resolve();
      };
      document.head.appendChild(link);
    });
  }

  async _loadHTML() {
    const path = this._viewPath();
    const response = await fetch(`${path}.html`);

    if (!response.ok) {
      // HTML is optional - some views build their markup entirely in mount()
      console.warn(`[BaseView] No HTML found at "${path}.html" - skipping.`);
      return;
    }

    this.el.innerHTML = await response.text();
  }
}