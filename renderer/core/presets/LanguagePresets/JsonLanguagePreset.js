import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxStateTransition,
  createHighlightStyle,
  createTokenStyle,
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

export function createJsonLanguage() {
  const def = createSyntaxDefinition('JSON');
  def.aliases = ['json', 'jsonc'];
  def.id = 'JsonLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // States
  const shared = newState(def, 'shared_rules');
  const strDouble = newState(def, 'string_double');
  const strEscape = newState(def, 'string_escape');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Shared rules
  // Comments for JSONC
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
    r.action = action(TokenType.COMMENT);
  });
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT);
    r.endAction   = action(TokenType.COMMENT);
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = newState(def, 'block_comment').id;
    def.states[def.states.length - 1].onUnmatched = OnUnmatched.CHARACTER;
  });

  // Strings
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Numbers
  addRule(shared, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Booleans and null
  addRule(shared, 'literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = ['true', 'false', 'null'];
    r.action = action(TokenType.LITERAL);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\],:]/;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules
  // Property keys – color strings before a colon as PROPERTY
  addRule(root, 'property_key', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /"(?:[^"\\]|\\.)*"(?=\s*:)/.source;
    r.action = action(TokenType.PROPERTY);
  });

  // Include shared rules (strings, numbers, literals, punctuation, comments)
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Example code
  def.exampleCode = `{
  // This is a comment (jsonc)
  /*
    Block comment also supported
  */
  "name": "Alice",
  "age": 30,
  "isStudent": false,
  "grades": [95, 87, 92],
  "address": {
    "street": "123 Main St",
    "city": "Springfield",
    "zip": 12345
  },
  "nullValue": null,
  "pi": 3.14159
}`;
  return def;
}

export function createJsonLanguageStyles(jsonDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(jsonDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.PROPERTY,      '#9cdcfe'),
    createTokenStyle(TokenType.STRING,        '#ce9178'),
    createTokenStyle(TokenType.NUMBER,        '#b5cea8'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.COMMENT,       '#6a9955', { italic: true }),
    createTokenStyle(TokenType.PUNCTUATION,   '#d4d4d4'),
    createTokenStyle(TokenType.ESCAPE,        '#d7ba7d'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  const lightStyle = createHighlightStyle(jsonDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.PROPERTY,      '#0451a5'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(jsonDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.PROPERTY,      '#e06c75'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(jsonDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.PROPERTY,      '#66d9ef'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(jsonDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.PROPERTY,      '#8be9fd'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(jsonDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.PROPERTY,      '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}