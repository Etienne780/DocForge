import { eventBus } from './EventBus.js';

const DEFAULT_SESSION = {
    editorSidbarCollpased: false,
};

class SessionStateManager {
  constructor() {
    this._state = { ...DEFAULT_SESSION };
  }

  get(key) {
    return this._state[key] ?? DEFAULT_SESSION[key];
  }

  set(key, value) {
    const previousValue = this._state[key];
    this._state[key] = value;
    eventBus.emit('session:change', { key, value, previousValue });
    eventBus.emit(`session:change:${key}`, { value, previousValue });
  }

  reset() {
    this._state = { ...DEFAULT_SESSION };
  }
}

export const session = new SessionStateManager();