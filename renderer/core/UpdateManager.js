import { eventBus } from '@core/EventBus.js';
import { isPlatformWeb, isDevelopment } from '@core/Platform';
import { state } from '@core/State.js';

class UpdateManager {
  constructor() {
    this._status = 'idle'; // idle | checking | available | downloading | downloaded | error
    this._pendingInfo = null;
  }

  init() {
    if (isPlatformWeb() || isDevelopment())
      return;

    const u = window.electronAPI.updater;

    u.onChecking(() => this._set('checking'));
    u.onNotAvailable(() => this._set('idle'));

    u.onAvailable((info) => {
      this._pendingInfo = info;

      if (info.version && state.get('skippedUpdateVersion') === info.version) {
        this._set('idle');
        return;
      }

      this._set('available');
      eventBus.emit('show:modal:update', info);
    });

    u.onProgress((prog) => {
      this._set('downloading');
      eventBus.emit('updater:progress', Math.floor(prog.percent));
    });

    u.onDownloaded((info) => {
      this._set('downloaded');
      eventBus.emit('updater:ready', info);
    });

    u.onError((err) => {
      const msg = err?.message || '';
      if (
        msg.includes('Unable to find latest version') ||
        msg.includes('Cannot find latest.yml') ||
        msg.includes('404')
      ) {
        this._set('idle');
        return;
      }
      this._set('error');
      console.error('[UpdateManager]', err.message);
    });
  }

  checkForUpdates() {
    window.electronAPI?.updater?.checkForUpdates();
  }

  requestDownload() {
    if (!this._pendingInfo?.isCompatible) 
      return;
    if (this._status === 'downloaded') {
      this.installNow();
      return;
    }
    window.electronAPI?.updater?.downloadUpdate();
  }

  installNow() {
    window.electronAPI?.updater?.installNow();
  }

  skipVersion() {
    if (this._pendingInfo?.version) {
      state.set('skippedUpdateVersion', this._pendingInfo.version);
    }
    this._pendingInfo = null;
    this._set('idle');
  }

  get status() {
    return this._status;
  }

  get pendingInfo() {
    return this._pendingInfo;
  }

  _set(status) {
    this._status = status;
    eventBus.emit('updater:status', status);
  }
}

export const updateManager = new UpdateManager();