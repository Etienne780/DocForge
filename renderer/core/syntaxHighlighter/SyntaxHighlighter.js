import { blobManager } from '@core/BlobManager.js';
import {
  findSyntaxDefinition,
  findSyntaxDefinitionByName,
  findRootSyntaxState,
  highlightStyleIdToIndex,
} from '@data/SyntaxDefinitionManager.js';
import { debounce } from '@common/Common.js';
import { SyntaxHighlightWorkerPool } from './SyntaxHighlightWorkerPool.js';

const BLOB_SECTION = 'syntax-definition-css';

/**
 * Performs syntax highlighting of source code via a Web Worker and manages
 * the globally cached/registered CSS stylesheets that go along with it.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *   syntaxHighlighter.highlightTextAsHTML({ langId, styleId, text });
 *   syntaxHighlighter.highlightTextToElement({ outputElement, langId, styleId, text });
 *   syntaxHighlighter.cleanLanguageStyle(langId, styleId);
 *
 * ─── CSS Cache ────────────────────────────────────────────────────────────────
 * Every syntax definition's generated CSS is registered once globally (as a
 * <link> pointing to a blob URL) and cached by definition ID. Use
 * cleanLanguageStyle() / cleanAllLanguageStyle() to release it again.
 */
export class SyntaxHighlighter {

  constructor() {
    /** @type {Map<string, { link: HTMLLinkElement, entry: Object }>} key = definition ID */
    this._cssCache = new Map();

    /** Fixed-size, reused worker pool — see SyntaxHighlightWorkerPool.js */
    this._pool = new SyntaxHighlightWorkerPool();
  }

  // ─── Cache Management ─────────────────────────────────────────────────────

  /**
   * Removes the globally cached CSS for a specific syntax definition.
   * @param {string} langId - Syntax definition ID
   * @param {string} styleId - Highlight style ID
   */
  cleanLanguageStyle(langId, styleId) {
    const cachKey = this._createCssCachKey(langId, styleId);
    const cached = this._cssCache.get(cachKey);
    if (!cached)
      return;

    cached.link?.remove();
    blobManager.remove(BLOB_SECTION, cachKey);
    this._cssCache.delete(cachKey);
  }

  /**
   * Removes all globally cached syntax CSS styles.
   */
  cleanAllLanguageStyle() {
    for (const [key, cached] of this._cssCache.entries()) {
      cached.link?.remove();
      blobManager.remove(BLOB_SECTION, key);
    }
    this._cssCache.clear();
  }

  /**
   * Returns the cached blob entry (url + data) for a syntax definition's CSS.
   * @param {string} langId - Syntax definition ID
   * @param {string} styleId - Highlight style ID
   * @returns {{url: string, data: BlobPart}|null}
   */
  getLanguageBlobEntry(langId, styleId) {
    if (!langId, !styleId)
      return null;

    const cachKey = this._createCssCachKey(langId, styleId);
    return blobManager.get(BLOB_SECTION, cachKey);
  }

  // ─── High-level API ───────────────────────────────────────────────────────

  /**
   * Highlights text asynchronously and returns the final HTML string.
   * @param {Object} options
   * @param {string} options.langId - Syntax definition ID.
   * @param {string} options.styleId - Highlight style ID (can be null for default).
   * @param {string} options.text - Source code text to highlight.
   * @returns {Promise<{html: string}>} Promise resolving to highlighted HTML.
   */
  highlightTextAsHTML({ langId, styleId, text }) {
    return new Promise((resolve, reject) => {
      const def = findSyntaxDefinition(langId);
      if (!def)
        return reject(new Error('Syntax definition not found'));

      const container = document.createElement('div');

      this.highlightTextByDef({
        syntaxDefinition: def,
        styleId,
        text,
        onChunk: chunk => {
          this._onChunk(chunk, container);

          if (chunk.done) {
            resolve({ html: container.innerHTML });
          } else if (!chunk.ok) {
            reject(new Error(chunk.error));
          }
        }
      });
    });
  }

  /**
   * Highlights text directly into a DOM element (non‑streaming wrapper).
   * @param {Object} options
   * @param {HTMLElement} options.outputElement - Target element to receive the highlighted HTML.
   * @param {string} options.langId - Syntax definition ID.
   * @param {string} options.styleId - Highlight style ID (can be null).
   * @param {string} options.text - Source code to highlight.
   * @returns {() => void} Cancel function that terminates the underlying worker.
   */
  highlightTextToElement({ outputElement, langId, styleId, text }) {
    if (!outputElement || !text)
      return () => {};

    const def = findSyntaxDefinition(langId);
    if (!def)
      return () => {};

    const cancel = this.highlightTextByDef({
      syntaxDefinition: def,
      styleId,
      text,
      onChunk: chunk => {
        this._onChunk(chunk, outputElement);
      }
    });

    return () => {
      cancel();
    };
  }

  /**
   * Highlights the example code of a syntax definition (by alias) into a DOM element.
   * @param {Object} options
   * @param {HTMLElement} options.outputElement - Target element.
   * @param {string} options.alias - Syntax definition alias.
   * @param {string} options.styleId - Highlight style ID (can be null).
   * @returns {() => void} Cancel function.
   */
  highlightExampleToElement({ outputElement, alias, styleId }) {
    const def = findSyntaxDefinitionByName(alias);
    if (!def || !def.exampleCode)
      return () => {};

    return this.highlightTextToElement({
      outputElement,
      langId: def.id,
      styleId,
      text: def.exampleCode
    });
  }

  /**
   * Attaches an input‑listener that automatically re‑highlights on every keystroke with debouncing.
   * @param {Object} options
   * @param {string} options.langId - Syntax definition ID.
   * @param {string} options.styleId - Highlight style ID (can be null).
   * @param {HTMLInputElement|HTMLTextAreaElement} options.inputHTML - Input element whose value is used.
   * @param {HTMLElement} options.outputHTML - Element where highlighted result is shown.
   * @param {number} [options.debounceTimeMS=300] - Debounce delay in milliseconds.
   * @returns {() => void} Cleanup function that removes the listener and cancels pending work.
   */
  autoHighlightTextById({
    langId,
    styleId,
    inputHTML,
    outputHTML,
    debounceTimeMS = 300
  }) {
    let cancelHighlight = null;

    const listener = debounce(e => {
      const text = e.target.value;
      if (!text)
        return;

      cancelHighlight?.();
      cancelHighlight = this.highlightTextById({
        syntaxDefinitionId: langId,
        styleId,
        text,
        onChunk: chunk => {
          this._onChunk(chunk, outputHTML);
          if (chunk.done)
            cancelHighlight = null;
        }
      });
    }, debounceTimeMS);

    inputHTML.addEventListener('input', listener);

    return () => {
      inputHTML.removeEventListener('input', listener);
      listener?.cancel();
      cancelHighlight?.();
    };
  }

  /**
   * Highlights example code of a syntax definition (by alias) using a custom chunk callback.
   * @param {Object} options
   * @param {string} options.alias - Syntax definition alias.
   * @param {string} options.styleId - Style ID.
   * @param {(chunk: Object) => void} options.onChunk - Callback for each highlight chunk.
   * @returns {(() => void)|null} Cancel function, or null if parameters invalid.
   */
  highlightExampleByAlias({ alias, styleId, onChunk }) {
    if (!alias || !onChunk)
      return null;

    const def = findSyntaxDefinitionByName(alias);
    if (!def || !def.exampleCode)
      return null;

    return this.highlightTextByDef({
      syntaxDefinition: def,
      styleId,
      text: def.exampleCode,
      onChunk
    });
  }

  /**
   * Highlights example code of a syntax definition (by ID) using a custom chunk callback.
   * @param {Object} options
   * @param {string} options.syntaxDefinitionId - Syntax definition ID.
   * @param {string} options.styleId - Style ID.
   * @param {(chunk: Object) => void} options.onChunk - Callback for each highlight chunk.
   * @returns {(() => void)|null} Cancel function, or null if parameters invalid.
   */
  highlightExampleById({ syntaxDefinitionId, styleId, onChunk }) {
    if (!syntaxDefinitionId || !onChunk)
      return null;

    const def = findSyntaxDefinition(syntaxDefinitionId);
    if (!def || !def.exampleCode)
      return null;

    return this.highlightTextByDef({
      syntaxDefinition: def,
      styleId,
      text: def.exampleCode,
      onChunk
    });
  }

  /**
   * Highlights arbitrary text using a syntax definition alias.
   * @param {Object} options
   * @param {string} options.alias - Syntax definition alias.
   * @param {string} options.styleId - Style ID.
   * @param {string} options.text - Source code.
   * @param {(chunk: Object) => void} options.onChunk - Callback for each highlight chunk.
   * @returns {(() => void)|null} Cancel function.
   */
  highlightTextByAlias({ alias, styleId, text, onChunk }) {
    if (!alias || !text || !onChunk)
      return null;

    const def = findSyntaxDefinitionByName(alias);
    if (!def)
      return null;

    return this.highlightTextByDef({
      syntaxDefinition: def,
      styleId,
      text,
      onChunk
    });
  }

  /**
   * Highlights arbitrary text using a syntax definition ID.
   * @param {Object} options
   * @param {string} options.syntaxDefinitionId - Syntax definition ID.
   * @param {string} options.styleId - Style ID.
   * @param {string} options.text - Source code.
   * @param {(chunk: Object) => void} options.onChunk - Callback for each highlight chunk.
   * @returns {(() => void)|null} Cancel function.
   */
  highlightTextById({ syntaxDefinitionId, styleId, text, onChunk }) {
    if (!syntaxDefinitionId || !text || !onChunk)
      return null;

    const def = findSyntaxDefinition(syntaxDefinitionId);
    if (!def)
      return null;

    return this.highlightTextByDef({
      syntaxDefinition: def,
      styleId,
      text,
      onChunk
    });
  }

  /**
   * Low‑level method that queues a highlight job onto the shared worker pool
   * (see SyntaxHighlightWorkerPool.js). Previously this spawned a brand-new
   * Worker per call; now a small, fixed set of workers is reused and jobs
   * queue up FIFO when every worker is busy.
   * @param {Object} options
   * @param {Object} options.syntaxDefinition - Full syntax definition object.
   * @param {string} options.styleId - Style ID.
   * @param {string} options.text - Source code.
   * @param {(chunk: Object) => void} options.onChunk - Callback for each highlight chunk.
   * @returns {() => void} Cancel function. If the job hasn't started yet it is
   *   simply dequeued; if it's already running, the worker running it is
   *   terminated and transparently replaced.
   */
  highlightTextByDef({ syntaxDefinition, styleId, text, onChunk }) {
    const styleIndex = highlightStyleIdToIndex(syntaxDefinition, styleId);

    return this._pool.enqueue({
      syntaxDefinition,
      styleIndex,
      text,
      onChunk,
    });
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  _createCssCachKey(defId, styleId) {
    return `${defId}-${styleId}`
  }

  /**
   * Registers CSS globally for a syntax definition (idempotent).
   * @param {string} defId - Syntax definition ID
   * @param {string} css - CSS content
   */
  _registerCssGlobally(defId, styleId, css) {
    const cachKey = this._createCssCachKey(defId, styleId);
    if (this._cssCache.has(cachKey))
      return;

    const entry = blobManager.add(BLOB_SECTION, cachKey, { data: css, type: 'text/css' });
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = entry.url;
    link.dataset.syntaxDef = defId;
    document.head.appendChild(link);

    this._cssCache.set(cachKey, { link, entry });
  }

  /**
   * Handles incoming chunks from the worker.
   * @param {Object} chunk
   * @param {HTMLElement} outputHTML - Container element where HTML will be inserted
   */
  _onChunk(chunk, outputHTML) {
    if (!chunk) {
      console.error('chunk is ' + chunk);
      return;
    }

    if (!chunk.ok) {
      console.error(chunk.error);
      return;
    }

    if (chunk.type === 'css') {
      this._registerCssGlobally(chunk.defId, chunk.styleId, chunk.css);
      return;
    }

    if (chunk.type === 'pre-render') {
      outputHTML.innerHTML = chunk.html;
      return;
    }

    const chunkIndex = chunk.lineStart / chunk.chunkSize;
    const oldPre = outputHTML.querySelector(`[id=syntax-chunk-${chunkIndex}]`);
    if (oldPre) {
      oldPre.outerHTML = chunk.html;
    } else {
      console.warn(`Failed to replace Chunk ${chunkIndex}, not found!`);
    }
  }
}

export const syntaxHighlighter = new SyntaxHighlighter();