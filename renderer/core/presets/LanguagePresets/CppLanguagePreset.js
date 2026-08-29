import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxCaptureMap,
  createSymbolRegister,
  createSyntaxStateTransition,
  createDynamicEnd,
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

/**
 * Appends a SyntaxStateRule directly to a SyntaxState object and returns it.
 * (Avoids needing a defId round-trip during preset construction.)
 */
function addRule(syntaxState, name, setup) {
  const rule = createSyntaxStateRule(name);
  setup(rule);
  syntaxState.rules.push(rule);
  return rule;
}

/** Shorthand: push a new state onto `def.states` and return it. */
function newState(def, name) {
  const s = createSyntaxState(name);
  def.states.push(s);
  return s;
}

/**
 * Adds a MATCH rule that recognizes `name(` (a function/method definition
 * or call) and also `~name(` (a destructor), coloring the optional leading
 * `~` *and* the name itself as FUNCTION.
 *
 * `registerScope`: pass a RegisterScope to also register the name as a
 * FUNCTION symbol (so later *bare* occurrences, without a `(`, also get
 * FUNCTION-colored via the symbol table). Pass `null` to skip registration
 * entirely — every occurrence with a `(` is still colored FUNCTION, since
 * that comes directly from this rule matching, not from the symbol table.
 *
 * Used with RegisterScope.GLOBAL for free functions in `root`, and with
 * `null` (no registration) for methods/constructors/destructors in
 * `class_body`. RegisterScope.STATE was tried for the latter, but the
 * symbol table doesn't seem to actually expire STATE-scoped entries once
 * the state is popped — a constructor like `Test()` inside `class Test`
 * kept overwriting the class's own GLOBAL `TYPE` registration for `Test`
 * even *after* leaving the class body. Not registering member names avoids
 * that collision; the tradeoff is a bare (paren-less) reference to a
 * member name elsewhere won't be recolored via the symbol table — a rare
 * case in practice.
 *
 * Note: intentionally has no `notAfterTokenType` guard — an earlier version
 * blocked matches right after any PUNCTUATION token, which (since `;` and
 * `.` are both tokenized as PUNCTUATION) also incorrectly blocked ordinary
 * declarations following a previous statement, e.g. the `~Test(` in
 * `Test() = default;\n~Test() = default;` right after that `;`.
 */
function addFunctionDefinitionRule(state, name, registerScope) {
  addRule(state, name, r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    // optional leading `~` so destructors (`~Test()`) get full FUNCTION coloring
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
  def.symbolHoisting = false; // C++ is declaration-order sensitive

  // ── Predefined symbols ────────────────────────────────────────────────────
  const predefined = [
    // Standard namespaces
    ['std',   TokenType.NAMESPACE],
    ['boost', TokenType.NAMESPACE],
    // Common standard types
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
    // Common variables / objects
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

  // ──────────────────────────────────────────────────────────────────────────
  // States
  // ──────────────────────────────────────────────────────────────────────────

  const root = def.states.find(s => s.id === def.rootStateId); // auto-created root

  // ── Shared rules state (included in root + other states) ──────────────────
  const sharedRules = newState(def, 'shared_rules');

  // ── String states ─────────────────────────────────────────────────────────
  const rawString = newState(def, 'raw_string');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape'); // shared escape sequences

  // ── Comment states ────────────────────────────────────────────────────────
  const blockComment  = newState(def, 'block_comment');

  // ── Preprocessor states ───────────────────────────────────────────────────
  const preproc       = newState(def, 'preprocessor');
  const preprocInclude = newState(def, 'preprocessor_include');
  const preprocSysHeader = newState(def, 'preprocessor_sysheader');
  const preprocStrHeader = newState(def, 'preprocessor_strheader');

  // ── Template argument state ───────────────────────────────────────────────
  const templateArgs  = newState(def, 'template_args');

  // ── Class / struct / union body state ─────────────────────────────────────
  // Pushed whenever a `{` directly follows a class/struct/union (or enum
  // class) name. Its member_function_definition rule (see below) colors
  // methods/constructors/destructors as FUNCTION without registering them
  // in the symbol table, so a member name (e.g. a constructor `Test()`
  // matching the class name `Test`) can't overwrite the class's own
  // GLOBAL `TYPE` registration.
  const classBody = newState(def, 'class_body');

  // ──────────────────────────────────────────────────────────────────────────
  // strEscape — escape sequences inside strings
  // ──────────────────────────────────────────────────────────────────────────
  strEscape.onUnmatched = OnUnmatched.CHARACTER;

  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:['"\\abfnrtv0]|x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[0-7]{1,3})/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.ESCAPE;
    r.action = a;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // strDouble — content of "…" strings
  // ──────────────────────────────────────────────────────────────────────────
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // strSingle — content of '…' characters
  // ──────────────────────────────────────────────────────────────────────────
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // blockComment
  // ──────────────────────────────────────────────────────────────────────────
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT; // fallback for all content

  // ──────────────────────────────────────────────────────────────────────────
  // templateArgs — inside <…> after a type name
  // ──────────────────────────────────────────────────────────────────────────
  templateArgs.onUnmatched = OnUnmatched.CHARACTER;

  addRule(templateArgs, 'nested_template', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '<';
    r.end   = '>';
    r.beginAction = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.PUNCTUATION; const t = createSyntaxStateTransition(TransitionType.PUSH, templateArgs.id); a.transition = t; return a; })();
    r.endAction   = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.PUNCTUATION; const t = createSyntaxStateTransition(TransitionType.POP); a.transition = t; return a; })();
    r.contentTokenType = TokenType.TYPE;
    r.innerStateId = templateArgs.id;
  });

  addRule(templateArgs, 'type_in_template', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.TYPE;
    r.action = a;
  });

  addRule(templateArgs, 'punctuation_in_template', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[,*&]/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.PUNCTUATION;
    r.action = a;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Preprocessor states
  // ──────────────────────────────────────────────────────────────────────────
  preproc.onUnmatched = OnUnmatched.CHARACTER;

  // #include <…>  — system header
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

  // #include "…"  — project header
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

  // ──────────────────────────────────────────────────────────────────────────
  // sharedRules — reusable rule set included in root and other states
  // ──────────────────────────────────────────────────────────────────────────

  // ── Line comment //…
  addRule(sharedRules, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.COMMENT;
    r.action = a;
  });

  // ── Block comment /*…*/
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

  // ── Raw string literal  R"delim(…)delim"
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

  // ── Double-quoted string "…"
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

  // ── Single-quoted char '…'
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

  // ── Numbers
  addRule(sharedRules, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /0[xX][0-9a-fA-F']+(?:[uUlL]*)/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NUMBER; r.action = a;
  });

  addRule(sharedRules, 'number_bin', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /0[bB][01']+(?:[uUlL]*)/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NUMBER; r.action = a;
  });

  addRule(sharedRules, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d[\d']*\.[\d']*(?:[eE][+-]?\d+)?[fFlL]?\b/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NUMBER; r.action = a;
  });

  addRule(sharedRules, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d[\d']*(?:[uUlL]*)\b/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NUMBER; r.action = a;
  });

  // ── Operators
  addRule(sharedRules, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    // arithmetic, bitwise, logical, comparison, assignment, pointer, scope
    r.pattern = /->|::|<<|>>|<<=|>>=|\+\+|--|&&|\|\||[+\-*/%&|^~!<>=?:]=?|\.\.\./.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.OPERATOR; r.action = a;
  });

  // ── Punctuation (braces are handled separately below, see brace_open/brace_close)
  addRule(sharedRules, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[()\[\],.;]/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.PUNCTUATION; r.action = a;
  });

  // ── Generic block braces `{ }` — push/pop a state so nested scopes
  //    (function bodies, if/for/while blocks, namespaces, …) stay balanced.
  //    `class_body_open` in `root` (see below) intercepts the opening brace
  //    right after a class/struct/union name and pushes `class_body`
  //    instead; this pair only handles every other `{ }`.
  addRule(sharedRules, 'brace_open', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\{/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.PUNCTUATION;
    a.transition = createSyntaxStateTransition(TransitionType.PUSH, root.id);
    r.action = a;
  });

  addRule(sharedRules, 'brace_close', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\}/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.PUNCTUATION;
    a.transition = createSyntaxStateTransition(TransitionType.POP);
    r.action = a;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // ROOT state
  // ──────────────────────────────────────────────────────────────────────────

  // ── Preprocessor directives  #include, #define, #ifdef, …
  addRule(root, 'preprocessor', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /^[ \t]*#/.source;
    r.end   = /(?<!\\)$/.source; // end of line (respects line continuation)
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

  // Preprocessor keyword (first token after #)
  addRule(preproc, 'preproc_keyword', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = ['include', 'define', 'undef', 'if', 'ifdef', 'ifndef',
                  'elif', 'else', 'endif', 'pragma', 'error', 'warning', 'line'];
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.KEYWORD; r.action = a;
  });

  // #include <…> / "…"
  addRule(preproc, 'include_path', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = preprocInclude.id;
    r.context = { afterTokenType: [TokenType.KEYWORD] }; 
  });

  // #define macro name  → register as FUNCTION
  addRule(preproc, 'macro_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=\bdefine\s+)[A-Z_][A-Z0-9_]*/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.FUNCTION;
    a.register = createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL);
    r.action = a;
  });

  // ── Class / struct / enum declaration  → registers type name
  //    IMPORTANT: this must run before the generic 'keywords' rule below.
  //    'class'/'struct'/'union'/'enum' are also plain keywords in that list;
  //    if 'keywords' matched first it would consume just the bare keyword
  //    (e.g. "class") one token at a time, and this rule would never get a
  //    chance to match "class Name" as a unit — leaving the class name
  //    colored as a plain identifier instead of TYPE, and unregistered.
  addRule(root, 'type_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    // group 1 = keyword, group 2 = type name
    r.pattern = /\b(class|struct|union|enum(?:\s+class)?)\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD,  register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // ── Namespace declaration  → registers namespace name
  //    Same reasoning as type_declaration above: must run before 'keywords'
  //    since 'namespace' is also in that plain-keyword list.
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
  
  // ── Using alias -> registers the new type name
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

  // ── C++ keywords
  addRule(root, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      // control flow
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
      'break', 'continue', 'return', 'goto',
      // storage / qualifiers
      'const', 'constexpr', 'consteval', 'constinit', 'volatile', 'mutable',
      'static', 'extern', 'register', 'inline', 'thread_local',
      'virtual', 'override', 'final', 'explicit', 'friend',
      // access specifiers
      'public', 'private', 'protected',
      // type system
      'class', 'struct', 'union', 'enum', 'namespace', 'template',
      'typename', 'typedef', 'using', 'auto', 'decltype',
      // memory
      'new', 'delete', 'sizeof', 'alignof', 'alignas',
      // exceptions
      'try', 'catch', 'throw', 'noexcept',
      // casts
      'static_cast', 'dynamic_cast', 'const_cast', 'reinterpret_cast',
      // misc
      'operator', 'this', 'co_await', 'co_yield', 'co_return',
      'export', 'module', 'import',
    ];
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.KEYWORD; r.action = a;
  });

  // ── Primitive types
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
    // Built-in types share the keyword color (like 'public', 'const', …).
    // TokenType.TYPE is reserved for user-defined class/struct/union/enum
    // names, so only your own types get the green (#4ec9b0).
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.KEYWORD; r.action = a;
  });

  // ── Literals  nullptr, true, false, NULL
  addRule(root, 'literals', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = ['nullptr', 'true', 'false', 'NULL', 'EXIT_SUCCESS', 'EXIT_FAILURE'];
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.LITERAL; r.action = a;
  });

  // ── Decorator / attribute  [[nodiscard]], [[deprecated]], …
  addRule(root, 'attribute', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\[\[[^\]]*\]\]/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.DECORATOR; r.action = a;
  });

  // ── Class / struct / union body  →  push a dedicated scope (`class_body`)
  //    so member functions/constructors/destructors are colored without
  //    touching the symbol table (see addFunctionDefinitionRule). Fires
  //    only for a `{` that directly follows a statically TYPE-tagged
  //    token, which in practice means: the name just captured by
  //    `type_declaration` above.
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

  // ── Function / constructor / destructor definitions (free functions,
  //    RegisterScope.GLOBAL). See addFunctionDefinitionRule for the shared
  //    implementation (also used by class_body, which passes `null`).
  addFunctionDefinitionRule(root, 'function_definition', RegisterScope.GLOBAL);

  // ── Namespace qualifier  Foo::  (before a scope-resolution operator)
  addRule(root, 'namespace_qualifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*(?=::)/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NAMESPACE; r.action = a;
  });

  // ── Template open bracket after identifier   MyType<
  addRule(root, 'template_open', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*(?=<)/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.TYPE; r.action = a;
  });

  addRule(root, 'capitalized_identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Z][A-Za-z0-9_]*\b/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.TYPE;
    r.action = a;
  });

  // ── Plain identifier  (falls through to symbol table lookup at runtime)
  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Za-z_]\w*\b/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.IDENTIFIER; r.action = a;
  });

  // ── Include all shared rules at the end of root
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = sharedRules.id;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // classBody — inside a class/struct/union { … }
  // ──────────────────────────────────────────────────────────────────────────
  classBody.onUnmatched = OnUnmatched.CHARACTER;

  // Constructors, destructors (`~Test()`) and methods are colored FUNCTION
  // directly by the rule match, with no symbol-table registration (`null`)
  // — so e.g. a constructor `Test()` can't overwrite the class's own
  // GLOBAL `TYPE` registration for `Test`. Must come before `include_root`
  // below so it wins the first-match check over root's own (registering)
  // `function_definition` rule.
  addFunctionDefinitionRule(classBody, 'member_function_definition', null);

  // Everything else a class body needs — access specifiers, primitive
  // types, nested class/struct declarations (which recursively push
  // another class_body), comments, strings, numbers, operators, and the
  // generic `{ }` handling for method bodies — is identical to root.
  addRule(classBody, 'include_root', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = root.id;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Example code for the editor preview
  // ──────────────────────────────────────────────────────────────────────────
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
  // ── Dark ────────────────────────────────────────────────────────
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