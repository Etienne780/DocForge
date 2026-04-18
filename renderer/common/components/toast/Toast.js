import { Component } from '@core/Component.js';

const DEFAULT_TOAST_SHOWTIME = 2400;
const TOAST_ICONS = { success: '✓', error: '✕', info: 'ℹ' };

/**
 * Toast - transient notification banner.
 *
 * Listens for the 'toast:show' EventBus event:
 *   eventBus.emit('toast:show', { message: 'Saved!', type: 'success' });
 *   eventBus.emit('toast:show', { message: 'Info!', type: 'info' });
 *   eventBus.emit('toast:show', { message: 'Error!', type: 'error' });
 *   eventBus.emit('toast:show', { message: 'Warning!', type: 'warning' });
 *
 * The toast appears for 2.4 seconds, then fades out.
 * Consecutive calls reset the timer so the toast stays visible.
 */
export default class Toast extends Component {

  onLoad() {
    // key: `${type}:${message}` → { element, timerId }
    this._active = new Map();

    this.subscribe('toast:show', ({ message, type = 'success', durationMS = DEFAULT_TOAST_SHOWTIME }) => {
      this._show(message, type, durationMS);
    });
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _show(message, type, durationMS) {
    const key = `${type}:${message}`;

    if (this._active.has(key)) {
      const { element, timerId } = this._active.get(key);
      clearTimeout(timerId);

      element.classList.remove('toast--visible');
      void element.offsetWidth;
      element.classList.add('toast--visible');
      this._active.set(key, { element, timerId: this._scheduleRemove(key, element, durationMS) });
      return;
    }
    
    if(type === 'error')
      console.error(message);

    if(type === 'warning')
      console.warn(message);

    // New toast -> create and append
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.innerHTML = `
      <span class="toast__icon">${TOAST_ICONS[type] ?? 'ℹ'}</span>
      <span class="toast__message">${message}</span>
    `;

    this.element('toast-container').appendChild(el);

    // Trigger transition
    void el.offsetWidth;
    el.classList.add('toast--visible');

    this._active.set(key, { element: el, timerId: this._scheduleRemove(key, el, durationMS) });
  }

  _scheduleRemove(key, element, durationMS) {
    return setTimeout(() => {
      element.classList.remove('toast--visible');
      element.addEventListener('transitionend', () => {
        element.remove();
        this._active.delete(key);
      }, { once: true });
    }, durationMS);
  }
}
