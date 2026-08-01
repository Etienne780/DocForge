import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxCaptureMap,
  createSymbolRegister,
  createSyntaxStateTransition,
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

export function createJavaScriptLanguage() {
  const def = createSyntaxDefinition('JavaScript');
  def.aliases = ['js', 'javascript', 'node', 'nodejs', 'es6', 'mjs'];
  def.id = 'JavaScriptLang';
  def.builtIn = true;
  def.symbolHoisting = true; // var / function declarations are hoisted

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    // Global objects
    ['Object',        TokenType.TYPE],
    ['Array',         TokenType.TYPE],
    ['String',        TokenType.TYPE],
    ['Number',        TokenType.TYPE],
    ['Boolean',       TokenType.TYPE],
    ['Function',      TokenType.TYPE],
    ['Symbol',        TokenType.TYPE],
    ['BigInt',        TokenType.TYPE],
    ['Date',          TokenType.TYPE],
    ['RegExp',        TokenType.TYPE],
    ['Error',         TokenType.TYPE],
    ['TypeError',     TokenType.TYPE],
    ['ReferenceError', TokenType.TYPE],
    ['SyntaxError',   TokenType.TYPE],
    ['RangeError',    TokenType.TYPE],
    ['Promise',       TokenType.TYPE],
    ['Map',           TokenType.TYPE],
    ['Set',           TokenType.TYPE],
    ['WeakMap',       TokenType.TYPE],
    ['WeakSet',       TokenType.TYPE],
    ['Proxy',         TokenType.TYPE],
    ['Reflect',       TokenType.TYPE],
    ['Math',          TokenType.TYPE],
    ['JSON',          TokenType.TYPE],
    ['console',       TokenType.VARIABLE],
    // Global functions
    ['parseInt',      TokenType.FUNCTION],
    ['parseFloat',    TokenType.FUNCTION],
    ['isNaN',         TokenType.FUNCTION],
    ['isFinite',      TokenType.FUNCTION],
    ['encodeURI',     TokenType.FUNCTION],
    ['decodeURI',     TokenType.FUNCTION],
    ['encodeURIComponent', TokenType.FUNCTION],
    ['decodeURIComponent', TokenType.FUNCTION],
    ['require',       TokenType.FUNCTION],
    ['eval',          TokenType.FUNCTION],
    ['setTimeout',    TokenType.FUNCTION],
    ['setInterval',   TokenType.FUNCTION],
    ['clearTimeout',  TokenType.FUNCTION],
    ['clearInterval', TokenType.FUNCTION],
    ['fetch',         TokenType.FUNCTION],
    // Node.js globals (if needed)
    ['Buffer',        TokenType.TYPE],
    ['process',       TokenType.VARIABLE],
    // Literals
    ['undefined',     TokenType.LITERAL],
    ['null',          TokenType.LITERAL],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['Infinity',      TokenType.LITERAL],
    ['NaN',           TokenType.LITERAL],
    ['globalThis',    TokenType.LITERAL],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const templateLiteral = newState(def, 'template_literal');
  const blockComment = newState(def, 'block_comment');
  const regexLiteral = newState(def, 'regex_literal');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\"bfnrtv]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]{1,6}\}|[^0-9xu])/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted string content
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Template literal content
  templateLiteral.onUnmatched = OnUnmatched.CHARACTER;
  templateLiteral.contentTokenType = TokenType.STRING;
  addRule(templateLiteral, 'template_subst', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\${[^}]*}/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Regular expression literal content
  regexLiteral.onUnmatched = OnUnmatched.CHARACTER;
  regexLiteral.contentTokenType = TokenType.REGEXP;

  // Shared rules
  // Comments (line and block)
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Double-quoted strings
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Single-quoted strings
  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // Template literals
  addRule(shared, 'template_literal', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /`/.source;
    r.end   = /`/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, templateLiteral.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = templateLiteral.id;
  });

  // Regular expression literals (simplified: /.../ with optional flags)
  // We use a MATCH rule with a complex regex that matches the whole literal.
  addRule(shared, 'regex_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    // Matches /.../ with optional flags, but avoids capturing comments or division
    r.pattern = /\/(?:[^\/\\\n\r]|\\.)+\/[gimsuy]*(?=\s*[,;)}\])]|$)/.source;
    r.context = {
      afterTokenType: [TokenType.OPERATOR, TokenType.PUNCTUATION, TokenType.KEYWORD, TokenType.LITERAL, TokenType.IDENTIFIER]
    };
    r.action = action(TokenType.REGEXP);
  });

  // Numbers (hex, decimal, binary, octal, floating)
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
    r.pattern = /\b\d+\.\d+(?:[eE][+-]?\d+)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!]=?|<<|>>|>>>|&&|\|\||\?\?|\.{3}|[?:]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Keywords
  addRule(root, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      // Control flow
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
      'break', 'continue', 'return', 'throw', 'try', 'catch', 'finally',
      // Declarations
      'var', 'let', 'const', 'function', 'class', 'extends', 'super',
      'new', 'this', 'delete', 'void', 'typeof', 'instanceof', 'in',
      // Modules
      'import', 'export', 'default', 'from', 'as',
      // Async / iterators
      'async', 'await', 'yield', 'generator',
      // Other
      'debugger', 'with', 'get', 'set', 'static',
      // Strict mode
      'eval', 'arguments',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Class declaration – register class name
  addRule(root, 'class_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bclass\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Function declaration – register function name
  addRule(root, 'function_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bfunction\s+([A-Za-z_]\w*)\s*\(/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION,
                         register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Arrow function – we don't register because it's anonymous, but we color as function
  // We don't need a specific rule; the identifier will be colored by the function_call rule.

  // Function call (name followed by parenthesis)
  addRule(root, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*\(/.source;
    r.context = { notAfterTokenType: [TokenType.PUNCTUATION, TokenType.KEYWORD] };
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Method call (object.method or object['method'])
  // For dot notation: we color the property as PROPERTY
  addRule(root, 'property_access', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\.([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.PROPERTY, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Identifier fallback
  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Example code
  def.exampleCode = `// JavaScript example
const name = "Alice";
let age = 30;

function greet(person) {
    return \`Hello, \${person}!\`;
}

class Person {
    constructor(name, age) {
        this.name = name;
        this.age = age;
    }

    sayHello() {
        console.log(\`Hello, I'm \${this.name}\`);
    }

    static create(name, age) {
        return new Person(name, age);
    }
}

const p = new Person("Bob", 25);
p.sayHello();

// Arrow functions
const add = (a, b) => a + b;
console.log(add(5, 7));

// Array methods
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log(doubled);

// Destructuring
const { name: userName, age: userAge } = p;
console.log(userName, userAge);

// Spread operator
const moreNumbers = [...numbers, 6, 7, 8];
console.log(moreNumbers);

// Template literal with expression
console.log(\`Sum: \${add(10, 20)}\`);

// Regular expression
const regex = /[a-z]+/g;
const result = regex.test("hello");

// Async / Await
async function fetchData() {
    try {
        const response = await fetch('https://api.example.com/data');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error:', error);
    }
}

// Module import (ES6)
// import { something } from './module.js';

// Export
export { Person, greet };

// Default export
export default fetchData;
`;

  // HighlightStyle
  const style = createHighlightStyle('Dark+');
  style.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.TYPE,          '#4ec9b0'),
    createTokenStyle(TokenType.FUNCTION,      '#dcdcaa'),
    createTokenStyle(TokenType.VARIABLE,      '#9cdcfe'),
    createTokenStyle(TokenType.PROPERTY,      '#9cdcfe'),
    createTokenStyle(TokenType.IDENTIFIER,    '#9cdcfe'),
    createTokenStyle(TokenType.OPERATOR,      '#d4d4d4'),
    createTokenStyle(TokenType.PUNCTUATION,   '#d4d4d4'),
    createTokenStyle(TokenType.NUMBER,        '#b5cea8'),
    createTokenStyle(TokenType.STRING,        '#ce9178'),
    createTokenStyle(TokenType.COMMENT,       '#6a9955', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#d7ba7d'),
    createTokenStyle(TokenType.REGEXP,        '#d7ba7d'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];
  def.styles.push(style);

  return def;
}