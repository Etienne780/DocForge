import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxCaptureMap,
  createSyntaxStateTransition,
  createSymbolRegister,
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

export function createLessLanguage() {
  const def = createSyntaxDefinition('Less');
  def.aliases = ['less'];
  def.id = 'LessLang';
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
    ['hsv',           TokenType.FUNCTION],
    ['hsva',          TokenType.FUNCTION],
    ['argb',          TokenType.FUNCTION],
    ['darken',        TokenType.FUNCTION],
    ['lighten',       TokenType.FUNCTION],
    ['saturate',      TokenType.FUNCTION],
    ['desaturate',    TokenType.FUNCTION],
    ['fadein',        TokenType.FUNCTION],
    ['fadeout',       TokenType.FUNCTION],
    ['fade',          TokenType.FUNCTION],
    ['spin',          TokenType.FUNCTION],
    ['mix',           TokenType.FUNCTION],
    ['greyscale',     TokenType.FUNCTION],
    ['contrast',      TokenType.FUNCTION],
    ['multiply',      TokenType.FUNCTION],
    ['screen',        TokenType.FUNCTION],
    ['overlay',       TokenType.FUNCTION],
    ['softlight',     TokenType.FUNCTION],
    ['hardlight',     TokenType.FUNCTION],
    ['difference',    TokenType.FUNCTION],
    ['exclusion',     TokenType.FUNCTION],
    ['average',       TokenType.FUNCTION],
    ['negation',      TokenType.FUNCTION],
    ['ceil',          TokenType.FUNCTION],
    ['floor',         TokenType.FUNCTION],
    ['percentage',    TokenType.FUNCTION],
    ['round',         TokenType.FUNCTION],
    ['sqrt',          TokenType.FUNCTION],
    ['abs',           TokenType.FUNCTION],
    ['sin',           TokenType.FUNCTION],
    ['cos',           TokenType.FUNCTION],
    ['tan',           TokenType.FUNCTION],
    ['atan',          TokenType.FUNCTION],
    ['pow',           TokenType.FUNCTION],
    ['mod',           TokenType.FUNCTION],
    ['min',           TokenType.FUNCTION],
    ['max',           TokenType.FUNCTION],
    ['length',        TokenType.FUNCTION],
    ['extract',       TokenType.FUNCTION],
    ['replace',       TokenType.FUNCTION],
    ['escape',        TokenType.FUNCTION],
    ['e',             TokenType.FUNCTION],
    ['unit',          TokenType.FUNCTION],
    ['color',         TokenType.FUNCTION],
    ['data-uri',      TokenType.FUNCTION],
    ['svg-gradient',  TokenType.FUNCTION],
    ['when',          TokenType.KEYWORD],
    ['default',       TokenType.KEYWORD],
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

  // Escape sequences for strings
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4})/.source;
    r.action = action(TokenType.ESCAPE);
  });
  addRule(strEscape, 'interpolation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@\{[^}]*\}/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted string content
  strSingle.onUnmatched = OnUnmatched.CHARACTER;

  // Interpolation content
  interpContent.onUnmatched = OnUnmatched.CHARACTER;
  interpContent.contentTokenType = TokenType.VARIABLE;

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Common rules
  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'import', 'from', 'when', 'default', 'extend', 'plugin',
      'keyframes', 'media', 'supports', 'if', 'for', 'each',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'at_rule', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_][A-Za-z0-9_-]*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(common, 'interpolation', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /@\{/.source;
    r.end   = /\}/.source;
    r.beginAction = action(TokenType.VARIABLE, createSyntaxStateTransition(TransitionType.PUSH, interpContent.id));
    r.endAction   = action(TokenType.VARIABLE, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.VARIABLE;
    r.innerStateId = interpContent.id;
  });

  addRule(common, 'mixin_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\.([A-Za-z_][A-Za-z0-9_-]*)\s*\(/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'mixin_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\.([A-Za-z_][A-Za-z0-9_-]*)\s*\(/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'escaped_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /~"[^"]*"|~'[^']*'/.source;
    r.action = action(TokenType.STRING);
  });

  addRule(common, 'parent_selector', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /&/.source;
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'property', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_][A-Za-z0-9_-]*(?=\s*:)/.source;
    r.action = action(TokenType.PROPERTY);
  });

  addRule(common, 'number_with_unit', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /-?\d*\.?\d+(?:px|em|rem|%|vh|vw|vmin|vmax|deg|rad|grad|turn|s|ms|fr|pt|pc|in|cm|mm|ex|ch)/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(common, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /-?\d*\.?\d+/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(common, 'hex_color', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /#[0-9a-fA-F]+/.source;
    r.action = action(TokenType.STRING);
  });

  addRule(common, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%]=?|[!=]=?|<=|>=|and|or|not/.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(common, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[;:,.(){}[\]]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_][A-Za-z0-9_-]*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules
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
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
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
  def.exampleCode = `// Less example
// This is a comment

// Variables
@primary: #3498db;
@font-stack: "Helvetica", sans-serif;
@spacing: 16px;
@theme: dark;

// Mixin with parameter
.border-radius(@radius) {
  -webkit-border-radius: @radius;
  -moz-border-radius: @radius;
  border-radius: @radius;
}

// Mixin with default value
.box-shadow(@x: 0, @y: 0, @blur: 8px, @color: rgba(0,0,0,0.2)) {
  box-shadow: @x @y @blur @color;
}

// Mixin with when guard
.text-color(@color) when (lightness(@color) > 50%) {
  color: @color;
}
.text-color(@color) when (lightness(@color) <= 50%) {
  color: lighten(@color, 20%);
}

// Nested rules
.button {
  @extend .btn-base;
  padding: @spacing;
  background: @primary;
  color: #fff;
  .border-radius(4px);

  &:hover {
    background: darken(@primary, 10%);
  }

  &.large {
    padding: @spacing * 1.5;
  }
}

// Interpolation
@side: left;
.article-@{side} {
  margin-@{side}: 20px;
}

// Variables in variables
@base: #f04615;
@bg: @base;
.selector {
  background: @bg;
}

// Escape string
@min768: ~"(min-width: 768px)";
@media @min768 {
  .container {
    padding: @spacing / 2;
  }
}

// Import
@import "components/button";
@import (inline) "fonts.css";
@import (reference) "mixins.less";
@import (less) "variables.less";

// Ruleset as variable
@detached: {
  .box-shadow(0, 2px, 4px);
};
.widget {
  @detached();
}

// Map (Less 3.0+)
@colors: {
  primary: #3498db;
  success: #28a745;
  danger: #dc3545;
};

.alert-primary {
  background: @colors[primary];
}

// For loop (Less 3.7+)
@iterations: 4;
.loop (@index) when (@index > 0) {
  .col-@{index} {
    width: 100% / @iterations * @index;
  }
  .loop(@index - 1);
}
.loop(@iterations);

// Each loop (Less 3.7+)
@each: {
  red: #ff0000;
  green: #00ff00;
  blue: #0000ff;
};
each(@each, {
  .bg-@{key} {
    background: @value;
  }
});

// Keyframes
@keyframes slide-in {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

// Property value extraction
@width: 10px + 20px;
@height: 30px;

.rect {
  width: @width;
  height: @height;
}

// Color operations
@color: #ff0000;
.darken-example {
  color: darken(@color, 20%);
}

// Math
@base-font-size: 16px;
.fluid {
  font-size: @base-font-size * 1.5;
}
`;
  return def;
}

export function createLessLanguageStyles(lessDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(lessDef.id, 'Dark+');
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

  return [darkStyle];
}