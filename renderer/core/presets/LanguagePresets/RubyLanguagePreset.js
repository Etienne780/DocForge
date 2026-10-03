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

function addRule(syntaxState, name, setup) {
  const rule = createSyntaxStateRule(name);
  setup(rule);
  syntaxState.rules.push(rule);
  return rule;
}

function newState(def, name) {
  const s = createSyntaxState(name);
  def.states.push(s);
  return s;
}

function action(tokenType, transition = null) {
  const a = createSyntaxRuleAction();
  a.tokenType = tokenType;
  a.transition = transition;
  return a;
}

export function createRubyLanguage() {
  const def = createSyntaxDefinition('Ruby');
  def.aliases = ['rb', 'ruby', 'ruby3'];
  def.id = 'RubyLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['$LOAD_PATH',    TokenType.VARIABLE],
    ['$LOADED_FEATURES', TokenType.VARIABLE],
    ['$PROGRAM_NAME', TokenType.VARIABLE],
    ['$0',            TokenType.VARIABLE],
    ['$?',            TokenType.VARIABLE],
    ['$!',            TokenType.VARIABLE],
    ['$@',            TokenType.VARIABLE],
    ['$;',            TokenType.VARIABLE],
    ['$,',            TokenType.VARIABLE],
    ['$\\',           TokenType.VARIABLE],
    ['$/',            TokenType.VARIABLE],
    ['$_',            TokenType.VARIABLE],
    ['$~',            TokenType.VARIABLE],
    ['$`',            TokenType.VARIABLE],
    ["$'",            TokenType.VARIABLE],
    ['$+',            TokenType.VARIABLE],
    ['$=',            TokenType.VARIABLE],
    ['$:',            TokenType.VARIABLE],
    ['$DEBUG',        TokenType.VARIABLE],
    ['$FILENAME',     TokenType.VARIABLE],
    ['$stdin',        TokenType.VARIABLE],
    ['$stdout',       TokenType.VARIABLE],
    ['$stderr',       TokenType.VARIABLE],
    ['$VERBOSE',      TokenType.VARIABLE],
    ['$SAFE',         TokenType.VARIABLE],
    ['__FILE__',      TokenType.LITERAL],
    ['__LINE__',      TokenType.LITERAL],
    ['__ENCODING__',  TokenType.LITERAL],
    ['RUBY_VERSION',  TokenType.LITERAL],
    ['RUBY_RELEASE_DATE', TokenType.LITERAL],
    ['RUBY_PLATFORM', TokenType.LITERAL],
    ['RUBY_ENGINE',   TokenType.LITERAL],
    ['RUBY_DESCRIPTION', TokenType.LITERAL],
    ['TOPLEVEL_BINDING', TokenType.LITERAL],
    ['Object',        TokenType.TYPE],
    ['Array',         TokenType.TYPE],
    ['String',        TokenType.TYPE],
    ['Integer',       TokenType.TYPE],
    ['Float',         TokenType.TYPE],
    ['Hash',          TokenType.TYPE],
    ['Symbol',        TokenType.TYPE],
    ['Proc',          TokenType.TYPE],
    ['Method',        TokenType.TYPE],
    ['UnboundMethod', TokenType.TYPE],
    ['Regexp',        TokenType.TYPE],
    ['MatchData',     TokenType.TYPE],
    ['Range',         TokenType.TYPE],
    ['File',          TokenType.TYPE],
    ['Dir',           TokenType.TYPE],
    ['Time',          TokenType.TYPE],
    ['Date',          TokenType.TYPE],
    ['DateTime',      TokenType.TYPE],
    ['Thread',        TokenType.TYPE],
    ['Mutex',         TokenType.TYPE],
    ['Queue',         TokenType.TYPE],
    ['SizedQueue',    TokenType.TYPE],
    ['Exception',     TokenType.TYPE],
    ['StandardError', TokenType.TYPE],
    ['TypeError',     TokenType.TYPE],
    ['ArgumentError', TokenType.TYPE],
    ['RuntimeError',  TokenType.TYPE],
    ['NoMethodError', TokenType.TYPE],
    ['NameError',     TokenType.TYPE],
    ['IndexError',    TokenType.TYPE],
    ['KeyError',      TokenType.TYPE],
    ['StopIteration', TokenType.TYPE],
    ['IO',            TokenType.TYPE],
    ['Enumerator',    TokenType.TYPE],
    ['Struct',        TokenType.TYPE],
    ['OpenStruct',    TokenType.TYPE],
    ['Kernel',        TokenType.NAMESPACE],
    ['Enumerable',    TokenType.NAMESPACE],
    ['Comparable',    TokenType.NAMESPACE],
    ['JSON',          TokenType.NAMESPACE],
    ['Math',          TokenType.NAMESPACE],
    ['Process',       TokenType.NAMESPACE],
    ['GC',            TokenType.NAMESPACE],
    ['puts',          TokenType.FUNCTION],
    ['print',         TokenType.FUNCTION],
    ['p',             TokenType.FUNCTION],
    ['gets',          TokenType.FUNCTION],
    ['require',       TokenType.FUNCTION],
    ['require_relative', TokenType.FUNCTION],
    ['load',          TokenType.FUNCTION],
    ['autoload',      TokenType.FUNCTION],
    ['exit',          TokenType.FUNCTION],
    ['abort',         TokenType.FUNCTION],
    ['sleep',         TokenType.FUNCTION],
    ['system',        TokenType.FUNCTION],
    ['exec',          TokenType.FUNCTION],
    ['fork',          TokenType.FUNCTION],
    ['spawn',         TokenType.FUNCTION],
    ['raise',         TokenType.FUNCTION],
    ['fail',          TokenType.FUNCTION],
    ['catch',         TokenType.FUNCTION],
    ['throw',         TokenType.FUNCTION],
    ['loop',          TokenType.FUNCTION],
    ['trap',          TokenType.FUNCTION],
    ['at_exit',       TokenType.FUNCTION],
    ['lambda',        TokenType.FUNCTION],
    ['proc',          TokenType.FUNCTION],
    ['eval',          TokenType.FUNCTION],
    ['binding',       TokenType.FUNCTION],
    ['local_variables', TokenType.FUNCTION],
    ['instance_variables', TokenType.FUNCTION],
    ['class_variables', TokenType.FUNCTION],
    ['global_variables', TokenType.FUNCTION],
    ['define_singleton_method', TokenType.FUNCTION],
    ['respond_to?',   TokenType.FUNCTION],
    ['method_missing',TokenType.FUNCTION],
    ['map',           TokenType.FUNCTION],
    ['collect',       TokenType.FUNCTION],
    ['select',        TokenType.FUNCTION],
    ['find_all',      TokenType.FUNCTION],
    ['reject',        TokenType.FUNCTION],
    ['grep',          TokenType.FUNCTION],
    ['inject',        TokenType.FUNCTION],
    ['reduce',        TokenType.FUNCTION],
    ['each',          TokenType.FUNCTION],
    ['each_with_index', TokenType.FUNCTION],
    ['any?',          TokenType.FUNCTION],
    ['all?',          TokenType.FUNCTION],
    ['none?',         TokenType.FUNCTION],
    ['one?',          TokenType.FUNCTION],
    ['count',         TokenType.FUNCTION],
    ['first',         TokenType.FUNCTION],
    ['last',          TokenType.FUNCTION],
    ['min',           TokenType.FUNCTION],
    ['max',           TokenType.FUNCTION],
    ['minmax',        TokenType.FUNCTION],
    ['sort',          TokenType.FUNCTION],
    ['sort_by',       TokenType.FUNCTION],
    ['group_by',      TokenType.FUNCTION],
    ['partition',     TokenType.FUNCTION],
    ['zip',           TokenType.FUNCTION],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const heredocContent = newState(def, 'heredoc_content');
  const regexLiteral = newState(def, 'regex_literal');
  const symbolString = newState(def, 'symbol_string');
  const interpolation = newState(def, 'interpolation');

  const NAME = /[A-Za-z_]\w*/.source;

  // String escape sequences + interpolation (shared by all interpolating literals)
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|u\{[0-9a-fA-F ]{1,}\}|[^0-9xu])/.source;
    r.action = action(TokenType.ESCAPE);
  });
  // #{ expression } – full Ruby code up to the matching brace
  addRule(strEscape, 'var_in_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /#\{/.source;
    r.end   = /\}/.source;
    r.beginAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, interpolation.id));
    r.endAction   = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.innerStateId = interpolation.id;
  });
  // Short interpolation forms: "#$global", "#@ivar", "#@@cvar"
  addRule(strEscape, 'global_var_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `#\\$${NAME}`;
    r.action = action(TokenType.VARIABLE);
  });
  addRule(strEscape, 'class_var_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `#@@${NAME}`;
    r.action = action(TokenType.VARIABLE);
  });
  addRule(strEscape, 'instance_var_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `#@${NAME}`;
    r.action = action(TokenType.VARIABLE);
  });

  // Interpolation: nested `{…}` (hashes, blocks) is counted
  interpolation.onUnmatched = OnUnmatched.CHARACTER;
  addRule(interpolation, 'brace_block', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\{/.source;
    r.end   = /\}/.source;
    r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, interpolation.id));
    r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
    r.innerStateId = interpolation.id;
  });
  // (root is included at the end)

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted strings: only \\ and \' are escapes
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\[\\']/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Symbol strings
  symbolString.onUnmatched = OnUnmatched.CHARACTER;
  addRule(symbolString, 'symbol_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Heredoc content (interpolating)
  heredocContent.onUnmatched = OnUnmatched.CHARACTER;
  addRule(heredocContent, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Regex literals
  regexLiteral.onUnmatched = OnUnmatched.CHARACTER;
  regexLiteral.contentTokenType = TokenType.REGEXP;
  addRule(regexLiteral, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Common rules
  // class / module declaration – register the name (also `class A::B`)
  addRule(common, 'class_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(class|module)\\s+(${NAME}(?:::${NAME})*)`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // def name / def self.name / def name? / def name=(v) / endless `def x = …`
  addRule(common, 'method_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(def)\\s+(?:(self)(\\.))?(${NAME}(?:[?!]|=(?=\\())?)`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['3'] = { tokenType: TokenType.OPERATOR, register: null };
    caps.groups['4'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // `defined?` (KEYWORDS cannot contain `?`)
  addRule(common, 'defined_keyword', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bdefined\?/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Hash label / keyword argument: `name:` (not `A::B`)
  addRule(common, 'symbol_label', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(${NAME}[?!]?)(:)(?!:)`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.LITERAL, register: null };
    caps.groups['2'] = { tokenType: TokenType.PUNCTUATION, register: null };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'BEGIN', 'END', 'alias', 'and', 'begin', 'break', 'case', 'class',
      'def', 'do', 'else', 'elsif', 'end', 'ensure', 'false',
      'for', 'if', 'in', 'module', 'next', 'nil', 'not', 'or', 'redo',
      'rescue', 'retry', 'return', 'self', 'super', 'then', 'true',
      'undef', 'unless', 'until', 'when', 'while', 'yield',
      '__LINE__', '__FILE__', '__ENCODING__', '__method__', '__dir__',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Implicit block parameters: `_1`, `it` (Ruby 3.4) – not RSpec's `it "…" do`
  addRule(common, 'implicit_block_param', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:_[1-9]|it)\b(?![?!:]|\s*["'(]|\s+do\b|\s*=[^=~>])/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(common, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b${NAME}[?!]?(?=\\()`;
    r.action = action(TokenType.FUNCTION);
  });

  // Symbols :name, :name?, :name= (LITERAL); not `A::B`, not `a ? b : c`
  addRule(common, 'symbol', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(?<![:\\w]):(?:${NAME}[?!=]?|@@?${NAME}|\\$${NAME})`;
    r.action = action(TokenType.LITERAL);
  });

  addRule(common, 'symbol_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?<![:\w]):"/.source;
    r.end   = /"/.source;
    r.beginAction = action(TokenType.LITERAL, createSyntaxStateTransition(TransitionType.PUSH, symbolString.id));
    r.endAction   = action(TokenType.LITERAL, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.LITERAL;
    r.innerStateId = symbolString.id;
  });

  addRule(common, 'symbol_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?<![:\w]):'/.source;
    r.end   = /'/.source;
    r.beginAction = action(TokenType.LITERAL, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.LITERAL, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.LITERAL;
    r.innerStateId = strSingle.id;
  });

  addRule(common, 'constant', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Z]\w*/.source;
    r.action = action(TokenType.TYPE);
  });

  addRule(common, 'class_var', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `@@${NAME}`;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(common, 'instance_var', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `@${NAME}`;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(common, 'global_var', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*|\$-\w|\$[0-9!@&~=\/\\,;.<>_*$?:"'`+]/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*(?:[?!](?!=))?/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  addRule(shared, 'block_comment_begin', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /^=begin\b/.source;
    r.end   = /^=end\b.*/.source;
    r.beginAction = action(TokenType.COMMENT);
    r.endAction   = action(TokenType.COMMENT);
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = newState(def, 'block_comment').id;
    def.states[def.states.length - 1].onUnmatched = OnUnmatched.CHARACTER;
  });

  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // Backtick command strings
  addRule(shared, 'string_backtick', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '`';
    r.end   = '`';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Heredoc with single-quoted marker: no interpolation
  addRule(shared, 'heredoc_raw', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = `<<[~-]?'(${NAME})'`;
    r.end   = /^\s*\w+\s*$/.source;
    r.dynamicEnd = createDynamicEnd(1, '^\\s*${0}\\s*$');
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // Heredoc <<~EOS / <<-EOS / <<"EOS" (interpolating)
  addRule(shared, 'heredoc', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = `<<(?:[~-]["\`]?|["\`])(${NAME})["\`]?`;
    r.end   = /^\s*\w+\s*$/.source;
    r.dynamicEnd = createDynamicEnd(1, '^\\s*${0}\\s*$');
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, heredocContent.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = heredocContent.id;
  });

  // Bare heredoc <<EOS – only with an uppercase marker (`a <<b` stays a shift)
  addRule(shared, 'heredoc_bare', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<<([A-Z_][A-Z0-9_]*)\b/.source;
    r.end   = /^\w+$/.source;
    r.dynamicEnd = createDynamicEnd(1, '^${0}\\s*$');
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, heredocContent.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = heredocContent.id;
  });

  // Percent literals: %w[] %i[] %q() %Q{} %r<> %x() %s() %() …
  // One rule per bracket pair; nesting of the same bracket is not tracked.
  const percentBrackets = [['(', ')'], ['[', ']'], ['{', '}'], ['<', '>']];
  const esc = s => '\\' + s;
  for (const [open, close] of percentBrackets) {
    // %r – regex with flags
    addRule(shared, 'percent_regex', r => {
      r.type = RuleType.BEGIN_END;
      r.begin = `%r${esc(open)}`;
      r.end   = `${esc(close)}[imxounse]*`;
      r.beginAction = action(TokenType.REGEXP, createSyntaxStateTransition(TransitionType.PUSH, regexLiteral.id));
      r.endAction   = action(TokenType.REGEXP, createSyntaxStateTransition(TransitionType.POP));
      r.contentTokenType = TokenType.REGEXP;
      r.innerStateId = regexLiteral.id;
    });
    // %Q %W %I %x – interpolating
    addRule(shared, 'percent_literal', r => {
      r.type = RuleType.BEGIN_END;
      r.begin = `%[QWIx]${esc(open)}`;
      r.end   = esc(close);
      r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
      r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
      r.contentTokenType = TokenType.STRING;
      r.innerStateId = strDouble.id;
    });
    // %q %w %i %s – raw
    addRule(shared, 'percent_string', r => {
      r.type = RuleType.BEGIN_END;
      r.begin = `%[qwis]${esc(open)}`;
      r.end   = esc(close);
      r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
      r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
      r.contentTokenType = TokenType.STRING;
      r.innerStateId = strSingle.id;
    });
    // %( … ) – only where an expression starts (otherwise `%` is modulo)
    addRule(shared, 'percent_bare', r => {
      r.type = RuleType.BEGIN_END;
      r.begin = `%${esc(open)}`;
      r.end   = esc(close);
      r.context = { afterTokenType: [TokenType.OPERATOR, TokenType.PUNCTUATION, TokenType.KEYWORD, TokenType.FUNCTION, null] };
      r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
      r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
      r.contentTokenType = TokenType.STRING;
      r.innerStateId = strDouble.id;
    });
  }
  // Same-character delimiters: %q|…|, %r!…!, %w/…/
  addRule(shared, 'percent_other', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /%[qQwWiIxrs]([^\w\s(\[{<])/.source;
    r.end   = /[^\w\s]/.source;
    r.dynamicEnd = createDynamicEnd(1, '${0}[imxounse]*');
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // Regex literal /…/flags – only where an expression can start
  addRule(shared, 'regex_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/(?![\s=*])(?:\\.|\[(?:\\.|[^\]\\])*\]|[^\/\\\[])+\/[imxounse]*/.source;
    r.context = { afterTokenType: [TokenType.OPERATOR, TokenType.PUNCTUATION, TokenType.KEYWORD, TokenType.FUNCTION, null] };
    r.action = action(TokenType.REGEXP);
  });

  // Numbers: hex/bin/oct, then float (exponent), then int; `_`, rational `r`, imaginary `i`
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_bin', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[bB][01](?:_?[01])*\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_oct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[oO]?[0-7](?:_?[0-7])*\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d(?:_?\d)*(?:\.\d(?:_?\d)*(?:[eE][+-]?\d(?:_?\d)*)?|[eE][+-]?\d(?:_?\d)*)r?i?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:0[dD])?\d(?:_?\d)*r?i?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators (longest first); `.` / `&.` are method-call operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\*\*=|<<=|>>=|&&=|\|\|=|<=>|===|\.\.\.|\.\.|&\.|=>|->|::|\*\*|==|!=|=~|!~|<=|>=|&&|\|\||<<|>>|[+\-*\/%&|^]=|[+\-*\/%&|^~!<>=?.]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];:,\\]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules
  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Interpolations contain regular Ruby code
  addRule(interpolation, 'include_root', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = root.id;
  });

  // Example code
  def.exampleCode = `#!/usr/bin/env ruby
# This is a comment
=begin
  Multi-line comment
=end

# Variables
name = "Alice"
age = 30
pi = 3.14159

# Constants
VERSION = "1.0.0"

# Global, instance, class variables
$global = "global"
@instance = "instance"
@@class = "class"

# String interpolation
greeting = "Hello, #{name}!"

# Symbols
symbol = :symbol
symbol_with_quotes = :"symbol with spaces"

# Arrays
numbers = [1, 2, 3]
mixed = [1, "two", :three]

# Hashes
person = { name: "Alice", age: 30 }
person2 = { "name" => "Bob", "age" => 25 }

# Regex
regex = /[a-z]+/i
match = regex.match("hello")

# Block
3.times do |i|
  puts "Iteration #{i}"
end

3.times { |i| puts "Iteration #{i}" }

# Method definition
def greet(person)
  "Hello, #{person}!"
end

# Method with default value and splat
def greet_multiple(greeting = "Hello", *people)
  people.map { |p| "#{greeting}, #{p}!" }
end

# Class definition
class Person
  attr_accessor :name, :age

  def initialize(name, age)
    @name = name
    @age = age
  end

  def to_s
    "#{@name} (#{@age})"
  end

  def self.from_hash(hash)
    new(hash[:name], hash[:age])
  end
end

# Module
module Greetable
  def greet
    "Hello, #{@name}!"
  end
end

# Using module
class Employee < Person
  include Greetable

  attr_accessor :employee_id
end

# Control flow
if age > 18
  puts "Adult"
elsif age == 18
  puts "Just turned 18"
else
  puts "Minor"
end

unless age < 18
  puts "Adult"
end

case age
when 0..17
  puts "Minor"
when 18
  puts "Just turned 18"
else
  puts "Adult"
end

# Loop
for i in 0...5 do
  puts i
end

10.times do |i|
  puts i
end

# Exception handling
begin
  raise "Error"
rescue StandardError => e
  puts "Caught: #{e.message}"
ensure
  puts "Always runs"
end

# Lambda
add = ->(a, b) { a + b }
puts add.call(3, 4)

# Proc
multiply = Proc.new { |a, b| a * b }
puts multiply.call(3, 4)

# Heredoc
sql = <<SQL
SELECT * FROM users
WHERE age > 18
SQL

# Interpolation in heredoc
name = "Alice"
html = <<HTML
<div>
  <h1>Hello, #{name}!</h1>
</div>
HTML

# Calling methods
puts greet("Bob")
puts greet_multiple("Hi", "Alice", "Bob", "Charlie")

p = Person.new("Alice", 30)
puts p
puts p.name

# Singleton method
def p.say_hello
  "Hello from singleton!"
end
puts p.say_hello

# Array operations
numbers = [1, 2, 3, 4, 5]
squared = numbers.map { |n| n ** 2 }

# Method that ends with ? or !
def adult?
  @age >= 18
end

def save!
  puts "Saving..."
end

# Regex match with =~
if age =~ /^\\d+$/
  puts "Age is numeric"
end

# Accessing hash with symbol
puts person[:name]

# Using keywords
yield if block_given?
super if defined?(super)

# Modern syntax
def full_name = "#{first_name} #{last_name}"

case { name: "Alice", roles: [:admin] }
in { name: String => user, roles: [*, :admin, *] }
  puts "Admin: #{user}"
end

tags = %w[ruby rails docs]
lengths = tags.map { it.length }
city = user&.address&.city || "unknown"
query = <<~SQL
  SELECT * FROM users WHERE id = #{id}
SQL
`;
  return def;
}

export function createRubyLanguageStyles(rbDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(rbDef.id, 'Dark+');
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
    createTokenStyle(TokenType.REGEXP,        '#d7ba7d'),
    createTokenStyle(TokenType.DECORATOR,     '#c8c8c8'),
    createTokenStyle(TokenType.NAMESPACE,     '#4ec9b0'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  const lightStyle = createHighlightStyle(rbDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#0000ff'),
    createTokenStyle(TokenType.TYPE,          '#267f99'),
    createTokenStyle(TokenType.IDENTIFIER,    '#001080'),
    createTokenStyle(TokenType.VARIABLE,      '#001080'),
    createTokenStyle(TokenType.FUNCTION,      '#795e26'),
    createTokenStyle(TokenType.PARAMETER,     '#001080', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#001080'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.REGEXP,        '#811f3f'),
    createTokenStyle(TokenType.NAMESPACE,     '#267f99'),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(rbDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.TYPE,          '#e5c07b'),
    createTokenStyle(TokenType.IDENTIFIER,    '#abb2bf'),
    createTokenStyle(TokenType.VARIABLE,      '#e06c75'),
    createTokenStyle(TokenType.FUNCTION,      '#61afef'),
    createTokenStyle(TokenType.PARAMETER,     '#e06c75', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#e06c75'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.REGEXP,        '#56b6c2'),
    createTokenStyle(TokenType.NAMESPACE,     '#e5c07b'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(rbDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#fd971f'),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.PARAMETER,     '#fd971f', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.REGEXP,        '#e6db74'),
    createTokenStyle(TokenType.NAMESPACE,     '#66d9ef'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(rbDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.TYPE,          '#8be9fd', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#ffb86c'),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.PARAMETER,     '#ffb86c', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.REGEXP,        '#ff5555'),
    createTokenStyle(TokenType.NAMESPACE,     '#8be9fd'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(rbDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.TYPE,          '#6639ba'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.VARIABLE,      '#953800'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.PARAMETER,     '#24292f'),
    createTokenStyle(TokenType.PROPERTY,      '#0550ae'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.REGEXP,        '#116329'),
    createTokenStyle(TokenType.NAMESPACE,     '#6639ba'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}