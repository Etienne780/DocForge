/**
 * Fixed-size pool of Web Workers for syntax highlighting.
 *
 * Keeps a small number of workers alive and reuses them for every task,
 * instead of spawning a new one each time. Tasks are queued (FIFO) and run
 * as soon as a worker is free.
 *
 * Each task streams back a 'css' message, a 'pre-render' message, and one
 * or more 'chunk' messages. A worker stays busy until its task reports
 * `done: true` or errors.
 *
 * Queued tasks can be cancelled by removing them from the queue. A running
 * task can only be cancelled by terminating its worker (JS inside a worker
 * can't be interrupted) — a fresh worker is spawned right away as a
 * replacement.
 */
export class SyntaxHighlightWorkerPool {

  /**
   * @param {number} [poolSize=3] - Number of workers to keep alive.
   */
  constructor(poolSize = 3) {
    this._poolSize = Math.max(1, poolSize);
    /** @type {Array<{ worker: Worker, busy: boolean, task: Object|null }>} */
    this._workers = [];
    /** @type {Object[]} FIFO queue of pending tasks */
    this._queue = [];
  }

  warmpUp() {
    this._ensureWorkers();
  }

  /**
   * Enqueues a highlight task. Runs immediately on a free worker, or waits
   * in the queue until one becomes available.
   * @param {Object} options
   * @param {Object} options.syntaxDefinition - Full syntax definition object.
   * @param {number} options.style - style.
   * @param {string} options.text - Source code.
   * @param {(chunk: Object) => void} options.onChunk - Callback for each message.
   * @returns {() => void} Cancel function for this specific task.
   */
  enqueue({ syntaxDefinition, style, text, onChunk }) {
    const task = { syntaxDefinition, style, text, onChunk, cancelled: false };
    this._queue.push(task);
    this._dispatch();

    return () => this._cancel(task);
  }

  /**
   * Terminates every worker and clears the queue. Any task still queued or
   * running will not receive further callbacks.
   */
  destroy() {
    this._queue.length = 0;
    for (const entry of this._workers) {
      entry.worker.terminate();
    }
    this._workers.length = 0;
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  _ensureWorkers() {
    while (this._workers.length < this._poolSize) {
      this._workers.push(this._createWorkerEntry());
    }
  }
  
  _createWorkerEntry() {
    const entry = { worker: null, busy: false, task: null, crashCount: 0 };
    entry.worker = this._spawnWorker(entry);
    return entry;
  }

  _spawnWorker(entry) {
    const worker = new Worker(
      new URL('./SyntaxHighlightWorker.js', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = e => this._handleMessage(entry, e);
    worker.onerror = () => this._handleError(entry);

    return worker;
  }

  _dispatch() {
    this._ensureWorkers();

    for (const entry of this._workers) {
      if (entry.busy)
        continue;

      const task = this._nextTask();
      if (!task)
        return;

      this._start(entry, task);
    }
  }

  _nextTask() {
    let task = this._queue.shift();
    // Skip tasks that were cancelled while still queued.
    while (task && task.cancelled)
      task = this._queue.shift();
    return task ?? null;
  }

  _start(entry, task) {
    entry.busy = true;
    entry.task = task;
    entry.worker.postMessage({
      syntaxDefinition: task.syntaxDefinition,
      style: task.style,
      text: task.text,
    });
  }

  _finish(entry) {
    entry.busy = false;
    entry.task = null;
    this._dispatch();
  }

  _handleMessage(entry, e) {
    const task = entry.task;
    if (!task)
      return;

    if (!task.cancelled) {
      task.onChunk?.({
        ok: e.data.ok,
        error: e.data.error,
        done: e.data.done, 
        type: e.data.type,           // 'css' | 'pre-render' | 'chunk'
        css: e.data.css,             // only when type === 'css'
        lineStart: e.data.lineStart, // only when type === 'chunk' 
        chunkSize: e.data.chunkSize,
        html: e.data.html,
        defId: task.syntaxDefinition.id,
        styleId: task.style?.id ?? null,
      });
    }

    if (e.data.done || !e.data.ok)
      this._finish(entry);
  }

  _handleError(entry) {
    const task = entry.task;
    if (task && !task.cancelled) {
      task.onChunk?.({
        ok: false,
        error: 'Syntax highlight worker crashed',
        done: true,
      });
    }

    entry.crashCount++;
    if (entry.crashCount > 3) {
      console.error('Worker crashes repeatedly, giving up on respawn.');
      entry.busy = false;
      entry.task = null;
      return;
    }

    entry.worker.terminate();
    entry.worker = this._spawnWorker(entry);
    this._finish(entry);
  }

  _cancel(task) {
    if (task.cancelled)
      return;
    task.cancelled = true;

    const queuedIndex = this._queue.indexOf(task);
    if (queuedIndex !== -1) {
      this._queue.splice(queuedIndex, 1);
      return;
    }

    const entry = this._workers.find(w => w.task === task);
    if (!entry)
      return;

    // Task is actively running inside this worker — the only way to stop
    // mid-computation is to terminate and replace the worker.
    entry.worker.terminate();
    entry.worker = this._spawnWorker(entry);
    this._finish(entry);
  }
}
