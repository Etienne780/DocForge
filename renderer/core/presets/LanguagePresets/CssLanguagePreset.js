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

// Custom token type - nicht im TokenType-Enum, aber laut JSDoc dort explizit erlaubt.
const COLOR_TOKEN = 'color';

export function createCSSLanguage() {
  const def = createSyntaxDefinition('CSS');
  def.aliases = ['css'];
  def.id = 'CssLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // ── Shared: comments + strings, in root und declaration_block included ─
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

  // ── declaration_block:  { property: value; ... }  ───────────────────────
  const declarationBlock = newState(def, 'declaration_block');
  declarationBlock.onUnmatched = OnUnmatched.CHARACTER;

  addRule(declarationBlock, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(declarationBlock, 'property_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:--)?[A-Za-z-]+(?=\s*:)/.source; // Lookahead, konsumiert ':' nicht
    r.action = action(TokenType.PROPERTY);
  });

  addRule(declarationBlock, 'important', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /!important/.source;
    r.action = action(TokenType.KEYWORD);
  });

  addRule(declarationBlock, 'hex_color', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#[0-9a-fA-F]{3,8}\b/.source;
    r.action = action(COLOR_TOKEN);
  });

  addRule(declarationBlock, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /-?\d+(\.\d+)?(px|em|rem|%|vh|vw|vmin|vmax|deg|s|ms|fr|pt|pc|in|cm|mm|ex|ch)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(declarationBlock, 'custom_property', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /--[A-Za-z0-9-]+/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(declarationBlock, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z-]+(?=\()/.source; // Lookahead, konsumiert '(' nicht
    r.action = action(TokenType.FUNCTION);
  });

  addRule(declarationBlock, 'value_identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z-]+/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

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

  // ── Root: Selektoren + At-Rules ──────────────────────────────────────────

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
    r.action = action(TokenType.FUNCTION);
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

  def.exampleCode = `:root {
  --main-color: #22d4a8;
}

/* layout */
.page > header#top, nav.main {
  display: flex;
  margin: 0 10px 0 10px;
  color: var(--main-color);
  font-family: "Segoe UI", sans-serif;
}

a:hover::after {
  content: "\\2192";
  color: rgba(34, 212, 168, .5) !important;
}
`;

  const style = createHighlightStyle('Default');
  style.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,     '#569cd6'),
    createTokenStyle(TokenType.TYPE,        '#4ec9b0'),
    createTokenStyle(TokenType.FUNCTION,    '#dcdcaa'),
    createTokenStyle(TokenType.PROPERTY,    '#9cdcfe'),
    createTokenStyle(TokenType.VARIABLE,    '#9cdcfe'),
    createTokenStyle(TokenType.IDENTIFIER,  '#ce9178'),
    createTokenStyle(TokenType.OPERATOR,    '#d4d4d4'),
    createTokenStyle(TokenType.PUNCTUATION, '#808080'),
    createTokenStyle(TokenType.NUMBER,      '#b5cea8'),
    createTokenStyle(TokenType.STRING,      '#ce9178'),
    createTokenStyle(TokenType.COMMENT,     '#6a9955', { italic: true }),
    createTokenStyle(TokenType.DECORATOR,   '#c8c8c8'),
    createTokenStyle(TokenType.OTHER,       '#d4d4d4'),
    createTokenStyle(COLOR_TOKEN,           '#d7ba7d'),
  ];
  def.styles.push(style);

  return def;
}