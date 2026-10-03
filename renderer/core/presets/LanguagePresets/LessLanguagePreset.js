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

// CSS/Less at-rules (any other `@name` is a Less variable)
const AT_RULE_PATTERN = /@(?:-[a-z]+-)?(?:import|plugin|media|supports|keyframes|font-face|container|layer|property|scope|starting-style|page|namespace|charset|counter-style|font-feature-values|font-palette-values|view-transition|document)(?![\w-])/.source;

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

  // Real at-rules only; everything else starting with @ is a variable
  addRule(common, 'at_rule', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = AT_RULE_PATTERN;
    r.action = action(TokenType.KEYWORD);
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

  // @var, @@var (variable variables)
  addRule(common, 'variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@@?[A-Za-z_][A-Za-z0-9_-]*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // !important
  addRule(common, 'important', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /!\s*important\b/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // .mixin( … ) – the whole `.name` is colored as function
  addRule(common, 'mixin_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\.([A-Za-z_][A-Za-z0-9_-]*)(?=\s*\()/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.FUNCTION;
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
    r.pattern = /\.([A-Za-z_][A-Za-z0-9_-]*)(?=\s*\()/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.FUNCTION;
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Namespace: #ns > .mixin(), #ns.mixin()
  addRule(common, 'namespace', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#[A-Za-z_][\w-]*(?=\s*>?\s*\.[A-Za-z_])/.source;
    r.action = action(TokenType.TYPE);
  });

  // Class selector: .name (never valid in a value)
  addRule(common, 'class_selector', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\.[A-Za-z_-][\w-]*/.source;
    r.action = action(TokenType.TYPE);
  });

  // Function calls: iscolor(), lighten(), translateX()
  addRule(common, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_][\w-]*(?=\()/.source;
    r.action = action(TokenType.FUNCTION);
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
    r.pattern = /-{0,2}[A-Za-z_][A-Za-z0-9_-]*(?=\s*:)/.source;
    r.action = action(TokenType.PROPERTY);
  });

  addRule(common, 'number_with_unit', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /-?\d*\.?\d+(?:e[+-]?\d+)?(?:%|(?:px|em|rem|ex|ch|cap|ic|lh|rlh|vh|vw|vi|vb|vmin|vmax|[sld]v(?:h|w|i|b|min|max)|cq(?:w|h|i|b|min|max)|deg|rad|grad|turn|s|ms|hz|khz|dpi|dpcm|dppx|x|fr|pt|pc|in|cm|mm|q)\b)/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(common, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /-?\d*\.?\d+(?:e[+-]?\d+)?/.source;
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
    r.pattern = /[+\-*/%]=?|[!=]=?|[<>]=?|~|\b(?:and|or|not)\b/.source;
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

  // Selector rules: only where a `{` follows on the same line before any
  // `;` or `}` (interpolation @{…} is skipped), so `a:hover {` is a
  // selector while `color: red;` stays a declaration.
  const selectorRules = newState(def, 'selector_rules');
  const SEL_AHEAD = /(?=(?:[^;{}@]|@\{[^{}]*\}|@(?!\{))*\{)/.source;

  addRule(selectorRules, 'parent_suffix', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=&)[\w-]+/.source;
    r.action = action(TokenType.TYPE);
  });

  addRule(selectorRules, 'id_selector', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#[A-Za-z_-][\w-]*/.source + SEL_AHEAD;
    r.action = action(TokenType.TYPE);
  });

  addRule(selectorRules, 'pseudo', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /::[A-Za-z-]+|:[A-Za-z-]+/.source + SEL_AHEAD;
    r.action = action(TokenType.DECORATOR);
  });

  addRule(selectorRules, 'combinator', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = '(?:' + /[>+~]|[\[\]=^$*|]/.source + ')' + SEL_AHEAD;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(selectorRules, 'element_selector', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = '(?:' + /(?<!@)\b(?!(?:when|and|or|not)\b)[A-Za-z][\w-]*(?![\w-]*\()/.source + ')' + SEL_AHEAD;
    r.action = action(TokenType.TYPE);
  });

  // At-rule prelude: @media, @import, @supports … up to `;`, `{` or `}`
  const atPrelude = newState(def, 'at_prelude');
  atPrelude.onUnmatched = OnUnmatched.CHARACTER;

  addRule(atPrelude, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(atPrelude, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
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

  addRule(root, 'at_rule', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = AT_RULE_PATTERN;
    // `;` ends the statement, `{`/`}` is left for the root state
    r.end   = /(;)|(?=[{}])/.source;
    r.beginAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, atPrelude.id));
    const endAction = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.PUNCTUATION, register: null };
    endAction.captures = caps;
    endAction.transition = createSyntaxStateTransition(TransitionType.POP);
    r.endAction = endAction;
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = atPrelude.id;
  });

  addRule(root, 'include_selectors', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = selectorRules.id;
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

// Namespaces, guards and !important
#theme {
  .primary() { color: @primary; }
}
.cta {
  #theme > .primary();
  .box-shadow(0, 1px) !important;
  &:extend(.button all);
}
@name: primary;
.dynamic { color: @@name; }
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

  const lightStyle = createHighlightStyle(lessDef.id, 'Light+');
  lightStyle.tokenStyles = [
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

  const oneDarkStyle = createHighlightStyle(lessDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
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

  const monokaiStyle = createHighlightStyle(lessDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
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

  const draculaStyle = createHighlightStyle(lessDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
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

  const githubLightStyle = createHighlightStyle(lessDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
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