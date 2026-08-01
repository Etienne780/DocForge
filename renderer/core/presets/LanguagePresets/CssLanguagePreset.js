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

  // ── HighlightStyle ────────────────────────────────────────────────────────
  const style = createHighlightStyle('Inspector');
  style.tokenStyles = [
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
  def.styles.push(style);

  return def;
}