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

function captureAction(groups) {
  const a = createSyntaxRuleAction();
  const caps = createSyntaxCaptureMap();
  Object.assign(caps.groups, groups);
  a.captures = caps;
  return a;
}

// `keyword Name` -> KEYWORD + TYPE (registered globally). Further keyword
// groups (e.g. `type Name struct`) can be passed as extra group indices.
function typeDeclarationAction(...extraKeywordGroups) {
  const groups = {
    '1': { tokenType: TokenType.KEYWORD, register: null },
    '2': { tokenType: TokenType.TYPE, register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) },
  };
  for (const g of extraKeywordGroups)
    groups[String(g)] = { tokenType: TokenType.KEYWORD, register: null };
  return captureAction(groups);
}

export function createGoLanguage() {
  const def = createSyntaxDefinition('Go');
  def.aliases = ['go', 'golang'];
  def.id = 'GoLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['bool',          TokenType.TYPE],
    ['string',        TokenType.TYPE],
    ['int',           TokenType.TYPE],
    ['int8',          TokenType.TYPE],
    ['int16',         TokenType.TYPE],
    ['int32',         TokenType.TYPE],
    ['int64',         TokenType.TYPE],
    ['uint',          TokenType.TYPE],
    ['uint8',         TokenType.TYPE],
    ['uint16',        TokenType.TYPE],
    ['uint32',        TokenType.TYPE],
    ['uint64',        TokenType.TYPE],
    ['uintptr',       TokenType.TYPE],
    ['byte',          TokenType.TYPE],
    ['rune',          TokenType.TYPE],
    ['float32',       TokenType.TYPE],
    ['float64',       TokenType.TYPE],
    ['complex64',     TokenType.TYPE],
    ['complex128',    TokenType.TYPE],
    ['error',         TokenType.TYPE],
    ['make',          TokenType.FUNCTION],
    ['new',           TokenType.FUNCTION],
    ['len',           TokenType.FUNCTION],
    ['cap',           TokenType.FUNCTION],
    ['append',        TokenType.FUNCTION],
    ['copy',          TokenType.FUNCTION],
    ['delete',        TokenType.FUNCTION],
    ['close',         TokenType.FUNCTION],
    ['panic',         TokenType.FUNCTION],
    ['recover',       TokenType.FUNCTION],
    ['min',           TokenType.FUNCTION],
    ['max',           TokenType.FUNCTION],
    ['clear',         TokenType.FUNCTION],
    ['any',           TokenType.TYPE],
    ['comparable',    TokenType.TYPE],
    ['complex',       TokenType.FUNCTION],
    ['real',          TokenType.FUNCTION],
    ['imag',          TokenType.FUNCTION],
    ['print',         TokenType.FUNCTION],
    ['println',       TokenType.FUNCTION],
    ['printf',        TokenType.FUNCTION],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['nil',           TokenType.LITERAL],
    ['iota',          TokenType.LITERAL],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const rawString = newState(def, 'raw_string');
  const blockComment = newState(def, 'block_comment');
  const tagContent = newState(def, 'tag_content');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted character literal content
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Raw strings (backticks)
  rawString.onUnmatched = OnUnmatched.CHARACTER;

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Struct tag content
  tagContent.onUnmatched = OnUnmatched.CHARACTER;
  tagContent.contentTokenType = TokenType.STRING;

  // Common rules
  addRule(common, 'package_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(package)\s+([A-Za-z_]\w*)/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.KEYWORD, register: null },
      '2': { tokenType: TokenType.NAMESPACE, register: createSymbolRegister(TokenType.NAMESPACE, RegisterScope.GLOBAL) },
    });
  });

  // import "fmt" / import alias "path" (grouped imports fall through to strings)
  addRule(common, 'import_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(import)\s+(?:([A-Za-z_]\w*|\.)\s+)?("[^"]*")/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.KEYWORD, register: null },
      '2': { tokenType: TokenType.NAMESPACE, register: null },
      '3': { tokenType: TokenType.STRING, register: null },
    });
  });

  // func Name( / func Name[T any](
  addRule(common, 'func_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(func)\s+([A-Za-z_]\w*)(?=\s*[(\[])/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.KEYWORD, register: null },
      '2': { tokenType: TokenType.FUNCTION, register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL) },
    });
  });

  // func (r Recv) Name(  - the receiver is lexed normally, the name is found by lookbehind
  addRule(common, 'method_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=\bfunc\s*\([^()]*\)\s*)[A-Za-z_]\w*(?=\s*[(\[])/.source;
    const a = action(TokenType.FUNCTION);
    a.register = createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL);
    r.action = a;
  });

  addRule(common, 'struct_type', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(type)\s+([A-Za-z_]\w*)\s+(struct)\b/.source;
    r.action = typeDeclarationAction(3);
  });

  addRule(common, 'interface_type', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(type)\s+([A-Za-z_]\w*)\s+(interface)\b/.source;
    r.action = typeDeclarationAction(3);
  });

  // type Name ... / type Name[T any] ... / type Alias = Other
  addRule(common, 'type_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(type)\s+([A-Za-z_]\w*)/.source;
    r.action = typeDeclarationAction();
  });

  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'break', 'case', 'chan', 'const', 'continue', 'default', 'defer',
      'else', 'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import',
      'interface', 'map', 'package', 'range', 'return', 'select', 'struct',
      'switch', 'type', 'var',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Built-in types stay types in conversions like string(b) / any(x)
  addRule(common, 'builtin_types', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'bool', 'string', 'int', 'int8', 'int16', 'int32', 'int64',
      'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uintptr',
      'byte', 'rune', 'float32', 'float64', 'complex64', 'complex128',
      'error', 'any', 'comparable',
    ];
    r.action = action(TokenType.TYPE);
  });

  addRule(common, 'func_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)(?=\s*\()/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.FUNCTION, register: null },
    });
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

  // Single-quoted character literals
  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // Raw strings (backticks)
  addRule(shared, 'raw_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /`/.source;
    r.end   = /`/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, rawString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = rawString.id;
  });

  // Struct tags
  addRule(shared, 'struct_tag', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /`[^`]*`/.source;
    r.action = action(TokenType.STRING);
  });

  // Numbers: hex (incl. hex floats 0x1p-2) / oct / bin first, then decimal
  // float and int; `_` separators and imaginary suffix `i` everywhere.
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX](?:[0-9a-fA-F_]+(?:\.[0-9a-fA-F_]*)?|\.[0-9a-fA-F_]+)(?:[pP][+-]?\d[\d_]*)?i?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_oct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[oO][0-7_]+i?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_bin', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[bB][01_]+i?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:\b\d[\d_]*\.[\d_]*|(?<![\w.])\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?i?|\b\d[\d_]*[eE][+-]?\d[\d_]*i?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d[\d_]*i?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators (longest first)
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /<<=|>>=|&\^=|\.\.\.|:=|<-|&&|\|\||<<|>>|&\^|\+\+|--|==|!=|<=|>=|[+\-*/%&|^]=|[+\-*/%&|^~!<>=]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.:]/.source;
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
  def.exampleCode = `package main

import (
	"fmt"
	"strings"
)

// Constants
const (
	Pi       = 3.14159
	Greeting = "Hello"
)

// Variables
var (
	name    string
	counter int
)

// Struct definition
type Person struct {
	Name    string \`json:"name"\`
	Age     int    \`json:"age"\`
	Address string \`json:"address,omitempty"\`
}

// Interface
type Greeter interface {
	Greet() string
}

// Method on Person
func (p Person) Greet() string {
	return fmt.Sprintf("Hello, %s!", p.Name)
}

// Function with multiple return values
func divide(a, b int) (int, error) {
	if b == 0 {
		return 0, fmt.Errorf("division by zero")
	}
	return a / b, nil
}

// Function using defer, panic, recover
func safeDivide(a, b int) (result int) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("Recovered from:", r)
			result = 0
		}
	}()
	return a / b
}

// Function with variadic parameter
func sum(numbers ...int) int {
	total := 0
	for _, n := range numbers {
		total += n
	}
	return total
}

// Goroutine and channel
func worker(id int, jobs <-chan int, results chan<- int) {
	for job := range jobs {
		fmt.Printf("Worker %d processing job %d\\n", id, job)
		results <- job * 2
	}
}

func main() {
	// Variables and type inference
	var x int = 10
	y := 20
	message := "Hello, World!"

	// Control flow
	if x > 5 {
		fmt.Println("x is greater than 5")
	} else if x == 5 {
		fmt.Println("x is 5")
	} else {
		fmt.Println("x is less than 5")
	}

	// Loop
	for i := 0; i < 5; i++ {
		fmt.Printf("i = %d\\n", i)
	}

	// While-like loop
	count := 0
	for count < 3 {
		fmt.Printf("count = %d\\n", count)
		count++
	}

	// Range loop
	numbers := []int{1, 2, 3, 4, 5}
	for index, value := range numbers {
		fmt.Printf("numbers[%d] = %d\\n", index, value)
	}

	// Map
	ages := map[string]int{
		"Alice": 30,
		"Bob":   25,
	}
	for name, age := range ages {
		fmt.Printf("%s is %d years old\\n", name, age)
	}

	// Switch
	switch age := 30; {
	case age < 18:
		fmt.Println("Minor")
	case age == 18:
		fmt.Println("Just turned 18")
	default:
		fmt.Println("Adult")
	}

	// Channel
	jobs := make(chan int, 5)
	results := make(chan int, 5)

	// Start workers
	for w := 0; w < 3; w++ {
		go worker(w, jobs, results)
	}

	// Send jobs
	for j := 0; j < 5; j++ {
		jobs <- j
	}
	close(jobs)

	// Collect results
	for r := 0; r < 5; r++ {
		fmt.Println("Result:", <-results)
	}

	// Select
	ch1 := make(chan string)
	ch2 := make(chan string)

	go func() { ch1 <- "from ch1" }()
	go func() { ch2 <- "from ch2" }()

	select {
	case msg1 := <-ch1:
		fmt.Println(msg1)
	case msg2 := <-ch2:
		fmt.Println(msg2)
	default:
		fmt.Println("No messages")
	}

	// Defer
	defer fmt.Println("Goodbye!")

	// Error handling
	result, err := divide(10, 2)
	if err != nil {
		fmt.Println("Error:", err)
	} else {
		fmt.Println("Result:", result)
	}

	// Type assertion
	var g Greeter = Person{Name: "Alice"}
	if p, ok := g.(Person); ok {
		fmt.Println(p.Name)
	}

	// Using a struct tag
	p := Person{Name: "Bob", Age: 25}
	fmt.Printf("%+v\\n", p)

	fmt.Println(sum(1, 2, 3, 4, 5))
	fmt.Println(message)
	fmt.Println(Greeting)
}
// Generics (Go 1.18+) and newer builtins
type Number interface {
	~int | ~int64 | ~float64
}

func Sum[T Number](values ...T) T {
	var total T
	for _, v := range values {
		total += v
	}
	return total
}

func modern() {
	for i := range 3 { // range over int (Go 1.22)
		fmt.Println(i, min(i, 2), max(i, 1))
	}
	big, ratio, mask := 1_000_000, 6.022e23, 0b1010
	m := map[string]any{"big": big, "ratio": ratio, "mask": mask}
	clear(m)
}
`;
  return def;
}

export function createGoLanguageStyles(goDef) {
  const darkStyle = createHighlightStyle(goDef.id, 'Dark+');
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

  const lightStyle = createHighlightStyle(goDef.id, 'Light+');
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
    createTokenStyle(TokenType.NAMESPACE,     '#267f99'),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(goDef.id, 'One Dark');
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
    createTokenStyle(TokenType.NAMESPACE,     '#e5c07b'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(goDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.PARAMETER,     '#fd971f', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.NAMESPACE,     '#66d9ef'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(goDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.TYPE,          '#8be9fd', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.PARAMETER,     '#ffb86c', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.NAMESPACE,     '#8be9fd'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(goDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.TYPE,          '#953800'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.VARIABLE,      '#24292f'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.PARAMETER,     '#24292f'),
    createTokenStyle(TokenType.PROPERTY,      '#0550ae'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.NAMESPACE,     '#953800'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}