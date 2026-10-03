import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxCaptureMap,
  createSymbolRegister,
  createSyntaxStateTransition,
  createDynamicEnd,
  createHighlightStyle,
  createTokenStyle,
  createPredefinedSymbol,
  RuleType,
  PatternType,
  TokenType,
  TransitionType,
  RegisterScope,
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

export function createPythonLanguage() {
  const def = createSyntaxDefinition('Python');
  def.aliases = ['py', 'python', 'python3'];
  def.id = 'PythonLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['int',           TokenType.TYPE],
    ['float',         TokenType.TYPE],
    ['str',           TokenType.TYPE],
    ['bool',          TokenType.TYPE],
    ['bytes',         TokenType.TYPE],
    ['bytearray',     TokenType.TYPE],
    ['tuple',         TokenType.TYPE],
    ['list',          TokenType.TYPE],
    ['dict',          TokenType.TYPE],
    ['set',           TokenType.TYPE],
    ['frozenset',     TokenType.TYPE],
    ['complex',       TokenType.TYPE],
    ['range',         TokenType.TYPE],
    ['slice',         TokenType.TYPE],
    ['memoryview',    TokenType.TYPE],
    ['object',        TokenType.TYPE],
    ['type',          TokenType.TYPE],
    ['None',          TokenType.LITERAL],
    ['True',          TokenType.LITERAL],
    ['False',         TokenType.LITERAL],
    ['Ellipsis',      TokenType.LITERAL],
    ['NotImplemented',TokenType.LITERAL],
    ['print',         TokenType.FUNCTION],
    ['len',           TokenType.FUNCTION],
    ['sum',           TokenType.FUNCTION],
    ['min',           TokenType.FUNCTION],
    ['max',           TokenType.FUNCTION],
    ['sorted',        TokenType.FUNCTION],
    ['reversed',      TokenType.FUNCTION],
    ['enumerate',     TokenType.FUNCTION],
    ['zip',           TokenType.FUNCTION],
    ['filter',        TokenType.FUNCTION],
    ['map',           TokenType.FUNCTION],
    ['reduce',        TokenType.FUNCTION],
    ['any',           TokenType.FUNCTION],
    ['all',           TokenType.FUNCTION],
    ['isinstance',    TokenType.FUNCTION],
    ['issubclass',    TokenType.FUNCTION],
    ['super',         TokenType.FUNCTION],
    ['property',      TokenType.FUNCTION],
    ['staticmethod',  TokenType.FUNCTION],
    ['classmethod',   TokenType.FUNCTION],
    ['open',          TokenType.FUNCTION],
    ['help',          TokenType.FUNCTION],
    ['dir',           TokenType.FUNCTION],
    ['vars',          TokenType.FUNCTION],
    ['locals',        TokenType.FUNCTION],
    ['globals',       TokenType.FUNCTION],
    ['hasattr',       TokenType.FUNCTION],
    ['getattr',       TokenType.FUNCTION],
    ['setattr',       TokenType.FUNCTION],
    ['delattr',       TokenType.FUNCTION],
    ['callable',      TokenType.FUNCTION],
    ['chr',           TokenType.FUNCTION],
    ['ord',           TokenType.FUNCTION],
    ['hex',           TokenType.FUNCTION],
    ['oct',           TokenType.FUNCTION],
    ['bin',           TokenType.FUNCTION],
    ['format',        TokenType.FUNCTION],
    ['input',         TokenType.FUNCTION],
    ['eval',          TokenType.FUNCTION],
    ['exec',          TokenType.FUNCTION],
    ['compile',       TokenType.FUNCTION],
    ['repr',          TokenType.FUNCTION],
    ['ascii',         TokenType.FUNCTION],
    ['hash',          TokenType.FUNCTION],
    ['id',            TokenType.FUNCTION],
    ['next',          TokenType.FUNCTION],
    ['iter',          TokenType.FUNCTION],
    ['Exception',     TokenType.TYPE],
    ['TypeError',     TokenType.TYPE],
    ['ValueError',    TokenType.TYPE],
    ['IndexError',    TokenType.TYPE],
    ['KeyError',      TokenType.TYPE],
    ['AttributeError',TokenType.TYPE],
    ['NameError',     TokenType.TYPE],
    ['RuntimeError',  TokenType.TYPE],
    ['OSError',       TokenType.TYPE],
    ['ImportError',   TokenType.TYPE],
    ['ModuleNotFoundError', TokenType.TYPE],
    ['StopIteration', TokenType.TYPE],
    ['StopAsyncIteration', TokenType.TYPE],
    ['ArithmeticError', TokenType.TYPE],
    ['AssertionError', TokenType.TYPE],
    ['FileNotFoundError', TokenType.TYPE],
    ['PermissionError', TokenType.TYPE],
    ['TimeoutError',  TokenType.TYPE],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strSingle = newState(def, 'string_single');
  const strDouble = newState(def, 'string_double');
  const strEscape = newState(def, 'string_escape');
  const tripleSingle = newState(def, 'triple_single');
  const tripleDouble = newState(def, 'triple_double');
  const rawString = newState(def, 'raw_string');
  const fString = newState(def, 'f_string');
  const fStringEscape = newState(def, 'f_string_escape');
  const fExprContent = newState(def, 'f_expr_content');

  const NAME = /[A-Za-z_]\w*/.source;

  // Escape sequences for normal strings
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|N\{[^}]+\})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Escape sequences for f‑strings
  fStringEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(fStringEscape, 'f_escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|N\{[^}]+\})/.source;
    r.action = action(TokenType.ESCAPE);
  });
  addRule(fStringEscape, 'f_escape_brace', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\{\{|\}\}/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Single‑quoted strings
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Double‑quoted strings
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Triple‑quoted strings
  tripleSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(tripleSingle, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });
  tripleDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(tripleDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Raw strings: no escapes, but `\"` still does not close the string
  rawString.onUnmatched = OnUnmatched.CHARACTER;
  addRule(rawString, 'raw_backslash', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\./.source;
    r.action = action(TokenType.STRING);
  });

  // F‑string content: `{{`/`}}` escapes, then `{ expression }`
  fString.onUnmatched = OnUnmatched.CHARACTER;
  addRule(fString, 'include_f_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = fStringEscape.id;
  });
  addRule(fString, 'f_expression', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\{/.source;
    r.end   = /\}/.source;
    r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, fExprContent.id));
    r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
    r.innerStateId = fExprContent.id;
  });

  // F‑string expression: full Python code; nested `{…}` (dict/set) is counted
  fExprContent.onUnmatched = OnUnmatched.CHARACTER;
  addRule(fExprContent, 'f_expr_brace', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\{/.source;
    r.end   = /\}/.source;
    r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, fExprContent.id));
    r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
    r.innerStateId = fExprContent.id;
  });
  // Conversion `!r` and format spec `:>10` (format spec may not start with `=`)
  addRule(fExprContent, 'f_expr_format', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:![rsa])?:(?!=)[^{}'"\])]*(?=\})|![rsa](?=\})/.source;
    r.action = action(TokenType.ESCAPE);
  });
  // (root is included at the end)

  // Common rules (identifiers, keywords, declarations)
  // Class definition – register class name
  addRule(common, 'class_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(class)\\s+(${NAME})`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Function definition – register function name (also `def f[T](…)`)
  addRule(common, 'function_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(def)\\s+(${NAME})(?=\\s*[(\\[])`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Type alias statement (soft keyword): `type Point = …`, `type Pair[T] = …`
  addRule(common, 'type_alias', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(?<=^\\s*)(type)\\s+(${NAME})(?=\\s*[\\[=])`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Type parameters (PEP 695): `def f[T, *Ts, **P]`, `class C[T: int]`
  addRule(common, 'type_parameter', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(?<=\\b(?:def|class|type)\\s+${NAME}\\s*\\[(?:[^\\]]*,)?\\s*\\**)${NAME}`;
    r.action = action(TokenType.TYPE);
    r.action.register = createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL);
  });

  // Soft keywords `match` / `case` at the start of a statement
  addRule(common, 'soft_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=^\s*)(?:match|case)\b(?=\s+(?![=,.)\]:]|[-+*\/%&|^<>]?=))/.source;
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'False', 'True', 'None', 'and', 'as', 'assert', 'async', 'await',
      'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
      'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
      'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
      'try', 'while', 'with', 'yield',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Function call: lowercase names only, so `MyClass(…)` keeps its TYPE color
  addRule(common, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[a-z_]\w*(?=\s*\()/.source;
    r.action = action(TokenType.FUNCTION);
  });

  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = NAME;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules (comments, strings, numbers, operators, punctuation)
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // f-strings (f, F, rf, fr, …) – triple-quoted first
  addRule(shared, 'f_string_triple', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?:[rR][fF]|[fF][rR]?)("""|''')/.source;
    r.end   = /"""|'''/.source;
    r.dynamicEnd = createDynamicEnd(1, '${0}');
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, fString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = fString.id;
  });

  addRule(shared, 'f_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?:[rR][fF]|[fF][rR]?)(["'])/.source;
    r.end   = /['"]/.source;
    r.dynamicEnd = createDynamicEnd(1, '${0}|(?<!\\\\)$');
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, fString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = fString.id;
  });

  // Raw strings (r, R, rb, br, …)
  addRule(shared, 'raw_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?:[rR][bB]?|[bB][rR])("""|'''|"|')/.source;
    r.end   = /"""|'''|"|'/.source;
    r.dynamicEnd = createDynamicEnd(1, '${0}');
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, rawString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = rawString.id;
  });

  addRule(shared, 'triple_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /[bBuU]?"""/.source;
    r.end   = /"""/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, tripleDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = tripleDouble.id;
  });

  addRule(shared, 'triple_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /[bBuU]?'''/.source;
    r.end   = /'''/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, tripleSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = tripleSingle.id;
  });

  // Single-line strings end at the line end when unterminated
  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /[bBuU]?'/.source;
    r.end   = /'|(?<!\\)$/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /[bBuU]?"/.source;
    r.end   = /"|(?<!\\)$/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Numbers: hex/bin/oct, then float/complex, then int; `_` separators
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX](?:_?[0-9a-fA-F])+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_bin', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[bB](?:_?[01])+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_oct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[oO](?:_?[0-7])+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:\b\d(?:_?\d)*\.(?:\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?|(?<![\w.])\.\d(?:_?\d)*(?:[eE][+-]?\d(?:_?\d)*)?|\b\d(?:_?\d)*[eE][+-]?\d(?:_?\d)*)[jJ]?(?![\w.])/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_complex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d(?:_?\d)*[jJ]\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d(?:_?\d)*\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Decorators: only at the start of a line (`a @ b` is matrix multiplication)
  addRule(shared, 'decorator', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(?<=^\\s*)@${NAME}(?:\\.${NAME})*`;
    r.action = action(TokenType.DECORATOR);
  });

  // Ellipsis
  addRule(shared, 'ellipsis', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\.\.\./.source;
    r.action = action(TokenType.LITERAL);
  });

  // Operators (longest first); `@` is matrix multiplication here
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\*\*=|\/\/=|>>=|<<=|->|:=|\*\*|\/\/|<<|>>|<=|>=|==|!=|[+\-*\/%&|^@]=|[+\-*\/%&|^~<>=@]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];:,.!\\]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules (strings first, so prefixes like f"…" / rb"…" are not identifiers)
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });

  // F-string expressions contain regular Python code
  addRule(fExprContent, 'include_root', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = root.id;
  });

  // Example code
  def.exampleCode = `#!/usr/bin/env python3
# This is a comment
"""Docstring at module level."""

import os
from sys import argv

def greet(name: str) -> str:
    """Return a greeting."""
    return f"Hello, {name}!"

class Person:
    """A simple person class."""
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age

    def __str__(self):
        return f"{self.name} ({self.age})"

    @property
    def is_adult(self):
        return self.age >= 18

def main():
    # Variables
    name = "Alice"
    age = 30

    # Built-in functions
    print(greet(name))

    # List
    numbers = [1, 2, 3, 4, 5]
    squared = [x**2 for x in numbers]

    # Loop
    for i in range(len(numbers)):
        print(f"numbers[{i}] = {numbers[i]}")

    # Conditional
    if age > 18:
        print("Adult")
    elif age == 18:
        print("Just turned 18")
    else:
        print("Minor")

    # Exception handling
    try:
        with open("data.txt", "r") as f:
            data = f.read()
    except FileNotFoundError as e:
        print(f"Error: {e}")

    # Class usage
    p = Person("Bob", 25)
    print(p)

    # Decorator
    @staticmethod
    def static_method():
        return "static"

    # Lambda
    add = lambda a, b: a + b
    print(add(3, 4))

if __name__ == "__main__":
    main()

# Modern syntax
type Vector = list[float]

def first[T](items: list[T]) -> T | None:
    return items[0] if items else None

def handle(command: dict) -> str:
    match command:
        case {"action": "move", "x": x, "y": y}:
            return f"Moving to {x:>4}, {y!r}"
        case [first, *rest]:
            return f"{first=} and {len(rest):_} more"
        case _:
            return "unknown"

if (count := len(argv)) > 1_000:
    pattern = rb"\\d+\\.\\d*"
`;
  return def;
}

export function createPythonLanguageStyles(pyDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(pyDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.TYPE,          '#4ec9b0'),
    createTokenStyle(TokenType.IDENTIFIER,    '#9cdcfe'),
    createTokenStyle(TokenType.VARIABLE,      '#9cdcfe'),
    createTokenStyle(TokenType.FUNCTION,      '#dcdcaa'),
    createTokenStyle(TokenType.PARAMETER,     '#9cdcfe', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#9cdcfe'),
    createTokenStyle(TokenType.OPERATOR,      '#d4d4d4'),
    createTokenStyle(TokenType.PUNCTUATION,   '#d4d4d4'),
    createTokenStyle(TokenType.NUMBER,        '#b5cea8'),
    createTokenStyle(TokenType.STRING,        '#ce9178'),
    createTokenStyle(TokenType.COMMENT,       '#6a9955', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#d7ba7d'),
    createTokenStyle(TokenType.DECORATOR,     '#c8c8c8'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  const lightStyle = createHighlightStyle(pyDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#0000ff'),
    createTokenStyle(TokenType.TYPE,          '#267f99'),
    createTokenStyle(TokenType.IDENTIFIER,    '#001080'),
    createTokenStyle(TokenType.VARIABLE,      '#001080'),
    createTokenStyle(TokenType.FUNCTION,      '#795e26'),
    createTokenStyle(TokenType.PARAMETER,     '#001080', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#001080'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.DECORATOR,     '#795e26'), // @decorator
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(pyDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.TYPE,          '#e5c07b'),
    createTokenStyle(TokenType.IDENTIFIER,    '#abb2bf'),
    createTokenStyle(TokenType.VARIABLE,      '#e06c75'),
    createTokenStyle(TokenType.FUNCTION,      '#61afef'),
    createTokenStyle(TokenType.PARAMETER,     '#e06c75', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#e06c75'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.DECORATOR,     '#61afef'), // @decorator
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(pyDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.PARAMETER,     '#fd971f', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.DECORATOR,     '#a6e22e'), // @decorator
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(pyDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.TYPE,          '#8be9fd', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.PARAMETER,     '#ffb86c', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.DECORATOR,     '#50fa7b'), // @decorator
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(pyDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.TYPE,          '#953800'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.VARIABLE,      '#24292f'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.PARAMETER,     '#24292f'),
    createTokenStyle(TokenType.PROPERTY,      '#0550ae'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.DECORATOR,     '#8250df'), // @decorator
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}