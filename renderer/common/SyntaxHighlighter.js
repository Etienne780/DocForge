import { blobManager } from '@core/BlobManager.js';
import {
  findSyntaxDefinition,
  findSyntaxDefinitionByName,
  findRootSyntaxState,
  highlightStyleIdToIndex,
} from '@data/SyntaxDefinitionManager.js';
import { debounce } from '@common/Common.js';

/**
 * Highlight text asynchronously and return the final HTML string.
 * @param {Object} options
 * @param {string} options.langId - Syntax definition ID.
 * @param {string} options.styleId - Highlight style ID (can be null for default).
 * @param {string} options.text - Source code text to highlight.
 * @returns {Promise<{html: string, cleanup: (() => void)|null}>} Promise resolving to highlighted HTML and optional CSS cleanup.
 */
export function highlightTextAsHTML({ langId, styleId, text }) {
  return new Promise((resolve, reject) => {
    const def = findSyntaxDefinition(langId);
    if (!def)
      return reject(new Error('Syntax definition not found'));

    const container = document.createElement('div');
    let cssCleanup = null;

    const cancel = highlightTextByDef({
      syntaxDefinition: def,
      styleId,
      text,
      onChunk: chunk => {
        _onChunk(chunk, container, cleanup => {
          if (cssCleanup) 
            cssCleanup();
          cssCleanup = cleanup;
        });

        if (chunk.done) {
          resolve({
            html: container.innerHTML,
            cleanup: cssCleanup,
          });
        } else if (!chunk.ok) {
          reject(new Error(chunk.error));
        }
      }
    });
  });
}

/**
 * Highlight text directly into a DOM element (non‑streaming wrapper).
 * @param {Object} options
 * @param {HTMLElement} options.outputElement - Target element to receive the highlighted HTML.
 * @param {string} options.langId - Syntax definition ID.
 * @param {string} options.styleId - Highlight style ID (can be null).
 * @param {string} options.text - Source code to highlight.
 * @returns {() => void} Cancel function that terminates the underlying worker and removes injected CSS.
 */
export function highlightTextToElement({ outputElement, langId, styleId, text }) {
  if (!outputElement || !text)
    return () => {};

  const def = findSyntaxDefinition(langId);
  if (!def)
    return () => {};

  let cssCleanup = null;

  const cancel = highlightTextByDef({
    syntaxDefinition: def,
    styleId,
    text,
    onChunk: chunk => {
      _onChunk(chunk, outputElement, cleanup => {
        if (cssCleanup) 
          cssCleanup();
        cssCleanup = cleanup;
      });
    }
  });

  return () => {
    cancel();
    if (cssCleanup) {
      cssCleanup();
      cssCleanup = null;
    }
  };
}

/**
 * Highlight the example code of a syntax definition (by alias) into a DOM element.
 * @param {Object} options
 * @param {HTMLElement} options.outputElement - Target element.
 * @param {string} options.alias - Syntax definition alias.
 * @param {string} options.styleId - Highlight style ID (can be null).
 * @returns {() => void} Cancel function.
 */
export function highlightExampleToElement({ outputElement, alias, styleId }) {
  const def = findSyntaxDefinitionByName(alias);
  if (!def || !def.exampleCode)
    return () => {};

  return highlightTextToElement({
    outputElement,
    langId: def.id,
    styleId,
    text: def.exampleCode
  });
}

/**
 * Attach an input‑listener that automatically re‑highlights on every keystroke, with debouncing.
 * @param {Object} options
 * @param {string} options.langId - Syntax definition ID.
 * @param {string} options.styleId - Highlight style ID (can be null).
 * @param {HTMLInputElement|HTMLTextAreaElement} options.inputHTML - Input element whose value is used.
 * @param {HTMLElement} options.outputHTML - Element where highlighted result is shown.
 * @param {number} [options.debounceTimeMS=300] - Debounce delay in milliseconds.
 * @returns {() => void} Cleanup function that removes the listener, cancels pending work, and removes injected CSS.
 */
export function autoHighlightTextById({
  langId,
  styleId,
  inputHTML,
  outputHTML,
  debounceTimeMS = 300
}) {
  let cancelHighlight = null;
  let cssCleanup = null;

  const listener = debounce(e => {
    const text = e.target.value;
    if (!text)
      return;

    cancelHighlight?.();
    cancelHighlight = highlightTextById({
      syntaxDefinitionId: langId,
      styleId,
      text,
      onChunk: chunk => {
        _onChunk(chunk, outputHTML, value => {
          if (cssCleanup) 
            cssCleanup();

          if (chunk.done)
            cancelHighlight = null;

          cssCleanup = value;
        });
      }
    });
  }, debounceTimeMS);

  inputHTML.addEventListener('input', listener);

  return () => {
    inputHTML.removeEventListener('input', listener);
    listener?.cancel();

    if (cssCleanup) {
      cssCleanup();
      cssCleanup = null;
    }
  };
}

/**
 * Highlight example code of a syntax definition (by alias) using a custom chunk callback.
 * @param {Object} options
 * @param {string} options.alias - Syntax definition alias.
 * @param {string} options.styleId - Style ID.
 * @param {(chunk: Object) => void} options.onChunk - Callback for each highlight chunk.
 * @returns {(() => void)|null} Cancel function, or null if parameters invalid.
 */
export function highlightExampleByAlias({ alias, styleId, onChunk }) {
  if (!alias || !onChunk)
    return null;

  const def = findSyntaxDefinitionByName(alias);
  if (!def || !def.exampleCode)
    return null;

  return highlightTextByDef({
    syntaxDefinition: def,
    styleId,
    text: def.exampleCode,
    onChunk
  });
}

/**
 * Highlight example code of a syntax definition (by ID) using a custom chunk callback.
 * @param {Object} options
 * @param {string} options.syntaxDefinitionId - Syntax definition ID.
 * @param {string} options.styleId - Style ID.
 * @param {(chunk: Object) => void} options.onChunk - Callback for each highlight chunk.
 * @returns {(() => void)|null} Cancel function, or null if parameters invalid.
 */
export function highlightExampleById({ syntaxDefinitionId, styleId, onChunk }) {
  if (!syntaxDefinitionId || !onChunk)
    return null;

  const def = findSyntaxDefinition(syntaxDefinitionId);
  if (!def || !def.exampleCode)
    return null;

  return highlightTextByDef({
    syntaxDefinition: def,
    styleId,
    text: def.exampleCode,
    onChunk
  });
}

/**
 * Highlight arbitrary text using a syntax definition alias.
 * @param {Object} options
 * @param {string} options.alias - Syntax definition alias.
 * @param {string} options.styleId - Style ID.
 * @param {string} options.text - Source code.
 * @param {(chunk: Object) => void} options.onChunk - Callback for each highlight chunk.
 * @returns {(() => void)|null} Cancel function.
 */
export function highlightTextByAlias({ alias, styleId, text, onChunk }) {
  if (!alias || !text || !onChunk)
    return null;

  const def = findSyntaxDefinitionByName(alias);
  if (!def)
    return null;

  return highlightTextByDef({
    syntaxDefinition: def,
    styleId,
    text,
    onChunk
  });
}

/**
 * Highlight arbitrary text using a syntax definition ID.
 * @param {Object} options
 * @param {string} options.syntaxDefinitionId - Syntax definition ID.
 * @param {string} options.styleId - Style ID.
 * @param {string} options.text - Source code.
 * @param {(chunk: Object) => void} options.onChunk - Callback for each highlight chunk.
 * @returns {(() => void)|null} Cancel function.
 */
export function highlightTextById({ syntaxDefinitionId, styleId, text, onChunk }) {
  if (!syntaxDefinitionId || !text || !onChunk)
    return null;

  const def = findSyntaxDefinition(syntaxDefinitionId);
  if (!def)
    return null;

  return highlightTextByDef({
    syntaxDefinition: def,
    styleId,
    text,
    onChunk
  });
}

/**
 * Low‑level function that spawns a Web Worker to perform syntax highlighting.
 * @param {Object} options
 * @param {Object} options.syntaxDefinition - Full syntax definition object.
 * @param {string} options.styleId - Style ID.
 * @param {string} options.text - Source code.
 * @param {(chunk: Object) => void} options.onChunk - Callback for each highlight chunk.
 * @returns {() => void} Cancel function that terminates the worker.
 */
export function highlightTextByDef({ syntaxDefinition, styleId, text, onChunk }) {
  const worker = new Worker(
    new URL('./SyntaxHighlightWorker.js', import.meta.url),
    { type: 'module' }
  );

  worker.onmessage = e => {
    onChunk?.({
      ok: e.data.ok,
      error: e.data.error,
      done: e.data.done,
      type: e.data.type,       // 'css' | 'chunk'
      css: e.data.css,         // only when type === 'css'
      lineStart: e.data.lineStart, // only when type === 'chunk'
      chunkSize: e.data.chunkSize,
      html: e.data.html,
      defId: syntaxDefinition.id,
    });

    if (e.data.done || !e.data.ok)
      worker.terminate();
  };

  worker.onerror = error => {
    worker.terminate();
  };

  const styleIndex = highlightStyleIdToIndex(syntaxDefinition, styleId);
  worker.postMessage({ syntaxDefinition, styleIndex, text });

  return () => { worker.terminate(); };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _onChunk(chunk, outputHTML, setCssCleanup) {
  if (!chunk) {
    console.error('chunk is ' + chunk);
    return;
  }

  if (!chunk.ok) {
    console.error(chunk.error);
    return;
  }

  if (chunk.type === 'css') {
    const cleanup = _ensureCssBlob(chunk.defId, chunk.css);
    if (cleanup)
      setCssCleanup(cleanup);
    return;
  }

  if (chunk.type === 'pre-render') {
    outputHTML.innerHTML = chunk.html;
    return;
  }

  const chunkIndex = chunk.lineStart / chunk.chunkSize;
  const oldPre = document.getElementById(`syntax-chunk-${chunkIndex}`);
  if (oldPre) {
    oldPre.outerHTML = chunk.html;
  } else {
    console.warn(`Failed to replace Chunk ${chunkIndex}, not found!`);
  }
}

function _ensureCssBlob(defId, css) {
  const section = `syntax-definition-css`;

  if (blobManager.has(section, defId))
    return;

  const entry = blobManager.add(section, defId, { data: css, type: 'text/css' });
  const link = document.createElement('link');

  link.rel = 'stylesheet';
  link.href = entry.url;
  link.dataset.syntaxDef = defId;
  document.head.appendChild(link);

  return () => {
    link?.remove();
    blobManager.remove(section, defId);
  };
}