import { HIGHLIGHTER_WORKER_POOL_SIZE } from '@common/Common.js';

/**
 * Fixed-size pool of long-lived Web Workers that perform syntax highlighting.
 *
 * ─── Why ──────────────────────────────────────────────────────────────────────
 * Spawning a `new Worker(...)` per code block is expensive (module fetch +
 * compile + thread startup) and pointless for small snippets — most of the
 * highlighting time was worker startup, not actual lexing. This pool creates
 * a small, fixed number of workers up front (see HIGHLIGHTER_WORKER_POOL_SIZE
 * in Common.js) and reuses them for every highlight task. Tasks that arrive
 * while all workers are busy are queued (FIFO) and dispatched as soon as a
 * worker frees up.
 *
 * ─── Task Lifecycle ───────────────────────────────────────────────────────────
 * Each task streams multiple messages back (a 'css' message, a 'pre-render'
 * message, then one or more 'chunk' messages), exactly like the previous
 * one-worker-per-task design. A worker is considered "busy" for the whole
 * streamed task and only picks up its next queued task once the current one
 * reports `done: true` (or an error).
 *
 * ─── Cancellation ─────────────────────────────────────────────────────────────
 * - A queued (not yet started) task is simply removed from the queue.
 * - A task that is already running inside a worker can only be cancelled by
 *   terminating that worker (JS running inside it can't be interrupted
 *   otherwise). The pool transparently replaces a terminated worker so the
 *   pool size stays constant.
 */
export class SyntaxHighlightWorkerPool {

  /**
   * @param {number} [poolSize=HIGHLIGHTER_WORKER_POOL_SIZE] - Number of workers to keep alive.
   */
  constructor(poolSize = HIGHLIGHTER_WORKER_POOL_SIZE) {
    this._poolSize = Math.max(1, poolSize);
    /** @type {Array<{ worker: Worker, busy: boolean, task: Object|null }>} */
    this._workers = [];
    /** @type {Object[]} FIFO queue of pending tasks */
    this._queue = [];
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
    const entry = { worker: null, busy: false, task: null };
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

    // The worker may be in a broken state after an uncaught error — replace it.
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
