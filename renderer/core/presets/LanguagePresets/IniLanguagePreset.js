import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxStateTransition,
  createSyntaxCaptureMap,
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

export function createIniLanguage() {
  const def = createSyntaxDefinition('INI');
  def.aliases = ['ini', 'cfg', 'config'];
  def.id = 'IniLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['yes',           TokenType.LITERAL],
    ['no',            TokenType.LITERAL],
    ['on',            TokenType.LITERAL],
    ['off',           TokenType.LITERAL],
    ['enabled',       TokenType.LITERAL],
    ['disabled',      TokenType.LITERAL],
    ['name',          TokenType.PROPERTY],
    ['path',          TokenType.PROPERTY],
    ['dir',           TokenType.PROPERTY],
    ['file',          TokenType.PROPERTY],
    ['mode',          TokenType.PROPERTY],
    ['type',          TokenType.PROPERTY],
    ['debug',         TokenType.PROPERTY],
    ['verbose',       TokenType.PROPERTY],
    ['host',          TokenType.PROPERTY],
    ['port',          TokenType.PROPERTY],
    ['user',          TokenType.PROPERTY],
    ['password',      TokenType.PROPERTY],
    ['timeout',       TokenType.PROPERTY],
    ['retries',       TokenType.PROPERTY],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const multilineValue = newState(def, 'multiline_value');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\"']|[0-7]{1,3}|x[0-9a-fA-F]{2})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted string content
  strSingle.onUnmatched = OnUnmatched.CHARACTER;

  // Multiline value content
  multilineValue.onUnmatched = OnUnmatched.CHARACTER;
  multilineValue.contentTokenType = TokenType.STRING;

  // Shared rules
  addRule(shared, 'comment_semicolon', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^[ \t]*;.*/.source;
    r.action = action(TokenType.COMMENT);
  });
  addRule(shared, 'comment_hash', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^[ \t]*#.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Section: [SectionName]
  addRule(shared, 'section', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^[ \t]*\[[^\]]+\]/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    // The section name is inside brackets
    a.tokenType = TokenType.KEYWORD;
    r.action = a;
  });

  addRule(shared, 'section_detailed', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^[ \t]*\[([^\]]+)\]/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['0'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['1'] = { tokenType: TokenType.IDENTIFIER, register: null };
    a.captures = caps;
    r.action = a;
  });

  addRule(shared, 'key_value', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^[ \t]*([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*=[ \t]*(.*)$/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.PROPERTY, register: null };
    caps.groups['2'] = { tokenType: TokenType.OTHER, register: null };
    a.captures = caps;
    r.action = a;
  });

  addRule(shared, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+(?:\.\d+)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(shared, 'multiline_start', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^[ \t]*([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*=[ \t]*$/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.PROPERTY, register: null };
    a.captures = caps;
    r.action = a;
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

  // Root rules
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(root, 'whitespace', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[ \t]+/.source;
    r.action = action(TokenType.OTHER);
  });

  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Example code
  def.exampleCode = `# INI file example
; This is also a comment

[General]
name = My Application
version = 1.2.3
debug = true
verbose = false

[Paths]
data_dir = data/
log_dir = logs/
config_file = config/settings.ini

[Network]
host = localhost
port = 8080
timeout = 30
retries = 3
ssl_enabled = true

[User]
username = admin
password = secret123

[Colors]
background = "#1a1a2e"
foreground = "#e0e0e0"
accent = "#00d4ff"

[Quoted Strings]
with_spaces = "Hello, World!"
with_escapes = "Line1\\nLine2\\tTab"
single_quoted = 'Single quoted string'

[Multiline]
description =
  This is a multiline value
  that spans several lines
  and preserves the formatting.

[Empty Section]

[Special Keys]
path_with_dots = /usr/local/bin
key_with_underscore = value_123
key-with-dash = also allowed
`;
  return def;
}

export function createIniLanguageStyles(iniDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(iniDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.PROPERTY,      '#9cdcfe'),
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

  return [darkStyle];
}