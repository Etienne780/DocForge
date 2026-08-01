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

export function createXMLLanguage() {
  const def = createSyntaxDefinition('XML');
  def.aliases = ['xml', 'xsd', 'xsl', 'xslt', 'svg', 'rss'];
  def.id = 'XmlLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // ── Comment content ────────────────────────────────────────────────────
  const comment = newState(def, 'comment');
  comment.onUnmatched = OnUnmatched.CHARACTER;
  comment.contentTokenType = TokenType.COMMENT;

  // ── CDATA content ───────────────────────────────────────────────────────
  const cdata = newState(def, 'cdata');
  cdata.onUnmatched = OnUnmatched.CHARACTER;
  cdata.contentTokenType = TokenType.STRING;

  // ── Processing instruction content  <?xml version="1.0"?>  ─────────────
  const procInstr = newState(def, 'processing_instruction');
  procInstr.onUnmatched = OnUnmatched.CHARACTER;
  procInstr.contentTokenType = TokenType.KEYWORD;

  // ── Tag internals ───────────────────────────────────────────────────────
  const tagInside        = newState(def, 'tag_inside');
  const attrValueDouble  = newState(def, 'attr_value_double');
  const attrValueSingle  = newState(def, 'attr_value_single');

  attrValueDouble.onUnmatched = OnUnmatched.CHARACTER;
  attrValueDouble.contentTokenType = TokenType.STRING;
  attrValueSingle.onUnmatched = OnUnmatched.CHARACTER;
  attrValueSingle.contentTokenType = TokenType.STRING;

  tagInside.onUnmatched = OnUnmatched.CHARACTER;

  addRule(tagInside, 'tag_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_][\w:.-]*/.source;
    r.context = { afterTokenType: [TokenType.PUNCTUATION] };
    r.action = action(TokenType.TYPE);
  });

  addRule(tagInside, 'attr_value_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, attrValueDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = attrValueDouble.id;
  });

  addRule(tagInside, 'attr_value_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, attrValueSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = attrValueSingle.id;
  });

  addRule(tagInside, 'equals', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /=/.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(tagInside, 'attribute_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_:][\w:.-]*/.source;
    r.action = action(TokenType.PROPERTY);
  });

  // ── Root ─────────────────────────────────────────────────────────────────

  addRule(root, 'comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<!--/.source;
    r.end   = /-->/.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, comment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = comment.id;
  });

  addRule(root, 'cdata', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<!\[CDATA\[/.source;
    r.end   = /\]\]>/.source;
    r.beginAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, cdata.id));
    r.endAction   = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = cdata.id;
  });

  addRule(root, 'processing_instruction', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<\?/.source;
    r.end   = /\?>/.source;
    r.beginAction = action(TokenType.DECORATOR, createSyntaxStateTransition(TransitionType.PUSH, procInstr.id));
    r.endAction   = action(TokenType.DECORATOR, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.KEYWORD;
    r.innerStateId = procInstr.id;
  });

  addRule(root, 'entity', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /&#?[A-Za-z0-9]+;/.source;
    r.action = action(TokenType.ESCAPE);
  });

  addRule(root, 'tag', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<\/?/.source;
    r.end   = /\/?>/.source;
    r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, tagInside.id));
    r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = tagInside.id;
  });

  def.exampleCode = `<?xml version="1.0" encoding="UTF-8"?>
<!-- catalog of books -->
<catalog xmlns:bk="urn:example:books">
  <book bk:id="bk101" available="true">
    <author>Gambardella, Matthew</author>
    <title>XML Developer's Guide</title>
    <price>44.95</price>
    <description><![CDATA[An <in-depth> look at XML & friends]]></description>
  </book>
</catalog>
`;

  const style = createHighlightStyle('Default');
  style.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,     '#569cd6'),
    createTokenStyle(TokenType.TYPE,        '#569cd6'),
    createTokenStyle(TokenType.PROPERTY,    '#9cdcfe'),
    createTokenStyle(TokenType.OPERATOR,    '#d4d4d4'),
    createTokenStyle(TokenType.PUNCTUATION, '#808080'),
    createTokenStyle(TokenType.STRING,      '#ce9178'),
    createTokenStyle(TokenType.COMMENT,     '#6a9955', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,      '#d7ba7d'),
    createTokenStyle(TokenType.DECORATOR,   '#c8c8c8'),
    createTokenStyle(TokenType.OTHER,       '#d4d4d4'),
  ];
  def.styles.push(style);

  return def;
}