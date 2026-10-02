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

export function createKotlinLanguage() {
  const def = createSyntaxDefinition('Kotlin');
  def.aliases = ['kt', 'kotlin', 'kts'];
  def.id = 'KotlinLang';
  def.builtIn = true;
  def.symbolHoisting = true;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['Int',           TokenType.TYPE],
    ['Byte',          TokenType.TYPE],
    ['Short',         TokenType.TYPE],
    ['Long',          TokenType.TYPE],
    ['Float',         TokenType.TYPE],
    ['Double',        TokenType.TYPE],
    ['Boolean',       TokenType.TYPE],
    ['Char',          TokenType.TYPE],
    ['String',        TokenType.TYPE],
    ['Unit',          TokenType.TYPE],
    ['Nothing',       TokenType.TYPE],
    ['Any',           TokenType.TYPE],
    ['Any?',          TokenType.TYPE],
    ['Array',         TokenType.TYPE],
    ['IntArray',      TokenType.TYPE],
    ['ByteArray',     TokenType.TYPE],
    ['ShortArray',    TokenType.TYPE],
    ['LongArray',     TokenType.TYPE],
    ['FloatArray',    TokenType.TYPE],
    ['DoubleArray',   TokenType.TYPE],
    ['BooleanArray',  TokenType.TYPE],
    ['CharArray',     TokenType.TYPE],
    ['List',          TokenType.TYPE],
    ['MutableList',   TokenType.TYPE],
    ['ArrayList',     TokenType.TYPE],
    ['Set',           TokenType.TYPE],
    ['MutableSet',    TokenType.TYPE],
    ['HashSet',       TokenType.TYPE],
    ['Map',           TokenType.TYPE],
    ['MutableMap',    TokenType.TYPE],
    ['HashMap',       TokenType.TYPE],
    ['LinkedHashMap', TokenType.TYPE],
    ['Sequence',      TokenType.TYPE],
    ['Iterable',      TokenType.TYPE],
    ['Iterator',      TokenType.TYPE],
    ['Collection',    TokenType.TYPE],
    ['MutableCollection', TokenType.TYPE],
    ['Queue',         TokenType.TYPE],
    ['Deque',         TokenType.TYPE],
    ['ArrayDeque',    TokenType.TYPE],
    ['PriorityQueue', TokenType.TYPE],
    ['Stack',         TokenType.TYPE],
    ['Vector',        TokenType.TYPE],
    ['Enumeration',   TokenType.TYPE],
    ['Function',      TokenType.TYPE],
    ['Function0',     TokenType.TYPE],
    ['Function1',     TokenType.TYPE],
    ['Function2',     TokenType.TYPE],
    ['Function3',     TokenType.TYPE],
    ['KFunction',     TokenType.TYPE],
    ['KClass',        TokenType.TYPE],
    ['KType',         TokenType.TYPE],
    ['KParameter',    TokenType.TYPE],
    ['KCallable',     TokenType.TYPE],
    ['KProperty',     TokenType.TYPE],
    ['KMutableProperty', TokenType.TYPE],
    ['KDeclarationContainer', TokenType.TYPE],
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
    ['SQLException',  TokenType.TYPE],
    ['ClassNotFoundException', TokenType.TYPE],
    ['NoSuchMethodException', TokenType.TYPE],
    ['InstantiationException', TokenType.TYPE],
    ['IllegalAccessException', TokenType.TYPE],
    ['InvocationTargetException', TokenType.TYPE],
    ['Deprecated',    TokenType.DECORATOR],
    ['Suppress',      TokenType.DECORATOR],
    ['JvmStatic',     TokenType.DECORATOR],
    ['JvmOverloads',  TokenType.DECORATOR],
    ['JvmField',      TokenType.DECORATOR],
    ['JvmName',       TokenType.DECORATOR],
    ['JvmMultifileClass', TokenType.DECORATOR],
    ['Target',        TokenType.DECORATOR],
    ['Retention',     TokenType.DECORATOR],
    ['Repeatable',    TokenType.DECORATOR],
    ['MustBeDocumented', TokenType.DECORATOR],
    ['OptIn',         TokenType.DECORATOR],
    ['Experimental',  TokenType.DECORATOR],
    ['ExperimentalCoroutinesApi', TokenType.DECORATOR],
    ['ExperimentalTime', TokenType.DECORATOR],
    ['kotlinx.serialization.Serializable', TokenType.DECORATOR],
    ['println',       TokenType.FUNCTION],
    ['print',         TokenType.FUNCTION],
    ['readln',        TokenType.FUNCTION],
    ['readLine',      TokenType.FUNCTION],
    ['println',       TokenType.FUNCTION],
    ['print',         TokenType.FUNCTION],
    ['error',         TokenType.FUNCTION],
    ['require',       TokenType.FUNCTION],
    ['requireNotNull', TokenType.FUNCTION],
    ['checkNotNull',  TokenType.FUNCTION],
    ['run',           TokenType.FUNCTION],
    ['also',          TokenType.FUNCTION],
    ['apply',         TokenType.FUNCTION],
    ['let',           TokenType.FUNCTION],
    ['takeIf',        TokenType.FUNCTION],
    ['takeUnless',    TokenType.FUNCTION],
    ['repeat',        TokenType.FUNCTION],
    ['with',          TokenType.FUNCTION],
    ['use',           TokenType.FUNCTION],
    ['lazy',          TokenType.FUNCTION],
    ['sequenceOf',    TokenType.FUNCTION],
    ['listOf',        TokenType.FUNCTION],
    ['mutableListOf', TokenType.FUNCTION],
    ['setOf',         TokenType.FUNCTION],
    ['mutableSetOf',  TokenType.FUNCTION],
    ['mapOf',         TokenType.FUNCTION],
    ['mutableMapOf',  TokenType.FUNCTION],
    ['arrayOf',       TokenType.FUNCTION],
    ['intArrayOf',    TokenType.FUNCTION],
    ['longArrayOf',   TokenType.FUNCTION],
    ['doubleArrayOf', TokenType.FUNCTION],
    ['arrayOfNulls',  TokenType.FUNCTION],
    ['emptyList',     TokenType.FUNCTION],
    ['emptySet',      TokenType.FUNCTION],
    ['emptyMap',      TokenType.FUNCTION],
    ['listOfNotNull', TokenType.FUNCTION],
    ['filter',        TokenType.FUNCTION],
    ['map',           TokenType.FUNCTION],
    ['flatMap',       TokenType.FUNCTION],
    ['fold',          TokenType.FUNCTION],
    ['reduce',        TokenType.FUNCTION],
    ['sum',           TokenType.FUNCTION],
    ['sumOf',         TokenType.FUNCTION],
    ['average',       TokenType.FUNCTION],
    ['min',           TokenType.FUNCTION],
    ['max',           TokenType.FUNCTION],
    ['count',         TokenType.FUNCTION],
    ['first',         TokenType.FUNCTION],
    ['last',          TokenType.FUNCTION],
    ['find',          TokenType.FUNCTION],
    ['findLast',      TokenType.FUNCTION],
    ['single',        TokenType.FUNCTION],
    ['firstOrNull',   TokenType.FUNCTION],
    ['lastOrNull',    TokenType.FUNCTION],
    ['singleOrNull',  TokenType.FUNCTION],
    ['any',           TokenType.FUNCTION],
    ['all',           TokenType.FUNCTION],
    ['none',          TokenType.FUNCTION],
    ['contains',      TokenType.FUNCTION],
    ['elementAt',     TokenType.FUNCTION],
    ['elementAtOrElse', TokenType.FUNCTION],
    ['elementAtOrNull', TokenType.FUNCTION],
    ['plus',          TokenType.FUNCTION],
    ['minus',         TokenType.FUNCTION],
    ['groupBy',       TokenType.FUNCTION],
    ['partition',     TokenType.FUNCTION],
    ['sorted',        TokenType.FUNCTION],
    ['sortedBy',      TokenType.FUNCTION],
    ['sortedDescending', TokenType.FUNCTION],
    ['sortedByDescending', TokenType.FUNCTION],
    ['distinct',      TokenType.FUNCTION],
    ['distinctBy',    TokenType.FUNCTION],
    ['intersect',     TokenType.FUNCTION],
    ['union',         TokenType.FUNCTION],
    ['subtract',      TokenType.FUNCTION],
    ['drop',          TokenType.FUNCTION],
    ['take',          TokenType.FUNCTION],
    ['dropWhile',     TokenType.FUNCTION],
    ['takeWhile',     TokenType.FUNCTION],
    ['dropLast',      TokenType.FUNCTION],
    ['takeLast',      TokenType.FUNCTION],
    ['chunked',       TokenType.FUNCTION],
    ['windowed',      TokenType.FUNCTION],
    ['zip',           TokenType.FUNCTION],
    ['unzip',         TokenType.FUNCTION],
    ['withIndex',     TokenType.FUNCTION],
    ['forEach',       TokenType.FUNCTION],
    ['forEachIndexed', TokenType.FUNCTION],
    ['onEach',        TokenType.FUNCTION],
    ['toList',        TokenType.FUNCTION],
    ['toSet',         TokenType.FUNCTION],
    ['toMap',         TokenType.FUNCTION],
    ['toMutableList', TokenType.FUNCTION],
    ['toMutableSet',  TokenType.FUNCTION],
    ['toMutableMap',  TokenType.FUNCTION],
    ['toString',      TokenType.FUNCTION],
    ['hashCode',      TokenType.FUNCTION],
    ['equals',        TokenType.FUNCTION],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['null',          TokenType.LITERAL],
    ['CoroutineScope', TokenType.TYPE],
    ['suspend',       TokenType.KEYWORD],
    ['launch',        TokenType.FUNCTION],
    ['async',         TokenType.FUNCTION],
    ['delay',         TokenType.FUNCTION],
    ['withContext',   TokenType.FUNCTION],
    ['Dispatchers',   TokenType.TYPE],
    ['Job',           TokenType.TYPE],
    ['Deferred',      TokenType.TYPE],
    ['SupervisorJob', TokenType.TYPE],
    ['CoroutineExceptionHandler', TokenType.TYPE],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strEscape = newState(def, 'string_escape');
  const rawString = newState(def, 'raw_string');
  const blockComment = newState(def, 'block_comment');
  const kdoc = newState(def, 'kdoc');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\bfnrt"$]|[0-7]{1,3}|u[0-9a-fA-F]{4})/.source;
    r.action = action(TokenType.ESCAPE);
  });
  addRule(strEscape, 'template_var', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*|\${[^}]*}/.source;
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
  addRule(rawString, 'raw_template', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*|\${[^}]*}/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // KDoc comments
  kdoc.onUnmatched = OnUnmatched.CHARACTER;
  kdoc.contentTokenType = TokenType.COMMENT;

  // Common rules
  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'abstract', 'actual', 'annotation', 'as', 'as?', 'break', 'class',
      'companion', 'const', 'constructor', 'continue', 'crossinline',
      'data', 'delegate', 'do', 'dynamic', 'else', 'enum', 'expect',
      'external', 'false', 'final', 'finally', 'for', 'fun', 'if', 'import',
      'in', 'infix', 'inline', 'inner', 'interface', 'internal', 'is',
      'lateinit', 'noinline', 'null', 'object', 'open', 'operator',
      'out', 'override', 'package', 'private', 'protected', 'public',
      'reified', 'return', 'sealed', 'suspend', 'super', 'tailrec',
      'this', 'throw', 'true', 'try', 'typealias', 'typeof', 'val',
      'var', 'vararg', 'when', 'where', 'while', 'by', 'catch',
      'companion', 'constructor', 'delegate', 'do', 'dynamic',
      'enum', 'expect', 'external', 'finally', 'import', 'infix',
      'inline', 'inner', 'internal', 'lateinit', 'noinline', 'open',
      'operator', 'out', 'override', 'private', 'protected', 'public',
      'reified', 'sealed', 'super', 'tailrec', 'this', 'throw', 'try',
      'typealias', 'typeof', 'val', 'var', 'vararg', 'when', 'where',
      'while',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'modifiers', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'abstract', 'actual', 'annotation', 'companion', 'const', 'crossinline',
      'data', 'expect', 'external', 'final', 'infix', 'inline', 'inner',
      'internal', 'lateinit', 'noinline', 'open', 'operator', 'out', 'override',
      'private', 'protected', 'public', 'reified', 'sealed', 'suspend',
      'tailrec', 'vararg',
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
    r.pattern = /\b(class|interface|object|enum|sealed class|data class)\s+([A-Za-z_]\w*)(?:\s*<[^>]*>)?/.source;
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
    r.pattern = /\bfun\s+([A-Za-z_]\w*)\s*[<(]/.source;
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

  addRule(common, 'lambda_arrow', r => {
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
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*(?!\*)/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  addRule(shared, 'kdoc', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, kdoc.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = kdoc.id;
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
    r.begin = /"""/.source;
    r.end   = /"""/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, rawString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = rawString.id;
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
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.\d*(?:[eE][+-]?\d+)?[fF]?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_long', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+[lL]\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|>>>|<=|>=|==|!=|&&|\|\||\?|:|=|->|\.\./.source;
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
  def.exampleCode = `/**
 * Kotlin example demonstrating various language features
 * @author Developer
 * @since 1.0
 */
package com.example

import kotlin.collections.*
import kotlin.text.*
import kotlin.math.*

// Data class
data class Person(
    val name: String,
    var age: Int,
    val email: String? = null
)

// Enum class
enum class Status {
    ACTIVE, INACTIVE, PENDING
}

// Sealed class
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String) : Result<Nothing>()
    object Loading : Result<Nothing>()
}

// Interface
interface Greetable {
    fun greet(): String
}

// Class with companion object
class User(val username: String) : Greetable {
    companion object {
        val DEFAULT_USER = User("guest")
        fun create(name: String): User = User(name)
    }

    override fun greet(): String = "Hello, $username!"

    // Extension function inside class? Actually we define outside.
}

// Type alias
typealias UserMap = Map<String, User>

// Top-level function
fun calculateArea(width: Int, height: Int): Int {
    return width * height
}

// Generic function with where clause
fun <T> process(data: T) where T : Number, T : Comparable<T> {
    println("Processing: $data")
}

// Extension function
fun String.isEmail(): Boolean = this.contains("@")

// Suspending function (coroutine)
suspend fun fetchData(): String {
    delay(1000L)
    return "Data loaded"
}

// Higher-order function
fun repeatAction(times: Int, action: (Int) -> Unit) {
    for (i in 0 until times) {
        action(i)
    }
}

// Main function
fun main() {
    // Variable declarations
    val name = "Alice"
    var age = 30
    val isAdult = age >= 18

    // String templates
    val greeting = "Hello, $name! You are $age years old."
    val message = "In 5 years you'll be \${age + 5}."

    // Null safety
    val email: String? = "alice@example.com"
    val length = email?.length ?: 0

    // Safe call with let
    email?.let {
        println("Email: $it")
    }

    // When expression
    val status = Status.ACTIVE
    when (status) {
        Status.ACTIVE -> println("Active")
        Status.INACTIVE -> println("Inactive")
        else -> println("Unknown")
    }

    // When with is
    val value: Any = "Hello"
    when (value) {
        is String -> println("String: $value")
        is Int -> println("Int: $value")
        else -> println("Other")
    }

    // Loop
    for (i in 1..5) {
        println("i = $i")
    }

    // While loop
    var counter = 0
    while (counter < 3) {
        println("counter = $counter")
        counter++
    }

    // List operations
    val numbers = listOf(1, 2, 3, 4, 5)
    val doubled = numbers.map { it * 2 }
    val evens = numbers.filter { it % 2 == 0 }
    val sum = numbers.sum()

    // Sequence
    val seq = sequenceOf(1, 2, 3)
    seq.forEach { println(it) }

    // Lambda with arrow
    val sumLambda = { a: Int, b: Int -> a + b }
    println("Sum: \${sumLambda(3, 4)}")

    // Using data class
    val person = Person("Alice", 30)
    val (pName, pAge) = person // destructuring
    println("$pName is $pAge years old")

    // Using sealed class
    val result: Result<Int> = Result.Success(42)
    when (result) {
        is Result.Success -> println("Success: \${result.data}")
        is Result.Error -> println("Error: \${result.message}")
        Result.Loading -> println("Loading...")
    }

    // Extension function
    println("test@example.com".isEmail())

    // Type alias
    val users: UserMap = mapOf("alice" to User("alice"))

    // Range
    for (i in 0..10 step 2) {
        println(i)
    }

    // Lambda with receiver (DSL style)
    val buildString = buildString {
        append("Hello, ")
        append("world!")
    }
    println(buildString)

    // Try-catch
    try {
        val result = 10 / 2
        println("Result: $result")
    } catch (e: ArithmeticException) {
        println("Error: \${e.message}")
    } finally {
        println("Finally executed")
    }

    // Coroutine (suspend function call)
    // runBlocking { println(fetchData()) }

    // Lazy delegate
    val lazyValue: String by lazy {
        println("Computing lazy value...")
        "Lazy Value"
    }
    println(lazyValue)

    // Object expression
    val greeter = object : Greetable {
        override fun greet(): String = "Hello from anonymous object!"
    }
    println(greeter.greet())

    // Companion object usage
    val defaultUser = User.DEFAULT_USER
    println(defaultUser.username)

    // Using annotations
    @Suppress("UNUSED_VARIABLE")
    val unused = "This is unused"

    // Range until
    for (i in 0 until 5) {
        print(i)
    }

    println("Done")
}`;
  return def;
}

export function createKotlinLanguageStyles(ktDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(ktDef.id, 'Dark+');
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

  const lightStyle = createHighlightStyle(ktDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#0000ff'),
    createTokenStyle(TokenType.TYPE,          '#267f99'),
    createTokenStyle(TokenType.IDENTIFIER,    '#001080'),
    createTokenStyle(TokenType.VARIABLE,      '#001080'), // $template
    createTokenStyle(TokenType.FUNCTION,      '#795e26'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.DECORATOR,     '#795e26'), // @Annotation
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(ktDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.TYPE,          '#e5c07b'),
    createTokenStyle(TokenType.IDENTIFIER,    '#abb2bf'),
    createTokenStyle(TokenType.VARIABLE,      '#e06c75'),
    createTokenStyle(TokenType.FUNCTION,      '#61afef'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.DECORATOR,     '#61afef'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(ktDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.DECORATOR,     '#a6e22e'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(ktDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.TYPE,          '#8be9fd', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.DECORATOR,     '#50fa7b'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(ktDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.TYPE,          '#953800'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.VARIABLE,      '#24292f'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.DECORATOR,     '#8250df'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}