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

export function createRustLanguage() {
  const def = createSyntaxDefinition('Rust');
  def.aliases = ['rs', 'rust', 'rustlang'];
  def.id = 'RustLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['i8',            TokenType.TYPE],
    ['i16',           TokenType.TYPE],
    ['i32',           TokenType.TYPE],
    ['i64',           TokenType.TYPE],
    ['i128',          TokenType.TYPE],
    ['isize',         TokenType.TYPE],
    ['u8',            TokenType.TYPE],
    ['u16',           TokenType.TYPE],
    ['u32',           TokenType.TYPE],
    ['u64',           TokenType.TYPE],
    ['u128',          TokenType.TYPE],
    ['usize',         TokenType.TYPE],
    ['f32',           TokenType.TYPE],
    ['f64',           TokenType.TYPE],
    ['bool',          TokenType.TYPE],
    ['char',          TokenType.TYPE],
    ['str',           TokenType.TYPE],
    ['String',        TokenType.TYPE],
    ['Vec',           TokenType.TYPE],
    ['Option',        TokenType.TYPE],
    ['Result',        TokenType.TYPE],
    ['Box',           TokenType.TYPE],
    ['Rc',            TokenType.TYPE],
    ['Arc',           TokenType.TYPE],
    ['Cell',          TokenType.TYPE],
    ['RefCell',       TokenType.TYPE],
    ['Mutex',         TokenType.TYPE],
    ['RwLock',        TokenType.TYPE],
    ['HashMap',       TokenType.TYPE],
    ['HashSet',       TokenType.TYPE],
    ['BTreeMap',      TokenType.TYPE],
    ['BTreeSet',      TokenType.TYPE],
    ['LinkedList',    TokenType.TYPE],
    ['VecDeque',      TokenType.TYPE],
    ['BinaryHeap',    TokenType.TYPE],
    ['Pin',           TokenType.TYPE],
    ['UnsafeCell',    TokenType.TYPE],
    ['PhantomData',   TokenType.TYPE],
    ['Range',         TokenType.TYPE],
    ['RangeInclusive', TokenType.TYPE],
    ['Slice',         TokenType.TYPE],
    ['Array',         TokenType.TYPE],
    ['Tuple',         TokenType.TYPE],
    ['Fn',            TokenType.TYPE],
    ['FnMut',         TokenType.TYPE],
    ['FnOnce',        TokenType.TYPE],
    ['Iterator',      TokenType.TYPE],
    ['DoubleEndedIterator', TokenType.TYPE],
    ['ExactSizeIterator', TokenType.TYPE],
    ['IntoIterator',  TokenType.TYPE],
    ['FromIterator',  TokenType.TYPE],
    ['Default',       TokenType.TYPE],
    ['Clone',         TokenType.TYPE],
    ['Copy',          TokenType.TYPE],
    ['Debug',         TokenType.TYPE],
    ['Display',       TokenType.TYPE],
    ['PartialEq',     TokenType.TYPE],
    ['Eq',            TokenType.TYPE],
    ['PartialOrd',    TokenType.TYPE],
    ['Ord',           TokenType.TYPE],
    ['Hash',          TokenType.TYPE],
    ['Into',          TokenType.TYPE],
    ['From',          TokenType.TYPE],
    ['TryInto',       TokenType.TYPE],
    ['TryFrom',       TokenType.TYPE],
    ['ToString',      TokenType.TYPE],
    ['AsRef',         TokenType.TYPE],
    ['AsMut',         TokenType.TYPE],
    ['Deref',         TokenType.TYPE],
    ['DerefMut',      TokenType.TYPE],
    ['Drop',          TokenType.TYPE],
    ['Send',          TokenType.TYPE],
    ['Sync',          TokenType.TYPE],
    ['Unpin',         TokenType.TYPE],
    ['Sized',         TokenType.TYPE],
    ['?Sized',        TokenType.TYPE],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['Some',          TokenType.FUNCTION],
    ['None',          TokenType.LITERAL],
    ['Ok',            TokenType.FUNCTION],
    ['Err',           TokenType.FUNCTION],
    ['print!',        TokenType.FUNCTION],
    ['println!',      TokenType.FUNCTION],
    ['format!',       TokenType.FUNCTION],
    ['eprint!',       TokenType.FUNCTION],
    ['eprintln!',     TokenType.FUNCTION],
    ['dbg!',          TokenType.FUNCTION],
    ['todo!',         TokenType.FUNCTION],
    ['unreachable!',  TokenType.FUNCTION],
    ['unimplemented!', TokenType.FUNCTION],
    ['panic!',        TokenType.FUNCTION],
    ['assert!',       TokenType.FUNCTION],
    ['assert_eq!',    TokenType.FUNCTION],
    ['assert_ne!',    TokenType.FUNCTION],
    ['debug_assert!', TokenType.FUNCTION],
    ['debug_assert_eq!', TokenType.FUNCTION],
    ['debug_assert_ne!', TokenType.FUNCTION],
    ['vec!',          TokenType.FUNCTION],
    ['vec_deque!',    TokenType.FUNCTION],
    ['hash_map!',     TokenType.FUNCTION],
    ['hash_set!',     TokenType.FUNCTION],
    ['btree_map!',    TokenType.FUNCTION],
    ['btree_set!',    TokenType.FUNCTION],
    ['include!',      TokenType.FUNCTION],
    ['include_str!',  TokenType.FUNCTION],
    ['include_bytes!', TokenType.FUNCTION],
    ['concat!',       TokenType.FUNCTION],
    ['stringify!',    TokenType.FUNCTION],
    ['compile_error!', TokenType.FUNCTION],
    ['env!',          TokenType.FUNCTION],
    ['option_env!',   TokenType.FUNCTION],
    ['cfg!',          TokenType.FUNCTION],
    ['file!',         TokenType.FUNCTION],
    ['line!',         TokenType.FUNCTION],
    ['column!',       TokenType.FUNCTION],
    ['module_path!',  TokenType.FUNCTION],
    ['type_name!',    TokenType.FUNCTION],
    ['derive',        TokenType.DECORATOR],
    ['inline',        TokenType.DECORATOR],
    ['cold',          TokenType.DECORATOR],
    ['must_use',      TokenType.DECORATOR],
    ['deprecated',    TokenType.DECORATOR],
    ['test',          TokenType.DECORATOR],
    ['bench',         TokenType.DECORATOR],
    ['cfg',           TokenType.DECORATOR],
    ['cfg_attr',      TokenType.DECORATOR],
    ['allow',         TokenType.DECORATOR],
    ['deny',          TokenType.DECORATOR],
    ['forbid',        TokenType.DECORATOR],
    ['warn',          TokenType.DECORATOR],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strEscape = newState(def, 'string_escape');
  const byteString = newState(def, 'byte_string');
  const rawString = newState(def, 'raw_string');
  const rawByteString = newState(def, 'raw_byte_string');
  const blockComment = newState(def, 'block_comment');
  const docComment = newState(def, 'doc_comment');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\nrt"']|[0-7]{1,3}|x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]{1,6}\}|[^0-9xu])/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Byte string: b"..."
  byteString.onUnmatched = OnUnmatched.CHARACTER;
  addRule(byteString, 'byte_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Raw string: r"..." or r#"..."#
  rawString.onUnmatched = OnUnmatched.CHARACTER;
  rawString.contentTokenType = TokenType.STRING;

  // Raw byte string: br"..." or br#"..."#
  rawByteString.onUnmatched = OnUnmatched.CHARACTER;
  rawByteString.contentTokenType = TokenType.STRING;

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Doc comments
  docComment.onUnmatched = OnUnmatched.CHARACTER;
  docComment.contentTokenType = TokenType.COMMENT;

  // Common rules
  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern',
      'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match',
      'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static',
      'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where',
      'while', 'async', 'await', 'dyn', 'try', 'union', 'macro_rules',
      'default', 'cfg', 'repr',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'function_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bfn\s+([A-Za-z_]\w*)\s*[<({]/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'struct_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bstruct\s+([A-Za-z_]\w*)(?:\s*<[^>]*>)?\s*\{/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'enum_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\benum\s+([A-Za-z_]\w*)(?:\s*<[^>]*>)?\s*\{/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'trait_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\btrait\s+([A-Za-z_]\w*)(?:\s*<[^>]*>)?\s*\{/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'type_alias', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\btype\s+([A-Za-z_]\w*)\s*=(?!=)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
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

  addRule(common, 'macro_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*!/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'attribute', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#!?\[[^\]]*\]/.source;
    r.action = action(TokenType.DECORATOR);
  });

  addRule(common, 'lifetime', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /'[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules
  // Line comments: //, ///, //!
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

  // Doc block comment /** ... */
  addRule(shared, 'doc_block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, docComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = docComment.id;
  });

  // String literals
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Byte string: b"..."
  addRule(shared, 'byte_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /b"/.source;
    r.end   = /"/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, byteString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = byteString.id;
  });

  // Raw string: r"..." or r#"..."#
  addRule(shared, 'raw_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /r#*"[^"]*"#*/.source;
    r.action = action(TokenType.STRING);
  });

  // Raw byte string: br"..." or br#"..."#
  addRule(shared, 'raw_byte_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /br#*"[^"]*"#*/.source;
    r.action = action(TokenType.STRING);
  });

  // Byte character: b'...'
  addRule(shared, 'byte_char', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /b'(?:\\.|[^'\\])'/.source;
    r.action = action(TokenType.STRING);
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
    r.pattern = /\b\d+[ui](8|16|32|64|128|size)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX][0-9a-fA-F_]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_oct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[oO][0-7_]+\b/.source;
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
    r.pattern = /\b\d+\.\d*(?:[eE][+-]?\d+)?[f](32|64)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|<=|>=|==|!=|&&|\|\||\.\.\.|\.\.|->|=>|\?/.source;
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
  def.exampleCode = `//! This is a crate-level doc comment

use std::collections::HashMap;
use std::fmt::{Display, Formatter, Result as FmtResult};

/// A simple person struct with doc comment
#[derive(Debug, Clone, PartialEq)]
pub struct Person {
    pub name: String,
    pub age: u32,
}

impl Person {
    /// Creates a new Person
    pub fn new(name: &str, age: u32) -> Self {
        Self {
            name: name.to_string(),
            age,
        }
    }

    pub fn greet(&self) -> String {
        format!("Hello, {}! You are {} years old.", self.name, self.age)
    }
}

/// A trait for things that can speak
pub trait Speak {
    fn speak(&self) -> String;
}

impl Speak for Person {
    fn speak(&self) -> String {
        self.greet()
    }
}

/// This function demonstrates pattern matching
fn describe_optional(value: Option<&str>) -> String {
    match value {
        Some("hello") => "You said hello!".to_string(),
        Some(text) => format!("You said: {}", text),
        None => "Nothing was said".to_string(),
    }
}

/// Generic function with type parameters and where clause
fn process_data<T, U>(data: T, transform: U) -> T
where
    T: Clone + Display,
    U: Fn(T) -> T,
{
    let result = transform(data.clone());
    println!("Transformed: {}", result);
    result
}

/// Error handling with Result
fn parse_number(input: &str) -> Result<i32, std::num::ParseIntError> {
    input.trim().parse::<i32>()
}

/// Using lifetimes
fn first_word<'a>(s: &'a str) -> &'a str {
    let bytes = s.as_bytes();
    for (i, &item) in bytes.iter().enumerate() {
        if item == b' ' {
            return &s[0..i];
        }
    }
    &s[..]
}

/// Using async/await (as of Rust 1.39+)
async fn fetch_data(url: &str) -> Result<String, reqwest::Error> {
    let response = reqwest::get(url).await?;
    let text = response.text().await?;
    Ok(text)
}

/// Using a macro
macro_rules! create_vec {
    ($($x:expr),*) => {
        {
            let mut temp_vec = Vec::new();
            $(
                temp_vec.push($x);
            )*
            temp_vec
        }
    };
}

/// Main function
fn main() {
    // Variable bindings
    let x: i32 = 42;
    let y = 3.14f64;
    let z = x as f64 + y;
    println!("z = {:.2}", z);

    // Mutable variable
    let mut counter = 0;
    counter += 1;

    // String
    let hello = "Hello, world!";
    let owned_string = String::from(hello);

    // Vector
    let numbers = vec![1, 2, 3, 4, 5];
    let doubled: Vec<i32> = numbers.iter().map(|&n| n * 2).collect();

    // HashMap
    let mut map = HashMap::new();
    map.insert("key1", "value1");

    // Pattern matching
    let result = match x {
        0..=10 => "small",
        11..=42 => "medium",
        _ => "large",
    };

    // If let
    if let Some(value) = Some(42) {
        println!("Value: {}", value);
    }

    // While let
    let mut stack = vec![1, 2, 3];
    while let Some(top) = stack.pop() {
        println!("Popped: {}", top);
    }

    // For loop
    for i in 0..5 {
        println!("i = {}", i);
    }

    // Closure
    let add = |a, b| a + b;
    println!("3 + 4 = {}", add(3, 4));

    // Struct
    let person = Person::new("Alice", 30);
    println!("{}", person.greet());

    // Array
    let arr: [i32; 3] = [1, 2, 3];
    let slice = &arr[0..2];

    // Tuple
    let tuple = (42, "hello", 3.14);
    println!("Tuple: {:?}", tuple);

    // Option and unwrap
    let maybe = Some(42);
    let value = maybe.unwrap_or(0);

    // Result and error handling
    match parse_number("42") {
        Ok(num) => println!("Parsed: {}", num),
        Err(e) => println!("Error: {}", e),
    }

    // Lifecycle
    let s = String::from("hello world");
    let word = first_word(&s);
    println!("First word: {}", word);

    // Using trait
    let speaker: Box<dyn Speak> = Box::new(Person::new("Bob", 25));
    println!("{}", speaker.speak());

    // Macro
    let v = create_vec![1, 2, 3, 4];
    println!("Vec: {:?}", v);

    // Attribute
    #[cfg(target_os = "linux")]
    println!("Running on Linux");
}`;

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
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];
  def.styles.push(style);

  return def;
}