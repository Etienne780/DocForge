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

export function createJavaLanguage() {
  const def = createSyntaxDefinition('Java');
  def.aliases = ['java'];
  def.id = 'JavaLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    // Primitive types
    ['byte',          TokenType.TYPE],
    ['short',         TokenType.TYPE],
    ['int',           TokenType.TYPE],
    ['long',          TokenType.TYPE],
    ['float',         TokenType.TYPE],
    ['double',        TokenType.TYPE],
    ['char',          TokenType.TYPE],
    ['boolean',       TokenType.TYPE],
    ['void',          TokenType.TYPE],
    // Common wrapper types
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
    // Common collections
    ['List',          TokenType.TYPE],
    ['ArrayList',     TokenType.TYPE],
    ['LinkedList',    TokenType.TYPE],
    ['Set',           TokenType.TYPE],
    ['HashSet',       TokenType.TYPE],
    ['TreeSet',       TokenType.TYPE],
    ['Map',           TokenType.TYPE],
    ['HashMap',       TokenType.TYPE],
    ['TreeMap',       TokenType.TYPE],
    ['LinkedHashMap', TokenType.TYPE],
    ['Queue',         TokenType.TYPE],
    ['Deque',         TokenType.TYPE],
    ['ArrayDeque',    TokenType.TYPE],
    ['PriorityQueue', TokenType.TYPE],
    ['Stack',         TokenType.TYPE],
    ['Vector',        TokenType.TYPE],
    ['EnumSet',       TokenType.TYPE],
    ['EnumMap',       TokenType.TYPE],
    // Common exceptions
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
    // Common annotations
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
    // Common system classes
    ['System',        TokenType.TYPE],
    ['Math',          TokenType.TYPE],
    ['Arrays',        TokenType.TYPE],
    ['Collections',   TokenType.TYPE],
    ['Objects',       TokenType.TYPE],
    ['Optional',      TokenType.TYPE],
    ['OptionalInt',   TokenType.TYPE],
    ['OptionalLong',  TokenType.TYPE],
    ['OptionalDouble', TokenType.TYPE],
    ['Stream',        TokenType.TYPE],
    ['IntStream',     TokenType.TYPE],
    ['LongStream',    TokenType.TYPE],
    ['DoubleStream',  TokenType.TYPE],
    ['Collectors',    TokenType.TYPE],
    ['Comparator',    TokenType.TYPE],
    ['Comparable',    TokenType.TYPE],
    ['Runnable',      TokenType.TYPE],
    ['Callable',      TokenType.TYPE],
    ['Future',        TokenType.TYPE],
    ['CompletableFuture', TokenType.TYPE],
    ['ExecutorService', TokenType.TYPE],
    ['Executors',     TokenType.TYPE],
    ['Thread',        TokenType.TYPE],
    ['StringBuilder', TokenType.TYPE],
    ['StringBuffer',  TokenType.TYPE],
    // Common constants
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['null',          TokenType.LITERAL],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strEscape = newState(def, 'string_escape');
  const textBlock = newState(def, 'text_block');
  const blockComment = newState(def, 'block_comment');
  const javadoc = newState(def, 'javadoc');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[bfnrt"\\]|[0-7]{1,3}|u[0-9a-fA-F]{4})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Text block: """...""" (Java 15+)
  textBlock.onUnmatched = OnUnmatched.CHARACTER;
  textBlock.contentTokenType = TokenType.STRING;

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Javadoc comments
  javadoc.onUnmatched = OnUnmatched.CHARACTER;
  javadoc.contentTokenType = TokenType.COMMENT;

  // Common rules
  addRule(common, 'keywords', r => {
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
      'transient', 'try', 'void', 'volatile', 'while', 'var', 'yield',
      'record', 'sealed', 'permits', 'non-sealed', 'module', 'exports',
      'opens', 'requires', 'provides', 'transitive', 'uses', 'with',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'annotation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // Class/interface/enum/record definition – register name as TYPE
  addRule(common, 'type_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(class|interface|enum|record)\s+([A-Za-z_]\w*)(?:\s*<[^>]*>)?/.source;
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

  // Method definition – register name as FUNCTION
  // Only matches the method name before `(`, consumes the `(` but not the return type
  addRule(common, 'method_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*\(/.source;
    r.context = {
      notAfterTokenType: [TokenType.KEYWORD, TokenType.TYPE]
    };
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Method call – color as FUNCTION without registration
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

  // Block comment /* ... */
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*(?!\*)/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Javadoc /** ... */
  addRule(shared, 'javadoc', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, javadoc.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = javadoc.id;
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

  // Text block: """..."""
  addRule(shared, 'text_block', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /"""/.source;
    r.end   = /"""/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, textBlock.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = textBlock.id;
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
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|>>>|<=|>=|==|!=|&&|\|\||\?|:|=/.source;
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
 * A simple class demonstrating Java syntax.
 * @author Developer
 * @version 1.0
 */
package com.example;

import java.util.*;
import java.util.stream.*;
import java.util.function.*;

/**
 * This class represents a Person.
 */
public class Person<T extends Number> implements Comparable<Person> {
    // Constants
    public static final int MAX_AGE = 150;

    // Fields
    private String name;
    private int age;
    private List<String> hobbies;
    private T score;

    /**
     * Constructor with parameters.
     * @param name the person's name
     * @param age the person's age
     */
    public Person(String name, int age) {
        this.name = name;
        this.age = age;
        this.hobbies = new ArrayList<>();
    }

    public Person(String name, int age, T score) {
        this(name, age);
        this.score = score;
    }

    // Getters and setters
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getAge() {
        return age;
    }

    public void setAge(int age) {
        if (age < 0 || age > MAX_AGE) {
            throw new IllegalArgumentException("Invalid age: " + age);
        }
        this.age = age;
    }

    public T getScore() {
        return score;
    }

    public void addHobby(String hobby) {
        hobbies.add(hobby);
    }

    public List<String> getHobbies() {
        return Collections.unmodifiableList(hobbies);
    }

    /**
     * Returns a greeting message.
     * @return the greeting
     */
    public String greet() {
        return String.format("Hello, my name is %s and I am %d years old.", name, age);
    }

    /**
     * Checks if the person is an adult.
     * @return true if age >= 18
     */
    public boolean isAdult() {
        return age >= 18;
    }

    @Override
    public int compareTo(Person other) {
        return Integer.compare(this.age, other.age);
    }

    @Override
    public String toString() {
        return "Person{name='" + name + "', age=" + age + ", hobbies=" + hobbies + "}";
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Person person = (Person) o;
        return age == person.age && Objects.equals(name, person.name);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, age);
    }

    /**
     * A generic method with type parameter.
     * @param t the value to process
     * @param <U> the return type
     * @return the processed value
     */
    public <U> U process(T t, Function<T, U> processor) {
        return processor.apply(t);
    }

    /**
     * Main method - entry point.
     * @param args command line arguments
     */
    public static void main(String[] args) {
        // Variable declarations
        int x = 42;
        long y = 100L;
        double z = 3.14159;
        boolean flag = true;
        char c = 'A';
        String greeting = "Hello, world!";

        // Type inference with var (Java 10+)
        var list = new ArrayList<String>();
        list.add("Apple");
        list.add("Banana");

        // Text block (Java 15+)
        String json = """
                {
                    "name": "Alice",
                    "age": 30
                }
                """;

        // Conditional statement
        if (x > 10 && flag) {
            System.out.println("x is greater than 10 and flag is true");
        } else if (x == 10) {
            System.out.println("x is 10");
        } else {
            System.out.println("x is less than 10");
        }

        // Switch expression (Java 14+)
        String result = switch (x) {
            case 1 -> "one";
            case 2 -> "two";
            case 42 -> "the answer";
            default -> "other";
        };

        // Switch statement
        switch (x) {
            case 1:
                System.out.println("one");
                break;
            case 2:
                System.out.println("two");
                break;
            default:
                System.out.println("other");
        }

        // For loop
        for (int i = 0; i < 5; i++) {
            System.out.println("i = " + i);
        }

        // Enhanced for loop
        for (String item : list) {
            System.out.println(item);
        }

        // While loop
        int count = 0;
        while (count < 3) {
            System.out.println("count = " + count);
            count++;
        }

        // Do-while loop
        int n = 0;
        do {
            System.out.println("n = " + n);
            n++;
        } while (n < 3);

        // Try-catch-finally
        try {
            int result2 = 10 / 0;
        } catch (ArithmeticException e) {
            System.err.println("Error: " + e.getMessage());
        } finally {
            System.out.println("Finally block executed");
        }

        // Try-with-resources (Java 7+)
        try (Scanner scanner = new Scanner(System.in)) {
            String input = scanner.nextLine();
            System.out.println("Input: " + input);
        }

        // Lambda expression
        List<Integer> numbers = Arrays.asList(1, 2, 3, 4, 5);
        numbers.forEach(n -> System.out.println(n));

        // Stream API
        List<Integer> doubled = numbers.stream()
            .filter(n -> n % 2 == 0)
            .map(n -> n * 2)
            .collect(Collectors.toList());

        // Method reference
        numbers.forEach(System.out::println);

        // Optional
        Optional<String> optional = Optional.ofNullable("Hello");
        optional.ifPresent(System.out::println);

        // Creating an instance
        Person alice = new Person("Alice", 30);
        System.out.println(alice.greet());

        // Using generic method
        Double result3 = alice.process(10, n -> n * 2.5);
        System.out.println("Result: " + result3);

        // Annotation
        @SuppressWarnings("unused")
        String unused = "This is unused";

        // Record (Java 14+)
        record Point(int x, int y) {}
        Point p = new Point(3, 4);
        System.out.println("Point: " + p);

        // Sealed class (Java 17+)
        sealed class Shape permits Circle, Rectangle {}
        final class Circle extends Shape {}
        final class Rectangle extends Shape {}

        // Assertion
        assert age > 0 : "Age must be positive";

        // Synchronized block
        synchronized (alice) {
            System.out.println("Synchronized");
        }
    }
}`;
  return def;
}

export function createJavaLanguageStyles(javaDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(javaDef.id, 'Dark+');
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