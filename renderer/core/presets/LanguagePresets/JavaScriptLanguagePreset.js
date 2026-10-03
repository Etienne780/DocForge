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
  const templateInterpolation = newState(def, 'template_interpolation');
  const blockComment = newState(def, 'block_comment');
  const regexLiteral = newState(def, 'regex_literal');

  // Identifier building blocks (JS identifiers may contain `$`)
  const IDENT = /[A-Za-z_$][\w$]*/.source;
  const NOT_IDENT_BEFORE = /(?<![\w$#])/.source;

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\"'`bfnrtv0$]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]{1,6}\}|[^0-9xu])/.source;
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
  addRule(templateLiteral, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // `${ ... }` - full code inside, ends at the matching `}`.
  addRule(templateLiteral, 'template_subst', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\$\{/.source;
    r.end   = /\}/.source;
    r.beginAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, templateInterpolation.id));
    r.endAction   = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.innerStateId = templateInterpolation.id;
  });

  // Inside an interpolation every `{` opens a nested block, so the `}` that
  // closes an object literal / arrow body does not end the interpolation.
  templateInterpolation.onUnmatched = OnUnmatched.CHARACTER;
  addRule(templateInterpolation, 'brace_block', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\{/.source;
    r.end   = /\}/.source;
    r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, templateInterpolation.id));
    r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
    r.innerStateId = templateInterpolation.id;
  });
  // Root is added below (it includes the template rule again -> nesting).

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Regular expression literal content
  regexLiteral.onUnmatched = OnUnmatched.CHARACTER;
  regexLiteral.contentTokenType = TokenType.REGEXP;

  // Shared rules
  // Shebang (only at the very start of a line)
  addRule(shared, 'shebang', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^#!.*/.source;
    r.action = action(TokenType.COMMENT);
  });

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

  // Double-quoted strings (an unterminated string ends at the line end)
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = /"|(?<!\\)$/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Single-quoted strings
  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = /'|(?<!\\)$/.source;
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

  // Regular expression literals: only where an expression can start (after an
  // operator, keyword, punctuation or at the start), and only if the literal is
  // followed by something that can end an expression. `a / b / c` stays division.
  addRule(shared, 'regex_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/(?![*\/])(?:\\.|\[(?:\\.|[^\]\\])*\]|[^\/\\\[])+\/[dgimsuvy]*(?=\s*(?:[,;)\]}.:?]|&&|\|\||$))/.source;
    r.context = {
      afterTokenType: [TokenType.OPERATOR, TokenType.PUNCTUATION, TokenType.KEYWORD, null],
    };
    r.action = action(TokenType.REGEXP);
  });

  // Numbers: hex/bin/oct, then decimal/float with exponent; `_` separators, BigInt `n`
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*n?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_bin', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[bB][01](?:_?[01])*n?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_oct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[oO][0-7](?:_?[0-7])*n?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:\b\d(?:_?\d)*\.(?:\d(?:_?\d)*)?|(?<![\w$.])\.\d(?:_?\d)*)(?:[eE][+-]?\d(?:_?\d)*)?|\b\d(?:_?\d)*[eE][+-]?\d(?:_?\d)*\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d(?:_?\d)*n?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Private class members: #name
  addRule(shared, 'private_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#[A-Za-z_$][\w$]*/.source;
    r.action = action(TokenType.PROPERTY);
  });

  // Decorators: @name, @ns.name
  addRule(shared, 'decorator', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // Operators (longest first)
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = />>>=|\.\.\.|\?\?=|\*\*=|<<=|>>=|>>>|===|!==|&&=|\|\|=|\?\.(?!\d)|=>|\?\?|\*\*|&&|\|\||<<|>>|<=|>=|==|!=|\+\+|--|[+\-*\/%&|^]=|[+\-*\/%&|^~!<>=?:]/.source;
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

  // Class declaration – register class name
  addRule(root, 'class_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(class)\\s+(${IDENT})`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // `extends Base` – base class name as TYPE (not for calls like `extends mixin(B)`)
  addRule(root, 'extends_type', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(extends)\\s+(${IDENT})(?![\\w$]|\\s*[(.])`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Function declaration – register function name (also `function* gen`)
  addRule(root, 'function_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(function)\\s*\\*?\\s*(${IDENT})(?=\\s*\\()`;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.OPERATOR; // the optional `*`
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.FUNCTION,
                         register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Contextual keywords: only keywords when followed by a name
  // (`get x()`, `accessor n`, `using res = …`), plain identifiers otherwise (`get()`).
  addRule(root, 'contextual_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<![\w$.])(?:get|set|accessor|using)(?=\s+[#\[A-Za-z_$])/.source;
    r.action = action(TokenType.KEYWORD);
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
      'new', 'this', 'delete', 'void', 'typeof', 'instanceof', 'in', 'of',
      // Modules
      'import', 'export', 'from', 'as',
      // Async / iterators
      'async', 'await', 'yield',
      // Other
      'debugger', 'with', 'static',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Function call (name followed by a parenthesis or a tagged template)
  addRule(root, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `${NOT_IDENT_BEFORE}(${IDENT})(?=\\s*\\(|\`)`;
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
    r.pattern = `\\.(${IDENT})`;
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
    r.pattern = IDENT;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Template interpolation: full expression syntax (after the brace rule)
  addRule(templateInterpolation, 'include_root', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = root.id;
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

// Modern syntax
class Counter {
    #count = 0;
    static #instances = 0;
    get value() { return this.#count; }
    increment() { this.#count++; }
}

const city = user?.address?.city ?? 'unknown';
const big = 9_007_199_254_740_993n;
const label = \`Items: \${items.map(i => \`<li>\${i}</li>\`).join('')}\`;
const words = text.split(/\\s+/u).filter(Boolean);
settings.theme ||= 'dark';
`;
  return def;
}

export function createJavaScriptLanguageStyles(jsDef) {
  const darkStyle = createHighlightStyle(jsDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
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
    createTokenStyle(TokenType.DECORATOR,     '#c8c8c8'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  const lightStyle = createHighlightStyle(jsDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#0000ff'),
    createTokenStyle(TokenType.TYPE,          '#267f99'),
    createTokenStyle(TokenType.FUNCTION,      '#795e26'),
    createTokenStyle(TokenType.VARIABLE,      '#001080'),
    createTokenStyle(TokenType.PROPERTY,      '#001080'),
    createTokenStyle(TokenType.IDENTIFIER,    '#001080'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.REGEXP,        '#811f3f'),
    createTokenStyle(TokenType.DECORATOR,     '#795e26'),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(jsDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.TYPE,          '#e5c07b'),
    createTokenStyle(TokenType.FUNCTION,      '#61afef'),
    createTokenStyle(TokenType.VARIABLE,      '#e06c75'),
    createTokenStyle(TokenType.PROPERTY,      '#e06c75'),
    createTokenStyle(TokenType.IDENTIFIER,    '#abb2bf'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.REGEXP,        '#56b6c2'),
    createTokenStyle(TokenType.DECORATOR,     '#61afef'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(jsDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.VARIABLE,      '#f8f8f2'),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.REGEXP,        '#e6db74'),
    createTokenStyle(TokenType.DECORATOR,     '#a6e22e'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(jsDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.TYPE,          '#8be9fd', { italic: true }),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.VARIABLE,      '#f8f8f2'),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.REGEXP,        '#ff5555'),
    createTokenStyle(TokenType.DECORATOR,     '#50fa7b'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(jsDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.TYPE,          '#953800'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.VARIABLE,      '#24292f'),
    createTokenStyle(TokenType.PROPERTY,      '#0550ae'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.REGEXP,        '#116329'),
    createTokenStyle(TokenType.DECORATOR,     '#8250df'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}