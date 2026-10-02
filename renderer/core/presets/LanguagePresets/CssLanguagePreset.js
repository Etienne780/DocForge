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

  // ── declaration_block: { property: value; … } ───────────────────────────
  const declarationBlock = newState(def, 'declaration_block');
  declarationBlock.onUnmatched = OnUnmatched.CHARACTER;

  addRule(declarationBlock, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Property names (with lookahead)
  addRule(declarationBlock, 'property_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:--)?[A-Za-z-]+(?=\s*:)/.source;
    r.action = action(TokenType.PROPERTY);
  });

  // !important
  addRule(declarationBlock, 'important', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /!important/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Hex colors
  addRule(declarationBlock, 'hex_color', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})\b/.source;
    r.action = action(COLOR_TOKEN);
  });

  // Numbers with units (except %)
  addRule(declarationBlock, 'number_with_unit', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /(-?\d*\.?\d+(?:e[+-]?\d+)?)(px|em|rem|vh|vw|vmin|vmax|deg|s|ms|fr|pt|pc|in|cm|mm|ex|ch)\b/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.NUMBER, register: null };
    caps.groups['2'] = { tokenType: CSS_UNIT, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Percentage values
  addRule(declarationBlock, 'percentage', r => {
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
  addRule(declarationBlock, 'number_plain', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /-?\d*\.?\d+(?:e[+-]?\d+)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Custom Properties (--variable)
  addRule(declarationBlock, 'custom_property', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /--[A-Za-z0-9-]+/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Function calls (var(), rgb(), …)
  addRule(declarationBlock, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z-]+(?=\()/.source;
    r.action = action(TokenType.FUNCTION);
  });

  // Known CSS keywords (as LITERAL)
  addRule(declarationBlock, 'css_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      'inherit', 'initial', 'unset', 'revert',
      'auto', 'none', 'normal', 'bold', 'bolder', 'lighter',
      'italic', 'oblique', 'underline', 'overline', 'line-through',
      'stretch', 'center', 'left', 'right', 'top', 'bottom',
      'justify', 'space-between', 'space-around', 'space-evenly',
      'block', 'inline', 'flex', 'grid', 'table', 'list-item',
      'visible', 'hidden', 'collapse', 'scroll', 'fixed', 'relative', 'absolute', 'sticky',
      'transparent', 'currentcolor'
    ];
    r.action = action(TokenType.LITERAL);
  });

  // General identifiers (fallback for values)
  addRule(declarationBlock, 'value_identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z-]+/.source;
    r.action = action(TokenType.IDENTIFIER);
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

  addRule(root, 'at_rule', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z-]+/.source;
    r.action = action(TokenType.KEYWORD);
  });

  addRule(root, 'declaration_block', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '{';
    r.end   = '}';
    r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, declarationBlock.id));
    r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = declarationBlock.id;
  });

  // Selectors – all set to TYPE so they become white
  addRule(root, 'class_selector', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\.[A-Za-z_-][\w-]*/.source;
    r.action = action(TokenType.TYPE);
  });

  addRule(root, 'id_selector', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#[A-Za-z_-][\w-]*/.source;
    r.action = action(TokenType.TYPE);
  });

  addRule(root, 'pseudo', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /::?[A-Za-z-]+/.source;
    r.action = action(TokenType.DECORATOR);
  });

  addRule(root, 'combinator', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[>+~,]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(root, 'attr_selector_punct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[\[\]=^$*|~]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(root, 'element_selector', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\*|[A-Za-z][\w-]*/.source;
    r.action = action(TokenType.TYPE);
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