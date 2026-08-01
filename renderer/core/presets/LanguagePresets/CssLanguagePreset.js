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

// Benutzerdefinierte Token-Typen (für Farben und Einheiten)
const COLOR_TOKEN = 'color';
const CSS_UNIT    = 'cssUnit';

export function createCSSLanguage() {
  const def = createSyntaxDefinition('CSS');
  def.aliases = ['css'];
  def.id = 'CssLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // ── Shared: Kommentare + Strings ──────────────────────────────────────────
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

  // Eigenschaftsnamen (mit Lookahead)
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

  // Hex‑Farben
  addRule(declarationBlock, 'hex_color', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})\b/.source;
    r.action = action(COLOR_TOKEN);
  });

  // Zahlen mit Einheiten (ohne %)
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

  // Prozentwerte
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

  // Reine Zahlen
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

  // Funktionsaufrufe (var(), rgb(), …)
  addRule(declarationBlock, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z-]+(?=\()/.source;
    r.action = action(TokenType.FUNCTION);
  });

  // Bekannte CSS‑Schlüsselwörter (als LITERAL)
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

  // Allgemeine Bezeichner (Fallback für Werte)
  addRule(declarationBlock, 'value_identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z-]+/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Interpunktion
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

  // ── Root: Selektoren und At‑Rules ────────────────────────────────────────

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

  // Selektoren – alle auf TYPE gesetzt, damit sie weiß werden
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
    r.action = action(TokenType.TYPE); // jetzt auch TYPE, damit weiß
  });

  addRule(root, 'pseudo', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /::?[A-Za-z-]+/.source;
    r.action = action(TokenType.DECORATOR); // bleibt, aber wir setzen DECORATOR auf weiß
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

  // ── Beispielcode ──────────────────────────────────────────────────────────
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
    // Selektoren, Funktionen, Werte – alles weiß
    createTokenStyle(TokenType.TYPE,        '#ffffff'), // Klassen, Elemente, IDs
    createTokenStyle(TokenType.DECORATOR,   '#ffffff'), // Pseudoklassen / -elemente
    createTokenStyle(TokenType.FUNCTION,    '#ffffff'), // var(), url(), etc.
    createTokenStyle(TokenType.IDENTIFIER,  '#ffffff'), // allgemeine Werte
    createTokenStyle(TokenType.LITERAL,     '#ffffff'), // Schlüsselwörter
    createTokenStyle(TokenType.NUMBER,      '#ffffff'), // Zahlen
    createTokenStyle(COLOR_TOKEN,           '#ffffff'), // Hex-Farben
    createTokenStyle(CSS_UNIT,              '#ffffff'), // Einheiten
    createTokenStyle(TokenType.STRING,      '#ffffff'), // Strings
    createTokenStyle(TokenType.OPERATOR,    '#ffffff'), // Kombinatoren, Klammern, etc.
    createTokenStyle(TokenType.PUNCTUATION, '#ffffff'), // : ; , etc.

    // Eigenschaften – türkis
    createTokenStyle(TokenType.PROPERTY,    '#66d9ef'),

    // Custom Properties – hellblau (Link‑Farbe)
    createTokenStyle(TokenType.VARIABLE,    '#569cd6'),

    // Kommentare – dezent grau
    createTokenStyle(TokenType.COMMENT,     '#6a9955', { italic: true }),

    // Keyword (für !important) – weiß oder evtl. anders? Ich setze es auf weiß
    createTokenStyle(TokenType.KEYWORD,     '#ffffff'),

    // Fallback
    createTokenStyle(TokenType.OTHER,       '#ffffff'),
  ];
  def.styles.push(style);

  return def;
}