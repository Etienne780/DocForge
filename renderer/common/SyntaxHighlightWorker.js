import { findRootSyntaxState, } from '@core/SyntaxDefinitionManager.js';

const LINES_PER_CHUNK = 100;

self.onmessage = async e => {
  const { syntaxDefinition, text } = e.data;

  try {
    const rootState = findRootSyntaxState(syntaxDefinition);

    if(!rootState) {
      self.postMessage({
        ok: false,
        error: 'root state missing',
      });

      return;
    }

    const css = _generateCss(syntaxDefinition.styles);
    self.postMessage({
      ok: true,
      done: false,
      type: 'css',
      css: css,
    });

    const lexerData = {
      symbolHoisting: syntaxDefinition.symbolHoisting,
      rootState: rootState,
      states: syntaxDefinition.states,
      predefinedSymbols: syntaxDefinition.predefinedSymbols,
    };

    const chunks = _splitIntoChunks(text, LINES_PER_CHUNK);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const result = _lexeChunk(lexerData, chunk.lines);

      if (!result.ok) {
        self.postMessage({
          ok: false,
          error: `Chunk[${chunk.lineStart}-${hunk.lineStart + LINES_PER_CHUNK}]: `+ result.error,
        });
        return;
      }

      const resultHTML = _createHtmlFromLexerData(lexerData, result);

      if (!resultHTML.ok) {
        self.postMessage({
          ok: false,
          error: `Chunk[${chunk.lineStart}-${hunk.lineStart + LINES_PER_CHUNK}]: `+ resultHTML.error,
        });
        return;
      }

      self.postMessage({ 
        ok: true,
        done: (i + 1) === chunks.length,
        type: 'chunk',
        lineStart: chunk.lineStart,
        lineCount: chunk.lines.length,
        html: resultHTML.data,
      });
    }
  } catch(error) {
    self.postMessage({
        ok: false,
        error: error.message,
    });
  }
};

function _splitIntoChunks(text, linesPerChunk) {
  const lines = text.split('\n');
  const chunks = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    chunks.push({
      lines: lines.slice(i, i + linesPerChunk),
      lineStart: i,
    });
  }
  return chunks;
}

function _generateCss() {
  
}

function _lexeChunk(lexerData, lines) {
  const {
    symbolHoisting,
    rootState,
    states,
    predefinedSymbols,
  } = lexerData;


  return { 
    ok: true,
    error: null,
    data: null,
  };
}

function _createHtmlFromLexerData(styles, lexerResultData) {
  return { 
    ok: true,
    error: null,
    data: null,
  };
}