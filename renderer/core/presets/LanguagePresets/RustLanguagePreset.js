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

// `keyword Name` -> KEYWORD + TYPE (registered globally)
function typeDeclarationAction() {
  return captureAction({
    '1': { tokenType: TokenType.KEYWORD, register: null },
    '2': { tokenType: TokenType.TYPE, register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) },
  });
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
    r.pattern = /\\(?:[\\nrt0"']|x[0-9a-fA-F]{2}|u\{[0-9a-fA-F_]{1,6}\}|$)/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Byte string: b"..." / C string: c"..."
  byteString.onUnmatched = OnUnmatched.CHARACTER;
  addRule(byteString, 'byte_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Raw string: r"..." or r#"..."# (no escapes)
  rawString.onUnmatched = OnUnmatched.CHARACTER;
  rawString.contentTokenType = TokenType.STRING;

  // Raw byte string: br"..." or br#"..."# (no escapes)
  rawByteString.onUnmatched = OnUnmatched.CHARACTER;
  rawByteString.contentTokenType = TokenType.STRING;

  // Block comments (Rust block comments nest)
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;
  addRule(blockComment, 'nested_block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Doc comments
  docComment.onUnmatched = OnUnmatched.CHARACTER;
  docComment.contentTokenType = TokenType.COMMENT;
  addRule(docComment, 'include_block_comment', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = blockComment.id;
  });

  // Common rules
  // Raw identifier: r#type
  addRule(common, 'raw_identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\br#[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  addRule(common, 'macro_rules_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(macro_rules!)\s*([A-Za-z_]\w*)?/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.KEYWORD, register: null },
      '2': { tokenType: TokenType.FUNCTION, register: null },
    });
  });

  addRule(common, 'function_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(fn)\s+([A-Za-z_]\w*)/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.KEYWORD, register: null },
      '2': { tokenType: TokenType.FUNCTION, register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL) },
    });
  });

  // Declared type names -> TYPE (registered globally)
  addRule(common, 'struct_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(struct)\s+([A-Za-z_]\w*)/.source;
    r.action = typeDeclarationAction();
  });

  addRule(common, 'enum_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(enum)\s+([A-Za-z_]\w*)/.source;
    r.action = typeDeclarationAction();
  });

  addRule(common, 'trait_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(trait)\s+([A-Za-z_]\w*)/.source;
    r.action = typeDeclarationAction();
  });

  // `union` is a contextual keyword: only `union Name {` / `union Name<`
  addRule(common, 'union_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(union)\s+([A-Za-z_]\w*)(?=\s*[<{])/.source;
    r.action = typeDeclarationAction();
  });

  addRule(common, 'type_alias', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(type)\s+([A-Za-z_]\w*)/.source;
    r.action = typeDeclarationAction();
  });

  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern',
      'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match',
      'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static',
      'struct', 'super', 'trait', 'type', 'unsafe', 'use', 'where',
      'while', 'async', 'await', 'dyn', 'try', 'macro_rules',
      'default', 'gen', 'yield', 'become', 'box', 'macro',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Macro invocation: println!(...), vec![...]
  addRule(common, 'macro_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Za-z_]\w*!(?!=)/.source;
    r.action = action(TokenType.FUNCTION);
  });

  // Capitalized call: tuple structs / enum variants keep their type color
  // (Some/Ok/Err resolve to FUNCTION through the predefined symbols).
  addRule(common, 'capitalized_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Z]\w*(?=\s*\()/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  addRule(common, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)(?=\s*(?:::\s*<[^()]*>\s*)?\()/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.FUNCTION, register: null },
    });
  });

  addRule(common, 'attribute', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#!?\[[^\]]*\]/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // Lifetimes / loop labels: 'a, 'static (char literals are matched before)
  addRule(common, 'lifetime', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /'[A-Za-z_]\w*(?!')/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Macro metavariables: $x:expr, $name
  addRule(common, 'macro_fragment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(\$[A-Za-z_]\w*)(:)(block|expr(?:_2021)?|ident|item|lifetime|literal|meta|pat(?:_param)?|path|stmt|tt|ty|vis)\b/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.VARIABLE, register: null },
      '2': { tokenType: TokenType.PUNCTUATION, register: null },
      '3': { tokenType: TokenType.TYPE, register: null },
    });
  });

  addRule(common, 'macro_variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Macro repetition: $( ... )*
  addRule(common, 'macro_repetition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$/.source;
    r.action = action(TokenType.OPERATOR);
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

  // Block comment /* ... */ (also matches the empty comment /**/)
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*(?!\*(?!\/))/.source;
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

  // Raw byte string: br"..." or br#"..."#
  addRule(shared, 'raw_byte_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\bbr(#*)"/.source;
    r.dynamicEnd = createDynamicEnd(1, '"${0}');
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, rawByteString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = rawByteString.id;
  });

  // Raw string: r"...", r#"..."#, cr#"..."#
  addRule(shared, 'raw_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\bc?r(#*)"/.source;
    r.dynamicEnd = createDynamicEnd(1, '"${0}');
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, rawString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = rawString.id;
  });

  // Byte string: b"..." / C string: c"..."
  addRule(shared, 'byte_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\b[bc]"/.source;
    r.end   = /"/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, byteString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = byteString.id;
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

  // Byte character: b'...'
  addRule(shared, 'byte_char', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bb'(?:\\(?:x[0-9a-fA-F]{2}|.)|[^'\\])'/.source;
    r.action = action(TokenType.STRING);
  });

  // Character literal: 'x', '\n', '\u{1F600}' (before lifetimes)
  addRule(shared, 'char_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /'(?:\\(?:x[0-9a-fA-F]{2}|u\{[0-9a-fA-F_]{1,6}\}|.)|[^'\\])'/.source;
    r.action = action(TokenType.STRING);
  });

  // Numbers: hex/oct/bin first, then decimal int/float with `_`,
  // exponent and type suffixes (1_000u64, 1e-3f32, 2.5). `1..2` stays a range.
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0x[0-9a-fA-F_]+(?:[iu](?:8|16|32|64|128|size))?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_oct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0o[0-7_]+(?:[iu](?:8|16|32|64|128|size))?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_bin', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0b[01_]+(?:[iu](?:8|16|32|64|128|size))?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d[\d_]*(?:\.\d[\d_]*(?:[eE][+-]?[\d_]+)?|[eE][+-]?[\d_]+|\.(?![.\w]))(?:f32|f64)?|\b\d[\d_]*(?:f32|f64)\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d[\d_]*(?:[iu](?:8|16|32|64|128|size))?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators (longest first)
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /<<=|>>=|\.\.\.|\.\.=|\.\.|::|->|=>|==|!=|<=|>=|&&|\|\||<<|>>|[+\-*/%^&|]=|[+\-*/%&|^~!<>=?@]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.:]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules (literals/comments before identifiers so r"", b'', 'x', 42 win)
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
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
}

/// Modern syntax
const fn square(n: u32) -> u32 { n * n }

fn modern<'a>(items: &'a [i32]) -> Option<&'a i32> {
    let raw = r#"raw "quoted" text"#;
    let (bytes, cstr) = (b"bytes", c"c string");
    let (ch, big, tiny) = ('\\u{1F600}', 1_000_000u64, 1e-3f32);
    let Some(first) = items.first() else { return None; };
    let evens = items.iter().filter(|&&n| n % 2 == 0).collect::<Vec<_>>();
    'outer: for i in 0..=10 { if i > 5 { break 'outer; } }
    Some(first)
}`;
  return def;
}

export function createRustLanguageStyles(rsDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(rsDef.id, 'Dark+');
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
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  const lightStyle = createHighlightStyle(rsDef.id, 'Light+');
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
    createTokenStyle(TokenType.DECORATOR,     '#795e26'), // attributes #[...]
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(rsDef.id, 'One Dark');
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
    createTokenStyle(TokenType.DECORATOR,     '#61afef'), // attributes #[...]
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(rsDef.id, 'Monokai');
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
    createTokenStyle(TokenType.DECORATOR,     '#a6e22e'), // attributes #[...]
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(rsDef.id, 'Dracula');
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
    createTokenStyle(TokenType.DECORATOR,     '#50fa7b'), // attributes #[...]
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(rsDef.id, 'GitHub Light');
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
    createTokenStyle(TokenType.DECORATOR,     '#8250df'), // attributes #[...]
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}