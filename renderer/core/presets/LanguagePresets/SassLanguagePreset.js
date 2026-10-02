import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxCaptureMap,
  createSyntaxStateTransition,
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

export function createSassLanguage() {
  const def = createSyntaxDefinition('Sass/SCSS');
  def.aliases = ['sass', 'scss'];
  def.id = 'SassLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['white',         TokenType.LITERAL],
    ['black',         TokenType.LITERAL],
    ['red',           TokenType.LITERAL],
    ['blue',          TokenType.LITERAL],
    ['green',         TokenType.LITERAL],
    ['yellow',        TokenType.LITERAL],
    ['orange',        TokenType.LITERAL],
    ['purple',        TokenType.LITERAL],
    ['pink',          TokenType.LITERAL],
    ['gray',          TokenType.LITERAL],
    ['grey',          TokenType.LITERAL],
    ['transparent',   TokenType.LITERAL],
    ['currentColor',  TokenType.LITERAL],
    ['rgb',           TokenType.FUNCTION],
    ['rgba',          TokenType.FUNCTION],
    ['hsl',           TokenType.FUNCTION],
    ['hsla',          TokenType.FUNCTION],
    ['adjust-hue',    TokenType.FUNCTION],
    ['darken',        TokenType.FUNCTION],
    ['lighten',       TokenType.FUNCTION],
    ['saturate',      TokenType.FUNCTION],
    ['desaturate',    TokenType.FUNCTION],
    ['grayscale',     TokenType.FUNCTION],
    ['complement',    TokenType.FUNCTION],
    ['invert',        TokenType.FUNCTION],
    ['mix',           TokenType.FUNCTION],
    ['scale-color',   TokenType.FUNCTION],
    ['change-color',  TokenType.FUNCTION],
    ['color',         TokenType.FUNCTION],
    ['map-get',       TokenType.FUNCTION],
    ['map-merge',     TokenType.FUNCTION],
    ['map-remove',    TokenType.FUNCTION],
    ['map-keys',      TokenType.FUNCTION],
    ['map-values',    TokenType.FUNCTION],
    ['map-has-key',   TokenType.FUNCTION],
    ['list-length',   TokenType.FUNCTION],
    ['list-nth',      TokenType.FUNCTION],
    ['list-join',     TokenType.FUNCTION],
    ['list-append',   TokenType.FUNCTION],
    ['list-separator', TokenType.FUNCTION],
    ['index',         TokenType.FUNCTION],
    ['str-length',    TokenType.FUNCTION],
    ['str-insert',    TokenType.FUNCTION],
    ['str-index',     TokenType.FUNCTION],
    ['str-slice',     TokenType.FUNCTION],
    ['to-upper-case', TokenType.FUNCTION],
    ['to-lower-case', TokenType.FUNCTION],
    ['quote',         TokenType.FUNCTION],
    ['unquote',       TokenType.FUNCTION],
    ['inspect',       TokenType.FUNCTION],
    ['selector-append', TokenType.FUNCTION],
    ['selector-nest', TokenType.FUNCTION],
    ['selector-replace', TokenType.FUNCTION],
    ['selector-unify', TokenType.FUNCTION],
    ['unique-id',     TokenType.FUNCTION],
    ['random',        TokenType.FUNCTION],
    ['percentage',    TokenType.FUNCTION],
    ['round',         TokenType.FUNCTION],
    ['ceil',          TokenType.FUNCTION],
    ['floor',         TokenType.FUNCTION],
    ['abs',           TokenType.FUNCTION],
    ['min',           TokenType.FUNCTION],
    ['max',           TokenType.FUNCTION],
    ['if',            TokenType.FUNCTION],
    ['map-get',       TokenType.FUNCTION],
    ['map-has-key',   TokenType.FUNCTION],
    ['map-keys',      TokenType.FUNCTION],
    ['map-values',    TokenType.FUNCTION],
    ['map-merge',     TokenType.FUNCTION],
    ['map-remove',    TokenType.FUNCTION],
    ['$list-separator-comma', TokenType.VARIABLE],
    ['$list-separator-space', TokenType.VARIABLE],
    ['$list-separator-slash', TokenType.VARIABLE],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const blockComment = newState(def, 'block_comment');
  const interpContent = newState(def, 'interp_content');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4})/.source;
    r.action = action(TokenType.ESCAPE);
  });
  // Interpolation inside strings: #{...}
  addRule(strEscape, 'interpolation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#\{[^}]*\}/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted string content (no interpolation)
  strSingle.onUnmatched = OnUnmatched.CHARACTER;

  // Interpolation content state
  interpContent.onUnmatched = OnUnmatched.CHARACTER;
  interpContent.contentTokenType = TokenType.VARIABLE;

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Common rules
  // Sass/SCSS keywords
  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'and', 'or', 'not', 'if', 'else', 'for', 'each', 'while',
      'function', 'return', 'mixin', 'include', 'extend', 'content',
      'import', 'use', 'forward', 'media', 'supports', 'keyframes',
      'at-root', 'debug', 'warn', 'error', 'silent',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // @-rules
  addRule(common, 'at_rule', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Variable: $var – needs to be before property rule
  addRule(common, 'variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_][A-Za-z0-9_-]*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Interpolation: #{...}
  addRule(common, 'interpolation', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /#\{/.source;
    r.end   = /\}/.source;
    r.beginAction = action(TokenType.VARIABLE, createSyntaxStateTransition(TransitionType.PUSH, interpContent.id));
    r.endAction   = action(TokenType.VARIABLE, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.VARIABLE;
    r.innerStateId = interpContent.id;
  });

  // Placeholder selector: %placeholder
  addRule(common, 'placeholder', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /%[A-Za-z_][A-Za-z0-9_-]*/.source;
    r.action = action(TokenType.TYPE);
  });

  // Parent selector: &
  addRule(common, 'parent_selector', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /&/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // CSS property names – only match if NOT starting with $
  addRule(common, 'property', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_][A-Za-z0-9_-]*(?=\s*:)/.source;
    r.action = action(TokenType.PROPERTY);
  });

  // CSS unit values with px, em, rem, %, etc.
  addRule(common, 'number_with_unit', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /-?\d*\.?\d+(?:px|em|rem|%|vh|vw|vmin|vmax|deg|rad|grad|turn|s|ms|fr|pt|pc|in|cm|mm|ex|ch)/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Plain numbers
  addRule(common, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /-?\d*\.?\d+/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Hex colors – improved regex to match full hex values
  addRule(common, 'hex_color', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /#[0-9a-fA-F]+/.source;
    r.action = action(TokenType.STRING);
  });

  // Operators: +, -, *, /, %, ==, !=, >, <, >=, <=, and, or, not
  addRule(common, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%]=?|[!=]=?|<=|>=|and|or|not/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation: ; : , ( ) { } [ ] .
  addRule(common, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[;:,.(){}[\]]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Identifier fallback
  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_][A-Za-z0-9_-]*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules
  // Line comments (Sass: //, SCSS: //)
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Block comments (Sass: /* */)
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

  // Root rules – line comments first, then shared, then common
  addRule(root, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });

  // Example code
  def.exampleCode = `// ============================================
// SCSS example
// ============================================

// Variables
$primary: #3498db;
$font-stack: "Helvetica", sans-serif;
$spacing: 16px;

// Mixin
@mixin border-radius($radius) {
  border-radius: $radius;
}

// Placeholder
%text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Extend with placeholder
.button {
  @extend %text-ellipsis;
  padding: $spacing;
  background: $primary;
  color: #fff;
  @include border-radius(4px);

  &:hover {
    background: darken($primary, 10%);
  }
}

// Function
@function calculate-width($base, $multiplier) {
  @return $base * $multiplier;
}

// Interpolation
$side: left;
.article-#{$side} {
  margin-#{$side}: 20px;
}

// Control flow
$theme: dark;

.alert {
  @if $theme == dark {
    background: #333;
    color: #fff;
  } @else {
    background: #f8f9fa;
    color: #212529;
  }
}

// For loop
@for $i from 1 through 3 {
  .col-#{$i} {
    width: 20% * $i;
  }
}

// Each loop
$colors: (red: #ff0000, green: #00ff00, blue: #0000ff);
@each $name, $color in $colors {
  .bg-#{$name} {
    background: $color;
  }
}

// Media query
@media (max-width: 768px) {
  .container {
    padding: $spacing / 2;
  }
}

// Keyframes
@keyframes slide-in {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

// Import
@import "components/button";
@use "utils/mixins" as mix;
`;
  return def;
}

export function createSassLanguageStyles(sassDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(sassDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.TYPE,          '#4ec9b0'),
    createTokenStyle(TokenType.IDENTIFIER,    '#9cdcfe'),
    createTokenStyle(TokenType.VARIABLE,      '#9cdcfe'),
    createTokenStyle(TokenType.FUNCTION,      '#dcdcaa'),
    createTokenStyle(TokenType.PROPERTY,      '#9cdcfe'),
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

  const lightStyle = createHighlightStyle(sassDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.TYPE,          '#800000'), // %placeholder
    createTokenStyle(TokenType.FUNCTION,      '#795e26'),
    createTokenStyle(TokenType.IDENTIFIER,    '#0451a5'),
    createTokenStyle(TokenType.LITERAL,       '#0451a5'),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.PROPERTY,      '#e50000'),
    createTokenStyle(TokenType.VARIABLE,      '#001080'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.KEYWORD,       '#af00db'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(sassDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.TYPE,          '#d19a66'),
    createTokenStyle(TokenType.FUNCTION,      '#56b6c2'),
    createTokenStyle(TokenType.IDENTIFIER,    '#abb2bf'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.PROPERTY,      '#e06c75'),
    createTokenStyle(TokenType.VARIABLE,      '#e06c75'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(sassDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.TYPE,          '#a6e22e'),
    createTokenStyle(TokenType.FUNCTION,      '#66d9ef'),
    createTokenStyle(TokenType.IDENTIFIER,    '#66d9ef'),
    createTokenStyle(TokenType.LITERAL,       '#66d9ef'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.PROPERTY,      '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.VARIABLE,      '#fd971f'),
    createTokenStyle(TokenType.COMMENT,       '#75715e', { italic: true }),
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(sassDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.TYPE,          '#50fa7b'),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.PROPERTY,      '#8be9fd'),
    createTokenStyle(TokenType.VARIABLE,      '#ffb86c', { italic: true }),
    createTokenStyle(TokenType.COMMENT,       '#6272a4', { italic: true }),
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(sassDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.TYPE,          '#6639ba'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.IDENTIFIER,    '#0550ae'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.PROPERTY,      '#0550ae'),
    createTokenStyle(TokenType.VARIABLE,      '#953800'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781', { italic: true }),
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}