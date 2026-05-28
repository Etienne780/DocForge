import { 
  findSyntaxDefinition, 
  findSyntaxDefinitionByAlias, 
  findRootSyntaxState,
} from '@core/SyntaxDefinitionManager.js';

export async function highlightTextByAlias(alias, text) {
  if(!alias || !text)
    return null;

  const def = findSyntaxDefinitionByAlias(alias);
  if (!def)
    return null;
  
  return await highlightText(def, text);
}

export async function highlightTextById(syntaxDefinitionId, text) {
  if(!syntaxDefinitionId || !text)
    return null;

  const def = findSyntaxDefinition(syntaxDefinitionId);
  if (!def)
    return null;

  return await highlightText(def, text);
}

function _createResult(data, ok = true, error = undefined) {
  return {
    data: data,
    ok: ok,
    error: '[highlightSyntax]: ' + error,
  };
}

async function highlightText(syntaxDefinition, text) {
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