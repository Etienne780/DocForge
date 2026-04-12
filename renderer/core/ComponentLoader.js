import { componentRegistry } from "./ComponentRegistry";

/**
 * ComponentLoader - loads components from the /components directory at runtime.
 *
 * Each component lives in: components/<Name>/<Name>.js | .html | .css
 *
 * ─── Template Syntax (in .html files) ────────────────────────────────────────
 *   {{id:localName}}  → replaced with "<instanceId>__<localName>"
 *   {{instanceId}}    → replaced with the full instance ID string
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *   import { componentLoader } from './core/ComponentLoader.js';
 *
 *   // Load into a container element:
 *   const instance = await componentLoader.load('TopBar', document.getElementById('topbar-slot'));
 *
 *   // Load with props:
 *   const modal = await componentLoader.load('Modal', container, { title: 'Rename' });
 *
 *   // Destroy an instance:
 *   componentLoader.destroy('topbar-1');
 *
 * ─── Multiple Instances ───────────────────────────────────────────────────────
 *   Two calls to load('Modal', ...) produce instances with IDs "modal-1" and "modal-2".
 *   All element IDs inside each instance are prefixed accordingly - no conflicts.
 *
 * ─── Requirements ─────────────────────────────────────────────────────────────
 *   Must be served via HTTP (not file://) due to fetch() and dynamic import().
 *   Component JS files must export a default class extending Component.
 */
export class ComponentLoader {
  constructor() {
    /** @type {Set<string>} Component names whose CSS has been injected */
    this._loadedStyles = new Set();

    /** @type {Object<string, number>} Instance counters per component name */
    this._instanceCounters = {};

    /** @type {Map<string, Component>} Live component instances by instanceId */
    this._instances = new Map();
  }

  /**
   * Load a component into a container element.
   * Injects CSS once, fetches HTML, processes template IDs, imports JS, calls onLoad().
   *
   * @param {string} componentName - e.g. short path 'TopBar' (searches in comman) or full path 'views/editor/components/TopBar/TopBar'
   * @param {HTMLElement} container - Element to render into
   * @param {Object} [props] - Optional props passed to the component constructor
   * @returns {Promise<Component>}
   */
  async load(componentName, container, props = {}) {
    if (!(container instanceof HTMLElement)) {
      throw new Error(`[ComponentLoader] "container" must be an HTMLElement (got ${typeof container}).`);
    }

    const existingInstanceId = container.dataset.instanceId;
    if (existingInstanceId) {
      this.destroy(existingInstanceId);
    }

    await this._injectCSS(componentName);

    const templateHTML = await this._fetchHTML(componentName);
    const instanceId = this._createInstanceId(componentName);
    const processedHTML = this._processTemplate(templateHTML, instanceId);

    container.innerHTML = processedHTML;
    container.dataset.componentName = componentName;
    container.dataset.instanceId = instanceId;

    const ComponentClass = await this._importJS(componentName);
    const instance = new ComponentClass(instanceId, container, props);

    this._instances.set(instanceId, instance);
    instance.onLoad();

    return instance;
  }

  /**
   * Destroy a component instance: calls onDestroy(), clears container, removes from registry.
   * @param {string} instanceId - e.g. 'topbar-1'
   */
  destroy(instanceId) {
    const instance = this._instances.get(instanceId);
    if (!instance) {
      console.warn(`[ComponentLoader] No instance found for ID "${instanceId}".`);
      return;
    }
    instance.destroy();
    instance.container.innerHTML = '';
    delete instance.container.dataset.componentName;
    delete instance.container.dataset.instanceId;
    this._instances.delete(instanceId);
  }

  /**
   * Get a live component instance by its ID.
   * @param {string} instanceId
   * @returns {Component|null}
   */
  getInstance(instanceId) {
    return this._instances.get(instanceId) ?? null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Generates a new unique instance ID for a component type.
   * e.g. first TopBar -> "topbar-1", second -> "topbar-2"
   */
  _createInstanceId(componentPath) {
    const { name } = this._resolvePaths(componentPath);
    const key = name.toLowerCase();
    this._instanceCounters[key] = (this._instanceCounters[key] ?? 0) + 1;
    return `${key}-${this._instanceCounters[key]}`;
  }

  /**
   * Processes the HTML template, replacing ID placeholders with instance-prefixed IDs.
   *   {{id:search-input}}  →  "topbar-1__search-input"
   *   {{instanceId}}       →  "topbar-1"
   */
  _processTemplate(html, instanceId) {
    return html
      .replace(/\{\{id:([^}]+)\}\}/g, (_, localName) => `${instanceId}__${localName.trim()}`)
      .replace(/\{\{instanceId\}\}/g, instanceId);
  }

  /** Injects component CSS into <head> once per component type. */
  async _injectCSS(componentPath) {
    const { css, isView } = this._resolvePaths(componentPath);
    const registry = isView ? componentRegistry.viewsCss : componentRegistry.css;

    const importer = registry[css];
    if (!importer) {
      console.warn(`[ComponentLoader] No CSS for "${componentPath}"`);
      return;
    }

    if (!this._loadedStyles.has(css)) {
      const mod = await importer();
      const cssUrl = mod.default ?? mod;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssUrl;
      document.head.appendChild(link);
      this._loadedStyles.add(css);
    }
  }

  /** Fetches the HTML template for a component. */
  async _fetchHTML(componentPath) {
    const { html, isView } = this._resolvePaths(componentPath);
    const registry = isView ? componentRegistry.viewsHtml : componentRegistry.html;

    const importer  = registry[html];
    if (!importer) {
      throw new Error(`[ComponentLoader] HTML not found for "${componentPath}"`);
    }

    const mod = await importer();
    return mod.default ?? mod;
  }

  /** Dynamically imports the JS module and returns the default export (the class). */
  async _importJS(componentPath) {
    const { js, isView } = this._resolvePaths(componentPath);
    const registry = isView ? componentRegistry.viewsJs : componentRegistry.js;

    const importer  = registry[js];
    if (!importer) {
      throw new Error(`[ComponentLoader] JS not found or invalid for "${componentPath}"`);
    }

    const mod = await importer();
    if (typeof mod.default !== 'function') 
      throw new Error(`[ComponentLoader] No default export for "${componentPath}"`);
    return mod.default;
  }

  _resolvePaths(componentPath) {
    if (componentPath.includes('/')) {
      // Full path: 'views/editor/components/TopBar/TopBar'
      const parts = componentPath.split('/');
      const name = parts[parts.length - 1]; // 'TopBar'
      return {
        isView: true,
        css:  `../${componentPath}.css`,
        html: `../${componentPath}.html`,
        js:   `../${componentPath}.js`,  // relativ to /core/
        key:  componentPath,             // unique CSS-Cache-Key
        name: name,                      // instanceId: 'topbar-1'
      };
    }

    // Short path: 'Toast' search component in common
    const lowerComp = componentPath.charAt(0).toLowerCase() + componentPath.slice(1);
    return {
      isView: false,
      css:  `../common/components/${lowerComp}/${componentPath}.css`,
      html: `../common/components/${lowerComp}/${componentPath}.html`,
      js:   `../common/components/${lowerComp}/${componentPath}.js`,
      key:  componentPath,
      name: componentPath,
    };
  }
}

/** Singleton ComponentLoader instance. */
export const componentLoader = new ComponentLoader();
