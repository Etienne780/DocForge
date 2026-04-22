import { eventBus } from '@core/EventBus.js';

class UpdateManager {
    constructor() {
      this._status = 'idle'; // idle | checking | available | downloading | downloaded | error
  }

  init() {
    if (!window.electronAPI?.updater) 
        return;

    const u = window.electronAPI.updater;

    u.onChecking(() => this._set('checking'));
    u.onNotAvailable(() => this._set('idle'));
    u.onAvailable(() => this._set('available'));  // autoDownload handles the rest
    u.onProgress((prog)  => {
      this._set('downloading');
      eventBus.emit('updater:progress', Math.floor(prog.percent));
    });

    u.onDownloaded((info) => {
      this._set('downloaded');
      eventBus.emit('show:modal:update', info);
    });

    u.onError((err) => {
      this._set('error');
      console.error('[UpdateManager]', err.message);
    });
  }

  checkForUpdates() {
    window.electronAPI?.updater?.checkForUpdates();
  }

  installNow() {
    window.electronAPI?.updater?.installNow();
  }

  get status() { 
    return this._status; 
  }

  _set(status) {
    this._status = status;
    eventBus.emit('updater:status', status);
  }
}

export const updateManager = new UpdateManager();