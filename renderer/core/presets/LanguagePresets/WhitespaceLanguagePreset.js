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
} from '@data/SyntaxDefinitionManager.js';

// The highlighter worker lexes text.split('\n') one line at a time, so
// '\n' is never a matchable character -- only an implicit boundary
// between lines. Every rule below that needs "real char, then a
// newline" matches the real char and anchors with `$` (end of the
// current line), then continues on the next line via a pushed state.
//
// Flow Control (IMP = bare [LF]) can't be recognized under this scheme,
// nor can Discard's/EndProgram's back-to-back [LF]s -- both require
// reacting to an empty line, which the worker bypasses before any rule
// ever runs. Not implemented here.

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

function addMatch(state, name, pattern, tokenType, transitionTarget) {
  addRule(state, name, r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = pattern;
    const a = createSyntaxRuleAction();
    a.tokenType = tokenType;
    if (transitionTarget)
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, transitionTarget.id);
    r.action = a;
  });
}

const WS = {
  STACK: 'whitespace_stack',
  ARITHMETIC: 'whitespace_arithmetic',
  HEAP: 'whitespace_heap',
  IO: 'whitespace_io',
  STRAY: 'whitespace_stray',
};

export function createWhitespaceLanguage() {
  const def = createSyntaxDefinition('Whitespace');
  def.aliases = ['whitespace', 'ws', 'wsp', 'wspace'];
  def.id = 'WhitespaceLang';
  def.builtIn = true;
  def.symbolHoisting = false;
  def.predefinedSymbols = [];

  const root = def.states.find(s => s.id === def.rootStateId);

  const stackAfterImp = newState(def, 'stack_after_imp');
  addMatch(stackAfterImp, 'duplicate', / /.source, WS.STACK);
  addMatch(stackAfterImp, 'swap',      /\t/.source, WS.STACK);

  const stackSlideParam = newState(def, 'stack_slide_param');
  addMatch(stackSlideParam, 'slide_bits', /[ \t]*$/.source, WS.STACK);

  const ioOpcode = newState(def, 'io_opcode');
  addMatch(ioOpcode, 'out_char',  /  /.source,   WS.IO);
  addMatch(ioOpcode, 'out_num',   / \t/.source,  WS.IO);
  addMatch(ioOpcode, 'read_char', /\t /.source,  WS.IO);
  addMatch(ioOpcode, 'read_num',  /\t\t/.source, WS.IO);

  // Stack Manipulation (IMP: Space)
  addMatch(root, 'push', /  [ \t]*$/.source, WS.STACK);
  addMatch(root, 'copy', / \t [ \t]*$/.source, WS.STACK);
  addMatch(root, 'slide_begin', / \t$/.source, WS.STACK, stackSlideParam);
  addMatch(root, 'stack_imp_then_lf', / $/.source, WS.STACK, stackAfterImp);

  // Arithmetic (IMP: Tab Space)
  addMatch(root, 'add', /\t   /.source,   WS.ARITHMETIC);
  addMatch(root, 'sub', /\t  \t/.source,  WS.ARITHMETIC);
  addMatch(root, 'div', /\t \t /.source,  WS.ARITHMETIC);
  addMatch(root, 'mod', /\t \t\t/.source, WS.ARITHMETIC);
  addMatch(root, 'mul', /\t  $/.source, WS.ARITHMETIC);

  // Heap Access (IMP: Tab Tab)
  addMatch(root, 'store',    /\t\t /.source,  WS.HEAP);
  addMatch(root, 'retrieve', /\t\t\t/.source, WS.HEAP);

  // I/O (IMP: Tab LF)
  addMatch(root, 'io_imp_then_lf', /\t$/.source, WS.IO, ioOpcode);

  addRule(root, 'ignored_text', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[^ \t]+/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.COMMENT;
    r.action = a;
  });

  addRule(root, 'stray_whitespace', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[ \t]/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = WS.STRAY;
    r.action = a;
  });

  const S = ' ', T = '\t', L = '\n';
  def.exampleCode =
    S + S + S + T + S + T + L +
    S + S + S + T + T + L +
    T + S + S + S +
    T + L + S + T +
    S + L + S +
    S + L + T +
    S + T + S + S + L +
    S + T + L + S + L +
    T + S + S + T +
    T + S + S + L +
    T + S + T + S +
    T + S + T + T +
    T + T + S +
    T + T + T +
    T + L + S + S +
    T + L + T + S +
    T + L + T + T;

  return def;
}

export function createWhitespaceLanguageStyles(wsDef) {
  const darkStyle = createHighlightStyle(wsDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(WS.STACK,      '#569cd6', { underline: true, underlineStyle: 'solid' }),
    createTokenStyle(WS.ARITHMETIC, '#4ec9b0', { underline: true, underlineStyle: 'dashed' }),
    createTokenStyle(WS.HEAP,       '#c586c0', { underline: true, underlineStyle: 'dotted' }),
    createTokenStyle(WS.IO,         '#f44747', { underline: true, underlineStyle: 'double' }),
    createTokenStyle(TokenType.COMMENT, '#6a9955', { italic: true }),
    createTokenStyle(WS.STRAY,      '#808080', { underline: true, underlineStyle: 'dotted' }),
  ];

  return [darkStyle];
}