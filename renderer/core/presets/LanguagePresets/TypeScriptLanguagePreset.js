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

export function createTypeScriptLanguage() {
  const def = createSyntaxDefinition('TypeScript');
  def.aliases = ['ts', 'typescript', 'tsx'];
  def.id = 'TypeScriptLang';
  def.builtIn = true;
  def.symbolHoisting = true;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols (includes all JS globals + TS-specific)
  const predefined = [
    // JavaScript global objects
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
    // TypeScript-specific types
    ['any',           TokenType.TYPE],
    ['unknown',       TokenType.TYPE],
    ['never',         TokenType.TYPE],
    ['void',          TokenType.TYPE],
    ['undefined',     TokenType.LITERAL],
    ['null',          TokenType.LITERAL],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['Infinity',      TokenType.LITERAL],
    ['NaN',           TokenType.LITERAL],
    ['globalThis',    TokenType.LITERAL],
    // Node.js
    ['Buffer',        TokenType.TYPE],
    ['process',       TokenType.VARIABLE],
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

  // Double-quoted strings
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted strings
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Template literals
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

  // Regular expression literals
  regexLiteral.onUnmatched = OnUnmatched.CHARACTER;
  regexLiteral.contentTokenType = TokenType.REGEXP;

  // Shared rules
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

  addRule(shared, 'template_literal', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /`/.source;
    r.end   = /`/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, templateLiteral.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = templateLiteral.id;
  });

  addRule(shared, 'regex_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/(?:[^\/\\\n\r]|\\.)+\/[gimsuy]*(?=\s*[,;)}\])]|$)/.source;
    r.context = {
      afterTokenType: [TokenType.OPERATOR, TokenType.PUNCTUATION, TokenType.KEYWORD, TokenType.LITERAL, TokenType.IDENTIFIER]
    };
    r.action = action(TokenType.REGEXP);
  });

  // Numbers
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

  // JavaScript keywords (same as JS)
  addRule(root, 'js_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
      'break', 'continue', 'return', 'throw', 'try', 'catch', 'finally',
      'var', 'let', 'const', 'function', 'class', 'extends', 'super',
      'new', 'this', 'delete', 'void', 'typeof', 'instanceof', 'in',
      'import', 'export', 'default', 'from', 'as',
      'async', 'await', 'yield', 'generator',
      'debugger', 'with', 'get', 'set', 'static',
      'eval', 'arguments',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // TypeScript-specific keywords
  addRule(root, 'ts_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'type', 'interface', 'enum', 'namespace', 'module', 'declare',
      'abstract', 'readonly', 'override', 'implements',
      'keyof', 'infer', 'satisfies',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Type annotations: : Type (capture the type name)
  addRule(root, 'type_annotation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /:\s*([A-Za-z_]\w*(?:<[^>]*>)?)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.TYPE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Type assertion: as Type
  addRule(root, 'type_assertion', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bas\s+([A-Za-z_]\w*(?:<[^>]*>)?)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.TYPE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // extends / implements followed by type name
  addRule(root, 'extends_implements', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(extends|implements)\s+([A-Za-z_]\w*(?:<[^>]*>)?)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Type alias: type Name = ...
  addRule(root, 'type_alias', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\btype\s+([A-Za-z_]\w*)\s*=\s*/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Interface declaration: interface Name
  addRule(root, 'interface_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\binterface\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Enum declaration: enum Name
  addRule(root, 'enum_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\benum\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Namespace declaration: namespace Name
  addRule(root, 'namespace_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bnamespace\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.NAMESPACE,
      register: createSymbolRegister(TokenType.NAMESPACE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Class declaration – register class name
  addRule(root, 'class_declaration', r => {
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

  // Function declaration – register function name
  addRule(root, 'function_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bfunction\s+([A-Za-z_]\w*)\s*\(/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

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

  // Method call (object.method)
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

  // Decorators: @decorator
  addRule(root, 'decorator', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // Generic type parameters: <T>
  // We capture the inner type names and color them as TYPE
  addRule(root, 'generic_type', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /<([A-Za-z_]\w*)>/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.TYPE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Generic function call: func<T>(...)
  addRule(root, 'generic_function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*<([A-Za-z_]\w*)>/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE, register: null };
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
  def.exampleCode = `// TypeScript example
interface Person {
  name: string;
  age: number;
  email?: string;
  readonly id: number;
}

type User = {
  username: string;
  password: string;
} & Person;

enum Color {
  Red = 1,
  Green = 2,
  Blue = 3,
}

class Employee implements Person {
  constructor(
    public name: string,
    public age: number,
    public id: number,
    public department: string
  ) {}

  getInfo(): string {
    return \`\${this.name} (\${this.age}) - \${this.department}\`;
  }
}

function greet<T extends Person>(person: T): string {
  return \`Hello, \${person.name}!\`;
}

const alice: Person = {
  name: "Alice",
  age: 30,
  id: 123,
};

const result = greet(alice);

type AsyncResult<T> = Promise<T> | T;

async function fetchData(): Promise<User> {
  const response = await fetch('/api/user');
  const data = await response.json();
  return data as User;
}

// Generic function call
const nums: Array<number> = [1, 2, 3];
const first = nums[0];

// Decorator
@sealed
class MyClass {
  @log
  method() {}
}

// Type assertion
const value = someValue as string;

// Nullish coalescing
const name = user?.name ?? "Unknown";

// Conditional types (simplified)
type IsString<T> = T extends string ? true : false;

// Namespace
namespace MyNamespace {
  export const x = 10;
}

// Module declaration (ambient)
declare module "some-module" {
  export function doSomething(): void;
}

// Satisfies operator
const config = { host: "localhost", port: 8080 } satisfies { host: string; port: number };

export { Person, User, Employee, greet };
`;
  return def;
}

export function createTypeScriptLanguageStyles(tsDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(tsDef.id, 'Dark+');
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
    createTokenStyle(TokenType.NAMESPACE,     '#4ec9b0'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  return [darkStyle];
}