import { 
  findSyntaxDefinition, 
  findSyntaxDefinitionByAlias, 
  findRootSyntaxState,
} from '@core/SyntaxDefinitionManager.js';

export async function highlightSyntaxByAlias(alias, text) {
  if(!text) {
    console.error('[]: ');
    return null;
  }

  const def = findSyntaxDefinitionByAlias(alias);
  if (!def) {
    console.error('[]: ');
    return null;
  }
  
  return await highlightSyntax(def, text);
}

export async function highlightSyntaxById(syntaxDefinitionId, text) {
  if(!text) {
    console.error('[]: ');
    return null;
  }  

  const def = findSyntaxDefinition(syntaxDefinitionId);
  if (!def) {
    console.error('[]: ');
    return null;
  }  

  return await highlightSyntax(def, text);
}

function _createResult(data, ok = true, error = null) {
  return {
    data: data,
    ok: ok,
    error: '[highlightSyntax]' + error,
  };
}

async function highlightSyntax(syntaxDefinition, text) {
  return await _runHighlightWorker({
    syntaxDefinition,
    text,
  });
}

function _runHighlightWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./SyntaxHighlightWorker.js', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = e => {
      worker.terminate();

      if(e.data.ok) {
          resolve(e.data);
      } else {
          reject(e.data.error);
      }
    };

    worker.onerror = error => {
      worker.terminate();
      reject(error);
    };

    worker.postMessage(data);
  });
}