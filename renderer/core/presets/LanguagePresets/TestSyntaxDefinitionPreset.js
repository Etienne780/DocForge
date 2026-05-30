// ─── TestSyntaxDefinitionPreset ───────────────────────────────────────────────
//
// A fictional JS-inspired language ("TestLang") whose only purpose is to
// exercise every single feature of the SyntaxDefinition system in one place:
//
//  - symbolHoisting: true
//  - predefinedSymbols
//  - PatternType  – REGEX, KEYWORDS, WORD
//  - RuleType     – MATCH, BEGIN_END, INCLUDE
//  - CaptureMap   – per-group tokenType + SymbolRegister (GLOBAL + STATE scope)
//  - action.register (whole-match registration, not a capture group)
//  - TransitionType – PUSH (explicit), POP, SET
//  - DynamicEnd
//  - context guard – afterTokenType + notAfterTokenType
//  - caseInsensitive: true
//  - OnUnmatched  – CHARACTER + SKIP
//  - HighlightStyle – tokenStyles, stateTokenStyles, overrides
//
// Import alongside your existing factories:
//
//   import { createTestLanguage } from './TestSyntaxDefinitionPreset.js';
//
// Or paste directly into SyntaxDefinition.js and re-export.

import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxCaptureMap,
  createSyntaxStateTransition,
  createSymbolRegister,
  createDynamicEnd,
  createPredefinedSymbol,
  createHighlightStyle,
  createTokenStyle,
  createStateTokenStyle,
  createStyleOverride,
  findRootSyntaxState,
  TokenType,
  RuleType,
  PatternType,
  TransitionType,
  OnUnmatched,
  RegisterScope,
} from '@data/SyntaxDefinitionManager.js';

// ─────────────────────────────────────────────────────────────────────────────

export function createTestLanguage() {

  // ── Root definition ───────────────────────────────────────────────────────
  const def = createSyntaxDefinition('TestLang');
  def.id = "TestLang_devOnly";
  def.aliases         = ['test', 'testlang', 'tl'];
  def.devOnly         = true;
  def.symbolHoisting  = true; 
  def.exampleCode     = EXAMPLE_CODE;

  // ── (1) Predefined symbols ────────────────────────────────────────────────
  // These land in the symbol table before any scanning begins.
  def.predefinedSymbols = [
    createPredefinedSymbol('console',   TokenType.NAMESPACE),  // e.g. console.log()
    createPredefinedSymbol('Math',      TokenType.NAMESPACE),
    createPredefinedSymbol('undefined', TokenType.LITERAL),
    createPredefinedSymbol('NaN',       TokenType.LITERAL),
    createPredefinedSymbol('Infinity',  TokenType.LITERAL),
    createPredefinedSymbol('true',      TokenType.LITERAL),
    createPredefinedSymbol('false',     TokenType.LITERAL),
    createPredefinedSymbol('null',      TokenType.LITERAL),
  ];

  // ── (2) States ────────────────────────────────────────────────────────────
  const root         = findRootSyntaxState(def);   // created by createSyntaxDefinition
  root.onUnmatched   = OnUnmatched.CHARACTER;       // ← CHARACTER path

  const sEscape      = createSyntaxState('escape_sequences');   // shared INCLUDE target
  const sStrDouble   = createSyntaxState('string_double');
  const sStrSingle   = createSyntaxState('string_single');
  const sTmpl        = createSyntaxState('template_literal');
  const sTmplInterp  = createSyntaxState('template_interp');    // inside ${}
  const sBlockCmt    = createSyntaxState('block_comment');
  const sLineCmt     = createSyntaxState('line_comment');
  const sRegex       = createSyntaxState('regex_literal');
  const sRawStr      = createSyntaxState('raw_string');         // DynamicEnd demo
  const sImport      = createSyntaxState('import_clause');      // SET transition demo

  def.states.push(
    sEscape, sStrDouble, sStrSingle,
    sTmpl, sTmplInterp,
    sBlockCmt, sLineCmt,
    sRegex, sRawStr, sImport,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // (3) INCLUDE target: shared escape sequences
  //     Used by string states via RuleType.INCLUDE
  // ══════════════════════════════════════════════════════════════════════════
  sEscape.onUnmatched = OnUnmatched.SKIP;
  {
    const r    = createSyntaxStateRule('escape_char');
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    // unicode, hex, common single-char escapes
    r.pattern  = /\\(?:u[0-9A-Fa-f]{4}|x[0-9A-Fa-f]{2}|[nrtbf\\'"`\\])/.source;
    r.action.tokenType = TokenType.ESCAPE;
    sEscape.rules.push(r);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ROOT STATE RULES  (ordered, first-match-wins)
  // ══════════════════════════════════════════════════════════════════════════

  // ── (4) Line comment  ─────────────────────────────────────────────────────
  //        BEGIN_END, innerState onUnmatched = SKIP  ← SKIP path
  sLineCmt.onUnmatched = OnUnmatched.SKIP;
  {
    const r = createSyntaxStateRule('line_comment');
    r.type             = RuleType.BEGIN_END;
    r.begin            = '//';
    r.end              = '(?=$)';          // lookahead at EOL – zero-width end
    r.contentTokenType = TokenType.COMMENT;
    r.beginAction.tokenType = TokenType.COMMENT;
    r.endAction.tokenType   = TokenType.COMMENT;
    r.innerStateId     = sLineCmt.id;
    root.rules.push(r);
  }

  // ── (5) Block comment  ────────────────────────────────────────────────────
  //        BEGIN_END
  sBlockCmt.onUnmatched = OnUnmatched.SKIP;
  {
    const r = createSyntaxStateRule('block_comment');
    r.type             = RuleType.BEGIN_END;
    r.begin            = '/\\*';
    r.end              = '\\*/';
    r.contentTokenType = TokenType.COMMENT;
    r.beginAction.tokenType = TokenType.COMMENT;
    r.endAction.tokenType   = TokenType.COMMENT;
    r.innerStateId     = sBlockCmt.id;
    root.rules.push(r);
  }

  // ── (6) PatternType.KEYWORDS  ─────────────────────────────────────────────
  //        Compiled internally to \b(a|b|c)\b
  {
    const r = createSyntaxStateRule('control_keywords');
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern     = [
      'if', 'else', 'while', 'for', 'do',
      'return', 'break', 'continue',
      'switch', 'case', 'default',
      'throw', 'try', 'catch', 'finally',
      'in', 'of', 'instanceof', 'typeof', 'void', 'delete',
      'new', 'await', 'yield',
    ];
    r.action.tokenType = TokenType.KEYWORD;
    root.rules.push(r);
  }

  // ── (7) PatternType.WORD  ─────────────────────────────────────────────────
  //        Single word, compiled to \b<word>\b
  {
    const r = createSyntaxStateRule('async_keyword');
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.WORD;
    r.pattern     = 'async';
    r.action.tokenType = TokenType.KEYWORD;
    root.rules.push(r);
  }

  // ── (8) caseInsensitive keyword  ──────────────────────────────────────────
  //        Tests the caseInsensitive flag
  {
    const r = createSyntaxStateRule('pragma_keyword');
    r.type            = RuleType.MATCH;
    r.patternType     = PatternType.WORD;
    r.pattern         = 'PRAGMA';       // matches 'pragma', 'PRAGMA', 'Pragma' …
    r.caseInsensitive = true;           // ← caseInsensitive
    r.action.tokenType = TokenType.KEYWORD;
    root.rules.push(r);
  }

  // ── (9) import keyword + TransitionType.SET ────────────────────────────────
  //        Switches the current state to sImport without pushing the stack
  {
    const r = createSyntaxStateRule('import_keyword');
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.WORD;
    r.pattern     = 'import';
    r.action.tokenType  = TokenType.KEYWORD;
    r.action.transition = createSyntaxStateTransition(  // ← SET
      TransitionType.SET, sImport.id
    );
    root.rules.push(r);
  }

  // ── (10) Declaration + CaptureMap + SymbolRegister GLOBAL ─────────────────
  //         Registers the declared name globally so later uses are re-colored
  {
    const r = createSyntaxStateRule('declaration');
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    // group 1 = keyword, group 2 = identifier
    r.pattern = /(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/.source;

    const cap = createSyntaxCaptureMap();
    cap.groups['1'] = {
      tokenType: TokenType.KEYWORD,
      register:  null,
    };
    cap.groups['2'] = {
      tokenType: TokenType.IDENTIFIER,
      register:  createSymbolRegister(TokenType.VARIABLE, RegisterScope.GLOBAL), // ← GLOBAL
    };
    r.action.captures = cap;
    root.rules.push(r);
  }

  // ── (11) Type annotation + SymbolRegister STATE scope ─────────────────────
  //         : TypeName  — type only known while the enclosing state is active
  {
    const r = createSyntaxStateRule('type_annotation');
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /:\s*([A-Z][A-Za-z_$][\w$]*)/.source;

    const cap = createSyntaxCaptureMap();
    cap.groups['1'] = {
      tokenType: TokenType.TYPE,
      register:  createSymbolRegister(TokenType.TYPE, RegisterScope.STATE), // ← STATE
    };
    r.action.captures = cap;
    root.rules.push(r);
  }

  // ── (12) Decorator + action.register (whole match) ────────────────────────
  //         Registers the whole @Name token (not a capture group)
  {
    const r = createSyntaxStateRule('decorator');
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /@[A-Za-z_$][\w$]*/.source;
    r.action.tokenType = TokenType.DECORATOR;
    r.action.register  = createSymbolRegister(TokenType.DECORATOR, RegisterScope.GLOBAL); // ← whole-match
    root.rules.push(r);
  }

  // ── (13) Function call (identifier before '(')  ───────────────────────────
  {
    const r = createSyntaxStateRule('function_call');
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /\b([A-Za-z_$][\w$]*)\s*(?=\()/.source;

    const cap = createSyntaxCaptureMap();
    cap.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    r.action.captures = cap;
    root.rules.push(r);
  }

  // ── (14) Number literal  ──────────────────────────────────────────────────
  {
    const r = createSyntaxStateRule('number');
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /\b(?:0x[\dA-Fa-f]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?n?)\b/.source;
    r.action.tokenType = TokenType.NUMBER;
    root.rules.push(r);
  }

  // ── (15) Operators  ───────────────────────────────────────────────────────
  {
    const r = createSyntaxStateRule('operators');
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /(?:===|!==|=>|\.\.\.|\?\?|&&|\|\||[+\-*/%^&|~!<>=?:])/.source;
    r.action.tokenType = TokenType.OPERATOR;
    root.rules.push(r);
  }

  // ── (16) Punctuation  ─────────────────────────────────────────────────────
  {
    const r = createSyntaxStateRule('punctuation');
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /[{}()[\];,.]/.source;
    r.action.tokenType = TokenType.PUNCTUATION;
    root.rules.push(r);
  }

  // ── (17) Generic identifier  ──────────────────────────────────────────────
  {
    const r = createSyntaxStateRule('identifier');
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /[A-Za-z_$][\w$]*/.source;
    r.action.tokenType = TokenType.IDENTIFIER;
    root.rules.push(r);
  }

  // ── (18) Double-quoted string  (BEGIN_END + INCLUDE) ─────────────────────
  sStrDouble.onUnmatched = OnUnmatched.CHARACTER;
  {
    // INCLUDE escape sequences inside the string
    const incl = createSyntaxStateRule('incl_escapes');
    incl.type           = RuleType.INCLUDE;         // ← INCLUDE
    incl.includeStateId = sEscape.id;
    sStrDouble.rules.push(incl);

    const r = createSyntaxStateRule('string_double');
    r.type             = RuleType.BEGIN_END;
    r.begin            = '"';
    r.end              = '"';
    r.contentTokenType = TokenType.STRING;
    r.beginAction.tokenType = TokenType.STRING;
    r.endAction.tokenType   = TokenType.STRING;
    r.innerStateId     = sStrDouble.id;
    root.rules.push(r);
  }

  // ── (19) Single-quoted string  ────────────────────────────────────────────
  sStrSingle.onUnmatched = OnUnmatched.CHARACTER;
  {
    const incl = createSyntaxStateRule('incl_escapes');
    incl.type           = RuleType.INCLUDE;
    incl.includeStateId = sEscape.id;
    sStrSingle.rules.push(incl);

    const r = createSyntaxStateRule('string_single');
    r.type             = RuleType.BEGIN_END;
    r.begin            = "'";
    r.end              = "'";
    r.contentTokenType = TokenType.STRING;
    r.beginAction.tokenType = TokenType.STRING;
    r.endAction.tokenType   = TokenType.STRING;
    r.innerStateId     = sStrSingle.id;
    root.rules.push(r);
  }

  // ── (20) Template literal with ${…} interpolation  ────────────────────────
  //         Demonstrates: nested BEGIN_END (PUSH via innerState mechanism) +
  //         INCLUDE of root inside the interpolation → full expression support
  sTmpl.onUnmatched      = OnUnmatched.CHARACTER;
  sTmplInterp.onUnmatched = OnUnmatched.CHARACTER;
  {
    // ${…} interpolation opening/closing inside template
    const interp = createSyntaxStateRule('interpolation');
    interp.type             = RuleType.BEGIN_END;
    interp.begin            = '\\$\\{';
    interp.end              = '\\}';
    interp.beginAction.tokenType = TokenType.INTERPOLATION;
    interp.endAction.tokenType   = TokenType.INTERPOLATION;
    interp.innerStateId     = sTmplInterp.id;
    sTmpl.rules.push(interp);

    // escape sequences also valid inside template
    const inclEsc = createSyntaxStateRule('incl_escapes');
    inclEsc.type           = RuleType.INCLUDE;
    inclEsc.includeStateId = sEscape.id;
    sTmpl.rules.push(inclEsc);

    // interpolation body: re-use all root rules (expressions allowed inside ${})
    const inclRoot = createSyntaxStateRule('incl_root');
    inclRoot.type           = RuleType.INCLUDE;
    inclRoot.includeStateId = root.id;
    sTmplInterp.rules.push(inclRoot);

    const r = createSyntaxStateRule('template_literal');
    r.type             = RuleType.BEGIN_END;
    r.begin            = '`';
    r.end              = '`';
    r.contentTokenType = TokenType.STRING;
    r.beginAction.tokenType = TokenType.STRING;
    r.endAction.tokenType   = TokenType.STRING;
    r.innerStateId     = sTmpl.id;
    root.rules.push(r);
  }

  // ── (21) Regex literal  ───────────────────────────────────────────────────
  //         context guard: only fires after OPERATOR / KEYWORD / PUNCTUATION,
  //         never after IDENTIFIER or NUMBER (disambiguates from division)
  sRegex.onUnmatched = OnUnmatched.SKIP;
  {
    // character class  [a-z]  inside regex
    const charClass = createSyntaxStateRule('regex_char_class');
    charClass.type        = RuleType.MATCH;
    charClass.patternType = PatternType.REGEX;
    charClass.pattern     = /\[(?:[^\]\\]|\\.)*\]/.source;
    charClass.action.tokenType = TokenType.REGEXP;
    sRegex.rules.push(charClass);

    const r = createSyntaxStateRule('regex_literal');
    r.type             = RuleType.BEGIN_END;
    r.begin            = '/(?![/*])';      // not a comment
    r.end              = '/[gimsuy]*';     // closing / with optional flags
    r.contentTokenType = TokenType.REGEXP;
    r.beginAction.tokenType = TokenType.REGEXP;
    r.endAction.tokenType   = TokenType.REGEXP;
    r.innerStateId     = sRegex.id;
    // ← context guard
    r.context.afterTokenType    = [TokenType.OPERATOR, TokenType.KEYWORD, TokenType.PUNCTUATION];
    r.context.notAfterTokenType = [TokenType.IDENTIFIER, TokenType.NUMBER];
    root.rules.push(r);
  }

  // ── (22) DynamicEnd: raw heredoc  raw`DELIM(…)DELIM`  ────────────────────
  //         begin captures the delimiter name; dynamicEnd closes with it
  sRawStr.onUnmatched = OnUnmatched.SKIP;
  {
    const r = createSyntaxStateRule('raw_string');
    r.type             = RuleType.BEGIN_END;
    r.begin            = /raw`([A-Za-z_]\w*)\(/.source;  // e.g.  raw`END(
    r.dynamicEnd       = createDynamicEnd(1, ')${0}`');  // ← DynamicEnd: )END`
    r.end              = '';   // overridden by dynamicEnd at runtime
    r.contentTokenType = TokenType.STRING;
    r.beginAction.tokenType = TokenType.STRING;
    r.endAction.tokenType   = TokenType.STRING;
    r.innerStateId     = sRawStr.id;
    root.rules.push(r);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // IMPORT CLAUSE STATE  (entered via SET from root)
  // Demonstrates: keywords via KEYWORDS, TransitionType.POP, and INCLUDE
  // ══════════════════════════════════════════════════════════════════════════
  sImport.onUnmatched = OnUnmatched.CHARACTER;
  {
    // 'from' / 'as' are keywords only in this context
    const kw = createSyntaxStateRule('import_keywords');
    kw.type        = RuleType.MATCH;
    kw.patternType = PatternType.KEYWORDS;
    kw.pattern     = ['from', 'as', 'export', 'default'];
    kw.action.tokenType = TokenType.KEYWORD;
    sImport.rules.push(kw);

    // semicolon ends the import clause → POP back to root
    const semi = createSyntaxStateRule('import_end');
    semi.type        = RuleType.MATCH;
    semi.patternType = PatternType.REGEX;
    semi.pattern     = /;/.source;
    semi.action.tokenType  = TokenType.PUNCTUATION;
    semi.action.transition = createSyntaxStateTransition( // ← POP
      TransitionType.POP, null, 1
    );
    sImport.rules.push(semi);

    // strings (module paths) + other root constructs still work here
    const inclRoot = createSyntaxStateRule('incl_root_in_import');
    inclRoot.type           = RuleType.INCLUDE;
    inclRoot.includeStateId = root.id;
    sImport.rules.push(inclRoot);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EXPLICIT PUSH TRANSITION demo
  // A hypothetical 'macro!' keyword explicitly pushes a dedicated state.
  // (Shows TransitionType.PUSH used directly on a MATCH rule, not via
  //  the implicit BEGIN_END mechanism)
  // ══════════════════════════════════════════════════════════════════════════
  const sMacro = createSyntaxState('macro_body');
  sMacro.onUnmatched = OnUnmatched.SKIP;
  def.states.push(sMacro);
  {
    // trigger: macro! keyword in root  → PUSH into sMacro
    const rEnter = createSyntaxStateRule('macro_open');
    rEnter.type        = RuleType.MATCH;
    rEnter.patternType = PatternType.REGEX;
    rEnter.pattern     = /macro!\s*\{/.source;
    rEnter.action.tokenType  = TokenType.KEYWORD;
    rEnter.action.transition = createSyntaxStateTransition( // ← PUSH
      TransitionType.PUSH, sMacro.id
    );
    root.rules.push(rEnter);

    // closing brace inside macro body → POP back to root
    const rExit = createSyntaxStateRule('macro_close');
    rExit.type        = RuleType.MATCH;
    rExit.patternType = PatternType.REGEX;
    rExit.pattern     = /\}/.source;
    rExit.action.tokenType  = TokenType.PUNCTUATION;
    rExit.action.transition = createSyntaxStateTransition( // ← POP
      TransitionType.POP, null, 1
    );
    sMacro.rules.push(rExit);

    // macro body: reuse root rules
    const inclRoot = createSyntaxStateRule('incl_root_in_macro');
    inclRoot.type           = RuleType.INCLUDE;
    inclRoot.includeStateId = root.id;
    sMacro.rules.push(inclRoot);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HIGHLIGHT STYLE  (Dark theme)
  // Exercises: tokenStyles, stateTokenStyles, overrides
  // ══════════════════════════════════════════════════════════════════════════
  const style = createHighlightStyle('Dark');
  def.styles.push(style);

  // ── tokenStyles: global fallback per TokenType ────────────────────────────
  const GLOBAL_COLORS = [
    [TokenType.KEYWORD,       '#569cd6'],
    [TokenType.IDENTIFIER,    '#9cdcfe'],
    [TokenType.TYPE,          '#4ec9b0'],
    [TokenType.VARIABLE,      '#9cdcfe'],
    [TokenType.FUNCTION,      '#dcdcaa'],
    [TokenType.PARAMETER,     '#9cdcfe'],
    [TokenType.PROPERTY,      '#9cdcfe'],
    [TokenType.OPERATOR,      '#d4d4d4'],
    [TokenType.PUNCTUATION,   '#d4d4d4'],
    [TokenType.NUMBER,        '#b5cea8'],
    [TokenType.STRING,        '#ce9178'],
    [TokenType.COMMENT,       '#6a9955', { italic: true }],
    [TokenType.REGEXP,        '#d16969'],
    [TokenType.ESCAPE,        '#d7ba7d'],
    [TokenType.INTERPOLATION, '#569cd6', { bold: true }],
    [TokenType.DECORATOR,     '#dcdcaa'],
    [TokenType.NAMESPACE,     '#4ec9b0'],
    [TokenType.LITERAL,       '#569cd6'],
    [TokenType.OTHER,         '#d4d4d4'],
  ];
  for (const [tt, color, opts] of GLOBAL_COLORS) {
    style.tokenStyles.push(createTokenStyle(tt, color, opts ?? {}));
  }

  // ── stateTokenStyles: override per TokenType scoped to one state ──────────
  // Strings inside a template literal are slightly warmer
  style.stateTokenStyles.push(
    createStateTokenStyle(sTmpl.id, TokenType.STRING,  '#e09060')
  );
  // Comments inside block-comment state get a slightly different shade
  style.stateTokenStyles.push(
    createStateTokenStyle(sBlockCmt.id, TokenType.COMMENT, '#57a64a', { italic: true })
  );

  // ── overrides: per-rule color override inside a specific state ────────────
  // Give the @decorator rule bold + purple (overrides the global DECORATOR style)
  const decoratorRule = root.rules.find(r => r.name === 'decorator');
  if (decoratorRule) {
    style.overrides.push(
      createStyleOverride(
        root.id,
        decoratorRule.id,
        createTokenStyle(TokenType.DECORATOR, '#c586c0', { bold: true }),
      )
    );
  }
  // Make 'import' keyword in the import-end rule look different (bold blue)
  const importEndRule = sImport.rules.find(r => r.name === 'import_end');
  if (importEndRule) {
    style.overrides.push(
      createStyleOverride(
        sImport.id,
        importEndRule.id,
        createTokenStyle(TokenType.PUNCTUATION, '#808080', { bold: true }),
      )
    );
  }

  return def;
}

// ─── Example source code that hits every rule ─────────────────────────────────
const EXAMPLE_CODE = `\
// line comment
/* block
   comment */

import { foo, bar as baz } from "some-module";

@sealed
class Counter : EventEmitter {
  #count: Number = 0;

  constructor(start: Number) {
    super();
    this.#count = start ?? 0;
  }

  increment() {
    this.#count++;
    return this;
  }

  get value() { return this.#count; }
}

const greet = async (name) => {
  const msg = \`Hello, \${name.toUpperCase()}!\`;
  console.log(msg);
  return msg;
};

// regex (context guard: after = operator)
const RE = /^[a-z]+\\d*/gi;

// raw heredoc (DynamicEnd)
const xml = raw\`END(<root>text</root>)END\`;

// pragma (case-insensitive)
pragma strict;
PRAGMA strict;

// macro! block (explicit PUSH transition)
macro! {
  const x = 0xFF + 0b1010 + 0o17 + 3.14e2;
}

// Numbers: hex, binary, octal, float, bigint
const nums = [0xDEAD, 0b1111, 0o755, 1_000_000n, 6.02e23];
`;
