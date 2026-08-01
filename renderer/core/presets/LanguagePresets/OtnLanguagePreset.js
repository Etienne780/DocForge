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

export function createOtnLanguage() {
  const def = createSyntaxDefinition('OTN');
  def.aliases = ['otn'];
  def.id = 'OtnLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols – data types and keywords
  const predefined = [
    ['int',           TokenType.TYPE],
    ['int64',         TokenType.TYPE],
    ['uint64',        TokenType.TYPE],
    ['float',         TokenType.TYPE],
    ['double',        TokenType.TYPE],
    ['bool',          TokenType.TYPE],
    ['String',        TokenType.TYPE],
    ['string',        TokenType.TYPE],
    ['object',        TokenType.TYPE],
    ['list',          TokenType.TYPE],
    ['any',           TokenType.TYPE],
    ['Ref',           TokenType.KEYWORD],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['version',       TokenType.KEYWORD],
    ['defType',       TokenType.KEYWORD],
    ['defName',       TokenType.KEYWORD],
    ['object',        TokenType.KEYWORD],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const strDouble = newState(def, 'string_double');
  const strEscape = newState(def, 'string_escape');
  const blockComment = newState(def, 'block_comment');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Shared rules
  // Line comments
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
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

  // Numbers – supports integer, decimal, scientific notation (e.g. 1.31072e-12)
  addRule(shared, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /-?(?:\d+\.\d+|\d+)(?:[eE][+-]?\d+)?/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[=]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation: ; : , / { } [ ] < >
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[;,:/{}()\[\]<>]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Directives: @version, @defType, @defName, @object
  addRule(shared, 'directive', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Ref<TypeName> – reference syntax
  addRule(shared, 'ref_type', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /Ref\s*<[A-Za-z_]\w*>/.source;
    r.action = action(TokenType.KEYWORD);
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
  def.exampleCode = `// OTN does not support comments natively - these are for explanation only.

@version: 1;
@defType: int = 0, float = 1, String = 2;
@defName: name = 0, value = 1;

@object: {
  Weapon[3] {
    int/name, float/damage, String/type;
    1, 15.5, "Sword";
    2, 8.0, "Dagger";
    3, 22.0, "Axe";
  };

  Player[2] {
    String/name, int/health, Ref<Weapon>/weapon;
    "Alice", 100, 1;
    "Bob", 80, 3;
  };

  Inventory[1] {
    int/owner, Ref<Weapon>[]/weapons;
    1, [1, 2];
  };

  // Scientific notation example
  Physics[1] {
    float/mass, float/charge;
    1.31072e-12, -3.2e-19;
  };
}

@version: 1;

@object: {
  Weapon[3] {
    int/name, float/damage, String/type;
    1, 15.5, "Sword";
    2, 8.0, "Dagger";
    3, 22.0, "Axe";
  };

  Player[2] {
    String/name, int/health, Ref<Weapon>/weapon;
    "Alice", 100, 1;
    "Bob", 80, 3;
  };

  Inventory[1] {
    int/owner, Ref<Weapon>[]/weapons;
    1, [1, 2];
  };

  Physics[1] {
    float/mass, float/charge;
    1.31072e-12, -3.2e-19;
  };
}`;

  // HighlightStyle
  const style = createHighlightStyle('Dark+');
  style.tokenStyles = [
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
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];
  def.styles.push(style);

  return def;
}