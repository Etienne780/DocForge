import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxCaptureMap,
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

// Custom token types (for colors and units)
const COLOR_TOKEN = 'color';
const CSS_UNIT    = 'cssUnit';

// Length, angle, time, frequency, resolution and flex units
const CSS_UNITS = [
  'px', 'em', 'rem', 'ex', 'rex', 'ch', 'rch', 'cap', 'rcap', 'ic', 'ric', 'lh', 'rlh',
  'vh', 'vw', 'vi', 'vb', 'vmin', 'vmax',
  'svh', 'svw', 'svi', 'svb', 'svmin', 'svmax',
  'lvh', 'lvw', 'lvi', 'lvb', 'lvmin', 'lvmax',
  'dvh', 'dvw', 'dvi', 'dvb', 'dvmin', 'dvmax',
  'cqw', 'cqh', 'cqi', 'cqb', 'cqmin', 'cqmax',
  'cm', 'mm', 'q', 'in', 'pt', 'pc',
  'deg', 'grad', 'rad', 'turn', 's', 'ms', 'hz', 'khz',
  'dpi', 'dpcm', 'dppx', 'x', 'fr',
];

// Inside a block: a selector only if a `{` follows before `;`/`}`
const SELECTOR_AHEAD = /(?=[^;{}]*\{)/.source;

export function createCSSLanguage() {
  const def = createSyntaxDefinition('CSS');
  def.aliases = ['css'];
  def.id = 'CssLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // ── Shared: comments + strings ────────────────────────────────────────────
  const shared    = newState(def, 'shared_rules');
  const comment   = newState(def, 'comment');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');

  comment.onUnmatched = OnUnmatched.CHARACTER;
  comment.contentTokenType = TokenType.COMMENT;
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  strDouble.contentTokenType = TokenType.STRING;
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  strSingle.contentTokenType = TokenType.STRING;

  addRule(shared, 'comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, comment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = comment.id;
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

  // ── numbers: shared by declarations and at-rule preludes ──────────────────
  const numbers = newState(def, 'numbers');

  // Numbers with units (except %)
  addRule(numbers, 'number_with_unit', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = new RegExp(String.raw`(-?\d*\.?\d+(?:e[+-]?\d+)?)(` + CSS_UNITS.join('|') + String.raw`)\b`).source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.NUMBER, register: null };
    caps.groups['2'] = { tokenType: CSS_UNIT, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Percentage values
  addRule(numbers, 'percentage', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(-?\d*\.?\d+(?:e[+-]?\d+)?)(%)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.NUMBER, register: null };
    caps.groups['2'] = { tokenType: CSS_UNIT, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Plain numbers
  addRule(numbers, 'number_plain', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /-?\d*\.?\d+(?:e[+-]?\d+)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // ── Selector rules ────────────────────────────────────────────────────────
  // Top level everything is a selector. Inside a block a selector is only
  // assumed when a `{` follows on the same line before any `;` or `}`
  // (nested rules in @media/@container/@supports/@layer/@scope, CSS nesting).
  const addSelectorRules = (state, prefix, ahead) => {
    addRule(state, prefix + 'nesting_selector', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /&/.source;
      r.action = action(TokenType.OPERATOR);
    });

    addRule(state, prefix + 'class_selector', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /\.[A-Za-z_-][\w-]*/.source;
      r.action = action(TokenType.TYPE);
    });

    addRule(state, prefix + 'id_selector', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /#[A-Za-z_-][\w-]*/.source + ahead;
      r.action = action(TokenType.TYPE);
    });

    addRule(state, prefix + 'pseudo', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /::[A-Za-z-]+/.source + '|' + /:[A-Za-z-]+/.source + ahead;
      r.action = action(TokenType.DECORATOR);
    });

    addRule(state, prefix + 'combinator', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = '(?:' + /[>+~,]/.source + ')' + ahead;
      r.action = action(TokenType.OPERATOR);
    });

    addRule(state, prefix + 'attr_selector_punct', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = '(?:' + /[\[\]=^$*|~]/.source + ')' + ahead;
      r.action = action(TokenType.OPERATOR);
    });

    addRule(state, prefix + 'element_selector', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = '(?:' + /\*|[A-Za-z][\w-]*/.source + ')' + ahead;
      r.action = action(TokenType.TYPE);
    });
  };

  // ── at_prelude: @rule … up to `{` or `;` ──────────────────────────────────
  const atPrelude = newState(def, 'at_prelude');
  atPrelude.onUnmatched = OnUnmatched.CHARACTER;

  addRule(atPrelude, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(atPrelude, 'include_numbers', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = numbers.id;
  });

  addRule(atPrelude, 'custom_property', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /--[A-Za-z0-9_-]+/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(atPrelude, 'pseudo_function', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /::?[A-Za-z-]+(?=\()/.source;
    r.action = action(TokenType.DECORATOR);
  });

  addRule(atPrelude, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z-][\w-]*(?=\()/.source;
    r.action = action(TokenType.FUNCTION);
  });

  addRule(atPrelude, 'logic_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = ['and', 'or', 'not', 'only', 'to'];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(atPrelude, 'range_operator', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[<>]=?|=/.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(atPrelude, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[():\/]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addSelectorRules(atPrelude, 'prelude_', '');

  const addAtRule = (state) => {
    addRule(state, 'at_rule', r => {
      r.type = RuleType.BEGIN_END;
      r.begin = /@[A-Za-z-]+/.source;
      // `;` ends the statement, `{`/`}` is left for the surrounding state
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
  };

  // ── declaration_block: { property: value; … } ───────────────────────────
  const declarationBlock = newState(def, 'declaration_block');
  declarationBlock.onUnmatched = OnUnmatched.CHARACTER;

  const addBlockRule = (state) => {
    addRule(state, 'declaration_block', r => {
      r.type = RuleType.BEGIN_END;
      r.begin = '{';
      r.end   = '}';
      r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, declarationBlock.id));
      r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
      r.contentTokenType = TokenType.OTHER;
      r.innerStateId = declarationBlock.id;
    });
  };

  addRule(declarationBlock, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Nested at-rules (@media, @container, @layer, … inside a block)
  addAtRule(declarationBlock);

  // Nested blocks (nested rules, @media bodies, keyframe selectors)
  addBlockRule(declarationBlock);

  // Hex colors (before the id selector)
  addRule(declarationBlock, 'hex_color', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})\b(?![^;{}]*\{)/.source;
    r.action = action(COLOR_TOKEN);
  });

  // Nested selectors
  addSelectorRules(declarationBlock, 'nested_', SELECTOR_AHEAD);

  // Property names (with lookahead)
  addRule(declarationBlock, 'property_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:--)?[A-Za-z_-][\w-]*(?=\s*:)/.source;
    r.action = action(TokenType.PROPERTY);
  });

  // !important
  addRule(declarationBlock, 'important', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /!\s*important/.source;
    r.action = action(TokenType.KEYWORD);
  });

  addRule(declarationBlock, 'include_numbers', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = numbers.id;
  });

  // Custom Properties (--variable)
  addRule(declarationBlock, 'custom_property', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /--[A-Za-z0-9_-]+/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // url(unquoted/path.png)
  addRule(declarationBlock, 'url_unquoted', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /(url)(\()([^"'()]*)(\))/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    caps.groups['2'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['3'] = { tokenType: TokenType.STRING, register: null };
    caps.groups['4'] = { tokenType: TokenType.PUNCTUATION, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Function calls (var(), rgb(), …)
  addRule(declarationBlock, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /-?[A-Za-z_][\w-]*(?=\()/.source;
    r.action = action(TokenType.FUNCTION);
  });

  // Known CSS keywords (as LITERAL)
  // (REGEX instead of KEYWORDS: \b would split hyphenated values like auto-fill)
  addRule(declarationBlock, 'css_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = String.raw`(?<![\w-])(?:` + [
      'inherit', 'initial', 'unset', 'revert', 'revert-layer',
      'auto', 'none', 'normal', 'bold', 'bolder', 'lighter',
      'italic', 'oblique', 'underline', 'overline', 'line-through',
      'stretch', 'center', 'left', 'right', 'top', 'bottom',
      'justify', 'space-between', 'space-around', 'space-evenly',
      'block', 'inline', 'flex', 'grid', 'table', 'list-item',
      'inline-block', 'inline-flex', 'inline-grid', 'contents', 'subgrid',
      'visible', 'hidden', 'collapse', 'scroll', 'fixed', 'relative', 'absolute', 'sticky',
      'transparent', 'currentcolor', 'min-content', 'max-content', 'fit-content'
    ].join('|') + String.raw`)(?![\w-])`;
    r.action = action(TokenType.LITERAL);
  });

  // General identifiers (fallback for values)
  addRule(declarationBlock, 'value_identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /-*[A-Za-z_][\w-]*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Math operators in calc() etc.
  addRule(declarationBlock, 'operator', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[*+-]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(declarationBlock, 'colon', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /:/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(declarationBlock, 'semicolon', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /;/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(declarationBlock, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[(),\/]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // ── Root: Selectors and At‑Rules ──────────────────────────────────────────

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addAtRule(root);
  addBlockRule(root);

  // Selectors – all set to TYPE so they become white
  addSelectorRules(root, '', '');

  addRule(root, 'selector_punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[()]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Keyframe stops / stray numbers
  addRule(root, 'include_numbers', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = numbers.id;
  });

  // ── Example code ──────────────────────────────────────────────────────────
  def.exampleCode = `
:root {
  --main-color: #22d4a8;
  --bg: #f0f0f0;
}

/* Layout */
.page > header#top, nav.main {
  display: flex;
  margin: 0 10px 0 10px;
  color: var(--main-color);
  font-family: "Segoe UI", sans-serif;
  background: rgba(34, 212, 168, .5);
  border: 2px solid var(--accent-color) !important;
}

.theme-cards .theme-cards_body {
  width: 100%;
  height: 40%;
}

a:hover::after {
  content: "\\2192";
  color: #22d4a8 !important;
  font-size: 1.5rem;
  border: 2px solid #ffaa00;
}

/* Modern CSS: layers, nesting, container queries */
@layer base, components;

@layer components {
  .card {
    container-type: inline-size;
    padding: clamp(1rem, 2.5cqi, 2rem);

    & > .title:hover {
      color: color-mix(in oklch, var(--main-color) 70%, white);
    }
  }
}

@container (min-width: 400px) {
  .card .title { font-size: 1.25rem; }
}

@media (width >= 600px) and (prefers-color-scheme: dark) {
  :root { --bg: #111; }
}
`;
  return def;
}

export function createCSSLanguageStyles(cssDef) {
  const inspectorStyle = createHighlightStyle(cssDef.id, 'Inspector');
  inspectorStyle.builtIn = true;
  inspectorStyle.tokenStyles = [
    // Selectors, functions, values – all white
    createTokenStyle(TokenType.TYPE,        '#ffffff'), // classes, elements, IDs
    createTokenStyle(TokenType.DECORATOR,   '#ffffff'), // pseudo-classes / elements
    createTokenStyle(TokenType.FUNCTION,    '#ffffff'), // var(), url(), etc.
    createTokenStyle(TokenType.IDENTIFIER,  '#ffffff'), // general values
    createTokenStyle(TokenType.LITERAL,     '#ffffff'), // keywords
    createTokenStyle(TokenType.NUMBER,      '#ffffff'), // numbers
    createTokenStyle(COLOR_TOKEN,           '#ffffff'), // hex colors
    createTokenStyle(CSS_UNIT,              '#ffffff'), // units
    createTokenStyle(TokenType.STRING,      '#ffffff'), // strings
    createTokenStyle(TokenType.OPERATOR,    '#ffffff'), // combinators, brackets, etc.
    createTokenStyle(TokenType.PUNCTUATION, '#ffffff'), // : ; , etc.

    // Properties – turquoise
    createTokenStyle(TokenType.PROPERTY,    '#66d9ef'),

    // Custom Properties – light blue (link color)
    createTokenStyle(TokenType.VARIABLE,    '#569cd6'),

    // Comments – subtle green italic
    createTokenStyle(TokenType.COMMENT,     '#6a9955', { italic: true }),

    // Keyword (for !important) – white
    createTokenStyle(TokenType.KEYWORD,     '#ffffff'),

    // Fallback
    createTokenStyle(TokenType.OTHER,       '#ffffff'),
  ];

  const darkStyle = createHighlightStyle(cssDef.id, 'Dark+');
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.TYPE,        '#d7ba7d'),
    createTokenStyle(TokenType.DECORATOR,   '#d7ba7d'),
    createTokenStyle(TokenType.FUNCTION,    '#dcdcaa'),
    createTokenStyle(TokenType.IDENTIFIER,  '#ce9178'),
    createTokenStyle(TokenType.LITERAL,     '#ce9178'),
    createTokenStyle(TokenType.NUMBER,      '#b5cea8'),
    createTokenStyle(COLOR_TOKEN,           '#ce9178'),
    createTokenStyle(CSS_UNIT,              '#b5cea8'),
    createTokenStyle(TokenType.STRING,      '#ce9178'),
    createTokenStyle(TokenType.OPERATOR,    '#d4d4d4'),
    createTokenStyle(TokenType.PUNCTUATION, '#d4d4d4'),
    createTokenStyle(TokenType.PROPERTY,    '#9cdcfe'),
    createTokenStyle(TokenType.VARIABLE,    '#9cdcfe'),
    createTokenStyle(TokenType.COMMENT,     '#6a9955', { italic: true }),
    createTokenStyle(TokenType.KEYWORD,     '#c586c0'),
    createTokenStyle(TokenType.OTHER,       '#d4d4d4'),
  ];

  const lightStyle = createHighlightStyle(cssDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.TYPE,        '#800000'),
    createTokenStyle(TokenType.DECORATOR,   '#800000'),
    createTokenStyle(TokenType.FUNCTION,    '#795e26'),
    createTokenStyle(TokenType.IDENTIFIER,  '#0451a5'),
    createTokenStyle(TokenType.LITERAL,     '#0451a5'),
    createTokenStyle(TokenType.NUMBER,      '#098658'),
    createTokenStyle(COLOR_TOKEN,           '#0451a5'),
    createTokenStyle(CSS_UNIT,              '#098658'),
    createTokenStyle(TokenType.STRING,      '#a31515'),
    createTokenStyle(TokenType.OPERATOR,    '#000000'),
    createTokenStyle(TokenType.PUNCTUATION, '#000000'),
    createTokenStyle(TokenType.PROPERTY,    '#e50000'),
    createTokenStyle(TokenType.VARIABLE,    '#001080'),
    createTokenStyle(TokenType.COMMENT,     '#008000', { italic: true }),
    createTokenStyle(TokenType.KEYWORD,     '#af00db'),
    createTokenStyle(TokenType.OTHER,       '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(cssDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.TYPE,        '#d19a66'),
    createTokenStyle(TokenType.DECORATOR,   '#c678dd'),
    createTokenStyle(TokenType.FUNCTION,    '#56b6c2'),
    createTokenStyle(TokenType.IDENTIFIER,  '#abb2bf'),
    createTokenStyle(TokenType.LITERAL,     '#d19a66'),
    createTokenStyle(TokenType.NUMBER,      '#d19a66'),
    createTokenStyle(COLOR_TOKEN,           '#d19a66'),
    createTokenStyle(CSS_UNIT,              '#e06c75'),
    createTokenStyle(TokenType.STRING,      '#98c379'),
    createTokenStyle(TokenType.OPERATOR,    '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION, '#abb2bf'),
    createTokenStyle(TokenType.PROPERTY,    '#e06c75'),
    createTokenStyle(TokenType.VARIABLE,    '#e06c75'),
    createTokenStyle(TokenType.COMMENT,     '#7f848e', { italic: true }),
    createTokenStyle(TokenType.KEYWORD,     '#c678dd'),
    createTokenStyle(TokenType.OTHER,       '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(cssDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.TYPE,        '#a6e22e'),
    createTokenStyle(TokenType.DECORATOR,   '#a6e22e'),
    createTokenStyle(TokenType.FUNCTION,    '#66d9ef'),
    createTokenStyle(TokenType.IDENTIFIER,  '#66d9ef'),
    createTokenStyle(TokenType.LITERAL,     '#66d9ef'),
    createTokenStyle(TokenType.NUMBER,      '#ae81ff'),
    createTokenStyle(COLOR_TOKEN,           '#ae81ff'),
    createTokenStyle(CSS_UNIT,              '#f92672'),
    createTokenStyle(TokenType.STRING,      '#e6db74'),
    createTokenStyle(TokenType.OPERATOR,    '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION, '#f8f8f2'),
    createTokenStyle(TokenType.PROPERTY,    '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.VARIABLE,    '#fd971f'),
    createTokenStyle(TokenType.COMMENT,     '#75715e', { italic: true }),
    createTokenStyle(TokenType.KEYWORD,     '#f92672'),
    createTokenStyle(TokenType.OTHER,       '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(cssDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.TYPE,        '#50fa7b'),
    createTokenStyle(TokenType.DECORATOR,   '#50fa7b', { italic: true }),
    createTokenStyle(TokenType.FUNCTION,    '#50fa7b'),
    createTokenStyle(TokenType.IDENTIFIER,  '#f8f8f2'),
    createTokenStyle(TokenType.LITERAL,     '#bd93f9'),
    createTokenStyle(TokenType.NUMBER,      '#bd93f9'),
    createTokenStyle(COLOR_TOKEN,           '#bd93f9'),
    createTokenStyle(CSS_UNIT,              '#ff79c6'),
    createTokenStyle(TokenType.STRING,      '#f1fa8c'),
    createTokenStyle(TokenType.OPERATOR,    '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION, '#f8f8f2'),
    createTokenStyle(TokenType.PROPERTY,    '#8be9fd'),
    createTokenStyle(TokenType.VARIABLE,    '#ffb86c', { italic: true }),
    createTokenStyle(TokenType.COMMENT,     '#6272a4', { italic: true }),
    createTokenStyle(TokenType.KEYWORD,     '#ff79c6'),
    createTokenStyle(TokenType.OTHER,       '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(cssDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.TYPE,        '#6639ba'),
    createTokenStyle(TokenType.DECORATOR,   '#6639ba'),
    createTokenStyle(TokenType.FUNCTION,    '#8250df'),
    createTokenStyle(TokenType.IDENTIFIER,  '#0550ae'),
    createTokenStyle(TokenType.LITERAL,     '#0550ae'),
    createTokenStyle(TokenType.NUMBER,      '#0550ae'),
    createTokenStyle(COLOR_TOKEN,           '#0550ae'),
    createTokenStyle(CSS_UNIT,              '#cf222e'),
    createTokenStyle(TokenType.STRING,      '#0a3069'),
    createTokenStyle(TokenType.OPERATOR,    '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION, '#24292f'),
    createTokenStyle(TokenType.PROPERTY,    '#0550ae'),
    createTokenStyle(TokenType.VARIABLE,    '#953800'),
    createTokenStyle(TokenType.COMMENT,     '#6e7781', { italic: true }),
    createTokenStyle(TokenType.KEYWORD,     '#cf222e'),
    createTokenStyle(TokenType.OTHER,       '#24292f'),
  ];

  return [inspectorStyle, darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}