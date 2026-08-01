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

  // HighlightStyle
  const style = createHighlightStyle('Dark+');
  style.tokenStyles = [
    createTokenStyle(TokenType.PROPERTY,      '#9cdcfe'),
    createTokenStyle(TokenType.STRING,        '#ce9178'),
    createTokenStyle(TokenType.NUMBER,        '#b5cea8'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.COMMENT,       '#6a9955', { italic: true }),
    createTokenStyle(TokenType.PUNCTUATION,   '#d4d4d4'),
    createTokenStyle(TokenType.ESCAPE,        '#d7ba7d'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];
  def.styles.push(style);

  return def;
}