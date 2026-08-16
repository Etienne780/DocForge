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

  // Block comments (nested)
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Common rules
  // Keywords
  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'as', 'case', 'class', 'data', 'default', 'deriving', 'do', 'else',
      'foreign', 'if', 'import', 'in', 'infix', 'infixl', 'infixr',
      'instance', 'let', 'module', 'newtype', 'of', 'then', 'type',
      'where', '_',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Reserved symbols
  addRule(common, 'reserved_ops', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /::|->|=>|<-|\.\./.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Type constructor (starts with uppercase) – register as TYPE
  addRule(common, 'type_constructor', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Z][A-Za-z_']*/.source;
    r.action = action(TokenType.TYPE);
  });

  // Data constructor (starts with uppercase or colon)
  addRule(common, 'data_constructor', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /:[A-Za-z_']*/.source;
    r.action = action(TokenType.TYPE);
  });

  // Variable / function name (starts with lowercase) – color as FUNCTION when followed by pattern? We'll use identifier.
  addRule(common, 'function_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[a-z][A-Za-z_']*/.source;
    // Not registering, just color as IDENTIFIER for now – will be overridden by function call rule
    r.action = action(TokenType.IDENTIFIER);
  });

  // Function call (identifier followed by pattern) – we color as FUNCTION
  addRule(common, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([a-z][A-Za-z_']*)\s+(?![=:])/.source; // not followed by '=' or ':'
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Operator symbols (excluding reserved) – color as OPERATOR
  addRule(common, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[!#$%&*+./<=>?@\\^|~:-]+/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Number literals (including scientific, hex, octal)
  addRule(common, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:0[xX][0-9a-fA-F]+|0[oO][0-7]+|0[bB][01]+|\d+\.\d*(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+|\d+)\b/.source;
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
  // Line comments (--)
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /--.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Block comments {- ... -} (nested)
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /{-/.source;
    r.end   = /-}/.source;
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

  // Character literal: 'a'
  addRule(shared, 'char_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /'(?:\\.|[^'\\])'/.source;
    r.action = action(TokenType.STRING);
  });

  // Punctuation: parentheses, braces, brackets, commas, semicolons, etc.
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,`]/.source;
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

  return [darkStyle];
}