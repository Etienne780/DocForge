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

export function createSwiftLanguage() {
  const def = createSyntaxDefinition('Swift');
  def.aliases = ['swift'];
  def.id = 'SwiftLang';
  def.builtIn = true;
  def.symbolHoisting = true;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['Int',           TokenType.TYPE],
    ['Int8',          TokenType.TYPE],
    ['Int16',         TokenType.TYPE],
    ['Int32',         TokenType.TYPE],
    ['Int64',         TokenType.TYPE],
    ['UInt',          TokenType.TYPE],
    ['UInt8',         TokenType.TYPE],
    ['UInt16',        TokenType.TYPE],
    ['UInt32',        TokenType.TYPE],
    ['UInt64',        TokenType.TYPE],
    ['Float',         TokenType.TYPE],
    ['Double',        TokenType.TYPE],
    ['Bool',          TokenType.TYPE],
    ['String',        TokenType.TYPE],
    ['Character',     TokenType.TYPE],
    ['Void',          TokenType.TYPE],
    ['Any',           TokenType.TYPE],
    ['AnyObject',     TokenType.TYPE],
    ['Never',         TokenType.TYPE],
    ['Array',         TokenType.TYPE],
    ['Dictionary',    TokenType.TYPE],
    ['Set',           TokenType.TYPE],
    ['Range',         TokenType.TYPE],
    ['ClosedRange',   TokenType.TYPE],
    ['CountableRange', TokenType.TYPE],
    ['CountableClosedRange', TokenType.TYPE],
    ['Sequence',      TokenType.TYPE],
    ['Collection',    TokenType.TYPE],
    ['IteratorProtocol', TokenType.TYPE],
    ['Optional',      TokenType.TYPE],
    ['ImplicitlyUnwrappedOptional', TokenType.TYPE],
    ['Date',          TokenType.TYPE],
    ['URL',           TokenType.TYPE],
    ['URLComponents', TokenType.TYPE],
    ['URLRequest',    TokenType.TYPE],
    ['HTTPURLResponse', TokenType.TYPE],
    ['Data',          TokenType.TYPE],
    ['UUID',          TokenType.TYPE],
    ['UserDefaults',  TokenType.TYPE],
    ['Notification',  TokenType.TYPE],
    ['NotificationCenter', TokenType.TYPE],
    ['Bundle',        TokenType.TYPE],
    ['Locale',        TokenType.TYPE],
    ['TimeZone',      TokenType.TYPE],
    ['Calendar',      TokenType.TYPE],
    ['DateComponents', TokenType.TYPE],
    ['IndexPath',     TokenType.TYPE],
    ['CGRect',        TokenType.TYPE],
    ['CGSize',        TokenType.TYPE],
    ['CGPoint',       TokenType.TYPE],
    ['NSRange',       TokenType.TYPE],
    ['View',          TokenType.TYPE],
    ['Text',          TokenType.TYPE],
    ['Button',        TokenType.TYPE],
    ['Image',         TokenType.TYPE],
    ['VStack',        TokenType.TYPE],
    ['HStack',        TokenType.TYPE],
    ['ZStack',        TokenType.TYPE],
    ['List',          TokenType.TYPE],
    ['NavigationView', TokenType.TYPE],
    ['TabView',       TokenType.TYPE],
    ['Color',         TokenType.TYPE],
    ['Font',          TokenType.TYPE],
    ['Binding',       TokenType.TYPE],
    ['ObservedObject', TokenType.TYPE],
    ['State',         TokenType.TYPE],
    ['StateObject',   TokenType.TYPE],
    ['Environment',   TokenType.TYPE],
    ['EnvironmentObject', TokenType.TYPE],
    ['Published',     TokenType.TYPE],
    ['App',           TokenType.TYPE],
    ['Scene',         TokenType.TYPE],
    ['WindowGroup',   TokenType.TYPE],
    ['Equatable',     TokenType.TYPE],
    ['Hashable',      TokenType.TYPE],
    ['Codable',       TokenType.TYPE],
    ['Decodable',     TokenType.TYPE],
    ['Encodable',     TokenType.TYPE],
    ['Comparable',    TokenType.TYPE],
    ['Identifiable',  TokenType.TYPE],
    ['CaseIterable',  TokenType.TYPE],
    ['CustomStringConvertible', TokenType.TYPE],
    ['CustomDebugStringConvertible', TokenType.TYPE],
    ['print',         TokenType.FUNCTION],
    ['debugPrint',    TokenType.FUNCTION],
    ['dump',          TokenType.FUNCTION],
    ['assert',        TokenType.FUNCTION],
    ['precondition',  TokenType.FUNCTION],
    ['fatalError',    TokenType.FUNCTION],
    ['abs',           TokenType.FUNCTION],
    ['min',           TokenType.FUNCTION],
    ['max',           TokenType.FUNCTION],
    ['zip',           TokenType.FUNCTION],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['nil',           TokenType.LITERAL],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strEscape = newState(def, 'string_escape');
  const rawString = newState(def, 'raw_string');
  const multilineString = newState(def, 'multiline_string');
  const blockComment = newState(def, 'block_comment');
  const nestedComment = newState(def, 'nested_comment');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\"nrt0]|[0-7]{1,3}|x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]{1,8}\})/.source;
    r.action = action(TokenType.ESCAPE);
  });
  addRule(strEscape, 'interpolation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\\([^)]*\)/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Raw strings
  rawString.onUnmatched = OnUnmatched.CHARACTER;
  rawString.contentTokenType = TokenType.STRING;

  // Multiline strings
  multilineString.onUnmatched = OnUnmatched.CHARACTER;
  multilineString.contentTokenType = TokenType.STRING;
  addRule(multilineString, 'ml_interpolation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\\([^)]*\)/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  nestedComment.onUnmatched = OnUnmatched.CHARACTER;
  nestedComment.contentTokenType = TokenType.COMMENT;

  // Common rules
  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'associatedtype', 'class', 'deinit', 'enum', 'extension', 'fileprivate',
      'func', 'import', 'init', 'inout', 'internal', 'let', 'open', 'operator',
      'private', 'protocol', 'public', 'rethrows', 'static', 'struct', 'subscript',
      'typealias', 'var', 'break', 'case', 'continue', 'default', 'defer', 'do',
      'else', 'fallthrough', 'for', 'guard', 'if', 'in', 'repeat', 'return',
      'switch', 'where', 'while', 'as', 'catch', 'is', 'super', 'self',
      'Self', 'throws', 'throw', 'try', 'await', 'async',
      'some', 'any', 'actor', 'distributed', 'nonisolated',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'modifiers', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'open', 'public', 'internal', 'fileprivate', 'private',
      'static', 'class', 'final', 'override', 'required', 'optional',
      'convenience', 'dynamic', 'lazy', 'weak', 'unowned',
      'mutating', 'nonmutating', 'indirect', 'typealias',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'type_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(class|struct|enum|protocol|actor)\s+([A-Za-z_]\w*)(?:\s*<[^>]*>)?/.source;
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

  addRule(common, 'typealias_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\btypealias\s+([A-Za-z_]\w*)\s*=/.source;
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
    r.pattern = /\bfunc\s+([A-Za-z_]\w*)\s*[<(]/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
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

  addRule(common, 'property_wrapper', r => {
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
  // Nested block comments: /* /* ... */ */
  addRule(blockComment, 'nested_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, nestedComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = nestedComment.id;
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

  addRule(shared, 'raw_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /#"/.source;
    r.end   = /"#/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, rawString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = rawString.id;
  });

  addRule(shared, 'multiline_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /"""/.source;
    r.end   = /"""/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, multilineString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = multilineString.id;
  });

  addRule(shared, 'char_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /'(?:\\.|[^'\\])'/.source;
    r.action = action(TokenType.STRING);
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
    r.pattern = /\b\d+\.\d*(?:[eE][+-]?\d+)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|<=|>=|==|!=|&&|\|\||\.{3}|\.\.|\.\.<|->|\?|\?!|\./.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.]/.source;
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
  def.exampleCode = `//
//  Person.swift
//  A Swift example demonstrating language features
//

import Foundation
import SwiftUI

// MARK: - Protocols

/// A protocol for things that can be greeted
protocol Greetable {
    func greet() -> String
}

// MARK: - Structs

/// A simple Person struct
struct Person: Codable, Equatable, Hashable, Greetable {
    // Stored properties
    var name: String
    var age: Int
    var email: String?
    
    // Computed property
    var isAdult: Bool {
        age >= 18
    }
    
    // Method
    func greet() -> String {
        return "Hello, my name is \\(name) and I'm \\(age) years old."
    }
    
    // Mutating method
    mutating func haveBirthday() {
        age += 1
    }
}

// MARK: - Enums

enum Status: String, CaseIterable {
    case active = "Active"
    case inactive = "Inactive"
    case pending = "Pending"
}

enum Result<T> {
    case success(T)
    case failure(Error)
}

// MARK: - Class with inheritance

class Animal {
    let name: String
    
    init(name: String) {
        self.name = name
    }
    
    func speak() -> String {
        return "\\(name) makes a sound"
    }
}

class Dog: Animal {
    override func speak() -> String {
        return "\\(name) barks!"
    }
}

// MARK: - Protocol Extension

extension Greetable {
    func greetWithExclamation() -> String {
        return greet() + "!"
    }
}

// MARK: - Functions

// Simple function
func greetPerson(_ person: Person) -> String {
    return person.greet()
}

// Function with multiple return values (tuple)
func divide(_ a: Int, by b: Int) -> (quotient: Int, remainder: Int) {
    return (a / b, a % b)
}

// Generic function
func identity<T>(_ value: T) -> T {
    return value
}

// Function with variadic parameter
func sum(_ numbers: Int...) -> Int {
    return numbers.reduce(0, +)
}

// Throwing function
func readFile(at path: String) throws -> String {
    guard !path.isEmpty else {
        throw NSError(domain: "FileError", code: 1)
    }
    return "File content"
}

// Async function
func fetchData() async throws -> String {
    try await Task.sleep(nanoseconds: 1_000_000_000)
    return "Data loaded"
}

// MARK: - Extensions

extension String {
    var isEmail: Bool {
        contains("@") && contains(".")
    }
    
    func trimmed() -> String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

extension Array where Element: Comparable {
    func sortedAscending() -> [Element] {
        sorted(by: <)
    }
}

// MARK: - Main execution

func main() async {
    // MARK: Variables and constants
    let name = "Alice"
    var age = 30
    let isAdult = age >= 18
    
    // Optionals
    var optionalString: String?
    optionalString = "Hello"
    let unwrapped = optionalString ?? "Default"
    
    // Optional binding
    if let value = optionalString {
        print("Value: \\(value)")
    }
    
    // Guard statement
    guard let safeString = optionalString else {
        print("No value")
        return
    }
    print(safeString)
    
    // MARK: Collections
    let numbers = [1, 2, 3, 4, 5]
    let doubled = numbers.map { $0 * 2 }
    let evens = numbers.filter { $0 % 2 == 0 }
    let sum = numbers.reduce(0, +)
    
    // Dictionary
    var personDict: [String: Any] = [
        "name": "Alice",
        "age": 30
    ]
    
    // Set
    let uniqueNumbers: Set<Int> = [1, 2, 3, 3, 4]
    
    // MARK: Control flow
    if age >= 18 {
        print("Adult")
    } else {
        print("Minor")
    }
    
    switch age {
    case 0..<18:
        print("Minor")
    case 18:
        print("Just turned 18")
    default:
        print("Adult")
    }
    
    for i in 0..<5 {
        print("i = \\(i)")
    }
    
    var counter = 0
    while counter < 3 {
        print("counter = \\(counter)")
        counter += 1
    }
    
    repeat {
        print("At least once")
        counter += 1
    } while counter < 5
    
    // MARK: Closures
    let add = { (a: Int, b: Int) -> Int in
        return a + b
    }
    
    let multiply: (Int, Int) -> Int = { $0 * $1 }
    print(add(3, 4))
    print(multiply(3, 4))
    
    // Trailing closure
    let sorted = numbers.sorted { $0 > $1 }
    
    // MARK: Classes and structs
    let person = Person(name: "Alice", age: 30)
    print(person.greet())
    
    var mutablePerson = person
    mutablePerson.haveBirthday()
    
    // MARK: Enums
    let status = Status.active
    print(status.rawValue)
    print(Status.allCases)
    
    // MARK: Optional chaining
    let emailLength = person.email?.count ?? 0
    
    // MARK: Error handling
    do {
        let content = try readFile(at: "data.txt")
        print(content)
    } catch {
        print("Error: \\(error)")
    }
    
    // MARK: Async/await
    do {
        let data = try await fetchData()
        print(data)
    } catch {
        print("Async error: \\(error)")
    }
    
    // MARK: Extensions
    print("test@email.com".isEmail)
    print("  trimmed  ".trimmed())
    
    // MARK: Type casting
    let animal: Animal = Dog(name: "Rex")
    if let dog = animal as? Dog {
        print(dog.speak())
    }
    
    // MARK: Property wrappers
    @propertyWrapper
    struct TwelveOrLess {
        private var number = 0
        
        init() {}
        
        var wrappedValue: Int {
            get { return number }
            set { number = min(newValue, 12) }
        }
    }
}

// MARK: - SwiftUI View

struct ContentView: View {
    @State private var count = 0
    @State private var name = "Alice"
    @ObservedObject var viewModel: Person
    
    var body: some View {
        VStack {
            Text("Hello, \\(name)!")
                .font(.largeTitle)
            Button("Tap me!") {
                count += 1
            }
            Text("Count: \\(count)")
        }
    }
}`;
  return def;
}

export function createSwiftLanguageStyles(swiftDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(swiftDef.id, 'Dark+');
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
    createTokenStyle(TokenType.NAMESPACE,     '#4ec9b0'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  return [darkStyle];
}