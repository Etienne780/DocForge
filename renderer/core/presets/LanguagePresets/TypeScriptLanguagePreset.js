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
    ['string',        TokenType.TYPE],
    ['number',        TokenType.TYPE],
    ['boolean',       TokenType.TYPE],
    ['symbol',        TokenType.TYPE],
    ['bigint',        TokenType.TYPE],
    ['object',        TokenType.TYPE],
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
  // Generic type parameters `<T, const U extends X = Y, in out V>` – register as TYPE.
  // First parameter: after a name (`Box<T>`, `f<T>(`); following ones: after a type.
  addRule(root, 'type_parameter_first', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(<)\\s*((?:(?:const|in|out)\\s+)+)?([A-Z][\\w$]*)(?=\\s*(?:extends\\b|[,>=]))`;
    r.context = { afterTokenType: [TokenType.IDENTIFIER, TokenType.TYPE, TokenType.FUNCTION, TokenType.KEYWORD] };
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.OPERATOR, register: null };
    caps.groups['2'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['3'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(root, 'type_parameter_next', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(,)\\s*((?:(?:const|in|out)\\s+)+)?([A-Z][\\w$]*)(?=\\s*(?:extends\\b|[,>=]))`;
    r.context = { afterTokenType: [TokenType.TYPE] };
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['2'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['3'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Mapped type key: `[P in keyof T]`
  addRule(root, 'mapped_type_key', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(\[)\s*([A-Z][\w$]*)(?=\s+in\b)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['2'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // `infer U` in conditional types
  addRule(root, 'infer_type', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(infer)\\s+(${IDENT})`;
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

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Class / interface / type alias / enum declaration – register the name as TYPE
  addRule(root, 'type_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(?<![\\w$.])(class|interface|type|enum)\\s+(${IDENT})(?=\\s*[<={,;]|\\s+(?:extends|implements)\\b|\\s*$)`;
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

  // Namespace declaration: namespace Name / module Name
  addRule(root, 'namespace_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(?<![\\w$.])(namespace|module)\\s+(${IDENT})(?=[\\s.{])`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = {
      tokenType: TokenType.NAMESPACE,
      register: createSymbolRegister(TokenType.NAMESPACE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // extends / implements followed by a type name
  addRule(root, 'extends_implements', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(extends|implements)\\s+(?!(?:readonly|keyof|typeof|infer|unique|new)\\b)(${IDENT})(?![\\w$]|\\s*[(.])`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Type assertion: `as Type` / `satisfies Type` (not `as const`)
  addRule(root, 'type_assertion', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `(?<!\\*\\s*)\\b(as|satisfies)\\s+(?!(?:const|unknown|any|never|keyof|typeof|readonly|unique)\\b)(${IDENT})(?![\\w$]|\\s*\\()`;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Function declaration – register function name (also `function* gen`, `function f<T>(`)
  addRule(root, 'function_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b(function)\\s*\\*?\\s*(${IDENT})(?=\\s*[(<])`;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.OPERATOR; // the optional `*`
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Contextual keywords: only keywords when followed by a name
  // (`get x()`, `accessor n`, `type X`, `unique symbol`), identifiers otherwise.
  addRule(root, 'contextual_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<![\w$.])(?:get|set|accessor|using|type|namespace|module|global|unique|out)(?=\s+[#\[A-Za-z_${'"])/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // JavaScript keywords (`void` is a type in TypeScript, see predefined symbols)
  addRule(root, 'js_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
      'break', 'continue', 'return', 'throw', 'try', 'catch', 'finally',
      'var', 'let', 'const', 'function', 'class', 'extends', 'super',
      'new', 'this', 'delete', 'typeof', 'instanceof', 'in', 'of',
      'import', 'export', 'from', 'as',
      'async', 'await', 'yield',
      'debugger', 'with', 'static',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // TypeScript-specific keywords
  addRule(root, 'ts_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'interface', 'enum', 'declare', 'abstract', 'readonly', 'override',
      'implements', 'public', 'private', 'protected',
      'keyof', 'infer', 'satisfies', 'asserts', 'is',
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

// Modern syntax
type Getters<T> = { [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K] };
type ElementOf<T> = T extends readonly (infer U)[] ? U : never;

function assertIsString(v: unknown): asserts v is string {}

class Cache<in out K, V> {
  #store = new Map<K, V>();
  private readonly limit = 1_000;
  accessor hits = 0n;
}

const routes = ["home", "about"] as const;
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

  const lightStyle = createHighlightStyle(tsDef.id, 'Light+');
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
    createTokenStyle(TokenType.NAMESPACE,     '#267f99'),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(tsDef.id, 'One Dark');
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
    createTokenStyle(TokenType.NAMESPACE,     '#e5c07b'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(tsDef.id, 'Monokai');
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
    createTokenStyle(TokenType.NAMESPACE,     '#66d9ef'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(tsDef.id, 'Dracula');
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
    createTokenStyle(TokenType.NAMESPACE,     '#8be9fd'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(tsDef.id, 'GitHub Light');
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
    createTokenStyle(TokenType.NAMESPACE,     '#953800'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}