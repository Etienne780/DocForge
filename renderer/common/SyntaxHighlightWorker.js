import { 
  findRootSyntaxState,
} from '@core/SyntaxDefinitionManager.js';

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

    const lexerData = {
      symbolHoisting: syntaxDefinition.symbolHoisting,
      rootState: rootState,
      states: syntaxDefinition.states,
      predefinedSymbols: syntaxDefinition.predefinedSymbols,
    };

    const result = await _lexeText(lexerData, text);

    if(!result.ok) {
      self.postMessage({
        ok: false,
        error: result.error,
      });

      return;
    }

    const html = await _createHtmlFromLexerData(
      syntaxDefinition.styles,
      result.data
    );

    self.postMessage({
      ok: true,
      data: html,
    });
  } catch(error) {
    self.postMessage({
        ok: false,
        error: error.message,
    });
  }
};