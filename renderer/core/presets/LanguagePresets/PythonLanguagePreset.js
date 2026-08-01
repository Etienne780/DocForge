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
    ['str',           TokenType.FUNCTION],
    ['int',           TokenType.FUNCTION],
    ['float',         TokenType.FUNCTION],
    ['bool',          TokenType.FUNCTION],
    ['list',          TokenType.FUNCTION],
    ['tuple',         TokenType.FUNCTION],
    ['dict',          TokenType.FUNCTION],
    ['set',           TokenType.FUNCTION],
    ['frozenset',     TokenType.FUNCTION],
    ['range',         TokenType.FUNCTION],
    ['slice',         TokenType.FUNCTION],
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
    ['memoryview',    TokenType.FUNCTION],
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
  const fString = newState(def, 'f_string');
  const fStringEscape = newState(def, 'f_string_escape');

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
  tripleDouble.onUnmatched = OnUnmatched.CHARACTER;

  // F‑string expressions inside { ... }
  fString.onUnmatched = OnUnmatched.CHARACTER;
  addRule(fString, 'f_expression', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\{/.source;
    r.end   = /\}/.source;
    r.beginAction = action(TokenType.PUNCTUATION);
    r.endAction   = action(TokenType.PUNCTUATION);
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = newState(def, 'f_expr_content').id;
    const fExprContent = def.states[def.states.length - 1];
    fExprContent.onUnmatched = OnUnmatched.CHARACTER;
    addRule(fExprContent, 'f_expr_var', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /[A-Za-z_]\w*/.source;
      r.action = action(TokenType.VARIABLE);
    });
    addRule(fExprContent, 'f_expr_number', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /\b\d+\.?\d*\b/.source;
      r.action = action(TokenType.NUMBER);
    });
    addRule(fExprContent, 'f_expr_operator', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /[+\-*/%&|^~!<>=]=?/.source;
      r.action = action(TokenType.OPERATOR);
    });
    addRule(fExprContent, 'f_expr_punctuation', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /[()\[\];,.]/.source;
      r.action = action(TokenType.PUNCTUATION);
    });
    addRule(fExprContent, 'f_expr_string', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'/.source;
      r.action = action(TokenType.STRING);
    });
  });
  addRule(fString, 'include_f_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = fStringEscape.id;
  });

  // Common rules (shared by root and f‑string expressions)
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

  addRule(common, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*\(/.source;
    r.context = { notAfterTokenType: [TokenType.KEYWORD, TokenType.TYPE] };
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'class_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bclass\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'function_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bdef\s+([A-Za-z_]\w*)\s*\(/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'decorator', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.DECORATOR);
  });

  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules (comments, strings, numbers, operators, punctuation)
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /'/.source;
    r.end   = /'/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /"/.source;
    r.end   = /"/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  addRule(shared, 'triple_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /'''/.source;
    r.end   = /'''/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, tripleSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = tripleSingle.id;
  });

  addRule(shared, 'triple_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /"""/.source;
    r.end   = /"""/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, tripleDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = tripleDouble.id;
  });

  addRule(shared, 'raw_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:r|R)'(?:[^'\\]|\\')*'|(?:r|R)"(?:[^"\\]|\\")*"/.source;
    r.action = action(TokenType.STRING);
  });

  addRule(shared, 'f_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?:f|F)['"]/.source;
    r.end   = /['"]/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, fString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = fString.id;
  });

  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX][0-9a-fA-F_]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_bin', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[bB][01_]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_oct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[oO][0-7_]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.\d*(?:[eE][+-]?\d+)?[jJ]?/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_complex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+[jJ]|\b\d+\.\d*[jJ]/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|<=|>=|==|!=|:=|\*\*|\/\/|\.\.|\.\.\./.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];:,.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules
  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
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
`;

  // HighlightStyle
  const style = createHighlightStyle('Dark+');
  style.tokenStyles = [
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
  def.styles.push(style);

  return def;
}