import { Component } from '../../core/Component.js';

/**
 * Toast — transient notification banner.
 *
 * Listens for the 'toast:show' EventBus event:
 *   eventBus.emit('toast:show', { message: 'Saved!', type: 'success' });
 *   eventBus.emit('toast:show', { message: 'Error!', type: 'error' });
 *
 * The toast appears for 2.4 seconds, then fades out.
 * Consecutive calls reset the timer so the toast stays visible.
 */
export default class Toast extends Component {

  onLoad() {
    this._dismissTimer = null;

    this.subscribe('toast:show', ({ message, type = 'success' }) => {
      this._show(message, type);
    });
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _show(message, type) {
    const toast   = this.element('toast');
    const iconEl  = this.element('toast-icon');
    const msgEl   = this.element('toast-message');

    iconEl.textContent  = type === 'success' ? '✓' : '✕';
    msgEl.textContent   = message;

    toast.className = `toast toast--${type}`;

    // Trigger reflow so the transition re-fires if already showing
    void toast.offsetWidth;
    toast.classList.add('toast--visible');

    clearTimeout(this._dismissTimer);
    this._dismissTimer = setTimeout(() => {
      toast.classList.remove('toast--visible');
    }, 2400);
  }
}
