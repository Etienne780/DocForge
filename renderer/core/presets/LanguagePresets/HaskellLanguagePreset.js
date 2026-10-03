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

export function createHaskellLanguage() {
  const def = createSyntaxDefinition('Haskell');
  def.aliases = ['hs', 'haskell'];
  def.id = 'HaskellLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols – common types, functions, and built-ins
  const predefined = [
    // Primitive types
    ['Int',           TokenType.TYPE],
    ['Integer',       TokenType.TYPE],
    ['Float',         TokenType.TYPE],
    ['Double',        TokenType.TYPE],
    ['Char',          TokenType.TYPE],
    ['Bool',          TokenType.TYPE],
    ['String',        TokenType.TYPE],
    ['IO',            TokenType.TYPE],
    ['Maybe',         TokenType.TYPE],
    ['Either',        TokenType.TYPE],
    ['List',          TokenType.TYPE],
    ['[]',            TokenType.TYPE],
    ['()',            TokenType.TYPE],
    ['(->)',          TokenType.TYPE],
    ['Ord',           TokenType.TYPE],
    ['Eq',            TokenType.TYPE],
    ['Show',          TokenType.TYPE],
    ['Read',          TokenType.TYPE],
    ['Enum',          TokenType.TYPE],
    ['Bounded',       TokenType.TYPE],
    ['Num',           TokenType.TYPE],
    ['Integral',      TokenType.TYPE],
    ['Floating',      TokenType.TYPE],
    ['Fractional',    TokenType.TYPE],
    ['Real',          TokenType.TYPE],
    ['RealFrac',      TokenType.TYPE],
    ['RealFloat',     TokenType.TYPE],
    ['Functor',       TokenType.TYPE],
    ['Applicative',   TokenType.TYPE],
    ['Monad',         TokenType.TYPE],
    ['MonadIO',       TokenType.TYPE],
    ['Foldable',      TokenType.TYPE],
    ['Traversable',   TokenType.TYPE],
    ['Semigroup',     TokenType.TYPE],
    ['Monoid',        TokenType.TYPE],
    // Common functions
    ['id',            TokenType.FUNCTION],
    ['const',         TokenType.FUNCTION],
    ['flip',          TokenType.FUNCTION],
    ['curry',         TokenType.FUNCTION],
    ['uncurry',       TokenType.FUNCTION],
    ['($)',           TokenType.FUNCTION],
    ['(.)',           TokenType.FUNCTION],
    ['(++)',          TokenType.FUNCTION],
    ['(++)',          TokenType.FUNCTION],
    ['map',           TokenType.FUNCTION],
    ['filter',        TokenType.FUNCTION],
    ['foldl',         TokenType.FUNCTION],
    ['foldr',         TokenType.FUNCTION],
    ['foldl\'',       TokenType.FUNCTION],
    ['foldr\'',       TokenType.FUNCTION],
    ['scanl',         TokenType.FUNCTION],
    ['scanr',         TokenType.FUNCTION],
    ['zip',           TokenType.FUNCTION],
    ['zipWith',       TokenType.FUNCTION],
    ['unzip',         TokenType.FUNCTION],
    ['concat',        TokenType.FUNCTION],
    ['concatMap',     TokenType.FUNCTION],
    ['sequence',      TokenType.FUNCTION],
    ['sequence_',     TokenType.FUNCTION],
    ['mapM',          TokenType.FUNCTION],
    ['mapM_',         TokenType.FUNCTION],
    ['forM',          TokenType.FUNCTION],
    ['forM_',         TokenType.FUNCTION],
    ['return',        TokenType.FUNCTION],
    ['pure',          TokenType.FUNCTION],
    ['fmap',          TokenType.FUNCTION],
    ['(<$>)',         TokenType.FUNCTION],
    ['(<*>)',         TokenType.FUNCTION],
    ['(>>=)',         TokenType.FUNCTION],
    ['(>>)',          TokenType.FUNCTION],
    ['fail',          TokenType.FUNCTION],
    ['print',         TokenType.FUNCTION],
    ['putStr',        TokenType.FUNCTION],
    ['putStrLn',      TokenType.FUNCTION],
    ['getLine',       TokenType.FUNCTION],
    ['getContents',   TokenType.FUNCTION],
    ['interact',      TokenType.FUNCTION],
    ['read',          TokenType.FUNCTION],
    ['show',          TokenType.FUNCTION],
    ['reads',         TokenType.FUNCTION],
    ['shows',         TokenType.FUNCTION],
    ['error',         TokenType.FUNCTION],
    ['undefined',     TokenType.FUNCTION],
    ['seq',           TokenType.FUNCTION],
    ['($!)',          TokenType.FUNCTION],
    // Literals
    ['True',          TokenType.LITERAL],
    ['False',         TokenType.LITERAL],
    ['()',            TokenType.LITERAL],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strEscape = newState(def, 'string_escape');
  const blockComment = newState(def, 'block_comment');
  const pragma = newState(def, 'pragma');

  // Escape sequences for strings
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

  // Block comments (nested to any depth)
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;
  addRule(blockComment, 'nested_block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\{-/.source;
    r.end   = /-\}/.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Pragmas {-# LANGUAGE ... #-}
  pragma.onUnmatched = OnUnmatched.CHARACTER;
  pragma.contentTokenType = TokenType.DECORATOR;

  // Common rules
  // Contextual keywords: type family, data instance, type role,
  // deriving stock/anyclass/newtype, deriving (..) via T, pattern synonyms
  addRule(common, 'contextual_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(type|data)\s+(family|instance|role)\b|\b(deriving)\s+(stock|anyclass|newtype)\b|(?<=\)\s*)\bvia\b|^\bpattern\b(?=\s+[A-Z(])/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.KEYWORD, register: null },
      '2': { tokenType: TokenType.KEYWORD, register: null },
      '3': { tokenType: TokenType.KEYWORD, register: null },
      '4': { tokenType: TokenType.KEYWORD, register: null },
    });
    r.action.tokenType = TokenType.KEYWORD;
  });

  // Keywords
  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'as', 'case', 'class', 'data', 'default', 'deriving', 'do', 'else',
      'foreign', 'if', 'import', 'in', 'infix', 'infixl', 'infixr',
      'instance', 'let', 'module', 'newtype', 'of', 'then', 'type',
      'where', '_', 'qualified', 'hiding', 'forall', 'mdo',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Reserved symbols (not when part of a longer operator like ->>)
  addRule(common, 'reserved_ops', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:::|->|=>|<-|\.\.)(?![!#$%&*+.\/<=>?@\\^|~:-])/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Module qualifier: Data.Map.lookup, M.insert
  addRule(common, 'module_qualifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:[A-Z][\w']*\.)+(?=[A-Za-z_(])/.source;
    r.action = action(TokenType.NAMESPACE);
  });

  // Type constructor (starts with uppercase) – register as TYPE
  addRule(common, 'type_constructor', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Z][\w']*/.source;
    r.action = action(TokenType.TYPE);
  });

  // Constructor operators: :|, :+ (plain `:` is the cons operator)
  addRule(common, 'data_constructor', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /:[!#$%&*+.\/<=>?@\\^|~:-]+/.source;
    r.action = action(TokenType.TYPE);
  });

  // Variable / function name (starts with lowercase or _)
  addRule(common, 'function_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[a-z_][\w']*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Backtick infix: `div`, `M.lookup`
  addRule(common, 'infix_function', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /`(?:[A-Z][\w']*\.)*[A-Za-z_][\w']*`/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Operator symbols (excluding reserved) – color as OPERATOR
  addRule(common, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[!#$%&*+.\/<=>?@\\^|~:-]+/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Number literals: hex / octal / binary, float with exponent, int;
  // `_` separators (NumericUnderscores)
  addRule(common, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|\d[\d_]*\.\d[\d_]*(?:[eE][+-]?\d+)?|\d[\d_]*[eE][+-]?\d+|\d[\d_]*)\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Identifier fallback
  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_'][A-Za-z0-9_']*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules
  // Pragmas {-# ... #-} (before block comments)
  addRule(shared, 'pragma', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\{-#/.source;
    r.end   = /#-\}/.source;
    r.beginAction = action(TokenType.DECORATOR, createSyntaxStateTransition(TransitionType.PUSH, pragma.id));
    r.endAction   = action(TokenType.DECORATOR, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.DECORATOR;
    r.innerStateId = pragma.id;
  });

  // Line comments (--, ---) but not operators like --> or |--
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<![!#$%&*+.\/<=>?@\\^|~:-])--+(?![!#$%&*+.\/<=>?@\\^|~:]).*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Block comments {- ... -} (nested)
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\{-/.source;
    r.end   = /-\}/.source;
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

  // Character literal: 'a', '\n', '\x41'
  addRule(shared, 'char_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /'(?:\\(?:x[0-9a-fA-F]+|o[0-7]+|\d+|\^[A-Z]|[A-Z]{2,3}|.)|[^'\\])'/.source;
    r.action = action(TokenType.STRING);
  });

  // Punctuation: parentheses, braces, brackets, commas, semicolons, etc.
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });

  // Example code
  def.exampleCode = `--
-- Haskell example
-- This is a comment

module Main where

-- Import
import Data.List
import qualified Data.Map as Map
import Control.Monad

-- Type synonyms
type Name = String
type Age = Int

-- Data type
data Person = Person { name :: Name, age :: Age } deriving (Show, Eq)

-- Type class instance
instance Ord Person where
    compare p1 p2 = compare (age p1) (age p2)

-- Function definition
greet :: Person -> String
greet p = "Hello, " ++ name p ++ "!"

-- Pattern matching
describePerson :: Person -> String
describePerson (Person n a)
    | a < 18    = n ++ " is a minor"
    | otherwise = n ++ " is an adult"

-- Higher-order function
applyTwice :: (a -> a) -> a -> a
applyTwice f x = f (f x)

-- List comprehension
squares :: [Int] -> [Int]
squares xs = [x^2 | x <- xs, x > 0]

-- Monadic IO
main :: IO ()
main = do
    putStrLn "Enter your name:"
    name <- getLine
    putStrLn $ "Hello, " ++ name

    let alice = Person { name = "Alice", age = 30 }
    putStrLn (greet alice)
    putStrLn (describePerson alice)

    -- Using map and filter
    let numbers = [1..10]
    let evens = filter even numbers
    print evens

    -- Using mapM_
    mapM_ print numbers

    -- Using infix operator
    let sum = foldl (+) 0 numbers
    print sum

-- Operator definition
infixl 7 *. 
(*.) :: Int -> Int -> Int
x *. y = x * y + 1

-- Type class with default methods
class MyClass a where
    method :: a -> String
    method _ = "default"

instance MyClass Int where
    method _ = "Int"

-- Data with constructor
data Maybe a = Nothing | Just a

-- Pattern match in let
let (a,b) = (1,2) in a + b
-- Modern GHC syntax
newtype Score = Score Int
  deriving stock (Show)
  deriving (Eq) via Int

describe :: Maybe Int -> String
describe = \\case
  Just n | n \`mod\` 2 == 0 -> "even"
  _ -> "other"

{- outer {- nested -} still comment -}
big :: Integer
big = 1_000_000
`;
  return def;
}

export function createHaskellLanguageStyles(hsDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(hsDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.TYPE,          '#4ec9b0'),
    createTokenStyle(TokenType.IDENTIFIER,    '#9cdcfe'),
    createTokenStyle(TokenType.VARIABLE,      '#9cdcfe'),
    createTokenStyle(TokenType.FUNCTION,      '#dcdcaa'),
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

  const lightStyle = createHighlightStyle(hsDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#0000ff'),
    createTokenStyle(TokenType.TYPE,          '#267f99'),
    createTokenStyle(TokenType.IDENTIFIER,    '#001080'),
    createTokenStyle(TokenType.FUNCTION,      '#795e26'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(hsDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.TYPE,          '#e5c07b'),
    createTokenStyle(TokenType.IDENTIFIER,    '#e06c75'),
    createTokenStyle(TokenType.FUNCTION,      '#61afef'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(hsDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(hsDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.TYPE,          '#8be9fd', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(hsDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.TYPE,          '#953800'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}