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

export function createRubyLanguage() {
  const def = createSyntaxDefinition('Ruby');
  def.aliases = ['rb', 'ruby', 'ruby3'];
  def.id = 'RubyLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['$LOAD_PATH',    TokenType.VARIABLE],
    ['$LOADED_FEATURES', TokenType.VARIABLE],
    ['$PROGRAM_NAME', TokenType.VARIABLE],
    ['$0',            TokenType.VARIABLE],
    ['$?',            TokenType.VARIABLE],
    ['$!',            TokenType.VARIABLE],
    ['$@',            TokenType.VARIABLE],
    ['$;',            TokenType.VARIABLE],
    ['$,',            TokenType.VARIABLE],
    ['$\\',           TokenType.VARIABLE],
    ['$/',            TokenType.VARIABLE],
    ['$_',            TokenType.VARIABLE],
    ['$~',            TokenType.VARIABLE],
    ['$`',            TokenType.VARIABLE],
    ["$'",            TokenType.VARIABLE],
    ['$+',            TokenType.VARIABLE],
    ['$=',            TokenType.VARIABLE],
    ['$:',            TokenType.VARIABLE],
    ['$DEBUG',        TokenType.VARIABLE],
    ['$FILENAME',     TokenType.VARIABLE],
    ['$stdin',        TokenType.VARIABLE],
    ['$stdout',       TokenType.VARIABLE],
    ['$stderr',       TokenType.VARIABLE],
    ['$VERBOSE',      TokenType.VARIABLE],
    ['$SAFE',         TokenType.VARIABLE],
    ['__FILE__',      TokenType.LITERAL],
    ['__LINE__',      TokenType.LITERAL],
    ['__ENCODING__',  TokenType.LITERAL],
    ['RUBY_VERSION',  TokenType.LITERAL],
    ['RUBY_RELEASE_DATE', TokenType.LITERAL],
    ['RUBY_PLATFORM', TokenType.LITERAL],
    ['RUBY_ENGINE',   TokenType.LITERAL],
    ['RUBY_DESCRIPTION', TokenType.LITERAL],
    ['TOPLEVEL_BINDING', TokenType.LITERAL],
    ['Object',        TokenType.TYPE],
    ['Array',         TokenType.TYPE],
    ['String',        TokenType.TYPE],
    ['Integer',       TokenType.TYPE],
    ['Float',         TokenType.TYPE],
    ['Hash',          TokenType.TYPE],
    ['Symbol',        TokenType.TYPE],
    ['Proc',          TokenType.TYPE],
    ['Method',        TokenType.TYPE],
    ['UnboundMethod', TokenType.TYPE],
    ['Regexp',        TokenType.TYPE],
    ['MatchData',     TokenType.TYPE],
    ['Range',         TokenType.TYPE],
    ['File',          TokenType.TYPE],
    ['Dir',           TokenType.TYPE],
    ['Time',          TokenType.TYPE],
    ['Date',          TokenType.TYPE],
    ['DateTime',      TokenType.TYPE],
    ['Thread',        TokenType.TYPE],
    ['Mutex',         TokenType.TYPE],
    ['Queue',         TokenType.TYPE],
    ['SizedQueue',    TokenType.TYPE],
    ['Exception',     TokenType.TYPE],
    ['StandardError', TokenType.TYPE],
    ['TypeError',     TokenType.TYPE],
    ['ArgumentError', TokenType.TYPE],
    ['RuntimeError',  TokenType.TYPE],
    ['NoMethodError', TokenType.TYPE],
    ['NameError',     TokenType.TYPE],
    ['IndexError',    TokenType.TYPE],
    ['KeyError',      TokenType.TYPE],
    ['StopIteration', TokenType.TYPE],
    ['IO',            TokenType.TYPE],
    ['Enumerator',    TokenType.TYPE],
    ['Struct',        TokenType.TYPE],
    ['OpenStruct',    TokenType.TYPE],
    ['Kernel',        TokenType.NAMESPACE],
    ['Enumerable',    TokenType.NAMESPACE],
    ['Comparable',    TokenType.NAMESPACE],
    ['JSON',          TokenType.NAMESPACE],
    ['Math',          TokenType.NAMESPACE],
    ['Process',       TokenType.NAMESPACE],
    ['GC',            TokenType.NAMESPACE],
    ['puts',          TokenType.FUNCTION],
    ['print',         TokenType.FUNCTION],
    ['p',             TokenType.FUNCTION],
    ['gets',          TokenType.FUNCTION],
    ['require',       TokenType.FUNCTION],
    ['require_relative', TokenType.FUNCTION],
    ['load',          TokenType.FUNCTION],
    ['autoload',      TokenType.FUNCTION],
    ['exit',          TokenType.FUNCTION],
    ['abort',         TokenType.FUNCTION],
    ['sleep',         TokenType.FUNCTION],
    ['system',        TokenType.FUNCTION],
    ['exec',          TokenType.FUNCTION],
    ['fork',          TokenType.FUNCTION],
    ['spawn',         TokenType.FUNCTION],
    ['raise',         TokenType.FUNCTION],
    ['fail',          TokenType.FUNCTION],
    ['catch',         TokenType.FUNCTION],
    ['throw',         TokenType.FUNCTION],
    ['loop',          TokenType.FUNCTION],
    ['trap',          TokenType.FUNCTION],
    ['at_exit',       TokenType.FUNCTION],
    ['lambda',        TokenType.FUNCTION],
    ['proc',          TokenType.FUNCTION],
    ['eval',          TokenType.FUNCTION],
    ['binding',       TokenType.FUNCTION],
    ['local_variables', TokenType.FUNCTION],
    ['instance_variables', TokenType.FUNCTION],
    ['class_variables', TokenType.FUNCTION],
    ['global_variables', TokenType.FUNCTION],
    ['define_singleton_method', TokenType.FUNCTION],
    ['respond_to?',   TokenType.FUNCTION],
    ['method_missing',TokenType.FUNCTION],
    ['map',           TokenType.FUNCTION],
    ['collect',       TokenType.FUNCTION],
    ['select',        TokenType.FUNCTION],
    ['find_all',      TokenType.FUNCTION],
    ['reject',        TokenType.FUNCTION],
    ['grep',          TokenType.FUNCTION],
    ['inject',        TokenType.FUNCTION],
    ['reduce',        TokenType.FUNCTION],
    ['each',          TokenType.FUNCTION],
    ['each_with_index', TokenType.FUNCTION],
    ['any?',          TokenType.FUNCTION],
    ['all?',          TokenType.FUNCTION],
    ['none?',         TokenType.FUNCTION],
    ['one?',          TokenType.FUNCTION],
    ['count',         TokenType.FUNCTION],
    ['first',         TokenType.FUNCTION],
    ['last',          TokenType.FUNCTION],
    ['min',           TokenType.FUNCTION],
    ['max',           TokenType.FUNCTION],
    ['minmax',        TokenType.FUNCTION],
    ['sort',          TokenType.FUNCTION],
    ['sort_by',       TokenType.FUNCTION],
    ['group_by',      TokenType.FUNCTION],
    ['partition',     TokenType.FUNCTION],
    ['zip',           TokenType.FUNCTION],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const heredocContent = newState(def, 'heredoc_content');
  const regexLiteral = newState(def, 'regex_literal');
  const symbolString = newState(def, 'symbol_string');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]{1,6}\}|[^0-9xu])/.source;
    r.action = action(TokenType.ESCAPE);
  });
  addRule(strEscape, 'var_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#\{[^}]*}/.source;
    r.action = action(TokenType.VARIABLE);
  });
  addRule(strEscape, 'global_var_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*|\$[0-9*#@?_-]/.source;
    r.action = action(TokenType.VARIABLE);
  });
  addRule(strEscape, 'instance_var_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });
  addRule(strEscape, 'class_var_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted strings
  strSingle.onUnmatched = OnUnmatched.CHARACTER;

  // Symbol strings
  symbolString.onUnmatched = OnUnmatched.CHARACTER;
  addRule(symbolString, 'symbol_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Heredoc content
  heredocContent.onUnmatched = OnUnmatched.CHARACTER;
  addRule(heredocContent, 'var_in_heredoc', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#\{[^}]*}/.source;
    r.action = action(TokenType.VARIABLE);
  });
  addRule(heredocContent, 'global_in_heredoc', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*|\$[0-9*#@?_-]/.source;
    r.action = action(TokenType.VARIABLE);
  });
  addRule(heredocContent, 'instance_in_heredoc', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });
  addRule(heredocContent, 'class_in_heredoc', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Regex literals
  regexLiteral.onUnmatched = OnUnmatched.CHARACTER;
  regexLiteral.contentTokenType = TokenType.REGEXP;

  // Common rules
  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'BEGIN', 'END', 'alias', 'and', 'begin', 'break', 'case', 'class',
      'def', 'defined?', 'do', 'else', 'elsif', 'end', 'ensure', 'false',
      'for', 'if', 'in', 'module', 'next', 'nil', 'not', 'or', 'redo',
      'rescue', 'retry', 'return', 'self', 'super', 'then', 'true',
      'undef', 'unless', 'until', 'when', 'while', 'yield',
      '__LINE__', '__FILE__', '__ENCODING__',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'class_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(class|module)\s+([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)/.source;
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
    r.pattern = /\bdef\s+(?:self\.)?([A-Za-z_]\w*)[?!]?\s*(?=\()/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'method_definition_simple', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bdef\s+(?:self\.)?([A-Za-z_]\w*)[?!]?\s*$/.source;
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
    r.pattern = /\b([A-Za-z_]\w*[?!]?)\s*\(/.source;
    r.context = { notAfterTokenType: [TokenType.KEYWORD, TokenType.TYPE] };
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'symbol', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /:[A-Za-z_]\w*[?!]?/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  addRule(common, 'symbol_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /:"/.source;
    r.end   = /"/.source;
    r.beginAction = action(TokenType.IDENTIFIER, createSyntaxStateTransition(TransitionType.PUSH, symbolString.id));
    r.endAction   = action(TokenType.IDENTIFIER, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = symbolString.id;
  });

  addRule(common, 'symbol_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /:'/.source;
    r.end   = /'/.source;
    r.beginAction = action(TokenType.IDENTIFIER, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.IDENTIFIER, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  addRule(common, 'constant', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Z]\w*/.source;
    r.action = action(TokenType.TYPE);
  });

  addRule(common, 'instance_var', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(common, 'class_var', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(common, 'global_var', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*|\$[0-9*#@?_-]/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*[?!]?/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  addRule(shared, 'block_comment_begin', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /^=begin/.source;
    r.end   = /^=end/.source;
    r.beginAction = action(TokenType.COMMENT);
    r.endAction   = action(TokenType.COMMENT);
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = newState(def, 'block_comment').id;
    def.states[def.states.length - 1].onUnmatched = OnUnmatched.CHARACTER;
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

  addRule(shared, 'heredoc', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<<-?(["']?)([A-Za-z_]\w*)\1/.source;
    r.dynamicEnd = createDynamicEnd(2, '^\\s*${0}\\s*$');
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.OPERATOR;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, heredocContent.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.KEYWORD;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.innerStateId = heredocContent.id;
  });

  addRule(shared, 'percent_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /%[qQwWiIxrs]?[^a-zA-Z0-9]\s*[^#{delim}]+\s*[^a-zA-Z0-9]/.source;
    // This is too complex for a simple regex; we'll handle common forms manually.
  });

  addRule(shared, 'percent_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /%[qQ]\([^)]*\)|%[qQ]\{[^}]*\}|%[qQ]\[[^\]]*\]|%[qQ]<[^>]*>/.source;
    r.action = action(TokenType.STRING);
  });

  addRule(shared, 'regex_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/(?:[^\/\\\n\r]|\\.)+\/[imxouesn]*/.source;
    r.context = { afterTokenType: [TokenType.OPERATOR, TokenType.PUNCTUATION, TokenType.KEYWORD] };
    r.action = action(TokenType.REGEXP);
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
    r.pattern = /\b0[oO][0-7_]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.\d*(?:[eE][+-]?\d+)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|<=>|==|!=|=~|!~|&&|\|\||\.{2,3}|\./.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];:,.?!]/.source;
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
  def.exampleCode = `#!/usr/bin/env ruby
# This is a comment
=begin
  Multi-line comment
=end

# Variables
name = "Alice"
age = 30
pi = 3.14159

# Constants
VERSION = "1.0.0"

# Global, instance, class variables
$global = "global"
@instance = "instance"
@@class = "class"

# String interpolation
greeting = "Hello, #{name}!"

# Symbols
symbol = :symbol
symbol_with_quotes = :"symbol with spaces"

# Arrays
numbers = [1, 2, 3]
mixed = [1, "two", :three]

# Hashes
person = { name: "Alice", age: 30 }
person2 = { "name" => "Bob", "age" => 25 }

# Regex
regex = /[a-z]+/i
match = regex.match("hello")

# Block
3.times do |i|
  puts "Iteration #{i}"
end

3.times { |i| puts "Iteration #{i}" }

# Method definition
def greet(person)
  "Hello, #{person}!"
end

# Method with default value and splat
def greet_multiple(greeting = "Hello", *people)
  people.map { |p| "#{greeting}, #{p}!" }
end

# Class definition
class Person
  attr_accessor :name, :age

  def initialize(name, age)
    @name = name
    @age = age
  end

  def to_s
    "#{@name} (#{@age})"
  end

  def self.from_hash(hash)
    new(hash[:name], hash[:age])
  end
end

# Module
module Greetable
  def greet
    "Hello, #{@name}!"
  end
end

# Using module
class Employee < Person
  include Greetable

  attr_accessor :employee_id
end

# Control flow
if age > 18
  puts "Adult"
elsif age == 18
  puts "Just turned 18"
else
  puts "Minor"
end

unless age < 18
  puts "Adult"
end

case age
when 0..17
  puts "Minor"
when 18
  puts "Just turned 18"
else
  puts "Adult"
end

# Loop
for i in 0...5 do
  puts i
end

10.times do |i|
  puts i
end

# Exception handling
begin
  raise "Error"
rescue StandardError => e
  puts "Caught: #{e.message}"
ensure
  puts "Always runs"
end

# Lambda
add = ->(a, b) { a + b }
puts add.call(3, 4)

# Proc
multiply = Proc.new { |a, b| a * b }
puts multiply.call(3, 4)

# Heredoc
sql = <<SQL
SELECT * FROM users
WHERE age > 18
SQL

# Interpolation in heredoc
name = "Alice"
html = <<HTML
<div>
  <h1>Hello, #{name}!</h1>
</div>
HTML

# Calling methods
puts greet("Bob")
puts greet_multiple("Hi", "Alice", "Bob", "Charlie")

p = Person.new("Alice", 30)
puts p
puts p.name

# Singleton method
def p.say_hello
  "Hello from singleton!"
end
puts p.say_hello

# Array operations
numbers = [1, 2, 3, 4, 5]
squared = numbers.map { |n| n ** 2 }

# Method that ends with ? or !
def adult?
  @age >= 18
end

def save!
  puts "Saving..."
end

# Regex match with =~
if age =~ /^\d+$/
  puts "Age is numeric"
end

# Accessing hash with symbol
puts person[:name]

# Using keywords
yield if block_given?
super if defined?(super)
`;
  return def;
}

export function createRubyLanguageStyles(rbDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(rbDef.id, 'Dark+');
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
    createTokenStyle(TokenType.REGEXP,        '#d7ba7d'),
    createTokenStyle(TokenType.DECORATOR,     '#c8c8c8'),
    createTokenStyle(TokenType.NAMESPACE,     '#4ec9b0'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  const lightStyle = createHighlightStyle(rbDef.id, 'Light+');
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
    createTokenStyle(TokenType.REGEXP,        '#811f3f'),
    createTokenStyle(TokenType.NAMESPACE,     '#267f99'),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(rbDef.id, 'One Dark');
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
    createTokenStyle(TokenType.REGEXP,        '#56b6c2'),
    createTokenStyle(TokenType.NAMESPACE,     '#e5c07b'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(rbDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#fd971f'),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.PARAMETER,     '#fd971f', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.REGEXP,        '#e6db74'),
    createTokenStyle(TokenType.NAMESPACE,     '#66d9ef'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(rbDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.TYPE,          '#8be9fd', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#ffb86c'),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.PARAMETER,     '#ffb86c', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.REGEXP,        '#ff5555'),
    createTokenStyle(TokenType.NAMESPACE,     '#8be9fd'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(rbDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.TYPE,          '#6639ba'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.VARIABLE,      '#953800'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.PARAMETER,     '#24292f'),
    createTokenStyle(TokenType.PROPERTY,      '#0550ae'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.REGEXP,        '#116329'),
    createTokenStyle(TokenType.NAMESPACE,     '#6639ba'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}