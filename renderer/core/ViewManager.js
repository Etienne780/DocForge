import { eventBus } from './EventBus.js';
import { componentLoader } from './ComponentLoader.js';
import { BaseView } from './BaseView.js';
import { session } from './SessionState.js';

const VIEW_ROUTES = {
  'navigate:docEditor':       () => import('../views/docEditor/DocEditorView.js').then(m => m.DocEditorView),
  'navigate:projectManager':  () => import('../views/projectManager/ProjectManagerView.js').then(m => m.ProjectManagerView),
  'navigate:themeEditor':     () => import('../views/themeEditor/ThemeEditorView.js').then(m => m.ThemeEditorView),
  'navigate:themeManager':     () => import('../views/themeManager/ThemeManagerView.js').then(m => m.ThemeManagerView)
};

const VIEW_FADE_DURATION = '220ms';
const VIEW_FADE_EASING = 'ease-in-out';

class ViewManager {
  constructor() {
    this._current = null;
    this._container = null;
    this._transitioning = false;
    // Only ever one item deep — last call wins, intermediates are dropped
    this._pending = null; // { ViewClass, props }
  }

  init(container) {
    this._currentViewClass = null;
    this._container = container;
    this._registerViewRoutes();
  }

  /**
   * @brief Requests a transition to the given view.
   *
   * Acts as the public entry point and concurrency gate. If no transition is
   * currently running, the view is rendered immediately via _run. If a
   * transition is already in progress, the request is stored as the pending
   * view, overwriting any previously queued one and executed automatically
   * once the active transition finishes (last-wins queue).
   *
   * @param {typeof BaseView} ViewClass  View class to instantiate; must extend BaseView.
   * @param {Object}          [props={}] Props forwarded to the view constructor.
   *
   * @throws {Error} If ViewClass does not extend BaseView.
   *
   * @see _run
   */
  switchTo(ViewClass, props = {}) {
    if (!(ViewClass.prototype instanceof BaseView)) {
      throw new Error(`[ViewManager] ViewClass must extend BaseView, got: ${ViewClass.name}`);
    }

    if(this._currentViewClass === ViewClass.name)
      return;

    this._currentViewClass = ViewClass.name;
    if (this._transitioning) {
      // Overwrite whatever was waiting — we only care about the final destination
      this._pending = { ViewClass, props };
      return;
    }

    this._run(ViewClass, props);
  }

  /**
   * @brief Executes a full crossfade transition to the given view.
   *
   * Internal implementation called exclusively by switchTo. Mounts the
   * incoming view while the outgoing one is still visible, then fades both
   * simultaneously. Resolves only after the outgoing element has been removed
   * from the DOM, so the transitioning flag stays set for the full duration and
   * prevents overlapping transitions.
   *
   * Transition behaviour:
   * - **With outgoing view** — both elements crossfade over VIEW_FADE_DURATION.
   *   A transitionend listener triggers cleanup; a setTimeout fires
   *   100 ms later as a fallback in case the event is suppressed (e.g. hidden tab).
   *   A cleaned guard ensures cleanup runs exactly once regardless of which
   *   path fires first.
   * - **First view** — incoming element fades in over 180 ms; no outgoing element.
   *
   * After the transition completes, session is updated and _pending is
   * drained: if switchTo was called during the transition, _run is
   * invoked immediately with the latest queued request.
   *
   * @param {typeof BaseView} ViewClass  View class to instantiate.
   * @param {Object}          props      Props forwarded to the view constructor.
   *
   * @returns {Promise<void>} Resolves once the outgoing view has been destroyed
   *                          and the incoming view is fully visible.
   *
   * @see switchTo
   */
  async _run(ViewClass, props) {
    this._transitioning = true;

    const durationMs = parseFloat(VIEW_FADE_DURATION) * 1000;

    const incomingEl = document.createElement('div');
    incomingEl.className = 'view';
    incomingEl.style.opacity = '0';
    this._container.appendChild(incomingEl);

    const incoming = new ViewClass(incomingEl, props);
    await incoming.initialize(componentLoader);

    await new Promise(resolve => {
      if (this._current) {
        const outgoing   = { ...this._current };
        const outgoingEl = outgoing.el;

        outgoingEl.style.transition = `opacity ${VIEW_FADE_DURATION} ${VIEW_FADE_EASING}`;
        incomingEl.style.transition = `opacity ${VIEW_FADE_DURATION} ${VIEW_FADE_EASING}`;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            outgoingEl.style.opacity = '0';
            incomingEl.style.opacity  = '1';
          });
        });

        let cleaned = false;
        const cleanup = () => {
          if (cleaned) 
            return;
          cleaned = true;
          outgoing.instance.destroy();
          outgoingEl.remove();
          resolve();
        };

        outgoingEl.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(cleanup, durationMs + 100);

      } else {
        incomingEl.style.transition = `opacity 180ms ${VIEW_FADE_EASING}`;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            incomingEl.style.opacity = '1';
          });
        });
        setTimeout(resolve, 180 + 100);
      }
    });

    session.set('activeView', ViewClass.name);
    this._current = { instance: incoming, el: incomingEl };
    this._transitioning = false;

    // If something was queued while, run it now
    if (this._pending) {
      const { ViewClass: nextClass, props: nextProps } = this._pending;
      this._pending = null;
      this._run(nextClass, nextProps);
    }
  }

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