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

export function createScalaLanguage() {
  const def = createSyntaxDefinition('Scala');
  def.aliases = ['scala', 'sc'];
  def.id = 'ScalaLang';
  def.builtIn = true;
  def.symbolHoisting = true;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['Int',           TokenType.TYPE],
    ['Long',          TokenType.TYPE],
    ['Short',         TokenType.TYPE],
    ['Byte',          TokenType.TYPE],
    ['Double',        TokenType.TYPE],
    ['Float',         TokenType.TYPE],
    ['Char',          TokenType.TYPE],
    ['Boolean',       TokenType.TYPE],
    ['Unit',          TokenType.TYPE],
    ['Any',           TokenType.TYPE],
    ['AnyRef',        TokenType.TYPE],
    ['AnyVal',        TokenType.TYPE],
    ['Nothing',       TokenType.TYPE],
    ['Null',          TokenType.TYPE],
    ['String',        TokenType.TYPE],
    ['List',          TokenType.TYPE],
    ['Set',           TokenType.TYPE],
    ['Map',           TokenType.TYPE],
    ['Vector',        TokenType.TYPE],
    ['Seq',           TokenType.TYPE],
    ['Array',         TokenType.TYPE],
    ['ArrayBuffer',   TokenType.TYPE],
    ['ListBuffer',    TokenType.TYPE],
    ['Queue',         TokenType.TYPE],
    ['Stack',         TokenType.TYPE],
    ['HashMap',       TokenType.TYPE],
    ['HashSet',       TokenType.TYPE],
    ['TreeMap',       TokenType.TYPE],
    ['TreeSet',       TokenType.TYPE],
    ['PriorityQueue', TokenType.TYPE],
    ['Option',        TokenType.TYPE],
    ['Some',          TokenType.TYPE],
    ['None',          TokenType.TYPE],
    ['Either',        TokenType.TYPE],
    ['Left',          TokenType.TYPE],
    ['Right',         TokenType.TYPE],
    ['Try',           TokenType.TYPE],
    ['Success',       TokenType.TYPE],
    ['Failure',       TokenType.TYPE],
    ['Future',        TokenType.TYPE],
    ['Promise',       TokenType.TYPE],
    ['Tuple',         TokenType.TYPE],
    ['Function',      TokenType.TYPE],
    ['PartialFunction', TokenType.TYPE],
    ['StringOps',     TokenType.TYPE],
    ['StringContext', TokenType.TYPE],
    ['Predef',        TokenType.NAMESPACE],
    ['Console',       TokenType.NAMESPACE],
    ['System',        TokenType.NAMESPACE],
    ['println',       TokenType.FUNCTION],
    ['print',         TokenType.FUNCTION],
    ['printf',        TokenType.FUNCTION],
    ['readLine',      TokenType.FUNCTION],
    ['readInt',       TokenType.FUNCTION],
    ['readDouble',    TokenType.FUNCTION],
    ['Array',         TokenType.FUNCTION],
    ['List',          TokenType.FUNCTION],
    ['Set',           TokenType.FUNCTION],
    ['Map',           TokenType.FUNCTION],
    ['Option',        TokenType.FUNCTION],
    ['Some',          TokenType.FUNCTION],
    ['Either',        TokenType.FUNCTION],
    ['Left',          TokenType.FUNCTION],
    ['Right',         TokenType.FUNCTION],
    ['Try',           TokenType.FUNCTION],
    ['Success',       TokenType.FUNCTION],
    ['Failure',       TokenType.FUNCTION],
    ['Future',        TokenType.FUNCTION],
    ['Promise',       TokenType.FUNCTION],
    ['apply',         TokenType.FUNCTION],
    ['unapply',       TokenType.FUNCTION],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['null',          TokenType.LITERAL],
    ['Nil',           TokenType.LITERAL],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strInterp = newState(def, 'string_interp');
  const strTriple = newState(def, 'string_triple');
  const strTripleInterp = newState(def, 'string_triple_interp');
  const strEscape = newState(def, 'string_escape');
  const blockComment = newState(def, 'block_comment');
  const scaladoc = newState(def, 'scaladoc');

  // Escape sequences for strings
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\bfnrt"']|[0-7]{1,3}|u[0-9a-fA-F]{4})/.source;
    r.action = action(TokenType.ESCAPE);
  });
  addRule(strEscape, 'interpolation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$\{[^}]*\}|\$[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Double-quoted string without interpolation
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Interpolated string (s"...", f"...", raw"...")
  strInterp.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strInterp, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Triple-quoted string without interpolation
  strTriple.onUnmatched = OnUnmatched.CHARACTER;
  strTriple.contentTokenType = TokenType.STRING;

  // Triple-quoted interpolated string
  strTripleInterp.onUnmatched = OnUnmatched.CHARACTER;
  strTripleInterp.contentTokenType = TokenType.STRING;
  addRule(strTripleInterp, 'triple_interp', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$\{[^}]*\}|\$[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Scaladoc comments
  scaladoc.onUnmatched = OnUnmatched.CHARACTER;
  scaladoc.contentTokenType = TokenType.COMMENT;

  // Common rules
  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends',
      'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit',
      'import', 'lazy', 'match', 'new', 'null', 'object', 'override',
      'package', 'private', 'protected', 'return', 'sealed', 'super',
      'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var',
      'while', 'with', 'yield',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Annotation
  addRule(common, 'annotation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // Class/trait/object definition – register as TYPE
  addRule(common, 'type_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(class|trait|object|case class|case object)\s+([A-Za-z_]\w*)(?:\s*\[[^\]]*\])?/.source;
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

  // Type alias: type Name = ...
  addRule(common, 'type_alias', r => {
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

  // Method definition – register as FUNCTION
  addRule(common, 'method_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bdef\s+([A-Za-z_]\w*)\s*[\[(]/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Function call – color as FUNCTION without registration
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

  // Type annotation: `: Type`
  addRule(common, 'type_annotation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /:\s*([A-Za-z_]\w*(?:\[[^\]]*\])?)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.TYPE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Function type arrow: `A => B`
  addRule(common, 'function_arrow', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /=>/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // For comprehension arrow: `<-`
  addRule(common, 'for_arrow', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /<-/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Wildcard: `_` as OPERATOR
  addRule(common, 'wildcard', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /_/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Identifier fallback
  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules
  // Line comments
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Block comments
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*(?!\*)/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Scaladoc comments
  addRule(shared, 'scaladoc', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, scaladoc.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = scaladoc.id;
  });

  // Double-quoted strings (non-interpolated)
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Interpolated strings: s"...", f"...", raw"..."
  addRule(shared, 'string_interp', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?:s|f|raw)"/.source;
    r.end   = /"/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strInterp.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strInterp.id;
  });

  // Triple-quoted strings (non-interpolated)
  addRule(shared, 'string_triple', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /"""/.source;
    r.end   = /"""/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strTriple.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strTriple.id;
  });

  // Triple-quoted interpolated strings
  addRule(shared, 'string_triple_interp', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?:s|f|raw)"""/.source;
    r.end   = /"""/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strTripleInterp.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strTripleInterp.id;
  });

  // Symbol literal: 'symbol
  addRule(shared, 'symbol_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /'[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Character literal: '...'
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
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.\d*(?:[eE][+-]?\d+)?[fFdD]?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_long', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+[lL]\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|<=|>=|==|!=|&&|\|\||\?|:|=|::|#|\.\.\.|\.\./.source;
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
  def.exampleCode = `/**
 * Scala example demonstrating various language features
 */
package com.example

import scala.collection.immutable.{List, Map}
import scala.util.{Try, Success, Failure}
import scala.concurrent.{Future, Await}
import scala.concurrent.duration._

// Case class
case class Person(name: String, age: Int, email: Option[String] = None)

// Trait
trait Greetable {
  def greet(): String
}

// Class with companion object
class User(val username: String) extends Greetable {
  override def greet(): String = s"Hello, $username!"
}

object User {
  def apply(username: String): User = new User(username)
}

// Object (singleton)
object MathUtils {
  def factorial(n: Int): Int = if (n <= 1) 1 else n * factorial(n - 1)
}

// Type alias
type UserMap = Map[String, User]

// Function with generic type
def identity[A](x: A): A = x

// Higher-order function
def repeat(n: Int)(f: Int => Unit): Unit = {
  for (i <- 1 to n) f(i)
}

// Pattern matching
def describe(x: Any): String = x match {
  case 0 => "zero"
  case n: Int if n > 0 => "positive integer"
  case _: String => "string"
  case _ => "other"
}

// For comprehension
def processList(xs: List[Int]): List[Int] = {
  for {
    x <- xs
    if x % 2 == 0
    y <- List(x, x * 2)
  } yield y
}

// Implicit parameter
implicit val defaultName: String = "Alice"
def greet(implicit name: String): String = s"Hello, $name!"

// Main function
def main(args: Array[String]): Unit = {
  // Variables
  val name = "Alice"
  var age = 30
  val isAdult = age >= 18

  // Option
  val email: Option[String] = Some("alice@example.com")
  val emailLen = email.map(_.length).getOrElse(0)

  // Try
  val result = Try(10 / 2) match {
    case Success(v) => s"Result: $v"
    case Failure(e) => s"Error: \${e.getMessage}"
  }

  // Future (simulated)
  import scala.concurrent.ExecutionContext.Implicits.global
  val future = Future {
    Thread.sleep(1000)
    42
  }
  val futureResult = Await.result(future, 2.seconds)

  // Case class
  val person = Person("Alice", 30, Some("alice@example.com"))
  val Person(pName, pAge, pEmail) = person // destructuring

  // Pattern matching in function
  val greeting = person match {
    case Person(name, age, Some(email)) => s"$name ($age), email: $email"
    case Person(name, age, None) => s"$name ($age), no email"
  }

  // Function literal (lambda)
  val add = (a: Int, b: Int) => a + b
  println(add(3, 4))

  // Partially applied function
  def multiply(a: Int)(b: Int): Int = a * b
  val double = multiply(2) _
  println(double(5))

  // Type annotation
  val numbers: List[Int] = List(1, 2, 3, 4, 5)

  // For loop
  for (i <- 0 until 5) {
    println(s"i = $i")
  }

  // While loop
  var count = 0
  while (count < 3) {
    println(s"count = $count")
    count += 1
  }

  // List operations
  val doubled = numbers.map(_ * 2)
  val evens = numbers.filter(_ % 2 == 0)
  val sum = numbers.reduce(_ + _)

  // String interpolation
  val s1 = s"Hello, $name!"
  val s2 = f"Pi is $Pi%1.4f"
  val s3 = raw"Line1\\nLine2"

  // Symbol
  val sym = 'symbol

  // Using implicit
  println(greet)

  // Lazy val
  lazy val expensive = {
    println("Computing...")
    42
  }

  // Using annotations
  @deprecated("Use newMethod instead")
  def oldMethod(): Unit = {}

  // Type ascription
  val ints: List[Int] = List(1, 2, 3)

  // Tuple
  val pair = (1, "one")
  val (first, second) = pair

  // Printing
  println(greeting)
  println(result)
  println(s"Future result: $futureResult")
  println(s"Numbers: $numbers")
  println(s"Doubled: $doubled")
}
`;
  return def;
}

export function createScalaLanguageStyles(scDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(scDef.id, 'Dark+');
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