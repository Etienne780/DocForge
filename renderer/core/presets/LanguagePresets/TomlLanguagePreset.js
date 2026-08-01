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

export function createTomlLanguage() {
  const def = createSyntaxDefinition('TOML');
  def.aliases = ['toml'];
  def.id = 'TomlLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols – common TOML keys and values
  const predefined = [
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['name',          TokenType.PROPERTY],
    ['version',       TokenType.PROPERTY],
    ['description',   TokenType.PROPERTY],
    ['license',       TokenType.PROPERTY],
    ['authors',       TokenType.PROPERTY],
    ['homepage',      TokenType.PROPERTY],
    ['repository',    TokenType.PROPERTY],
    ['documentation', TokenType.PROPERTY],
    ['readme',        TokenType.PROPERTY],
    ['keywords',      TokenType.PROPERTY],
    ['categories',    TokenType.PROPERTY],
    ['dependencies',  TokenType.PROPERTY],
    ['dev-dependencies', TokenType.PROPERTY],
    ['build-dependencies', TokenType.PROPERTY],
    ['bin',           TokenType.PROPERTY],
    ['lib',           TokenType.PROPERTY],
    ['path',          TokenType.PROPERTY],
    ['default',       TokenType.PROPERTY],
    ['features',      TokenType.PROPERTY],
    ['workspace',     TokenType.PROPERTY],
    ['members',       TokenType.PROPERTY],
    ['exclude',       TokenType.PROPERTY],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const multilineDouble = newState(def, 'multiline_double');
  const multilineSingle = newState(def, 'multiline_single');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:["\\bfnrt]|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted string content (no escapes)
  strSingle.onUnmatched = OnUnmatched.CHARACTER;

  // Multiline double-quoted string: """..."""
  multilineDouble.onUnmatched = OnUnmatched.CHARACTER;
  multilineDouble.contentTokenType = TokenType.STRING;
  addRule(multilineDouble, 'ml_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Multiline single-quoted string: '''...'''
  multilineSingle.onUnmatched = OnUnmatched.CHARACTER;
  multilineSingle.contentTokenType = TokenType.STRING;

  // Shared rules
  // Comments: # (single line)
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#.*/.source;
    r.action = action(TokenType.COMMENT);
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

  // Multiline double-quoted: """..."""
  addRule(shared, 'multiline_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /"""/.source;
    r.end   = /"""/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, multilineDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = multilineDouble.id;
  });

  // Multiline single-quoted: '''...'''
  addRule(shared, 'multiline_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /'''/.source;
    r.end   = /'''/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, multilineSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = multilineSingle.id;
  });

  // DateTime: ISO 8601 (e.g., 2024-01-01T12:00:00Z)
  addRule(shared, 'datetime', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Numbers (integer, hex, oct, bin, float, scientific)
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:[+-]?\d[\d_]*|0x[0-9a-fA-F_]+|0o[0-7_]+|0b[01_]+)\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+-]?(?:\d[\d_]*\.\d[\d_]*|\d[\d_]*(?:\.\d[\d_]*)?[eE][+-]?\d+)/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Arrays: [...] – we handle brackets as punctuation, content by shared rules
  addRule(shared, 'array_punct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[\[\],]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Inline table: { ... } – handled as punctuation
  addRule(shared, 'inline_table_punct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Dot separator for nested keys: a.b.c = value
  addRule(shared, 'dot_separator', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\./.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Key-value pair: key = value – we capture the key as PROPERTY
  addRule(shared, 'key_value', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*=(?=\s*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.PROPERTY, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Root rules
  // Table headers with capturing for better coloring
  addRule(root, 'table_header', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^[ \t]*(\[\[?)([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(\]\]?)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['2'] = { tokenType: TokenType.IDENTIFIER, register: null };
    caps.groups['3'] = { tokenType: TokenType.PUNCTUATION, register: null };
    a.captures = caps;
    r.action = a;
  });

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
  def.exampleCode = `# TOML example file
# This is a comment

# Basic key-value pairs
name = "My Application"
version = "1.2.3"
description = "A simple TOML example"

# Numbers
integer = 42
hex = 0xDEAD_BEEF
octal = 0o755
binary = 0b1010
float = 3.14159
scientific = 1.2e-3

# Booleans
enabled = true
disabled = false

# Datetime
created = 2024-01-01T12:00:00Z

# Array
numbers = [1, 2, 3, 4, 5]
mixed = [1, "two", 3.0, true]
nested = [[1, 2], [3, 4]]

# Inline table
person = { name = "Alice", age = 30 }

# Table
[package]
name = "my-app"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = "1.0"
tokio = { version = "1.0", features = ["full"] }

[dev-dependencies]
criterion = "0.5"

# Nested table
[profile.release]
opt-level = 3
lto = true

# Array of tables
[[bin]]
name = "app"
path = "src/main.rs"

[[bin]]
name = "cli"
path = "src/cli.rs"

# Multiline strings
multiline = """
This is a multiline string
that spans multiple lines.
"""

single_multiline = '''
This is a multiline string
using single quotes.
'''

# Keys with dots
"a.b.c" = 42
"d.e.f" = "hello"`;

  // HighlightStyle
  const style = createHighlightStyle('Dark+');
  style.tokenStyles = [
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
  def.styles.push(style);

  return def;
}