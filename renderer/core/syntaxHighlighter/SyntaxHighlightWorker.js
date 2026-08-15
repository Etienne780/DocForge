import { 
  findRootSyntaxState, 
  TokenType,
  RegisterScope,
  RuleType,
  PatternType,
  TransitionType,
  OnUnmatched,
} from '@data/SyntaxDefinitionManager.js';
import { HIGHLIGHTER_LINES_PER_CHUNK, escapeRegex, escapeHTML } from '@common/Common.js';

let lineTabSize = 4;

self.onmessage = async e => {
  const { syntaxDefinition, style, text, tabSize } = e.data;

  if (tabSize && Number(tabSize) != Number.NaN)
    lineTabSize = tabSize;

  try {
    const rootState = findRootSyntaxState(syntaxDefinition);

    if(!rootState) {
      self.postMessage({
        ok: false,
        error: 'root state missing',
      });

      return;
    }

    const highlightStyle = style;
    const styleObject = _generateStyleObject(highlightStyle, syntaxDefinition.id, highlightStyle.id);
    const css = _generateCss(highlightStyle, styleObject);
    self.postMessage({
      ok: true,
      done: false,
      type: 'css',
      css: css,
    });

    const preRenderHtml = _createPreRenderHtmlFromText(text, HIGHLIGHTER_LINES_PER_CHUNK);
    self.postMessage({
      ok: true,
      done: false,
      type: 'pre-render',
      html: preRenderHtml,
    });

    if (!Array.isArray(syntaxDefinition.states) || 
      !Array.isArray(syntaxDefinition.predefinedSymbols)) {
      return { 
        ok: false,
        error: 'LexerData incomplete',
        data: null,
      };
    }
    
    const stateMap = Object.fromEntries(syntaxDefinition.states.map(s => [s.id, s]));
    const symbolMap = _generateSymbolMap({
      symbolHoisting: Boolean(syntaxDefinition.symbolHoisting),
      rootState: rootState,
      stateMap: stateMap,
      predefined: syntaxDefinition.predefinedSymbols, 
      text: text,
    }); 

    // symbolScopes is a stack of maps: index 0 = global scope.
    // Each additional level corresponds to a pushed state registration.
    // Always stays in sync with stateStack.
    let carry = {
      stateStack:   [rootState],
      symbolScopes: [symbolMap],
      activeBeginRules: [],
    };

    const chunks = _splitIntoChunks(text, HIGHLIGHTER_LINES_PER_CHUNK);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const result = _lexeChunk(stateMap, carry, chunk.lines);

      if (!result.ok) {
        self.postMessage({
          ok: false,
          error: `Chunk[${chunk.lineStart}-${chunk.lineStart + HIGHLIGHTER_LINES_PER_CHUNK}]: `+ result.error,
        });
        return;
      }
      
      carry = result.carry;
      
      const resultHTML = _createHtmlFromLexerData(styleObject, result.data);

      if (!resultHTML.ok) {
        self.postMessage({
          ok: false,
          error: `Chunk[${chunk.lineStart}-${chunk.lineStart + HIGHLIGHTER_LINES_PER_CHUNK}]: `+ resultHTML.error,
        });
        return;
      }

      self.postMessage({ 
        ok: true,
        done: (i + 1) === chunks.length,
        type: 'chunk',
        lineStart: chunk.lineStart,
        chunkSize: HIGHLIGHTER_LINES_PER_CHUNK,
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

function _generateSymbolMap({ symbolHoisting, rootState, stateMap, predefined, text }) {
  const map = Object.fromEntries(predefined.map(d => [d.name, d.tokenType]));
 
  if (!symbolHoisting)
    return map;
 
  // Pre-scan: run the same lexer, but only collect global registrations.
  // symbolScopes is only kept in sync with stateStack for push/pop transitions.
  // Inner scopes are discarded after the scan; only `map` is kept.
  const lines       = text.split('\n');
  const stateStack  = [rootState];
  const symbolScopes = [map];
  const activeBeginRules = [];
 
  for (const line of lines) {
    let pos = 0;
    while (pos < line.length) {
      const currentState = stateStack[stateStack.length - 1];
      const match = _matchRules(currentState, activeBeginRules, stateMap, line, pos, null);
 
      if (!match) {
        pos++;
        continue;
      }
 
      _collectRegistrations(match, map);
      _applyTransition(match, stateStack, symbolScopes, activeBeginRules, stateMap);
      pos += match.length;
    }
  }
 
  return map;
}

function _collectRegistrations(match, symbolMap) {
  const { rule, match: m, type } = match;
  const action = type === 'begin' ? rule.beginAction :
                 type === 'end'   ? rule.endAction   : rule.action;
 
  if (!action)
    return;

  // Hoisting only applies to the global scope. Hoisting a STATE-scoped
  // registration without its stack context is meaningless and is ignored.
  // No scope defaults to GLOBAL, as before.
  const isGlobal = (reg) => (reg.scope ?? RegisterScope.GLOBAL) === RegisterScope.GLOBAL;
 
  if (action.captures) {
    for (let i = 1; i < m.length; i++) {
      const group = m[i];
      if (group == null) 
        continue;
      
      const cap = action.captures.groups[String(i)];
      if (cap?.register && isGlobal(cap.register))
        symbolMap[group] = cap.register.tokenType;
    }
    return;
  }
 
  if (action.register && isGlobal(action.register))
    symbolMap[m[0]] = action.register.tokenType;
}

function _generateCss(highlightStyle, styleObject) {
  const {
    tokenStyles = [],
    stateTokenStyles = [],
    overrides = [],
  } = highlightStyle ?? {};

  const safeTokenStyles = Array.isArray(tokenStyles) ? tokenStyles : [];
  const safeStateTokenStyles = Array.isArray(stateTokenStyles) ? stateTokenStyles : [];
  const safeOverrides = Array.isArray(overrides) ? overrides : [];

  const createClass = (className, classParams) => {
    let params = '';

    if (
      classParams &&
      Array.isArray(classParams) &&
      classParams.length > 0
    ) {
      classParams.forEach(({ name, value, active }) => {
        if (!name ||
          value === undefined ||
          value === null ||
          active === false) {
          return;
        }

        params += `  ${name}: ${value};\n`;
      });
    }

    return `.${className} {\n${params}}\n`;
  };

  const cssStyles = [];

  safeTokenStyles.forEach((ts) => {
    if (!ts.tokenType || !ts.color)
      return;

    const tokenClass = createClass(
      styleObject.generateClassNameTokenStyle(ts.tokenType),
      [
        { name: 'color', value: ts.color },
        { name: 'font-weight', value: 'bold', active: ts.bold },
        { name: 'font-style', value: 'italic', active: ts.italic },
        { name: 'text-decoration', value: 'underline', active: ts.underline },
      ]
    );

    cssStyles.push(tokenClass);
  });

  safeStateTokenStyles.forEach((sts) => {
    if (!sts.stateId || !sts.tokenType || !sts.color)
      return;

    const tokenClass = createClass(
      styleObject.generateClassNameStateTokenStyle(sts.stateId, sts.tokenType),
      [
        { name: 'color', value: sts.color },
        { name: 'font-weight', value: 'bold', active: sts.bold },
        { name: 'font-style', value: 'italic', active: sts.italic },
        { name: 'text-decoration', value: 'underline', active: sts.underline },
      ]
    );

    cssStyles.push(tokenClass);
  });

  safeOverrides.forEach((o) => {
    if (!o.stateId || !o.ruleId || !o.style)
      return;

    const ts = o.style;
    if (!ts.tokenType || !ts.color)
      return;

    const tokenClass = createClass(
      styleObject.generateClassNameOverride(o.stateId, o.ruleId),
      [
        { name: 'color', value: ts.color },
        { name: 'font-weight', value: 'bold', active: ts.bold },
        { name: 'font-style', value: 'italic', active: ts.italic },
        { name: 'text-decoration', value: 'underline', active: ts.underline },
      ]
    );

    cssStyles.push(tokenClass);
  });

  cssStyles.push(`.syntax-definition-highlight {
  white-space: pre; 
  tab-size: ${lineTabSize};
}`);
  
  return cssStyles.join('\n');
}

function _lexeChunk(stateMap, carry, lines) {
  // copy state, scoped symbol tables and active begin/end rules from prev
  const stateStack   = [...carry.stateStack];
  const symbolScopes  = carry.symbolScopes.map(scope => ({ ...scope }));
  const activeBeginRules = [...carry.activeBeginRules];

  const tokens = []; // { line, col, length, tokenType, stateId, ruleId }
  let lastTokenType = null;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let pos = 0;

    if (line.length === 0) {
      tokens.push({ 
        line: lineIdx,
        col: pos,
        text: null,
        length: 1,
        tokenType: TokenType.LINEBREAK,
        stateId: null,
        ruleId: null
      });
      continue;
    }

    while (pos < line.length) {
      const currentState = stateStack[stateStack.length - 1];
      const match = _matchRules(currentState, activeBeginRules, stateMap, line, pos, lastTokenType);

     if (!match) {
        const ch = line[pos];
        let tokenType = TokenType.OTHER;
        if (activeBeginRules.length > 0) {
          const activeRule = activeBeginRules[activeBeginRules.length - 1].rule;
          tokenType = activeRule?.contentTokenType ?? TokenType.OTHER;
        }

        tokens.push({ 
          line: lineIdx,
          col: pos,
          text: ch,
          length: 1,
          tokenType: tokenType,
          stateId: currentState.id,
          ruleId: null
        });
        lastTokenType = tokenType;
        pos++;
        continue;
      }

      // Captures or tokenType
      const emittedTokens = _applyAction(match, lineIdx, pos, symbolScopes, currentState.id);
      tokens.push(...emittedTokens);
      lastTokenType = emittedTokens.at(-1)?.tokenType ?? lastTokenType;

      // Transition
      _applyTransition(match, stateStack, symbolScopes, activeBeginRules, stateMap);

      pos += match.length;
    }

    if (activeBeginRules.length > 0) {
      const { rule: activeRule, endRegex } = activeBeginRules[activeBeginRules.length - 1];
      const regex = endRegex ?? _compileEnd(activeRule);
      regex.lastIndex = pos;
      const m = regex.exec(line);
      if (m) {
        const emittedTokens = _applyAction(
          { rule: activeRule, match: m, length: m[0].length, type: 'end' },
          lineIdx, m.index, symbolScopes, stateStack[stateStack.length - 1].id
        );
        tokens.push(...emittedTokens);
        _applyTransition(
          { rule: activeRule, type: 'end', match: m },
          stateStack, symbolScopes, activeBeginRules, stateMap
        );
      }
    }
  }

  return {
    ok: true,
    data:  tokens,
    carry: { stateStack, symbolScopes, activeBeginRules },
  };
}

function _matchRules(state, activeBeginRules, stateMap, line, pos, lastTokenType) { 
  if (Array.isArray(activeBeginRules) && 
    activeBeginRules.length > 0) {
    const { rule: activeRule, endRegex } = activeBeginRules[activeBeginRules.length - 1];
    const regex = endRegex ?? _compileEnd(activeRule);
    regex.lastIndex = pos;

    const match = regex.exec(line);
    if (match && match.index === pos)
      return { rule: activeRule, match: match, length: match[0].length, type: 'end' };
  }

  for (const rule of state.rules) {

    // INCLUDE -> recursively into the other state
    if (rule.type === RuleType.INCLUDE) {
      if (rule.context?.afterTokenType && 
          !rule.context.afterTokenType.includes(lastTokenType))
        continue;

      const included = stateMap[rule.includeStateId];
      if (included) {
        const m = _matchRules(included, activeBeginRules, stateMap, line, pos, lastTokenType);
        if (m) 
          return m;
      }
      continue;
    }

    // Context-Guard
    if (rule.context.afterTokenType && !rule.context.afterTokenType.includes(lastTokenType))
      continue;
    
    if (rule.context.notAfterTokenType &&  rule.context.notAfterTokenType.includes(lastTokenType)) 
      continue;

    if (rule.type === RuleType.MATCH) {
      const regex = _compilePattern(rule);
      regex.lastIndex = pos;

      const m = regex.exec(line);
      if (m && m.index === pos)
        return { rule, match: m, length: m[0].length, type: 'match' };
    }

    if (rule.type === RuleType.BEGIN_END) {
      const beginRegex = _compileBegin(rule);
      beginRegex.lastIndex = pos;
      
      const match = beginRegex.exec(line);
      if (match && match.index === pos) {
        return { rule, match: match, length: match[0].length, type: 'begin' };
      }
    }
  }

  return null;
}

const _patternCache = new Map();

function _compilePattern(rule) {
  const cacheKey = rule.id + '_pattern'

  if (_patternCache.has(cacheKey))  {
    const cached = _patternCache.get(cacheKey);
    return new RegExp(cached.source, cached.flags);
  }
  
  let source;
  if (rule.patternType === PatternType.KEYWORDS)
    source = `\\b(${rule.pattern.map(escapeRegex).join('|')})\\b`;
  else if (rule.patternType === PatternType.WORD)
    source = `\\b${escapeRegex(rule.pattern)}\\b`;
  else
    source = rule.pattern;

  const flags = 'gd' + (rule.caseInsensitive ? 'i' : '');
  const regex = new RegExp(source, flags);

  _patternCache.set(cacheKey, regex);
  return regex;
}

function _compileBegin(rule) {
  const cacheKey = rule.id + '_begin'
  
  if (_patternCache.has(cacheKey))  {
    const cached = _patternCache.get(cacheKey);
    return new RegExp(cached.source, cached.flags);
  }

  const flags = 'gd' + (rule.caseInsensitive ? 'i' : '');
  const regex = new RegExp(rule.begin, flags);

  _patternCache.set(cacheKey, regex);
  return regex;
}

function _compileEnd(rule) {
  const cacheKey = rule.id + '_end'
  
  if (_patternCache.has(cacheKey)) {
    const cached = _patternCache.get(cacheKey);
    return new RegExp(cached.source, cached.flags);
  }

  const flags = 'gd' + (rule.caseInsensitive ? 'i' : '');
  const regex = new RegExp(rule.end, flags);

  _patternCache.set(cacheKey, regex);
  return regex;
}

function _compileDynamicEnd(rule, beginMatch) {
  const captured = beginMatch[rule.dynamicEnd.captureGroup] ?? '';
  const source = rule.dynamicEnd.template.replace('${0}', escapeRegex(captured));
  const flags = 'gd' + (rule.caseInsensitive ? 'i' : '');
  return new RegExp(source, flags);
}

function _resolveSymbol(symbolScopes, name) {
  for (let i = symbolScopes.length - 1; i >= 0; i--) {
    if (symbolScopes[i][name] !== undefined)
      return symbolScopes[i][name];
  }
  return undefined;
}

function _writeSymbol(symbolScopes, name, tokenType, scope) {
  const targetIndex = (scope === RegisterScope.STATE)
    ? symbolScopes.length - 1
    : 0; // RegisterScope.GLOBAL oder kein scope angegeben
  symbolScopes[targetIndex][name] = tokenType;
}

function _applyAction(match, lineIdx, pos, symbolScopes, currentStateId) {
  const { rule, match: m, type } = match;
  const action = type === 'begin' ? rule.beginAction : 
                 type === 'end'   ? rule.endAction   : rule.action;
  const tokens = [];

  if (!action)
    return tokens;

  if (action.captures) {
    const indices = m.indices;
    if (!indices) {
      // fallback no indizes
      for (let i = 1; i < m.length; i++) {
        const group = m[i];
        if (group == null) 
          continue;
        
        const cap = action.captures.groups[String(i)];
        if (!cap) 
          continue;
        
        if (cap.register) 
          _writeSymbol(symbolScopes, group, cap.register.tokenType, cap.register.scope);

        let capTokenType = cap.tokenType ?? TokenType.OTHER;
        const resolved = _resolveSymbol(symbolScopes, group);
        if (capTokenType === TokenType.IDENTIFIER && resolved)
          capTokenType = resolved;
        
        const groupCol = pos;
        tokens.push({
          line: lineIdx, 
          col: groupCol, 
          text: group, 
          length: group.length,
          tokenType: capTokenType, 
          stateId: currentStateId, 
          ruleId: rule.id,
        });
      }
      return tokens;
    }
  
    const fullMatch = m[0];
    const matchStart = indices[0][0];
    let lastPos = matchStart;
  
    for (let i = 1; i < m.length; i++) {
      const capIndices = indices[i];
      if (!capIndices) 
        continue;
    
      const start = capIndices[0];
      const end   = capIndices[1];
  
      if (lastPos < start) {
        const beforeText = fullMatch.slice(lastPos - matchStart, start - matchStart);
        if (beforeText) {
          tokens.push({
            line: lineIdx, 
            col: lastPos, 
            text: beforeText, 
            length: beforeText.length,
            tokenType: action.tokenType ?? TokenType.OTHER,
            stateId: currentStateId, 
            ruleId: rule.id,
          });
        }
      }
    
      const group = m[i];
      if (group != null) {
        const cap = action.captures.groups[String(i)];
        if (cap) {
          if (cap.register) 
            _writeSymbol(symbolScopes, group, cap.register.tokenType, cap.register.scope);

          let capTokenType = cap.tokenType ?? TokenType.OTHER;
          const resolved = _resolveSymbol(symbolScopes, group);
          if (capTokenType === TokenType.IDENTIFIER && resolved)
            capTokenType = resolved;

          tokens.push({
            line: lineIdx, 
            col: start, 
            text: group, 
            length: group.length,
            tokenType: capTokenType,
            stateId: currentStateId, 
            ruleId: rule.id,
          });
        } else {
          tokens.push({
            line: lineIdx, 
            col: start, 
            text: group, 
            length: group.length,
            tokenType: TokenType.OTHER,
            stateId: currentStateId, 
            ruleId: rule.id,
          });
        }
      }
      lastPos = end;
    }
  
    const matchEnd = indices[0][1];
    if (lastPos < matchEnd) {
      const afterText = fullMatch.slice(lastPos - matchStart);
      if (afterText) {
        tokens.push({
          line: lineIdx, col: lastPos, text: afterText, length: afterText.length,
          tokenType: action.tokenType ?? TokenType.OTHER,
          stateId: currentStateId, ruleId: rule.id,
        });
      }
    }
    return tokens;
  }

  let tokenType = action.tokenType ?? TokenType.OTHER;

  if (action.register)
    _writeSymbol(symbolScopes, m[0], action.register.tokenType, action.register.scope);

  const resolved = _resolveSymbol(symbolScopes, m[0]);
  if (tokenType === TokenType.IDENTIFIER && resolved)
    tokenType = resolved;

  tokens.push({
    line:      lineIdx,
    col:       pos,
    text:      m[0],
    length:    m[0].length,
    tokenType: tokenType,
    stateId:   currentStateId,
    ruleId:    rule.id,
  });

  return tokens;
}

function _applyTransition(match, stateStack, symbolScopes, activeBeginRules, stateMap) {
  const { rule, match: m, type } = match;
 
  if (type === 'begin') {
    const explicitT = rule.beginAction?.transition;
    const targetId  = (explicitT?.type === TransitionType.PUSH && explicitT.targetStateId)
      ? explicitT.targetStateId
      : rule.innerStateId;
 
    if (targetId) {
      const target = stateMap[targetId];
      if (target) {
        stateStack.push(target);
        symbolScopes.push({});
      }
    }

    const endRegex = rule.dynamicEnd ? _compileDynamicEnd(rule, m) : null;
    activeBeginRules.push({ rule, endRegex });
    return;
  }
 
  if (type === 'end') {
    activeBeginRules.pop();
 
    const explicitT = rule.endAction?.transition;
    const count = (explicitT?.type === TransitionType.POP) ? (explicitT.popCount ?? 1) : 1;
    for (let i = 0; i < count && stateStack.length > 1; i++) {
      stateStack.pop();
      if (symbolScopes.length > 1)
        symbolScopes.pop();
    }
    return;
  }
 
  const t = rule.action?.transition;
  if (!t) 
    return;
 
  if (t.type === TransitionType.PUSH && t.targetStateId) {
    const target = stateMap[t.targetStateId];
    if (target) {
      stateStack.push(target);
      symbolScopes.push({});
    }
 
  } else if (t.type === TransitionType.POP) {
    const count = t.popCount ?? 1;
    for (let i = 0; i < count && stateStack.length > 1; i++) {
      stateStack.pop();
      if (symbolScopes.length > 1)
        symbolScopes.pop();
    }
    // s.o.: activeBeginRules hier ebenfalls nicht anfassen.
 
  } else if (t.type === TransitionType.SET && t.targetStateId) {
    const target = stateMap[t.targetStateId];
    if (target && stateStack.length > 0)
      stateStack[stateStack.length - 1] = target;
  }
}

function _generateStyleObject(style, defId, styleId) {
  const {
    tokenStyles = [],
    stateTokenStyles = [],
    overrides = [],
  } = style ?? {};

  const safeTokenStyles = Array.isArray(tokenStyles) ? tokenStyles : [];
  const safeStateTokenStyles = Array.isArray(stateTokenStyles) ? stateTokenStyles : [];
  const safeOverrides = Array.isArray(overrides) ? overrides : [];


  // key = `${stateId}|${ruleId}`
  const overrideMap = new Map();
  for (const ov of safeOverrides) {
    overrideMap.set(`${ov.stateId}|${ov.ruleId}`, true);
  }

  // key = `${stateId}|${tokenType}`
  const stateTokenStyleMap = new Map();
  for (const sts of safeStateTokenStyles) {
    stateTokenStyleMap.set(`${sts.stateId}|${sts.tokenType}`, true);
  }

  // key = tokenType;
  const tokenStyleMap = new Set();
  for (const ts of safeTokenStyles) {
    tokenStyleMap.add(ts.tokenType);
  }

  const getSyntaxDefPrefix = () => {
    return `${defId}_${styleId}`;
  }

  const generateClassNameOverride = (stateId, ruleId) => {
    return `override_${getSyntaxDefPrefix()}_${stateId}_${ruleId}`;
  };

  const generateClassNameStateTokenStyle = (stateId, tokenType) => {
    return `token-state_${getSyntaxDefPrefix()}_${stateId}_${tokenType}`;
  };

  const generateClassNameTokenStyle = (tokenType) => {
    return `token-type_${getSyntaxDefPrefix()}_${tokenType}`;
  };

  return {
    overrideMap,
    stateTokenStyleMap,
    tokenStyleMap,
    
    generateClassNameOverride,
    generateClassNameStateTokenStyle,
    generateClassNameTokenStyle,
  };
}

function _createPreRenderHtmlFromText(text, linesPerChunk) {
  const chunks = _splitIntoChunks(text, linesPerChunk);
  const parts = ['<pre class="syntax-definition-highlight">'];

  chunks.forEach((chunk, i) => {
    const chunkText = chunk.lines.join('\n');
    parts.push(`<span id="syntax-chunk-${i}">${escapeHTML(chunkText)}</span>`);
    if (i < chunks.length - 1)
      parts.push('\n');
  });

  parts.push('</pre>');
  return parts.join('');
}

function _createHtmlFromLexerData(style, lexerResultData) {
  if (!Array.isArray(lexerResultData)) {
    return { ok: false, error: 'Faild to create html from lexer result. Lexer result is not an array', data: null };
  }

  const combinedTokens = _combineTokens(lexerResultData);
  const parts = [];
  let currentLine = 0;

  for (const token of combinedTokens) {
    while (currentLine < token.line) {
      parts.push('\n');
      currentLine++;
    }

    const { tokenType, stateId, ruleId } = token;
    let className = '';
    if (ruleId && style.overrideMap.has(`${stateId}|${ruleId}`)) {
      className = style.generateClassNameOverride(stateId, ruleId);
    } else if (style.stateTokenStyleMap.has(`${stateId}|${tokenType}`)) {
      className = style.generateClassNameStateTokenStyle(stateId, tokenType);
    } else if (style.tokenStyleMap.has(tokenType)) {
      className = style.generateClassNameTokenStyle(tokenType);
    } else {
      className = style.generateClassNameTokenStyle(TokenType.OTHER);
    }

    const text = token.text ?? '';
    parts.push(`<span class="${className}">${escapeHTML(text)}</span>`);
  }

  return { ok: true, error: undefined, data: parts.join('') };
}

function _combineTokens(tokens) {
  const combinedTokens = [];
 
  if (!Array.isArray(tokens) || tokens.length === 0)
    return combinedTokens;
 
  let currentToken = { ...tokens[0] };
 
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];

    const canMerge =
      currentToken.stateId   === tok.stateId   &&
      currentToken.tokenType === tok.tokenType  &&
      currentToken.line      === tok.line       &&
      currentToken.tokenType !== TokenType.LINEBREAK;
 
    if (!canMerge) {
      combinedTokens.push(currentToken);
      currentToken = { ...tok };
      continue;
    }
    
    currentToken.text = (currentToken.text ?? '') + (tok.text ?? '');
    currentToken.length += tok.length;
  }
 
  combinedTokens.push(currentToken);
 
  return combinedTokens;
}