import { eventBus }    from './EventBus.js';
import { componentLoader } from './ComponentLoader.js';
import { BaseView }        from './BaseView.js';
import { session } from './SessionState.js';

/** Maps event names to their view module paths for lazy loading. */
const VIEW_ROUTES = {
  'navigate:editor':          () => import('../views/editor/EditorView.js').then(m => m.EditorView),
  'navigate:projectManager':  () => import('../views/projectManager/ProjectManagerView.js').then(m => m.ProjectManagerView),
  'navigate:themeEditor':  () => import('../views/themeEditor/ThemeEditorView.js').then(m => m.ThemeEditorView),
};

const VIEW_FADE_DURATION = '220ms';

/**
 * ViewManager - manages full-screen views and crossfade transitions between them.
 *
 * Usage:
 *   viewManager.init(document.getElementById('app'));
 *   await viewManager.switchTo(EditorView);
 *   await viewManager.switchTo(ProjectManagerView, { someProps });
 */
class ViewManager {
  constructor() {
    this._current = null;
    // The container both views live in during a crossfade
    this._container = null;
  }

  /**
   * Must be called once before any switchTo() calls.
   * @param {HTMLElement} container - typically document.getElementById('app')
   */
  init(container) {
    this._container = container;
    this._registerViewRoutes();
  }

  /**
   * Switches to a new view with a crossfade transition.
   * The incoming view is mounted while the outgoing view is still visible,
   * then both opacity transitions run simultaneously.
   *
   * @param {typeof BaseView} ViewClass - the view class to instantiate
   * @param {Object}          props     - optional props forwarded to the view constructor
   */
  async switchTo(ViewClass, props = {}) {
    if (!(ViewClass.prototype instanceof BaseView)) {
      throw new Error(`[ViewManager] ViewClass must extend BaseView, got: ${ViewClass.name}`);
    }

    // Create the incoming view element and hide it before mounting
    const incomingEl = document.createElement('div');
    incomingEl.className = 'view';
    incomingEl.style.opacity = '0';
    this._container.appendChild(incomingEl);

    // Mount the new view while the current one is still visible
    const incoming = new ViewClass(incomingEl, props);
    await incoming.initialize(componentLoader);

    if (this._current) {
      const outgoingEl = this._current.el;

      // Fade both views simultaneously
      outgoingEl.style.transition = `opacity ${VIEW_FADE_DURATION} ease`;
      incomingEl.style.transition = `opacity ${VIEW_FADE_DURATION} ease`;

      outgoingEl.style.opacity = '0';
      incomingEl.style.opacity = '1';

      // Destroy and remove the old view once its fade-out finishes
      outgoingEl.addEventListener('transitionend', () => {
        this._current.instance.destroy();
        outgoingEl.remove();
      }, { once: true });
    } else {
      // waits before the fading starts
      incomingEl.style.transition = 'opacity 180ms ease';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          incomingEl.style.opacity = '1';
        });
      });
    }

    session.set('activeView', ViewClass.name);
    this._current = { instance: incoming, el: incomingEl };
  }

  /**
   * Registers all view navigation events on the event bus.
   * Views are loaded lazily — the module is only imported on first navigation.
   * Call once during bootstrap, after viewManager.init().
   */
  _registerViewRoutes() {
    for (const [event, loadView] of Object.entries(VIEW_ROUTES)) {
      eventBus.on(event, async (props = {}) => {
        const ViewClass = await loadView();
        viewManager.switchTo(ViewClass, props);
      });
    }
  }
}

export const viewManager = new ViewManager();