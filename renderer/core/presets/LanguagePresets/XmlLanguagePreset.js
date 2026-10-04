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

  // ── DOCTYPE with optional internal subset ────────────────────────────────
  //   <!DOCTYPE note SYSTEM "note.dtd" [ <!ENTITY writer "Me"> ]>
  const doctypeInside = newState(def, 'doctype_inside');
  const declInside    = newState(def, 'markup_declaration_inside');
  doctypeInside.onUnmatched = OnUnmatched.CHARACTER;
  declInside.onUnmatched = OnUnmatched.CHARACTER;

  const addDtdCommon = (state) => {
    addRule(state, 'dtd_string', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /"[^"]*"|'[^']*'/.source;
      r.action = action(TokenType.STRING);
    });

    addRule(state, 'parameter_entity', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /%[A-Za-z_][\w:.-]*;/.source;
      r.action = action(TokenType.ESCAPE);
    });

    addRule(state, 'dtd_keywords', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /#(?:PCDATA|REQUIRED|IMPLIED|FIXED)\b|\b(?:SYSTEM|PUBLIC|EMPTY|ANY|NDATA|CDATA|IDREFS?|ID|ENTITY|ENTITIES|NMTOKENS?|NOTATION)\b/.source;
      r.action = action(TokenType.KEYWORD);
    });
  };

  addRule(doctypeInside, 'comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<!--/.source;
    r.end   = /-->/.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, comment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = comment.id;
  });

  addRule(doctypeInside, 'markup_declaration', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<!(?:ENTITY|ELEMENT|ATTLIST|NOTATION)\b/.source;
    r.end   = />/.source;
    r.beginAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, declInside.id));
    r.endAction   = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = declInside.id;
  });

  addDtdCommon(doctypeInside);

  addRule(doctypeInside, 'subset_bracket', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[\[\]]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(doctypeInside, 'root_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_][\w:.-]*/.source;
    r.action = action(TokenType.TYPE);
  });

  addDtdCommon(declInside);

  addRule(declInside, 'decl_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_][\w:.-]*/.source;
    r.action = action(TokenType.PROPERTY);
  });

  addRule(declInside, 'decl_punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[()|,*+?%]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(root, 'doctype', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<!DOCTYPE\b/.source;
    r.end   = />/.source;
    r.beginAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, doctypeInside.id));
    r.endAction   = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = doctypeInside.id;
  });

  addRule(root, 'entity', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /&#?[A-Za-z0-9]+;/.source;
    r.action = action(TokenType.ESCAPE);
  });

  addRule(root, 'tag', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<\/?(?=[A-Za-z_])/.source;
    r.end   = /\/?>/.source;
    r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, tagInside.id));
    r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = tagInside.id;
  });

  def.exampleCode = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE catalog [
  <!ELEMENT catalog (book+)>
  <!ATTLIST book available (true|false) #IMPLIED>
  <!ENTITY publisher "Example Press">
]>
<!-- catalog of books -->
<catalog xmlns:bk="urn:example:books">
  <book bk:id="bk101" available="true">
    <author>Gambardella, Matthew</author>
    <title>XML Developer's Guide</title>
    <price>44.95</price>
    <description><![CDATA[An <in-depth> look at XML & friends]]></description>
    <publisher>&publisher;</publisher>
  </book>
</catalog>
`;
  return def;
}

export function createXMLLanguageStyles(xmlDef) {
  const style = createHighlightStyle(xmlDef.id, 'Default');
  style.builtIn = true;
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

  const lightStyle = createHighlightStyle(xmlDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,     '#0000ff'), // CDATA / doctype
    createTokenStyle(TokenType.TYPE,        '#800000'),
    createTokenStyle(TokenType.PROPERTY,    '#e50000'),
    createTokenStyle(TokenType.OPERATOR,    '#000000'),
    createTokenStyle(TokenType.PUNCTUATION, '#800000'),
    createTokenStyle(TokenType.STRING,      '#0000ff'),
    createTokenStyle(TokenType.COMMENT,     '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,      '#ee0000'),
    createTokenStyle(TokenType.DECORATOR,   '#af00db'), // processing instruction
    createTokenStyle(TokenType.OTHER,       '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(xmlDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,     '#c678dd'),
    createTokenStyle(TokenType.TYPE,        '#e06c75'),
    createTokenStyle(TokenType.PROPERTY,    '#d19a66'),
    createTokenStyle(TokenType.OPERATOR,    '#abb2bf'),
    createTokenStyle(TokenType.PUNCTUATION, '#abb2bf'),
    createTokenStyle(TokenType.STRING,      '#98c379'),
    createTokenStyle(TokenType.COMMENT,     '#7f848e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,      '#56b6c2'),
    createTokenStyle(TokenType.DECORATOR,   '#61afef'),
    createTokenStyle(TokenType.OTHER,       '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(xmlDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,     '#66d9ef'),
    createTokenStyle(TokenType.TYPE,        '#f92672'),
    createTokenStyle(TokenType.PROPERTY,    '#a6e22e'),
    createTokenStyle(TokenType.OPERATOR,    '#f8f8f2'),
    createTokenStyle(TokenType.PUNCTUATION, '#f8f8f2'),
    createTokenStyle(TokenType.STRING,      '#e6db74'),
    createTokenStyle(TokenType.COMMENT,     '#75715e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,      '#ae81ff'),
    createTokenStyle(TokenType.DECORATOR,   '#75715e'),
    createTokenStyle(TokenType.OTHER,       '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(xmlDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,     '#8be9fd'),
    createTokenStyle(TokenType.TYPE,        '#ff79c6'),
    createTokenStyle(TokenType.PROPERTY,    '#50fa7b', { italic: true }),
    createTokenStyle(TokenType.OPERATOR,    '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION, '#f8f8f2'),
    createTokenStyle(TokenType.STRING,      '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,     '#6272a4', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,      '#bd93f9'),
    createTokenStyle(TokenType.DECORATOR,   '#ffb86c'),
    createTokenStyle(TokenType.OTHER,       '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(xmlDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,     '#cf222e'),
    createTokenStyle(TokenType.TYPE,        '#116329'),
    createTokenStyle(TokenType.PROPERTY,    '#0550ae'),
    createTokenStyle(TokenType.OPERATOR,    '#24292f'),
    createTokenStyle(TokenType.PUNCTUATION, '#24292f'),
    createTokenStyle(TokenType.STRING,      '#0a3069'),
    createTokenStyle(TokenType.COMMENT,     '#6e7781', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,      '#cf222e'),
    createTokenStyle(TokenType.DECORATOR,   '#8250df'),
    createTokenStyle(TokenType.OTHER,       '#24292f'),
  ];

  return [style, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}