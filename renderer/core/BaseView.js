import { capitalizeFirstLetter } from '@common/Common.js';
import { componentRegistry } from './ComponentRegistry.js';
import { componentLoader } from './ComponentLoader.js';
import { eventBus } from './EventBus.js';
import { translateTemplate } from './i18n/I18n.js';
import { CSS_SCOPE_ATTRIBUTE, scopeCss, addStyleSheet, addStyleSheetUrl } from './ScopedCss.js';

/** @type {Map<string, Promise<void>>} CSS key -> loading / loaded stylesheets of a view */
const _viewStyles = new Map();

export class BaseView {
  static viewId = null;

  /**
   * @param {HTMLElement} el      - the DOM element created by ViewManager
   * @param {Object}      props   - optional props from the switchTo() call
   */
  constructor(el, props = {}) {
    this.container = el;
    this.props = props;
    this._instanceIds = [];
    this._subscriptions = [];

    if (!this.constructor.viewId) {
      console.error(`[BaseView] viewId must be implemented by ${this.constructor.name}`);
    }
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
   * Subclasses implement this. happens after the html was injected
   * @param {ComponentLoader} componentLoader
   */
  async onLoad(componentLoader) {}

  /**
   * Cleanup - called by ViewManager before removing the view.
   * Subclasses can override onDestroy() for additional cleanup logic.
   */
  destroy() {
    this.onDestroy();
    this._subscriptions.forEach(unsub => unsub());
    this._instanceIds.forEach(id => componentLoader.destroy(id) );
    this._instanceIds = [];
    this._subscriptions = [];
  }

  /** Override for custom cleanup logic */
  onDestroy() {}

  // ─── Helpers for subclasses ───────────────────────────────────────────────

  /**
   * Gets a DOM element within this view by its id (elements outside the view, e.g. in a modal, as fallback).
   * The own container comes first: while the same view is built again (viewManager.show with force),
   * the outgoing one with the same ids is still in the DOM.
   * @param {string} id
   * @returns {HTMLElement|null}
   */
  element(id) {
    return this.container?.querySelector(`#${CSS.escape(id)}`) ?? document.getElementById(id);
  }

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
    return this.container.querySelector(`[data-slot="${name}"]`);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _buildBasePath(viewName) {
    return `views/${viewName}/${capitalizeFirstLetter(viewName)}View`;
  }

  /**
   * Must be implemented by subclasses - returns the base file path for this view.
   * e.g. EditorView -> 'views/editor/EditorView'
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

  /**
   * Loads the view CSS once: <Name>View.css scoped to the view container (@scope, ScopedCss.js),
   * <Name>View.global.css as it is. The container gets data-css-scope (the CSS key).
   */
  async _injectCSS() {
    // Registry-Key: '../views/editor/EditorView.css'
    const key = `../${this._viewPath()}.css`;
    this.container.setAttribute(CSS_SCOPE_ATTRIBUTE, key);

    if (!_viewStyles.has(key))
      _viewStyles.set(key, this._loadCSS(key));
    return _viewStyles.get(key);
  }

  async _loadCSS(key) {
    const loads = [];
    // both files are optional
    const importer = componentRegistry.viewsCss[key];
    if (importer)
      loads.push(importer().then(mod => addStyleSheet(scopeCss(mod.default ?? mod, key), `view-style-${this.constructor.name}`)));

    const globalImporter = componentRegistry.viewsGlobalCss[key.replace(/\.css$/, '.global.css')];
    if (globalImporter)
      loads.push(globalImporter().then(mod => addStyleSheetUrl(mod.default ?? mod)));

    await Promise.all(loads);
  }

  async _loadHTML() {
    // Registry-Key: '../views/editor/EditorView.html'
    const key = `../${this._viewPath()}.html`;
    const importer = componentRegistry.viewsHtml[key];

    if (!importer) {
      console.warn(`[BaseView] No HTML found for "${key}" - skipping.`);
      return;
    }

    const mod = await importer();
    this.container.innerHTML = translateTemplate(mod.default ?? mod);
  }
}