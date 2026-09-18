import chokidar from 'chokidar';
import { EventEmitter } from 'events';

/**
 * @class FileWatcher
 * @brief Watches files and directories for changes.
 *
 * Emits: add, change, unlink, addDir, unlinkDir, error.
 */
class FileWatcher extends EventEmitter {
  /**
   * @brief Creates a new file watcher.
   * @param {string} watchPath Path to watch.
   * @param {object} options Chokidar options.
   */
  constructor(watchPath, options = {}) {
    super();

    const { extraIgnores, extensions, ...restOptions } = options;

    this.watchPath = watchPath;
    this.watcher = null;
    this.extensions = extensions || null; // ['.md'] or null

    this.options = {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      },
      ignored: [
        /(^|[\/\\])\../,
        ...(extraIgnores
          ? (Array.isArray(extraIgnores) ? extraIgnores : [extraIgnores])
          : [])
      ],
      ...restOptions,
    };
  }

  _matchesExtension(filePath) {
    if (!this.extensions)
      return true; // no filter set
    return this.extensions.some(ext => filePath.toLowerCase().endsWith(ext.toLowerCase()));
  }

  /**
   * @brief Returns how long (in ms) chokidar may delay a 'change'/'add' event
   *        after the underlying write due to awaitWriteFinish, based on the
   *        options this watcher was configured with.
   * @returns {number} 0 if awaitWriteFinish is disabled, otherwise
   *          stabilityThreshold + pollInterval (chokidar's own defaults are
   *          used for any field left unset when awaitWriteFinish is `true`).
   */
  getAwaitWriteFinishDelay() {
    const awf = this.options.awaitWriteFinish;

    if (!awf)
      return 0;

    // chokidar accepts `awaitWriteFinish: true`, in which case it applies
    // its own internal defaults (stabilityThreshold: 2000, pollInterval: 100).
    const stabilityThreshold = (awf === true ? undefined : awf.stabilityThreshold) ?? 2000;
    const pollInterval = (awf === true ? undefined : awf.pollInterval) ?? 100;

    return stabilityThreshold + pollInterval;
  }

  /**
   * @brief Starts watching the configured path.
   */
  start() {
    if (this.watcher)
      return;

    this.watcher = chokidar.watch(this.watchPath, this.options);

    const emitIfMatch = (eventType) => (filePath) => {
      if (!this._matchesExtension(filePath))
        return;
      this.emit(eventType, filePath);
    };
  
    this.watcher
      .on('add', emitIfMatch('add'))
      .on('change', emitIfMatch('change'))
      .on('unlink', emitIfMatch('unlink'))
      .on('addDir', (path) => this.emit('addDir', path))
      .on('unlinkDir', (path) => this.emit('unlinkDir', path))
      .on('error', (error) => this.emit('error', error));
  }

  /**
   * @brief Stops watching the configured path.
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}

export default FileWatcher;