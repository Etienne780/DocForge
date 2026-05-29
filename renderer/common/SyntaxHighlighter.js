import { 
  findSyntaxDefinition, 
  findSyntaxDefinitionByName, 
  findRootSyntaxState,
  highlightStyleIdToIndex,
} from '@data/SyntaxDefinitionManager.js';

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
      lineCount: e.data.lineCount,
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