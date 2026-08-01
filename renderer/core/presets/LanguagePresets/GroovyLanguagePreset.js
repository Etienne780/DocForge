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

export function createGroovyLanguage() {
  const def = createSyntaxDefinition('Groovy');
  def.aliases = ['groovy', 'gvy', 'gradle', 'gradle.kts'];
  def.id = 'GroovyLang';
  def.builtIn = true;
  def.symbolHoisting = true;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['byte',          TokenType.TYPE],
    ['short',         TokenType.TYPE],
    ['int',           TokenType.TYPE],
    ['long',          TokenType.TYPE],
    ['float',         TokenType.TYPE],
    ['double',        TokenType.TYPE],
    ['char',          TokenType.TYPE],
    ['boolean',       TokenType.TYPE],
    ['void',          TokenType.TYPE],
    ['Byte',          TokenType.TYPE],
    ['Short',         TokenType.TYPE],
    ['Integer',       TokenType.TYPE],
    ['Long',          TokenType.TYPE],
    ['Float',         TokenType.TYPE],
    ['Double',        TokenType.TYPE],
    ['Character',     TokenType.TYPE],
    ['Boolean',       TokenType.TYPE],
    ['String',        TokenType.TYPE],
    ['Object',        TokenType.TYPE],
    ['Class',         TokenType.TYPE],
    ['List',          TokenType.TYPE],
    ['Set',           TokenType.TYPE],
    ['Map',           TokenType.TYPE],
    ['ArrayList',     TokenType.TYPE],
    ['LinkedList',    TokenType.TYPE],
    ['HashSet',       TokenType.TYPE],
    ['TreeSet',       TokenType.TYPE],
    ['HashMap',       TokenType.TYPE],
    ['TreeMap',       TokenType.TYPE],
    ['LinkedHashMap', TokenType.TYPE],
    ['Queue',         TokenType.TYPE],
    ['Deque',         TokenType.TYPE],
    ['Stack',         TokenType.TYPE],
    ['Vector',        TokenType.TYPE],
    ['EnumSet',       TokenType.TYPE],
    ['EnumMap',       TokenType.TYPE],
    ['Range',         TokenType.TYPE],
    ['IntRange',      TokenType.TYPE],
    ['LongRange',     TokenType.TYPE],
    ['Closure',       TokenType.TYPE],
    ['GString',       TokenType.TYPE],
    ['Binding',       TokenType.TYPE],
    ['GroovyObject',  TokenType.TYPE],
    ['GroovyInterceptable', TokenType.TYPE],
    ['Script',        TokenType.TYPE],
    ['ConfigObject',  TokenType.TYPE],
    ['Project',       TokenType.TYPE],
    ['Task',          TokenType.TYPE],
    ['Configuration', TokenType.TYPE],
    ['SourceSet',     TokenType.TYPE],
    ['Dependency',    TokenType.TYPE],
    ['DependencySet', TokenType.TYPE],
    ['Artifact',      TokenType.TYPE],
    ['Publishing',    TokenType.TYPE],
    ['Repository',    TokenType.TYPE],
    ['Distribution',  TokenType.TYPE],
    ['Exception',     TokenType.TYPE],
    ['RuntimeException', TokenType.TYPE],
    ['NullPointerException', TokenType.TYPE],
    ['IndexOutOfBoundsException', TokenType.TYPE],
    ['IllegalArgumentException', TokenType.TYPE],
    ['ClassCastException', TokenType.TYPE],
    ['ArithmeticException', TokenType.TYPE],
    ['ArrayIndexOutOfBoundsException', TokenType.TYPE],
    ['StringIndexOutOfBoundsException', TokenType.TYPE],
    ['NumberFormatException', TokenType.TYPE],
    ['IllegalStateException', TokenType.TYPE],
    ['UnsupportedOperationException', TokenType.TYPE],
    ['IOException',   TokenType.TYPE],
    ['FileNotFoundException', TokenType.TYPE],
    ['EOFException',  TokenType.TYPE],
    ['InterruptedException', TokenType.TYPE],
    ['ExecutionException', TokenType.TYPE],
    ['TimeoutException', TokenType.TYPE],
    ['Override',      TokenType.DECORATOR],
    ['Deprecated',    TokenType.DECORATOR],
    ['SuppressWarnings', TokenType.DECORATOR],
    ['SafeVarargs',   TokenType.DECORATOR],
    ['FunctionalInterface', TokenType.DECORATOR],
    ['Native',        TokenType.DECORATOR],
    ['Transient',     TokenType.DECORATOR],
    ['Volatile',      TokenType.DECORATOR],
    ['Synchronized',  TokenType.DECORATOR],
    ['Strictfp',      TokenType.DECORATOR],
    ['ToString',      TokenType.DECORATOR],
    ['EqualsAndHashCode', TokenType.DECORATOR],
    ['TupleConstructor', TokenType.DECORATOR],
    ['Canonical',     TokenType.DECORATOR],
    ['InheritConstructors', TokenType.DECORATOR],
    ['Category',      TokenType.DECORATOR],
    ['Mixin',         TokenType.DECORATOR],
    ['Delegate',      TokenType.DECORATOR],
    ['Immutable',     TokenType.DECORATOR],
    ['Newify',        TokenType.DECORATOR],
    ['Sortable',      TokenType.DECORATOR],
    ['Builder',       TokenType.DECORATOR],
    ['println',       TokenType.FUNCTION],
    ['print',         TokenType.FUNCTION],
    ['printf',        TokenType.FUNCTION],
    ['say',           TokenType.FUNCTION],
    ['each',          TokenType.FUNCTION],
    ['eachWithIndex', TokenType.FUNCTION],
    ['collect',       TokenType.FUNCTION],
    ['find',          TokenType.FUNCTION],
    ['findAll',       TokenType.FUNCTION],
    ['grep',          TokenType.FUNCTION],
    ['every',         TokenType.FUNCTION],
    ['any',           TokenType.FUNCTION],
    ['sum',           TokenType.FUNCTION],
    ['join',          TokenType.FUNCTION],
    ['split',         TokenType.FUNCTION],
    ['size',          TokenType.FUNCTION],
    ['sort',          TokenType.FUNCTION],
    ['reverse',       TokenType.FUNCTION],
    ['unique',        TokenType.FUNCTION],
    ['flatten',       TokenType.FUNCTION],
    ['intersect',     TokenType.FUNCTION],
    ['disjoint',      TokenType.FUNCTION],
    ['combinations',  TokenType.FUNCTION],
    ['permutations',  TokenType.FUNCTION],
    ['inject',        TokenType.FUNCTION],
    ['with',          TokenType.FUNCTION],
    ['withGroovyBuilder', TokenType.FUNCTION],
    ['memoize',       TokenType.FUNCTION],
    ['memoizeAtLeast', TokenType.FUNCTION],
    ['memoizeAtMost', TokenType.FUNCTION],
    ['trampoline',    TokenType.FUNCTION],
    ['sleep',         TokenType.FUNCTION],
    ['assert',        TokenType.FUNCTION],
    ['require',       TokenType.FUNCTION],
    ['use',           TokenType.FUNCTION],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['null',          TokenType.LITERAL],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const gString = newState(def, 'gstring');
  const gStringEscape = newState(def, 'gstring_escape');
  const slashyString = newState(def, 'slashy_string');
  const dollarSlashyString = newState(def, 'dollar_slashy_string');
  const multilineString = newState(def, 'multiline_string');
  const multilineGString = newState(def, 'multiline_gstring');
  const blockComment = newState(def, 'block_comment');

  // Escape sequences for regular strings
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\bfnrt"']|[0-7]{1,3}|u[0-9a-fA-F]{4})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Escape sequences and interpolation for GStrings
  gStringEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(gStringEscape, 'g_escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\bfnrt"']|[0-7]{1,3}|u[0-9a-fA-F]{4})/.source;
    r.action = action(TokenType.ESCAPE);
  });
  addRule(gStringEscape, 'gstring_interp', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$\{[^}]*\}|\$[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted string content
  strSingle.onUnmatched = OnUnmatched.CHARACTER;

  // GString content
  gString.onUnmatched = OnUnmatched.CHARACTER;
  addRule(gString, 'include_g_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = gStringEscape.id;
  });

  // Slashy string content
  slashyString.onUnmatched = OnUnmatched.CHARACTER;
  slashyString.contentTokenType = TokenType.STRING;
  addRule(slashyString, 'slashy_interp', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$\{[^}]*\}|\$[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Dollar-slashy string content
  dollarSlashyString.onUnmatched = OnUnmatched.CHARACTER;
  dollarSlashyString.contentTokenType = TokenType.STRING;
  addRule(dollarSlashyString, 'dollar_interp', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$\{[^}]*\}|\$[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Multiline string content
  multilineString.onUnmatched = OnUnmatched.CHARACTER;
  multilineString.contentTokenType = TokenType.STRING;

  // Multiline GString content
  multilineGString.onUnmatched = OnUnmatched.CHARACTER;
  multilineGString.contentTokenType = TokenType.STRING;
  addRule(multilineGString, 'ml_gstring_interp', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$\{[^}]*\}|\$[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Common rules
  addRule(common, 'java_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch',
      'char', 'class', 'const', 'continue', 'default', 'do', 'double',
      'else', 'enum', 'extends', 'final', 'finally', 'float', 'for',
      'goto', 'if', 'implements', 'import', 'instanceof', 'int',
      'interface', 'long', 'native', 'new', 'package', 'private',
      'protected', 'public', 'return', 'short', 'static', 'strictfp',
      'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
      'transient', 'try', 'void', 'volatile', 'while',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'groovy_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'def', 'in', 'as', 'trait', 'with', 'mixin', 'category', 'property',
      'delegate', 'immutable', 'canonical', 'tuple', 'sortable',
      'builder', 'script', 'memoized', 'tailrecursive', 'variable',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'annotation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.DECORATOR);
  });

  addRule(common, 'type_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(class|interface|enum|trait)\s+([A-Za-z_]\w*)(?:\s*<[^>]*>)?/.source;
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

  addRule(common, 'method_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(def)\s+([A-Za-z_]\w*)\s*\(/.source;
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

  addRule(common, 'method_call', r => {
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

  addRule(common, 'closure_arrow', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /->/.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules
  addRule(shared, 'shebang', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^#!.*/.source;
    r.action = action(TokenType.KEYWORD);
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

  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  addRule(shared, 'gstring', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, gString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = gString.id;
  });

  addRule(shared, 'multiline_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /'''/.source;
    r.end   = /'''/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, multilineString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = multilineString.id;
  });

  addRule(shared, 'multiline_gstring', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /"""/.source;
    r.end   = /"""/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, multilineGString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = multilineGString.id;
  });

  // Slashy string: /.../
  addRule(shared, 'slashy_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/(?!\/)/.source;
    r.end   = /\/(?!\/)/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, slashyString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = slashyString.id;
  });

  // Dollar-slashy string: $/.../$
  addRule(shared, 'dollar_slashy_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\$\//;
    r.end   = /\/\$/;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, dollarSlashyString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = dollarSlashyString.id;
  });

  addRule(shared, 'char_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /'(?:\\.|[^'\\])'/.source;
    r.action = action(TokenType.STRING);
  });

  // Numbers
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
    r.pattern = /\b0[0-7_]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.\d*(?:[eE][+-]?\d+)?[fFdD]?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_big', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+[gG]\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|>>>|<=|>=|==|!=|&&|\|\||\?|:|=|\.\.|\.\.<|\.\.\.|->/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules – line comments first to prevent conflict with slashy strings
  addRule(root, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });

  // Example code
  def.exampleCode = `#!/usr/bin/env groovy
// This is a comment

// Variables and types
def name = "Alice"
def age = 30
def pi = 3.14159
def isAdult = age >= 18

// GString interpolation
def greeting = "Hello, $name! You are \${age} years old."

// Lists
def numbers = [1, 2, 3, 4, 5]
def mixed = [1, "two", 3.0, true]

// Maps
def person = [name: "Alice", age: 30, email: "alice@example.com"]

// Ranges
def range = 1..10
def inclusiveRange = 1..10
def exclusiveRange = 1..<10

// Closures
def add = { a, b -> a + b }
println add(3, 4)

// Closure with implicit parameter (it)
def doubled = numbers.collect { it * 2 }

// Method definition
def greet(person) {
    return "Hello, \${person.name}!"
}

// Class definition
class Person {
    String name
    int age

    String toString() {
        return "Person(name: \${name}, age: \${age})"
    }
}

// Trait
trait Greetable {
    String greet() { return "Hello!" }
}

// Using trait
class Employee extends Person implements Greetable {
    String department
}

// Conditionals
if (age > 18) {
    println "Adult"
} else if (age == 18) {
    println "Just turned 18"
} else {
    println "Minor"
}

// Switch with Groovy's flexible case
switch (age) {
    case 0..17: println "Minor"; break
    case 18: println "Just turned 18"; break
    case 19..150: println "Adult"; break
    default: println "Invalid age"
}

// Loops
for (i in 0..4) {
    println "i = \$i"
}

numbers.each { println it }

// While loop
def count = 0
while (count < 3) {
    println "count = \$count"
    count++
}

// String operations
def text = "Hello, world!"
def words = text.split(',')
def upper = text.toUpperCase()
def contains = text.contains("world")

// Regular expressions
def regex = /[a-z]+/
def matcher = ("Hello World" =~ /[A-Z][a-z]+/)
matcher.each { println it }

// Slashy string (regex)
def pattern = /\\d{3}-\\d{2}-\\d{4}/

// Dollar-slashy string
def path = \$/C:\\Users\\\${user}/$

// Multiline string
def multiline = '''This is a
multiline string
without interpolation.'''

// Multiline GString
def multiGString = """Hello, \$name!
This is a multiline GString
with interpolation."""

// Safe navigation operator
def emailLength = person?.email?.length() ?: 0

// Elvis operator
def displayName = person.name ?: "Unknown"

// Spread operator
def names = ["Alice", "Bob", "Charlie"]
def upperNames = names*.toUpperCase()

// Method with default parameter
def greetWithTitle(name, title = "Mr./Ms.") {
    return "Hello, \$title \$name!"
}

// Using annotations
@ToString
class AnnotatedClass {
    String field
}

// Gradle-like DSL
buildscript {
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:7.0.0'
    }
}

apply plugin: 'java'

dependencies {
    implementation 'org.springframework:spring-core:5.3.0'
    testImplementation 'junit:junit:4.13.2'
}

// Script execution
println "Script executed at \${new Date()}"

// Return value
return 0
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
    createTokenStyle(TokenType.NAMESPACE,     '#4ec9b0'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];
  def.styles.push(style);

  return def;
}