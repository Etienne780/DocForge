import { 
  findRootSyntaxState, 
  TokenType,
  RegisterScope,
  RuleType,
  PatternType,
  TransitionType,
  OnUnmatched,
} from '@data/SyntaxDefinitionManager.js';
import { escapeRegex, escapeHTML } from '@common/Common.js';

const LINES_PER_CHUNK = 100;

self.onmessage = async e => {
  const { syntaxDefinition, styleIndex, text } = e.data;

//const test = JSON.parse(JSON.stringify(syntaxDefinition));
//console.log(JSON.stringify(test, null, 2));

  try {
    const rootState = findRootSyntaxState(syntaxDefinition);

    if(!rootState) {
      self.postMessage({
        ok: false,
        error: 'root state missing',
      });

      return;
    }

    // rootState.rules = rootState.rules.filter(r => r.name !== 'preprocessor');

    const highlightStyle = syntaxDefinition.styles[styleIndex];
    const styleObject = _generateStyleObject(highlightStyle);
    const css = _generateCss(highlightStyle, styleObject);
    self.postMessage({
      ok: true,
      done: false,
      type: 'css',
      css: css,
    });

    if (!rootState || 
      !Array.isArray(syntaxDefinition.states) || 
      !Array.isArray(syntaxDefinition.predefinedSymbols)) {
      return { 
        ok: false,
        error: 'LexerData incomplete',
        data: null,
      };
    }
    
    const stateMap = Object.fromEntries(syntaxDefinition.states.map(s => [s.id, s]));
    const symbolMap = _generateSymboleMap({
      symbolHoisting: Boolean(syntaxDefinition.symbolHoisting),
      rootState: rootState,
      stateMap: stateMap,
      predefined: syntaxDefinition.predefinedSymbols, 
      text: text,
    }); 

    let carry = {
      stateStack:  [rootState],
      symbolMap:   symbolMap,
      activeBeginRules: [],
    };

    const chunks = _splitIntoChunks(text, LINES_PER_CHUNK);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      console.log('Root state:', rootState.name, 'rules:', rootState.rules.length);
      if (rootState.rules.length > 0) {
        console.log('First rule includeStateId:', rootState.rules[0].includeStateId);
        console.log('First rule pattern:', rootState.rules[0].pattern);
        console.log('First rule begin:', rootState.rules[0].begin);
        console.log('First rule end:', rootState.rules[0].end);
      }

      const result = _lexeChunk(stateMap, carry, chunk.lines);

      if (!result.ok) {
        self.postMessage({
          ok: false,
          error: `Chunk[${chunk.lineStart}-${chunk.lineStart + LINES_PER_CHUNK}]: `+ result.error,
        });
        return;
      }
      
      carry = result.carry;
      
      const resultHTML = _createHtmlFromLexerData(styleObject, result.data);

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

function _generateSymboleMap({ symbolHoisting, rootState, stateMap, predefined, text }) {
  let map = Object.fromEntries(predefined.map(def => [def.name, def.tokenType]));

  if (!symbolHoisting)
    return map;


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
  white-space: pre-wrap; 
  tab-size: 8;
}`);
  
  return cssStyles.join('\n');
}

function _lexeChunk(stateMap, carry, lines) {
  // copy symbol and state stack from prev
  const stateStack  = [...carry.stateStack];
  const symbolMap   = { ...carry.symbolMap };
  const activeBeginRules = [...carry.activeBeginRules];

  const tokens = []; // { line, col, length, tokenType, stateId, ruleId }
  let lastTokenType = null;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let pos = 0;

console.log(line.charCodeAt(0), line.charCodeAt(1))

    while (pos < line.length) {
      const currentState = stateStack[stateStack.length - 1];
      const match = _matchRules(currentState, activeBeginRules, stateMap, line, pos, lastTokenType);

      if (!match) {
        // onUnmatched
        const ch = line[pos];
        if (currentState.onUnmatched === OnUnmatched.CHARACTER) {
          const activeRule = activeBeginRules.length > 0
            ? activeBeginRules[activeBeginRules.length - 1].rule
            : null;
          const tokenType = activeRule?.contentTokenType ?? TokenType.OTHER;
          
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
        }
        pos++;
        continue;
      }

      // Captures or tokenType
      const emittedTokens = _applyAction(match, lineIdx, pos, symbolMap, currentState.id);
      tokens.push(...emittedTokens);
      lastTokenType = emittedTokens.at(-1)?.tokenType ?? lastTokenType;

      // Transition
      _applyTransition(match, stateStack, activeBeginRules, stateMap);

      pos += match.length;
    }
    if (activeBeginRules.length > 0) {
      const { rule: activeRule, endRegex } = activeBeginRules[activeBeginRules.length - 1];
      const regex = endRegex ?? _compileEnd(activeRule);
      regex.lastIndex = pos; // pos === line.length hier
      const m = regex.exec(line);
      if (m) {
        const emittedTokens = _applyAction(
          { rule: activeRule, match: m, length: m[0].length, type: 'end' },
          lineIdx, m.index, symbolMap, stateStack[stateStack.length - 1].id
        );
        tokens.push(...emittedTokens);
        _applyTransition(
          { rule: activeRule, type: 'end', match: m },
          stateStack, activeBeginRules, stateMap
        );
      }
    }
  }

  return {
    ok: true,
    data:  tokens,
    carry: { stateStack, symbolMap, activeBeginRules },
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
      console.log(`Checking preprocessor rule on line: "${line.substring(pos, pos+20)}..."`);
      const beginRegex = _compileBegin(rule);
      beginRegex.lastIndex = pos;
      
      const match = beginRegex.exec(line);
      if (match && match.index === pos) {
        console.log(`Preprocessor matched!`);
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

  console.log('Compiling pattern for rule', rule.name, 'source:', source);

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

  console.log(`Compiling begin for ${rule.name}: pattern="${rule.begin}", flags="${flags}"`);
  console.log(`Resulting regex source: ${regex.source}`);

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

function _applyAction(match, lineIdx, pos, symbolMap, currentStateId) {
  const { rule, match: m, type } = match;
  const action = type === 'begin' ? rule.beginAction : 
                 type === 'end'   ? rule.endAction   : rule.action;
  const tokens = [];

  if (!action)
    return tokens;

  if (action.captures) {
    for (let i = 1; i < m.length; i++) {
      const group = m[i];
      if (group == null) 
        continue;

      const cap = action.captures.groups[String(i)];
      if (!cap)
        continue; 

      if (cap.register)
        symbolMap[group] = cap.register.tokenType;

      const groupCol = m.indices ? m.indices[i][0] : pos;

      tokens.push({
        line:      lineIdx,
        col:       groupCol,
        text:      group, 
        length:    group.length,
        tokenType: cap.tokenType,
        stateId:   currentStateId,
        ruleId:    rule.id,
      });
    }
    return tokens;
  }

  let tokenType = action.tokenType ?? 'other';

  if (action.register)
    symbolMap[m[0]] = action.register.tokenType;

  if (tokenType === TokenType.IDENTIFIER && symbolMap[m[0]])
    tokenType = symbolMap[m[0]];

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

function _applyTransition(match, stateStack, activeBeginRules, stateMap) {
  const { rule, type } = match;
  const action = type === 'begin' ? rule.beginAction : 
                 type === 'end'   ? rule.endAction   : rule.action;

  const t = action?.transition;
  if (!t) 
    return;

  if (t.type === TransitionType.PUSH && t.targetStateId) {
    const target = stateMap[t.targetStateId];
    if (target)
      stateStack.push(target);

    if (rule.dynamicEnd) {
      activeBeginRules.push({ rule, endRegex: _compileDynamicEnd(rule, match.match) });
    } else {
      activeBeginRules.push({ rule, endRegex: null });
    }
  } else if (t.type === TransitionType.POP) {
    const count = t.popCount ?? 1;

    for (let i = 0; i < count && stateStack.length > 1; i++)
      stateStack.pop();
    
    activeBeginRules.pop();
  } else if (t.type === TransitionType.SET && t.targetStateId) {
    const target = stateMap[t.targetStateId];
    if (target && stateStack.length > 0)
      stateStack[stateStack.length - 1] = target;
  }
}

function _generateStyleObject(style) {
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

  const generateClassNameOverride = (stateId, ruleId) => {
    return `override_${stateId}_${ruleId}`;
  };

  const generateClassNameStateTokenStyle = (stateId, tokenType) => {
    return `token-state_${stateId}_${tokenType}`;
  };

  const generateClassNameTokenStyle = (tokenType) => {
    return `token-type_${tokenType}`;
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

function _createHtmlFromLexerData(style, lexerResultData) {
  if(!Array.isArray(lexerResultData)) {
    return { 
      ok: false,
      error: 'Faild to create html from lexer result. Lexer result is not an array',
      data: null,
    };
  }

  const {
    overrideMap,
    stateTokenStyleMap,
    tokenStyleMap,
  } = style;
  
  let html = '';
  let currentLine = 0;
  for (const token of lexerResultData) {
    const { tokenType, stateId, ruleId } = token;

    let className = '';
    // 1. Override?
    if (ruleId && overrideMap.has(`${stateId}|${ruleId}`)) {
      className = style.generateClassNameOverride(stateId, ruleId);
    }
    // 2. StateTokenStyle?
    else if (stateTokenStyleMap.has(`${stateId}|${tokenType}`)) {
      className = style.generateClassNameStateTokenStyle(stateId, tokenType);
    }
    // 3. global TokenStyle?
    else if (tokenStyleMap.has(tokenType)) {
      className = style.generateClassNameTokenStyle(tokenType);
    }
    // 4. Fallback: OTHER
    else {
      className = style.generateClassNameTokenStyle(TokenType.OTHER);
    }

    while (currentLine < token.line) {
      html += '<br>';
      currentLine++;
    }

    const text = token.text ?? ''; 
    html += `<span class="syntax-definition-highlight ${className}">${escapeHTML(text)}</span>`;
  }

  return { ok: true, error: undefined, data: html };
}