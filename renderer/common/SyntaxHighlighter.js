import { 
  findSyntaxDefinition, 
  findSyntaxDefinitionByAlias, 
  findRootSyntaxState,
} from '@core/SyntaxDefinitionManager.js';

// caller
const cancel = highlightTextByAlias('js', code, onChunk);

function onChunk(chunk) {
  if (!chunk.ok) { 
    console.error(chunk.error); 
    return; 
  }

  if (chunk.type === 'css') {
    ensureCssBlob(def.id, chunk.css);   // einmalig Blob erstellen + <link> einbinden
    return;
  }

  if (chunk.lineStart === 0) {
    codeElement.innerHTML = chunk.html;
  } else {
    codeElement.innerHTML += chunk.html;
  }
}

function ensureCssBlob(defId, css) {
  if (blobManager.has('syntax-css', defId)) 
    return;

  const entry = blobManager.add('syntax-css', defId, { data: css, type: 'text/css' });

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = entry.url;
  link.dataset.syntaxDef = defId;
  document.head.appendChild(link);
}




export function highlightTextByAlias(alias, text, onChunk) {
  if(!alias || !text)
    return null;

  const def = findSyntaxDefinitionByAlias(alias);
  if (!def)
    return null;
  
  return highlightText(def, text, onChunk);
}

export function highlightTextById(syntaxDefinitionId, text, onChunk) {
  if(!syntaxDefinitionId || !text)
    return null;

  const def = findSyntaxDefinition(syntaxDefinitionId);
  if (!def)
    return null;

  return highlightText(def, text, onChunk);
}

function highlightText(syntaxDefinition, text, onChunk) {
  const worker = new Worker(
    new URL('./SyntaxHighlightWorker.js', import.meta.url),
    { type: 'module' }
  );

  worker.onmessage = e => {

    onChunk({
      ok:        e.data.ok,
      error:     e.data.error,
      done:      e.data.done,
      type:      e.data.type,       // 'css' | 'chunk'
      css:       e.data.css,        // nur bei type === 'css'
      lineStart: e.data.lineStart,  // nur bei type === 'chunk'
      lineCount: e.data.lineCount,
      html:      e.data.html,
    });

    if(e.data.done || !e.data.ok)
      worker.terminate();
  };

  worker.onerror = error => {
    worker.terminate();
  };

  worker.postMessage({ syntaxDefinition, text });

  return () => { worker.terminate(); };
}