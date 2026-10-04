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

export function createPHPLanguage() {
  const def = createSyntaxDefinition('PHP');
  def.aliases = ['php'];
  def.id = 'PhpLang';
  def.builtIn = true;
  def.symbolHoisting = true;

  const root = def.states.find(s => s.id === def.rootStateId);

  // ── Predefined symbols ──────────────────────────────────────────────────
  const predefined = [
    // Superglobals
    ['$_SERVER', TokenType.VARIABLE],
    ['$_GET',    TokenType.VARIABLE],
    ['$_POST',   TokenType.VARIABLE],
    ['$_FILES',  TokenType.VARIABLE],
    ['$_COOKIE', TokenType.VARIABLE],
    ['$_SESSION',TokenType.VARIABLE],
    ['$_REQUEST',TokenType.VARIABLE],
    ['$_ENV',    TokenType.VARIABLE],
    ['$GLOBALS', TokenType.VARIABLE],
    ['$this',    TokenType.VARIABLE],
    // Reserved constants
    ['__LINE__',      TokenType.LITERAL],
    ['__FILE__',      TokenType.LITERAL],
    ['__DIR__',       TokenType.LITERAL],
    ['__FUNCTION__',  TokenType.LITERAL],
    ['__CLASS__',     TokenType.LITERAL],
    ['__TRAIT__',     TokenType.LITERAL],
    ['__METHOD__',    TokenType.LITERAL],
    ['__NAMESPACE__', TokenType.LITERAL],
    // Types / classes
    ['stdClass',  TokenType.TYPE],
    ['Exception', TokenType.TYPE],
    ['Error',     TokenType.TYPE],
    ['PDO',       TokenType.TYPE],
    ['mysqli',    TokenType.TYPE],
    ['DateTime',  TokenType.TYPE],
    ['DateTimeImmutable', TokenType.TYPE],
    ['ArrayObject', TokenType.TYPE],
    ['ArrayIterator', TokenType.TYPE],
    // Common functions
    ['echo',       TokenType.FUNCTION],
    ['print',      TokenType.FUNCTION],
    ['die',        TokenType.FUNCTION],
    ['exit',       TokenType.FUNCTION],
    ['var_dump',   TokenType.FUNCTION],
    ['print_r',    TokenType.FUNCTION],
    ['isset',      TokenType.FUNCTION],
    ['unset',      TokenType.FUNCTION],
    ['empty',      TokenType.FUNCTION],
    ['defined',    TokenType.FUNCTION],
    ['define',     TokenType.FUNCTION],
    ['class_exists', TokenType.FUNCTION],
    ['interface_exists', TokenType.FUNCTION],
    ['trait_exists', TokenType.FUNCTION],
    ['method_exists', TokenType.FUNCTION],
    ['property_exists', TokenType.FUNCTION],
    ['function_exists', TokenType.FUNCTION],
    ['count',      TokenType.FUNCTION],
    ['sizeof',     TokenType.FUNCTION],
    ['array_push', TokenType.FUNCTION],
    ['array_pop',  TokenType.FUNCTION],
    ['array_shift',TokenType.FUNCTION],
    ['array_unshift', TokenType.FUNCTION],
    ['array_keys', TokenType.FUNCTION],
    ['array_values', TokenType.FUNCTION],
    ['array_merge', TokenType.FUNCTION],
    ['array_diff', TokenType.FUNCTION],
    ['array_intersect', TokenType.FUNCTION],
    ['in_array',   TokenType.FUNCTION],
    ['explode',    TokenType.FUNCTION],
    ['implode',    TokenType.FUNCTION],
    ['strlen',     TokenType.FUNCTION],
    ['strpos',     TokenType.FUNCTION],
    ['strrpos',    TokenType.FUNCTION],
    ['substr',     TokenType.FUNCTION],
    ['str_replace',TokenType.FUNCTION],
    ['preg_match', TokenType.FUNCTION],
    ['preg_replace', TokenType.FUNCTION],
    ['json_encode',TokenType.FUNCTION],
    ['json_decode',TokenType.FUNCTION],
    ['file_get_contents', TokenType.FUNCTION],
    ['file_put_contents', TokenType.FUNCTION],
    ['fopen',      TokenType.FUNCTION],
    ['fclose',     TokenType.FUNCTION],
    ['fread',      TokenType.FUNCTION],
    ['fwrite',     TokenType.FUNCTION],
    ['fgets',      TokenType.FUNCTION],
    ['feof',       TokenType.FUNCTION],
    ['header',     TokenType.FUNCTION],
    ['session_start', TokenType.FUNCTION],
    ['session_destroy', TokenType.FUNCTION],
    ['setcookie',  TokenType.FUNCTION],
    ['filter_var', TokenType.FUNCTION],
    ['filter_input', TokenType.FUNCTION],
    ['date',       TokenType.FUNCTION],
    ['time',       TokenType.FUNCTION],
    ['strtotime',  TokenType.FUNCTION],
    ['htmlspecialchars', TokenType.FUNCTION],
    ['htmlentities', TokenType.FUNCTION],
    ['strip_tags', TokenType.FUNCTION],
    ['urlencode',  TokenType.FUNCTION],
    ['urldecode',  TokenType.FUNCTION],
    ['base64_encode', TokenType.FUNCTION],
    ['base64_decode', TokenType.FUNCTION],
    ['hash',       TokenType.FUNCTION],
    ['password_hash', TokenType.FUNCTION],
    ['password_verify', TokenType.FUNCTION],
    ['gettype',    TokenType.FUNCTION],
    ['settype',    TokenType.FUNCTION],
    ['intval',     TokenType.FUNCTION],
    ['floatval',   TokenType.FUNCTION],
    ['strval',     TokenType.FUNCTION],
    ['boolval',    TokenType.FUNCTION],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // ── States ──────────────────────────────────────────────────────────────────
  const shared = newState(def, 'shared_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const strInterpolation = newState(def, 'string_interpolation');
  const heredoc = newState(def, 'heredoc');
  const nowdoc = newState(def, 'nowdoc');
  const blockComment = newState(def, 'block_comment');
  const attribute = newState(def, 'attribute');
  const phpContent = newState(def, 'php_content');

  // Identifier building blocks
  const NAME = /[A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*/.source;
  const QUALIFIED_NAME = `\\\\?${NAME}(?:\\\\${NAME})*`; // Foo, \Foo, App\Foo

  // ── String escape state ────────────────────────────────────────────────────
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[nrtvfe\\$"']|x[0-9a-fA-F]{1,2}|u\{[0-9a-fA-F]+\}|[0-7]{1,3})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // ── Double-quoted strings ──────────────────────────────────────────────────
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });
  // "{$expr}" – full PHP code up to the matching brace
  addRule(strDouble, 'complex_var_in_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\{(?=\$)/.source;
    r.end   = /\}/.source;
    r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, strInterpolation.id));
    r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
    r.innerStateId = strInterpolation.id;
  });
  // "$var", "$var->prop", "$var[key]"
  addRule(strDouble, 'variable_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\$${NAME}(?:\\??->${NAME}|\\[[^\\]"]*\\])?`;
    r.action = action(TokenType.VARIABLE);
  });

  strInterpolation.onUnmatched = OnUnmatched.CHARACTER;
  // (php_content is included at the end, once it is filled)

  // ── Single-quoted strings ──────────────────────────────────────────────────
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\[\\']/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // ── Heredoc / Nowdoc ──────────────────────────────────────────────────────
  // Heredoc content interpolates like a double-quoted string, nowdoc is raw.
  heredoc.onUnmatched = OnUnmatched.CHARACTER;
  heredoc.contentTokenType = TokenType.STRING;
  addRule(heredoc, 'include_string_double', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strDouble.id;
  });
  nowdoc.onUnmatched = OnUnmatched.CHARACTER;
  nowdoc.contentTokenType = TokenType.STRING;

  // ── Block comment ──────────────────────────────────────────────────────────
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // ── Attribute #[...] ────────────────────────────────────────────────────────
  attribute.onUnmatched = OnUnmatched.CHARACTER;
  addRule(attribute, 'bracket_block', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\[/.source;
    r.end   = /\]/.source;
    r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, attribute.id));
    r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
    r.innerStateId = attribute.id;
  });
  // (php_content is included at the end, once it is filled)

  // ── Shared rules ────────────────────────────────────────────────────────────
  // Attributes #[Name(args), Other] – may contain nested brackets
  addRule(shared, 'attribute', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = `#\\[\\s*(?:${QUALIFIED_NAME})?`;
    r.end   = /\]/.source;
    r.beginAction = action(TokenType.DECORATOR, createSyntaxStateTransition(TransitionType.PUSH, attribute.id));
    r.endAction   = action(TokenType.DECORATOR, createSyntaxStateTransition(TransitionType.POP));
    r.innerStateId = attribute.id;
  });

  // Line comments (// and #)
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:#(?!\[)|\/\/).*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Block comments /* ... */
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Double-quoted strings
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Single-quoted strings
  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // Nowdoc <<<'EOT' ... EOT (before heredoc, which would also match the quotes)
  addRule(shared, 'nowdoc', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = `<<<[ \\t]*'(${NAME})'`;
    r.end   = /^\s*[A-Za-z_]\w*\b/.source;
    r.dynamicEnd = createDynamicEnd(1, '^\\s*${0}\\b');
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, nowdoc.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = nowdoc.id;
  });

  // Heredoc <<<EOT / <<<"EOT" ... EOT (closing marker may be indented, PHP 7.3+)
  addRule(shared, 'heredoc', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = `<<<[ \\t]*"?(${NAME})"?`;
    r.end   = /^\s*[A-Za-z_]\w*\b/.source;
    r.dynamicEnd = createDynamicEnd(1, '^\\s*${0}\\b');
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, heredoc.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = heredoc.id;
  });

  // Numbers: hex/bin/oct, then float (with exponent), then int; `_` separators
  addRule(shared, 'numbers', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*\b|\b0[bB][01](?:_?[01])*\b|\b0[oO][0-7](?:_?[0-7])*\b|(?:\b\d(?:_?\d)*(?:\.\d(?:_?\d)*)?|(?<![\w.])\.\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators (longest first). `.` is the concatenation operator.
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /<=>|\*\*=|\?\?=|\.\.\.|<<=|>>=|===|!==|\?->|\?\?|\*\*|->|=>|::|\+\+|--|&&|\|\||<<|>>|<=|>=|==|!=|<>|[+\-*\/%&|^.]=|[+\-*\/%&|^~!<>=?@.]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation (`\` is the namespace separator)
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,:\\]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // ── PHP content (inside <?php ... ?>) ──────────────────────────────────────
  phpContent.onUnmatched = OnUnmatched.CHARACTER;

  // Comments, strings, numbers, operators, punctuation
  addRule(phpContent, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Type declarations (class/interface/trait/enum) – register type name
  addRule(phpContent, 'type_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(?<!::\\s*)\\b(class|interface|trait|enum)\\s+(${NAME})`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Namespace declaration – register namespace name
  addRule(phpContent, 'namespace_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(namespace)\\s+(${NAME}(?:\\\\${NAME})*)`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.NAMESPACE,
                         register: createSymbolRegister(TokenType.NAMESPACE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Use import – `use A\B [as C]`, `use function A\f`, `use const A\X`
  addRule(phpContent, 'use_import', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    // The last segment (or the alias) becomes a known class name.
    r.pattern = `\\b(use)\\s+(?:(function|const)\\s+)?(\\\\?(?:${NAME}\\\\)*)(${NAME})(?![\\\\\\w\\x80-\\xff])(?:\\s+(as)\\s+(${NAME}))?`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['3'] = { tokenType: TokenType.NAMESPACE, register: null };
    caps.groups['4'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    caps.groups['5'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['6'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Function definition – register function name
  addRule(phpContent, 'function_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(function)\\s+&?\\s*(${NAME})(?=\\s*\\()`;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.OPERATOR; // by-reference `&`
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.FUNCTION,
                         register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Class name after new / instanceof / extends / implements / insteadof
  addRule(phpContent, 'class_usage', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(new|instanceof|extends|implements|insteadof)\\s+(?!(?:class|static|self|parent)\\b)(${QUALIFIED_NAME})`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // `yield from`
  addRule(phpContent, 'yield_from', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\byield\s+from\b/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Asymmetric visibility: `public private(set)`
  addRule(phpContent, 'asymmetric_visibility', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(public|protected|private)(\()(set)(\))/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['3'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['4'] = { tokenType: TokenType.PUNCTUATION, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Property hooks: `get => …`, `get { … }`, `set(string $v) { … }`
  addRule(phpContent, 'property_hook', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<![\w$>:\\])(?:get|set)(?=\s*(?:=>|\{|\(\s*[\w\\?]+\s+\$))/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Keywords
  addRule(phpContent, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'if', 'else', 'elseif', 'endif', 'for', 'endfor', 'foreach', 'endforeach',
      'while', 'endwhile', 'do', 'switch', 'endswitch', 'case', 'default',
      'break', 'continue', 'return', 'goto', 'match', 'try', 'catch', 'finally', 'throw',
      'function', 'fn', 'class', 'interface', 'trait', 'enum', 'abstract',
      'final', 'readonly', 'private', 'protected', 'public', 'static',
      'var', 'const', 'use', 'namespace', 'declare', 'enddeclare', 'global', 'as', 'insteadof',
      'new', 'clone', 'instanceof', 'implements', 'extends',
      'yield', 'eval', 'include', 'include_once', 'require', 'require_once',
      'isset', 'unset', 'empty', 'die', 'exit', 'echo', 'print', 'list',
      'and', 'or', 'xor', 'self', 'parent', '__halt_compiler',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Built-in types
  addRule(phpContent, 'builtin_types', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'int', 'float', 'string', 'bool', 'array', 'object', 'mixed',
      'callable', 'iterable', 'void', 'never',
    ];
    r.action = action(TokenType.TYPE);
  });

  // Literals (case-insensitive in PHP)
  addRule(phpContent, 'literals', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = ['true', 'false', 'null'];
    r.caseInsensitive = true;
    r.action = action(TokenType.LITERAL);
  });

  // Variables ($, $$)
  addRule(phpContent, 'variables', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\$+${NAME}`;
    r.action = action(TokenType.VARIABLE);
  });

  // Method call after -> / ?-> / ::
  addRule(phpContent, 'method_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(?<=->|::)${NAME}(?=\\s*\\()`;
    r.action = action(TokenType.FUNCTION);
  });

  // Property access after -> / ?->
  addRule(phpContent, 'property_access', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(?<=->)${NAME}`;
    r.action = action(TokenType.PROPERTY);
  });

  // Static access: Foo::bar, \App\Foo::class
  addRule(phpContent, 'static_class', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `${QUALIFIED_NAME}(?=\\s*::)`;
    r.action = action(TokenType.TYPE);
  });

  // Return type: `): Foo`, `): ?Foo`
  addRule(phpContent, 'return_type', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(?<=\\)\\s*:\\s*\\??\\s*)${QUALIFIED_NAME}`;
    r.action = action(TokenType.TYPE);
  });

  // Function call (also first-class callable `strlen(...)`)
  addRule(phpContent, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(?<![\\w$\\\\])${QUALIFIED_NAME}(?=\\s*\\()`;
    r.action = action(TokenType.FUNCTION);
  });

  // Parameter / property type hint: `Foo $x`, `Foo&...$x`, `?Foo $x`, `A|B $x`
  addRule(phpContent, 'type_hint', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `${QUALIFIED_NAME}(?=\\s*(?:[|&]\\s*[\\w\\\\]+\\s*)*&?\\s*(?:\\.\\.\\.)?\\$)`;
    r.action = action(TokenType.TYPE);
  });

  // Identifier fallback (registered classes/functions are re-colored)
  addRule(phpContent, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = NAME;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Interpolations and attribute arguments contain regular PHP code
  addRule(strInterpolation, 'include_php_content', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = phpContent.id;
  });
  addRule(attribute, 'include_php_content', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = phpContent.id;
  });

  // ── Root ────────────────────────────────────────────────────────────────────
  // PHP tags: <?php ... ?> and <?= ... ?>
  addRule(root, 'php_tag', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<\?php\b/.source;
    r.end   = /\?>/.source;
    r.beginAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, phpContent.id));
    r.endAction   = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = phpContent.id;
  });

  addRule(root, 'short_echo_tag', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<\?=/.source;
    r.end   = /\?>/.source;
    r.beginAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, phpContent.id));
    r.endAction   = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = phpContent.id;
  });

  // Outside of tags: snippets in docs often omit `<?php`, so lex them as PHP too.
  addRule(root, 'include_php_content', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = phpContent.id;
  });

  // ── Example code ──────────────────────────────────────────────────────────
  def.exampleCode = `<?php

namespace App\\Controller;

use Symfony\\Component\\HttpFoundation\\Response;
use App\\Entity\\User;

class UserController
{
    private UserRepository $repo;

    public function __construct(UserRepository $repo)
    {
        $this->repo = $repo;
    }

    public function show(int $id): Response
    {
        $user = $this->repo->find($id);
        if (!$user) {
            throw $this->createNotFoundException('User not found');
        }

        return $this->render('user/show.html.twig', [
            'user' => $user,
            'title' => 'User Profile',
        ]);
    }

    #[Route('/user/{id}', name: 'user_show')]
    public function userAction(int $id): Response
    {
        // do something
        return new Response('Hello ' . $id);
    }
}

// string interpolation
$name = "John";
echo "Hello, $name!\\n";
echo 'Hello, $name!\\n';

// heredoc
$html = <<<HTML
<div class="container">
    <h1>Hello, $name</h1>
</div>
HTML;

// nowdoc
$css = <<<'CSS'
.container { color: #fff; }
CSS;

// constants
define('APP_ENV', 'dev');
if (APP_ENV === 'prod') {
    // ...
}

// match
$result = match($status) {
    200 => 'OK',
    404 => 'Not Found',
    default => 'Unknown',
};

// attributes
#[\\Attribute]
class MyAttribute {}

// array
$data = [1, 2, 3, 'key' => 'value'];

// modern syntax
enum Status: string
{
    case Active = 'active';
    case Archived = 'archived';
}

final readonly class Money
{
    public function __construct(public int $amount = 1_000, public ?string $currency = null) {}
}

$city = $user?->getAddress()?->city ?? 'unknown';
$double = fn(int $x): int => $x * 2;
$length = strlen(...);
`;
  return def;
}

export function createPHPLanguageStyles(phpDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(phpDef.id, 'Dark+');
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
    createTokenStyle(TokenType.NAMESPACE,     '#4ec9b0'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  const lightStyle = createHighlightStyle(phpDef.id, 'Light+');
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
    createTokenStyle(TokenType.DECORATOR,     '#af00db'), // attributes #[...]
    createTokenStyle(TokenType.NAMESPACE,     '#267f99'),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(phpDef.id, 'One Dark');
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
    createTokenStyle(TokenType.DECORATOR,     '#c678dd'), // attributes #[...]
    createTokenStyle(TokenType.NAMESPACE,     '#e5c07b'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(phpDef.id, 'Monokai');
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
    createTokenStyle(TokenType.DECORATOR,     '#f92672'), // attributes #[...]
    createTokenStyle(TokenType.NAMESPACE,     '#66d9ef'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(phpDef.id, 'Dracula');
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
    createTokenStyle(TokenType.DECORATOR,     '#ff79c6'), // attributes #[...]
    createTokenStyle(TokenType.NAMESPACE,     '#8be9fd'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(phpDef.id, 'GitHub Light');
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
    createTokenStyle(TokenType.DECORATOR,     '#cf222e'), // attributes #[...]
    createTokenStyle(TokenType.NAMESPACE,     '#6639ba'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}