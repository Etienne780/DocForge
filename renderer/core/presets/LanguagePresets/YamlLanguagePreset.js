import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxStateTransition,
  createHighlightStyle,
  createTokenStyle,
  createPredefinedSymbol,
  RuleType,
  PatternType,
  TokenType,
  TransitionType,
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

export function createYamlLanguage() {
  const def = createSyntaxDefinition('YAML');
  def.aliases = ['yaml', 'yml'];
  def.id = 'YamlLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['!!str',         TokenType.TYPE],
    ['!!int',         TokenType.TYPE],
    ['!!float',       TokenType.TYPE],
    ['!!bool',        TokenType.TYPE],
    ['!!null',        TokenType.TYPE],
    ['!!seq',         TokenType.TYPE],
    ['!!map',         TokenType.TYPE],
    ['!!set',         TokenType.TYPE],
    ['!!timestamp',   TokenType.TYPE],
    ['!!binary',      TokenType.TYPE],
    ['!!omap',        TokenType.TYPE],
    ['!!pairs',       TokenType.TYPE],
    ['!!set',         TokenType.TYPE],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['yes',           TokenType.LITERAL],
    ['no',            TokenType.LITERAL],
    ['on',            TokenType.LITERAL],
    ['off',           TokenType.LITERAL],
    ['y',             TokenType.LITERAL],
    ['n',             TokenType.LITERAL],
    ['null',          TokenType.LITERAL],
    ['~',             TokenType.LITERAL],
    ['&',             TokenType.OPERATOR],
    ['*',             TokenType.OPERATOR],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const blockScalarLiteral = newState(def, 'block_scalar_literal');
  const blockScalarFolded = newState(def, 'block_scalar_folded');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted string content (only '' escape)
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'single_escape', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /''/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Block scalar content (literal and folded)
  blockScalarLiteral.onUnmatched = OnUnmatched.CHARACTER;
  blockScalarLiteral.contentTokenType = TokenType.STRING;
  blockScalarFolded.onUnmatched = OnUnmatched.CHARACTER;
  blockScalarFolded.contentTokenType = TokenType.STRING;

  // Shared rules
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#.*/.source;
    r.action = action(TokenType.COMMENT);
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

  addRule(shared, 'block_scalar_literal', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\|[+-]?\d*/.source;
    r.end   = /(?=\S)/.source;
    r.beginAction = action(TokenType.OPERATOR, createSyntaxStateTransition(TransitionType.PUSH, blockScalarLiteral.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = blockScalarLiteral.id;
  });

  addRule(shared, 'block_scalar_folded', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = />[+-]?\d*/.source;
    r.end   = /(?=\S)/.source;
    r.beginAction = action(TokenType.OPERATOR, createSyntaxStateTransition(TransitionType.PUSH, blockScalarFolded.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = blockScalarFolded.id;
  });

  // Tags: !!tag or !tag
  addRule(shared, 'tag', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /!+[A-Za-z_]\w*/.source;
    r.action = action(TokenType.TYPE);
  });

  // Anchors: &anchor
  addRule(shared, 'anchor', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /&[A-Za-z_]\w*/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Aliases: *alias
  addRule(shared, 'alias', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\*[A-Za-z_]\w*/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Numbers
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX][0-9a-fA-F_]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_oct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[oO][0-7_]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.\d*(?:[eE][+-]?\d+)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float_inf_nan', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /\b(?:inf|nan)\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Booleans and null (fallback)
  addRule(shared, 'literal_bool_null', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = ['true', 'false', 'yes', 'no', 'on', 'off', 'null', '~'];
    r.action = action(TokenType.LITERAL);
  });

  // Punctuation and colon
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\],-]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(shared, 'colon', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /:/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Root rules
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Identifier fallback
  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Example code
  def.exampleCode = `# YAML example
# This is a comment

# Basic key-value pairs
name: Alice
age: 30
is_student: false
score: 95.5
null_value: null

# Boolean variations
enabled: true
disabled: no
feature_active: on
debug_mode: off

# Multi-line string (literal)
description: |
  This is a multi-line
  string using literal block
  with preserved newlines.

# Multi-line string (folded)
summary: >
  This is a folded block
  where newlines are replaced
  with spaces.

# Flow syntax
person: { name: Bob, age: 25 }
tags: [python, yaml, parser]

# Block sequence
fruits:
  - apple
  - banana
  - cherry

# Nested mapping
address:
  street: 123 Main St
  city: Springfield
  zip: 12345

# List of maps
people:
  - name: Alice
    age: 30
    hobbies:
      - reading
      - hiking
  - name: Bob
    age: 25
    hobbies:
      - coding
      - gaming

# Quotes
double_quoted: "Hello, world!"
single_quoted: 'Hello, world!'
escaped: "Line1\\nLine2\\tTab"

# Tags
custom_tag: !mytype value
explicit_type: !!str "hello"

# Anchors and aliases
defaults: &defaults
  timeout: 30
  retries: 3

production:
  <<: *defaults
  url: prod.example.com

development:
  <<: *defaults
  url: dev.example.com

# Complex data
database:
  host: localhost
  port: 5432
  credentials: &creds
    username: admin
    password: secret

app:
  database: *creds

# Inline list with different types
mixed: [string, 42, 3.14, true, null]

# Long text with quotes
message: "This is a long message with 'quotes' inside"
`;
  return def;
}

export function createYamlLanguageStyles(ymlDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(ymlDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.TYPE,          '#4ec9b0'),
    createTokenStyle(TokenType.IDENTIFIER,    '#9cdcfe'),
    createTokenStyle(TokenType.VARIABLE,      '#9cdcfe'),
    createTokenStyle(TokenType.FUNCTION,      '#dcdcaa'),
    createTokenStyle(TokenType.OPERATOR,      '#d4d4d4'),
    createTokenStyle(TokenType.PUNCTUATION,   '#d4d4d4'),
    createTokenStyle(TokenType.NUMBER,        '#b5cea8'),
    createTokenStyle(TokenType.STRING,        '#ce9178'),
    createTokenStyle(TokenType.COMMENT,       '#6a9955', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#d7ba7d'),
    createTokenStyle(TokenType.DECORATOR,     '#c8c8c8'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  const lightStyle = createHighlightStyle(ymlDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.IDENTIFIER,    '#800000'),
    createTokenStyle(TokenType.TYPE,          '#267f99'), // !!tags
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'), // : & * | >
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.STRING,        '#0451a5'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(ymlDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.IDENTIFIER,    '#e06c75'),
    createTokenStyle(TokenType.TYPE,          '#e5c07b'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(ymlDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.IDENTIFIER,    '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OPERATOR,      '#f8f8f2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(ymlDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.IDENTIFIER,    '#8be9fd'),
    createTokenStyle(TokenType.TYPE,          '#ff79c6'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(ymlDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.IDENTIFIER,    '#116329'),
    createTokenStyle(TokenType.TYPE,          '#cf222e'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OPERATOR,      '#24292f'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}