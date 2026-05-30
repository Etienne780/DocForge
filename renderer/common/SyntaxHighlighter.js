import { blobManager } from '@core/BlobManager.js';
import { 
  findSyntaxDefinition, 
  findSyntaxDefinitionByName, 
  findRootSyntaxState,
  highlightStyleIdToIndex,
} from '@data/SyntaxDefinitionManager.js';
import { debounce } from '@common/Common.js';

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
    cancelHighlight = highlightTextById(langId, styleId, text, chunk => {
      _onChunk(chunk, outputHTML, value => {
        if (cssCleanup)
          cssCleanup();

        if (chunk.done)
          cancelHighlight = null;

        cssCleanup = value;
      });
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

export function highlightExampleByAlias(alias, styleId, onChunk) {
   if(!alias || !onChunk)
    return null;

  const def = findSyntaxDefinitionByName(alias);
  if (!def)
    return null;
  
  if (!def.exampleCode)
    return null

  return highlightTextByDef(def, styleId, def.exampleCode, onChunk);
}

export function highlightExampleById(syntaxDefinitionId, styleId, onChunk) {
  if(!syntaxDefinitionId || !onChunk)
    return null;

  const def = findSyntaxDefinition(syntaxDefinitionId);
  if (!def)
    return null;

  if (!def.exampleCode)
    return null

  return highlightTextByDef(def, styleId, def.exampleCode, onChunk);
}

export function highlightTextByAlias(alias, styleId, text, onChunk) {
  if(!alias || !text || !onChunk)
    return null;

  const def = findSyntaxDefinitionByName(alias);
  if (!def)
    return null;
  
  return highlightTextByDef(def, styleId, text, onChunk);
}

export function highlightTextById(syntaxDefinitionId, styleId, text, onChunk) {
  if(!syntaxDefinitionId || !text || !onChunk)
    return null;

  const def = findSyntaxDefinition(syntaxDefinitionId);
  if (!def)
    return null;

  return highlightTextByDef(def, styleId, text, onChunk);
}

export function highlightTextByDef(syntaxDefinition, styleId, text, onChunk) {
  const worker = new Worker(
    new URL('./SyntaxHighlightWorker.js', import.meta.url),
    { type: 'module' }
  );

  worker.onmessage = e => {

    onChunk?.({
      ok:        e.data.ok,
      error:     e.data.error,
      done:      e.data.done,
      type:      e.data.type,       // 'css' | 'chunk'
      css:       e.data.css,        // nur bei type === 'css'
      lineStart: e.data.lineStart,  // nur bei type === 'chunk'
      chunkSize: e.data.chunkSize,
      html:      e.data.html,
      defId: syntaxDefinition.id,
    });

    if(e.data.done || !e.data.ok)
      worker.terminate();
  };

  worker.onerror = error => {
    worker.terminate();
  };

  const styleIndex = highlightStyleIdToIndex(syntaxDefinition, styleId);
  worker.postMessage({ syntaxDefinition, styleIndex, text });

  return () => { worker.terminate(); };
}