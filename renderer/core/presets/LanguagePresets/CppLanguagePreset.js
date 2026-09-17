import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxCaptureMap,
  createSymbolRegister,
  createSyntaxStateTransition,
  createDynamicEnd,
  createBalancedLookahead,
  createHighlightStyle,
  createTokenStyle,
  createPredefinedSymbol,
  RuleType,
  PatternType,
  TokenType,
  TransitionType,
  RegisterScope,
  OnUnmatched,
} from '@data/SyntaxDefinitionManager.js';

// Push a new SyntaxStateRule onto a state.
function addRule(syntaxState, name, setup) {
  const rule = createSyntaxStateRule(name);
  setup(rule);
  syntaxState.rules.push(rule);
  return rule;
}

// Push a new SyntaxState onto def.states.
function newState(def, name) {
  const s = createSyntaxState(name);
  def.states.push(s);
  return s;
}

// Matches `name(` / `~name(` (function def/call, destructor) as FUNCTION.
// registerScope: GLOBAL to also register in symbol table, null to skip
// (used for class members, to avoid clobbering the class's TYPE symbol).
function addFunctionDefinitionRule(state, name, registerScope) {
  addRule(state, name, r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(~)?\b([A-Za-z_]\w*)\s*(?=\()/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    caps.groups['2'] = {
      tokenType: TokenType.FUNCTION,
      register: registerScope ? createSymbolRegister(TokenType.FUNCTION, registerScope) : null,
    };
    a.captures = caps;
    r.action = a;
  });
}

export function createCPPLanguage() {
  const def = createSyntaxDefinition('C++');
  def.aliases = ['cpp', 'c++', 'cxx', 'cc'];
  def.id = "CppLang";
  def.builtIn = true;
  def.symbolHoisting = false;

  // ── Predefined symbols ──────────────────────────────────────────────────
  const predefined = [
    ['std',   TokenType.NAMESPACE],
    ['boost', TokenType.NAMESPACE],
    ['string',        TokenType.TYPE],
    ['wstring',       TokenType.TYPE],
    ['string_view',   TokenType.TYPE],
    ['vector',        TokenType.TYPE],
    ['map',           TokenType.TYPE],
    ['unordered_map', TokenType.TYPE],
    ['set',           TokenType.TYPE],
    ['unordered_set', TokenType.TYPE],
    ['list',          TokenType.TYPE],
    ['deque',         TokenType.TYPE],
    ['queue',         TokenType.TYPE],
    ['stack',         TokenType.TYPE],
    ['array',         TokenType.TYPE],
    ['pair',          TokenType.TYPE],
    ['tuple',         TokenType.TYPE],
    ['optional',      TokenType.TYPE],
    ['variant',       TokenType.TYPE],
    ['any',           TokenType.TYPE],
    ['function',      TokenType.TYPE],
    ['unique_ptr',    TokenType.TYPE],
    ['shared_ptr',    TokenType.TYPE],
    ['weak_ptr',      TokenType.TYPE],
    ['initializer_list', TokenType.TYPE],
    ['exception',     TokenType.TYPE],
    ['runtime_error', TokenType.TYPE],
    ['logic_error',   TokenType.TYPE],
    ['cout',  TokenType.VARIABLE],
    ['cin',   TokenType.VARIABLE],
    ['cerr',  TokenType.VARIABLE],
    ['clog',  TokenType.VARIABLE],
    ['endl',  TokenType.VARIABLE],
    ['flush', TokenType.VARIABLE],
    ['ws',    TokenType.VARIABLE],
    ['nullopt', TokenType.LITERAL],
    ['nullptr', TokenType.LITERAL],
    ['true',    TokenType.LITERAL],
    ['false',   TokenType.LITERAL],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // ── States ────────────────────────────────────────────────────────────
  const root = def.states.find(s => s.id === def.rootStateId);

  const sharedRules = newState(def, 'shared_rules'); // included by root + class_body

  const rawString = newState(def, 'raw_string');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape'); // shared by strDouble/strSingle

  const blockComment  = newState(def, 'block_comment');

  const preproc       = newState(def, 'preprocessor');
  const preprocInclude = newState(def, 'preprocessor_include');
  const preprocSysHeader = newState(def, 'preprocessor_sysheader');
  const preprocStrHeader = newState(def, 'preprocessor_strheader');

  const templateArgs  = newState(def, 'template_args'); // inside <...>

  // Entered on `{` right after a class/struct/union/enum name.
  const classBody = newState(def, 'class_body');

  // ── strEscape ─────────────────────────────────────────────────────────
  strEscape.onUnmatched = OnUnmatched.CHARACTER;

  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:['"\\abfnrtv0]|x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[0-7]{1,3})/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.ESCAPE;
    r.action = a;
  });

  // ── strDouble ─────────────────────────────────────────────────────────
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // ── strSingle ─────────────────────────────────────────────────────────
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // ── blockComment ──────────────────────────────────────────────────────
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // ── templateArgs ──────────────────────────────────────────────────────
  templateArgs.onUnmatched = OnUnmatched.CHARACTER;

  // Nested `<...>` inside template args.
  addRule(templateArgs, 'nested_template', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '<';
    r.end   = '>';
    r.beginAction = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.PUNCTUATION; const t = createSyntaxStateTransition(TransitionType.PUSH, templateArgs.id); a.transition = t; return a; })();
    r.endAction   = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.PUNCTUATION; const t = createSyntaxStateTransition(TransitionType.POP); a.transition = t; return a; })();
    r.contentTokenType = TokenType.TYPE;
    r.innerStateId = templateArgs.id;
  });

  // Bare identifier inside `<...>`.
  addRule(templateArgs, 'type_in_template', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.TYPE;
    r.action = a;
  });

  // `,` `*` `&` inside `<...>`.
  addRule(templateArgs, 'punctuation_in_template', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[,*&]/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.PUNCTUATION;
    r.action = a;
  });

  // ── Preprocessor states ───────────────────────────────────────────────
  preproc.onUnmatched = OnUnmatched.CHARACTER;

  // `#include <...>`.
  addRule(preprocInclude, 'sys_header', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '<';
    r.end   = '>';
    r.beginAction = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.PUNCTUATION; const t = createSyntaxStateTransition(TransitionType.PUSH, preprocSysHeader.id); a.transition = t; return a; })();
    r.endAction   = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.PUNCTUATION; const t = createSyntaxStateTransition(TransitionType.POP); a.transition = t; return a; })();
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = preprocSysHeader.id;
  });

  preprocSysHeader.onUnmatched = OnUnmatched.CHARACTER;

  // `#include "..."`.
  addRule(preprocInclude, 'str_header', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.STRING; const t = createSyntaxStateTransition(TransitionType.PUSH, preprocStrHeader.id); a.transition = t; return a; })();
    r.endAction   = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.STRING; const t = createSyntaxStateTransition(TransitionType.POP); a.transition = t; return a; })();
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = preprocStrHeader.id;
  });

  preprocStrHeader.onUnmatched = OnUnmatched.CHARACTER;

  // ── sharedRules ───────────────────────────────────────────────────────

  // `//...`
  addRule(sharedRules, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.COMMENT;
    r.action = a;
  });

  // `/* ... */`
  addRule(sharedRules, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.COMMENT;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, blockComment.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.COMMENT;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // `R"delim(...)delim"`
  addRule(sharedRules, 'raw_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /R"([^(]*)\(/.source;
    r.dynamicEnd = createDynamicEnd(1, ')${0}"');
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.STRING;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, rawString.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.STRING;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = rawString.id;
  });

  rawString.onUnmatched = OnUnmatched.CHARACTER;

  // `"..."`
  addRule(sharedRules, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.STRING;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, strDouble.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.STRING;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // `'...'`
  addRule(sharedRules, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = "'";
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.STRING;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, strSingle.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.STRING;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // `0x...`
  addRule(sharedRules, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /0[xX][0-9a-fA-F']+(?:[uUlL]*)/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NUMBER; r.action = a;
  });

  // `0b...`
  addRule(sharedRules, 'number_bin', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /0[bB][01']+(?:[uUlL]*)/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NUMBER; r.action = a;
  });

  // `1.5f` etc.
  addRule(sharedRules, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d[\d']*\.[\d']*(?:[eE][+-]?\d+)?[fFlL]?\b/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NUMBER; r.action = a;
  });

  // plain int literal
  addRule(sharedRules, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d[\d']*(?:[uUlL]*)\b/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NUMBER; r.action = a;
  });

  // arithmetic/bitwise/logical/comparison/assignment/pointer/scope operators
  addRule(sharedRules, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /->|::|<<|>>|<<=|>>=|\+\+|--|&&|\|\||[+\-*/%&|^~!<>=?:]=?|\.\.\./.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.OPERATOR; r.action = a;
  });

  // `()[],.;` — braces handled separately below
  addRule(sharedRules, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[()\[\],.;]/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.PUNCTUATION; r.action = a;
  });

  // generic `{` — pushes root again for any block that isn't a class body
  addRule(sharedRules, 'brace_open', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\{/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.PUNCTUATION;
    a.transition = createSyntaxStateTransition(TransitionType.PUSH, root.id);
    r.action = a;
  });

  // matching `}`
  addRule(sharedRules, 'brace_close', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\}/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.PUNCTUATION;
    a.transition = createSyntaxStateTransition(TransitionType.POP);
    r.action = a;
  });

  // ── ROOT state ────────────────────────────────────────────────────────

  // `#...` directive lines
  addRule(root, 'preprocessor', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /^[ \t]*#/.source;
    r.end   = /(?<!\\)$/.source;
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.KEYWORD;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, preproc.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.KEYWORD;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.contentTokenType = TokenType.KEYWORD;
    r.innerStateId = preproc.id;
  });

  // first word after `#`
  addRule(preproc, 'preproc_keyword', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = ['include', 'define', 'undef', 'if', 'ifdef', 'ifndef',
                  'elif', 'else', 'endif', 'pragma', 'error', 'warning', 'line'];
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.KEYWORD; r.action = a;
  });

  // path after `#include`
  addRule(preproc, 'include_path', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = preprocInclude.id;
    r.context = { afterTokenType: [TokenType.KEYWORD] }; 
  });

  // macro name after `#define` → register as FUNCTION
  addRule(preproc, 'macro_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=\bdefine\s+)[A-Z_][A-Z0-9_]*/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.FUNCTION;
    a.register = createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL);
    r.action = a;
  });

  // `class/struct/union/enum Name` → registers TYPE. Must run before
  // 'keywords' below, otherwise the bare keyword gets matched alone first.
  addRule(root, 'type_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(class|struct|union|enum(?:\s+class)?)\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD,  register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // `namespace Name(::Name)*` → registers NAMESPACE. Same ordering reason
  // as type_declaration above.
  addRule(root, 'namespace_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(namespace)\s+([A-Za-z_]\w*)(?:::([A-Za-z_]\w*))?(?:::([A-Za-z_]\w*))?(?:::([A-Za-z_]\w*))?/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    for (const g of ['2', '3', '4', '5']) {
      caps.groups[g] = {
        tokenType: TokenType.NAMESPACE,
        register: createSymbolRegister(TokenType.NAMESPACE, RegisterScope.GLOBAL)
      };
    }
    a.captures = caps;
    r.action = a;
  });
  
  // `using Name =` → registers new TYPE alias
  addRule(root, 'using_alias', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\busing\s+([A-Za-z_]\w*)\s*=(?!=)/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.KEYWORD;
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // general C++ keywords
  addRule(root, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
      'break', 'continue', 'return', 'goto',
      'const', 'constexpr', 'consteval', 'constinit', 'volatile', 'mutable',
      'static', 'extern', 'register', 'inline', 'thread_local',
      'virtual', 'override', 'final', 'explicit', 'friend',
      'public', 'private', 'protected',
      'class', 'struct', 'union', 'enum', 'namespace', 'template',
      'typename', 'typedef', 'using', 'auto', 'decltype',
      'new', 'delete', 'sizeof', 'alignof', 'alignas',
      'try', 'catch', 'throw', 'noexcept',
      'static_cast', 'dynamic_cast', 'const_cast', 'reinterpret_cast',
      'operator', 'this', 'co_await', 'co_yield', 'co_return',
      'export', 'module', 'import',
    ];
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.KEYWORD; r.action = a;
  });

  // built-in primitive types — colored as KEYWORD, TYPE is reserved for
  // user-defined class/struct/union/enum names
  addRule(root, 'primitive_types', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'void', 'bool', 'char', 'wchar_t', 'char8_t', 'char16_t', 'char32_t',
      'short', 'int', 'long', 'float', 'double',
      'signed', 'unsigned',
      'int8_t', 'int16_t', 'int32_t', 'int64_t',
      'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
      'size_t', 'ptrdiff_t', 'intptr_t', 'uintptr_t',
      'nullptr_t',
    ];
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.KEYWORD; r.action = a;
  });

  // `nullptr`, `true`, `false`, `NULL`, ...
  addRule(root, 'literals', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = ['nullptr', 'true', 'false', 'NULL', 'EXIT_SUCCESS', 'EXIT_FAILURE'];
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.LITERAL; r.action = a;
  });

  // `[[nodiscard]]`, `[[deprecated]]`, ...
  addRule(root, 'attribute', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\[\[[^\]]*\]\]/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.DECORATOR; r.action = a;
  });

  // `{` right after a TYPE token (i.e. the name from type_declaration) →
  // push class_body instead of the generic block state
  addRule(root, 'class_body_open', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\{/.source;
    r.context = { afterTokenType: [TokenType.TYPE] };
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.PUNCTUATION;
    a.transition = createSyntaxStateTransition(TransitionType.PUSH, classBody.id);
    r.action = a;
  });

  // free function/ctor/dtor definitions — registers GLOBAL FUNCTION symbol
  addFunctionDefinitionRule(root, 'function_definition', RegisterScope.GLOBAL);

  // `name<...>(` — templated function call, e.g. GetValue<int>(...) or
  // TryGetValue<std::vector<Vector2>>(...). Angle-bracket balance/nesting
  // is checked by balancedLookahead, not consumed by pattern.
  addRule(root, 'templated_function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Za-z_]\w*(?=\s*<)/.source;
    r.balancedLookahead = createBalancedLookahead('<', '>', '\\(');
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.FUNCTION;
    r.action = a;
  });

  // `Name::` — scope-resolution qualifier
  addRule(root, 'namespace_qualifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*(?=::)/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NAMESPACE; r.action = a;
  });

  // `Name<` — template instantiation, e.g. Vector2<float>
  addRule(root, 'template_open', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*(?=<)/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.TYPE; r.action = a;
  });

  // fallback: capitalized identifier → assume TYPE
  addRule(root, 'capitalized_identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Z][A-Za-z0-9_]*\b/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.TYPE;
    r.action = a;
  });

  // fallback: any other identifier → symbol table decides at runtime
  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Za-z_]\w*\b/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.IDENTIFIER; r.action = a;
  });

  // comments/strings/numbers/operators/punctuation/braces
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = sharedRules.id;
  });

  // ── classBody ─────────────────────────────────────────────────────────
  classBody.onUnmatched = OnUnmatched.CHARACTER;

  // ctor/dtor/methods → FUNCTION, no symbol registration. Must come before
  // include_root so it wins over root's registering function_definition.
  addFunctionDefinitionRule(classBody, 'member_function_definition', null);

  // everything else (access specifiers, types, nested classes, comments,
  // strings, numbers, operators, generic `{}` for method bodies, ...)
  addRule(classBody, 'include_root', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = root.id;
  });

  // ── Example code for the editor preview ──────────────────────────────
  def.exampleCode = `
#include <iostream>
#include <vector>
#include <memory>

namespace geometry {

  template<typename T>
  class Vector2 {
  public:
    T x, y;

    constexpr Vector2(T x, T y) : x(x), y(y) {}

    [[nodiscard]] T length() const {
      return std::sqrt(x * x + y * y);
    }

    Vector2 operator+(const Vector2& rhs) const {
      return { x + rhs.x, y + rhs.y };
    }
  };

} // namespace geometry

class Test {
public:
  Test() = default;
  ~Test() = default;

  bool GetValue() const;

private:
  bool m_value = true;
};

Test das;

void ComputeValue() {
}
ComputeValue das2;

int main() {
  auto v1 = geometry::Vector2<float>{ 3.0f, 4.0f };
  auto v2 = geometry::Vector2<float>{ 1.0f, 2.0f };
  auto v3 = v1 + v2;

  std::cout << "length = " << v3.length() << std::endl;

  /* block comment */
  // line comment
  uint32_t hex = 0xFF'AA'BB;
  std::string raw = R"(raw string)";

  return 0;
}
`;
  return def;
}

export function createCPPLanguageStyles(cppDef) {
  const darkStyle = createHighlightStyle(cppDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.TYPE,          '#4ec9b0'),
    createTokenStyle(TokenType.IDENTIFIER,    '#9cdcfe'),
    createTokenStyle(TokenType.VARIABLE,      '#9cdcfe'),
    createTokenStyle(TokenType.FUNCTION,      '#dcdcaa'),
    createTokenStyle(TokenType.PARAMETER,     '#9cdcfe', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#9cdcfe'),
    createTokenStyle(TokenType.OPERATOR,      '#d4d4d4'),
    createTokenStyle(TokenType.PUNCTUATION,   '#d4d4d4'),
    createTokenStyle(TokenType.NUMBER,        '#b5cea8'),
    createTokenStyle(TokenType.STRING,        '#ce9178'),
    createTokenStyle(TokenType.COMMENT,       '#6a9955', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#d7ba7d'),
    createTokenStyle(TokenType.DECORATOR,     '#c8c8c8'),
    createTokenStyle(TokenType.NAMESPACE,     '#d4d4d4'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  return [darkStyle];
}