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

function captureAction(groupTypes, transition = null) {
  const a = createSyntaxRuleAction();
  const caps = createSyntaxCaptureMap();
  groupTypes.forEach((tokenType, i) => {
    caps.groups[String(i + 1)] = { tokenType, register: null };
  });
  a.captures = caps;
  a.transition = transition;
  return a;
}

function addMatch(syntaxState, name, pattern, tokenType, opts = {}) {
  return addRule(syntaxState, name, r => {
    r.type = RuleType.MATCH;
    r.patternType = Array.isArray(pattern) ? PatternType.KEYWORDS : PatternType.REGEX;
    r.pattern = pattern;
    if (opts.caseInsensitive)
      r.caseInsensitive = true;
    if (opts.context)
      r.context = opts.context;
    r.action = action(tokenType);
  });
}

function addSimpleBlock(syntaxState, name, begin, end, innerState, tokenType) {
  innerState.onUnmatched = OnUnmatched.CHARACTER;
  innerState.contentTokenType = tokenType;
  return addRule(syntaxState, name, r => {
    r.type = RuleType.BEGIN_END;
    r.begin = begin;
    r.end   = end;
    r.beginAction = action(tokenType, createSyntaxStateTransition(TransitionType.PUSH, innerState.id));
    r.endAction   = action(tokenType, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = tokenType;
    r.innerStateId = innerState.id;
  });
}

// Custom token type for keywords inside <script>/<style>, so they don't
// share the (often muted) doctype color.
const EMBEDDED_KEYWORD = 'embeddedKeyword';

export function createHTMLLanguage() {
  const def = createSyntaxDefinition('HTML');
  def.aliases = ['html', 'htm', 'xhtml'];
  def.id = 'HtmlLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // ── Comment content ────────────────────────────────────────────────────
  const comment = newState(def, 'comment');
  comment.onUnmatched = OnUnmatched.CHARACTER;
  comment.contentTokenType = TokenType.COMMENT;

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
    r.pattern = /[A-Za-z][\w-]*/.source;
    r.context = { afterTokenType: [TokenType.PUNCTUATION] }; // right after < or </
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

  // Unquoted attribute value: data-id=5
  addRule(tagInside, 'attr_value_unquoted', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<==\s*)[^\s"'=<>`\/]+/.source;
    r.action = action(TokenType.STRING);
  });

  addRule(tagInside, 'attribute_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_:@#][\w:.@-]*/.source;
    r.action = action(TokenType.PROPERTY);
  });

  // ── Embedded <script> (reduced JavaScript rules) ─────────────────────────
  // Rules from other language definitions can't be included, so a small
  // JavaScript subset lives here.
  const scriptOpen = newState(def, 'script_open');
  const scriptBody = newState(def, 'script_body');
  scriptOpen.onUnmatched = OnUnmatched.CHARACTER;
  scriptBody.onUnmatched = OnUnmatched.CHARACTER;

  // Attributes of the opening tag
  addRule(scriptOpen, 'include_tag_inside', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = tagInside.id;
  });

  // `>` closes the opening tag; the content follows
  addRule(scriptOpen, 'open_tag_end', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = />/.source;
    r.action = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.SET, scriptBody.id));
  });

  addMatch(scriptBody, 'js_line_comment', /\/\/.*?(?=<\/script\s*>|$)/.source, TokenType.COMMENT, { caseInsensitive: true });
  addSimpleBlock(scriptBody, 'js_block_comment', /\/\*/.source, /\*\//.source, newState(def, 'js_block_comment'), TokenType.COMMENT);
  addMatch(scriptBody, 'js_string', /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/.source, TokenType.STRING);

  const jsTemplate = newState(def, 'js_template');
  addMatch(jsTemplate, 'js_template_escape', /\\./.source, TokenType.ESCAPE);
  addMatch(jsTemplate, 'js_template_substitution', /\$\{[^}]*\}/.source, TokenType.VARIABLE);
  addSimpleBlock(scriptBody, 'js_template', /`/.source, /`/.source, jsTemplate, TokenType.STRING);

  addMatch(scriptBody, 'js_keywords', [
    'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
    'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally',
    'for', 'from', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new',
    'of', 'return', 'static', 'super', 'switch', 'throw', 'try', 'typeof', 'var',
    'void', 'while', 'with', 'yield',
  ], EMBEDDED_KEYWORD);
  addMatch(scriptBody, 'js_literals', ['true', 'false', 'null', 'undefined', 'this', 'NaN', 'Infinity'], TokenType.LITERAL);
  addMatch(scriptBody, 'js_number', /\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?n?)\b|\.\d+\b/.source, TokenType.NUMBER);
  addMatch(scriptBody, 'js_function_call', /[A-Za-z_$][\w$]*(?=\s*\()/.source, TokenType.FUNCTION);
  addMatch(scriptBody, 'js_identifier', /[A-Za-z_$][\w$]*/.source, TokenType.IDENTIFIER);
  addMatch(scriptBody, 'js_operator', /=>|\?\?=?|\?\.|\.\.\.|[-+*\/%=<>!&|^~?:]+/.source, TokenType.OPERATOR);
  addMatch(scriptBody, 'js_punctuation', /[{}()[\];,.]/.source, TokenType.PUNCTUATION);

  // ── Embedded <style> (reduced CSS rules) ─────────────────────────────────
  const styleOpen = newState(def, 'style_open');
  const styleBody = newState(def, 'style_body');
  styleOpen.onUnmatched = OnUnmatched.CHARACTER;
  styleBody.onUnmatched = OnUnmatched.CHARACTER;

  addRule(styleOpen, 'include_tag_inside', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = tagInside.id;
  });

  addRule(styleOpen, 'open_tag_end', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = />/.source;
    r.action = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.SET, styleBody.id));
  });

  addSimpleBlock(styleBody, 'css_comment', /\/\*/.source, /\*\//.source, newState(def, 'css_comment'), TokenType.COMMENT);
  addMatch(styleBody, 'css_string', /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/.source, TokenType.STRING);
  // Declaration values (also used for at-rule preludes)
  const cssValues = newState(def, 'css_values');
  addMatch(cssValues, 'css_string', /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/.source, TokenType.STRING);
  addMatch(cssValues, 'css_property', /-{0,2}[A-Za-z_][\w-]*(?=\s*:)/.source, TokenType.PROPERTY);
  addMatch(cssValues, 'css_important', /!\s*important\b/.source, EMBEDDED_KEYWORD, { caseInsensitive: true });
  addMatch(cssValues, 'css_hex_color', /#[0-9a-fA-F]{3,8}\b/.source, TokenType.NUMBER);
  addMatch(cssValues, 'css_number', /-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:%|[a-zA-Z]+)?/.source, TokenType.NUMBER);
  addMatch(cssValues, 'css_function_call', /[A-Za-z_-][\w-]*(?=\()/.source, TokenType.FUNCTION);
  addMatch(cssValues, 'css_custom_property', /--[\w-]+/.source, TokenType.VARIABLE);
  addMatch(cssValues, 'css_value', /[A-Za-z_-][\w-]*/.source, TokenType.LITERAL);
  addMatch(cssValues, 'css_punctuation', /[{}():;,]/.source, TokenType.PUNCTUATION);
  addMatch(cssValues, 'css_operator', /[*+\/>~=<]/.source, TokenType.OPERATOR);

  // @media … up to `{` or `;`
  const cssAtPrelude = newState(def, 'css_at_prelude');
  cssAtPrelude.onUnmatched = OnUnmatched.CHARACTER;
  addRule(cssAtPrelude, 'include_css_values', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = cssValues.id;
  });
  addRule(styleBody, 'css_at_rule', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /@[\w-]+/.source;
    r.end   = /(?=[{;]|<\/style)/.source;
    r.beginAction = action(EMBEDDED_KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, cssAtPrelude.id));
    r.endAction   = null;
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = cssAtPrelude.id;
  });

  // A selector is everything up to a `{` on the same line
  addMatch(styleBody, 'css_selector', /[^\s{};\/"'][^{};"']*?(?=\s*\{)/.source, TokenType.TYPE);
  addRule(styleBody, 'include_css_values', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = cssValues.id;
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

  addRule(root, 'doctype', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /<!DOCTYPE[^>]*>/.source;
    r.action = action(TokenType.KEYWORD);
  });

  addRule(root, 'entity', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /&#?[A-Za-z0-9]+;/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // <script …> … </script>
  addRule(root, 'script_element', r => {
    r.type = RuleType.BEGIN_END;
    r.caseInsensitive = true;
    r.begin = /(<)(script)(?![\w-])/.source;
    r.end   = /(<\/)(script)(\s*>)/.source;
    r.beginAction = captureAction([TokenType.PUNCTUATION, TokenType.TYPE], createSyntaxStateTransition(TransitionType.PUSH, scriptOpen.id));
    r.endAction   = captureAction([TokenType.PUNCTUATION, TokenType.TYPE, TokenType.PUNCTUATION], createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = scriptOpen.id;
  });

  // <style …> … </style>
  addRule(root, 'style_element', r => {
    r.type = RuleType.BEGIN_END;
    r.caseInsensitive = true;
    r.begin = /(<)(style)(?![\w-])/.source;
    r.end   = /(<\/)(style)(\s*>)/.source;
    r.beginAction = captureAction([TokenType.PUNCTUATION, TokenType.TYPE], createSyntaxStateTransition(TransitionType.PUSH, styleOpen.id));
    r.endAction   = captureAction([TokenType.PUNCTUATION, TokenType.TYPE, TokenType.PUNCTUATION], createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = styleOpen.id;
  });

  addRule(root, 'tag', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<\/?(?=[A-Za-z])/.source;
    r.end   = /\/?>/.source;
    r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, tagInside.id));
    r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = tagInside.id;
  });

  def.exampleCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Example &amp; Demo</title>
</head>
<body class="page" data-active="true">
  <!-- main heading -->
  <h1 id="title">Hello, world!</h1>
  <p>This is a <a href="https://example.com">link</a>.</p>
  <my-counter data-start=5 hidden></my-counter>
  <dialog open>&copy; 2024</dialog>
  <style>
    .page h1 { color: #22d4a8; margin: 0 auto 1.5rem; }
  </style>
  <script type="module">
    const title = document.getElementById('title');
    title.textContent = \`Hello \${navigator.language}\`; // greeting
  </script>
</body>
</html>
`;
  return def;
}

export function createHTMLLanguageStyles(htmlDef) {
  const style = createHighlightStyle(htmlDef.id, 'Default');
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
    createTokenStyle(TokenType.NUMBER,      '#b5cea8'),
    createTokenStyle(TokenType.FUNCTION,    '#dcdcaa'),
    createTokenStyle(TokenType.LITERAL,     '#ce9178'),
    createTokenStyle(TokenType.VARIABLE,    '#9cdcfe'),
    createTokenStyle(EMBEDDED_KEYWORD,      '#c586c0'),
    createTokenStyle(TokenType.OTHER,       '#d4d4d4'),
  ];
  
  const lightStyle = createHighlightStyle(htmlDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,     '#800000'), // doctype
    createTokenStyle(TokenType.TYPE,        '#800000'),
    createTokenStyle(TokenType.PROPERTY,    '#e50000'),
    createTokenStyle(TokenType.OPERATOR,    '#000000'),
    createTokenStyle(TokenType.PUNCTUATION, '#800000'),
    createTokenStyle(TokenType.STRING,      '#0000ff'),
    createTokenStyle(TokenType.COMMENT,     '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,      '#ee0000'),
    createTokenStyle(TokenType.NUMBER,      '#098658'),
    createTokenStyle(TokenType.FUNCTION,    '#795e26'),
    createTokenStyle(TokenType.LITERAL,     '#0451a5'),
    createTokenStyle(TokenType.VARIABLE,    '#001080'),
    createTokenStyle(EMBEDDED_KEYWORD,      '#af00db'),
    createTokenStyle(TokenType.OTHER,       '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(htmlDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,     '#c678dd'),
    createTokenStyle(TokenType.TYPE,        '#e06c75'),
    createTokenStyle(TokenType.PROPERTY,    '#d19a66'),
    createTokenStyle(TokenType.OPERATOR,    '#abb2bf'),
    createTokenStyle(TokenType.PUNCTUATION, '#abb2bf'),
    createTokenStyle(TokenType.STRING,      '#98c379'),
    createTokenStyle(TokenType.COMMENT,     '#7f848e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,      '#56b6c2'),
    createTokenStyle(TokenType.NUMBER,      '#d19a66'),
    createTokenStyle(TokenType.FUNCTION,    '#61afef'),
    createTokenStyle(TokenType.LITERAL,     '#56b6c2'),
    createTokenStyle(TokenType.VARIABLE,    '#e06c75'),
    createTokenStyle(EMBEDDED_KEYWORD,      '#c678dd'),
    createTokenStyle(TokenType.OTHER,       '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(htmlDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,     '#75715e'),
    createTokenStyle(TokenType.TYPE,        '#f92672'),
    createTokenStyle(TokenType.PROPERTY,    '#a6e22e'),
    createTokenStyle(TokenType.OPERATOR,    '#f8f8f2'),
    createTokenStyle(TokenType.PUNCTUATION, '#f8f8f2'),
    createTokenStyle(TokenType.STRING,      '#e6db74'),
    createTokenStyle(TokenType.COMMENT,     '#75715e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,      '#ae81ff'),
    createTokenStyle(TokenType.NUMBER,      '#ae81ff'),
    createTokenStyle(TokenType.FUNCTION,    '#a6e22e'),
    createTokenStyle(TokenType.LITERAL,     '#66d9ef'),
    createTokenStyle(TokenType.VARIABLE,    '#fd971f'),
    createTokenStyle(EMBEDDED_KEYWORD,      '#f92672'),
    createTokenStyle(TokenType.OTHER,       '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(htmlDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,     '#ff79c6'),
    createTokenStyle(TokenType.TYPE,        '#ff79c6'),
    createTokenStyle(TokenType.PROPERTY,    '#50fa7b', { italic: true }),
    createTokenStyle(TokenType.OPERATOR,    '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION, '#f8f8f2'),
    createTokenStyle(TokenType.STRING,      '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,     '#6272a4', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,      '#bd93f9'),
    createTokenStyle(TokenType.NUMBER,      '#bd93f9'),
    createTokenStyle(TokenType.FUNCTION,    '#50fa7b'),
    createTokenStyle(TokenType.LITERAL,     '#8be9fd'),
    createTokenStyle(TokenType.VARIABLE,    '#ffb86c'),
    createTokenStyle(EMBEDDED_KEYWORD,      '#ff79c6'),
    createTokenStyle(TokenType.OTHER,       '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(htmlDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,     '#6e7781'),
    createTokenStyle(TokenType.TYPE,        '#116329'),
    createTokenStyle(TokenType.PROPERTY,    '#0550ae'),
    createTokenStyle(TokenType.OPERATOR,    '#24292f'),
    createTokenStyle(TokenType.PUNCTUATION, '#24292f'),
    createTokenStyle(TokenType.STRING,      '#0a3069'),
    createTokenStyle(TokenType.COMMENT,     '#6e7781', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,      '#cf222e'),
    createTokenStyle(TokenType.NUMBER,      '#0550ae'),
    createTokenStyle(TokenType.FUNCTION,    '#8250df'),
    createTokenStyle(TokenType.LITERAL,     '#0550ae'),
    createTokenStyle(TokenType.VARIABLE,    '#953800'),
    createTokenStyle(EMBEDDED_KEYWORD,      '#cf222e'),
    createTokenStyle(TokenType.OTHER,       '#24292f'),
  ];

  return [style, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}