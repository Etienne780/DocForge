import FileWatcher from './FileWatcher.js';
import path from 'path';

class ProjectWatcherManager {
  constructor() {
    this._watchers = new Map();     // projectId -> FileWatcher
    this._ignoreOnce = new Map();   // "projectId::path" -> timeoutId (fallback)
    this._ignoreTrees = new Map();  // projectId -> Map<normalizedPath, releaseTimeoutId|null>
  }

  // Extra buffer on top of the watcher's own awaitWriteFinish delay, to
  // absorb OS/disk scheduling jitter (chokidar's stability polling isn't
  // perfectly precise, especially on Windows).
  static RELEASE_GRACE_BUFFER_MS = 200;

  watchProject({ projectId, projectPath, onChangeCallback, onErrorCallback = null }) {
    if (!projectId || !projectPath || !onChangeCallback) {
      console.error(
        '[Electron][ProjectWatcherManager] watchProject: missing params',
        { projectId, projectPath, hasOnChangeCallback: !!onChangeCallback }
      );
      return;
    }

    if (this._watchers.has(projectId))
      return;

    const watcher = new FileWatcher(projectPath, { extensions: ['.md'] });

    const handleEvent = (eventType) => (filePath) => {
      const normalized = path.resolve(filePath);

      if (this._consumeIgnoreOnce(projectId, normalized))
        return;

      if (this._isInIgnoredTree(projectId, normalized))
        return;

      onChangeCallback({ eventType, filePath, projectId });
    };

    watcher.on('change', handleEvent('change'));
    watcher.on('add', handleEvent('add'));
    watcher.on('unlink', handleEvent('unlink'));
    watcher.on('error', (err) => onErrorCallback?.({ projectId, error: err }));

    try {
      watcher.start();
      this._watchers.set(projectId, watcher);
    } catch (err) {
      if (!onErrorCallback)
        console.error(`[Electron][ProjectWatcherManager] watchProject: failed to watch project '${projectId}':`, err);
      onErrorCallback?.({ projectId, error: err });
    }
  }

  async unwatchProject(projectId) {
    const watcher = this._watchers.get(projectId);
    if (watcher) {
      await watcher.stop();
      this._watchers.delete(projectId);
    }

    for (const [key, timeoutId] of this._ignoreOnce) {
      if (key.startsWith(`${projectId}::`)) {
        clearTimeout(timeoutId);
        this._ignoreOnce.delete(key);
      }
    }

    const trees = this._ignoreTrees.get(projectId);
    if (trees) {
      for (const releaseTimeoutId of trees.values()) {
        if (releaseTimeoutId)
          clearTimeout(releaseTimeoutId);
      }
      this._ignoreTrees.delete(projectId);
    }
  }

  async unwatchAll() {
    for (const [projectId] of this._watchers) {
      await this.unwatchProject(projectId);
    }
  }

  isWatching(projectId) {
    return this._watchers.has(projectId);
  }

  getWatchedProjects() {
    return Array.from(this._watchers.keys());
  }

  ignoreNextChange(projectId, filePath, durationMs = 2000) {
    if (!this._watchers.has(projectId))
      return;

    const normalized = path.resolve(filePath);
    const key = this._ignoreKey(projectId, normalized);

    const existing = this._ignoreOnce.get(key);
    if (existing)
      clearTimeout(existing);

    const timeoutId = setTimeout(() => this._ignoreOnce.delete(key), durationMs);
    this._ignoreOnce.set(key, timeoutId);
  }

  _consumeIgnoreOnce(projectId, normalizedPath) {
    const key = this._ignoreKey(projectId, normalizedPath);
    const timeoutId = this._ignoreOnce.get(key);
    if (timeoutId === undefined)
      return false;

    clearTimeout(timeoutId);
    this._ignoreOnce.delete(key);
    return true;
  }

  ignorePathTree(projectId, directoryPath) {
    if (!this._watchers.has(projectId))
      return;

    const normalized = path.resolve(directoryPath);

    if (!this._ignoreTrees.has(projectId))
      this._ignoreTrees.set(projectId, new Map());

    const trees = this._ignoreTrees.get(projectId);

    // If a delayed release is currently pending for this same path, cancel it -
    // we're back in the "actively ignored" state.
    const pendingRelease = trees.get(normalized);
    if (pendingRelease)
      clearTimeout(pendingRelease);

    trees.set(normalized, null); // null = active, no release scheduled
  }

  /**
   * Doesn't remove the ignore entry immediately, but only after a grace
   * period derived from the watcher's own awaitWriteFinish config. Necessary
   * because chokidar fires the change event well after the actual fs write
   * completes.
   */
  releasePathTree(projectId, directoryPath) {
    const normalized = path.resolve(directoryPath);
    const trees = this._ignoreTrees.get(projectId);
    if (!trees || !trees.has(normalized))
      return;

    const existingTimeout = trees.get(normalized);
    if (existingTimeout)
      clearTimeout(existingTimeout);

    const watcher = this._watchers.get(projectId);
    const graceMs = (watcher?.getAwaitWriteFinishDelay() ?? 0) + ProjectWatcherManager.RELEASE_GRACE_BUFFER_MS;

    const timeoutId = setTimeout(() => {
      trees.delete(normalized);
      if (trees.size === 0)
        this._ignoreTrees.delete(projectId);
    }, graceMs);

    trees.set(normalized, timeoutId);
  }

  isPathIgnored(projectId, directoryPath) {
    return this._isInIgnoredTree(projectId, path.resolve(directoryPath));
  }

  _isInIgnoredTree(projectId, normalizedPath) {
    const trees = this._ignoreTrees.get(projectId);
    if (!trees)
      return false;

    for (const ignoredPath of trees.keys()) {
      if (
        normalizedPath === ignoredPath ||
        normalizedPath.startsWith(`${ignoredPath}${path.sep}`)
      ) {
        return true;
      }
    }
    return false;
  }

  _ignoreKey(projectId, normalizedPath) {
    return `${projectId}::${normalizedPath}`;
  }
}

export default new ProjectWatcherManager();