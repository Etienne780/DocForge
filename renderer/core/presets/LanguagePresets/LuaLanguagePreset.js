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

export function createLuaLanguage() {
  const def = createSyntaxDefinition('Lua');
  def.aliases = ['lua'];
  def.id = 'LuaLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    // Global environment
    ['_G',            TokenType.VARIABLE],
    ['_VERSION',      TokenType.LITERAL],
    // Basic functions
    ['print',         TokenType.FUNCTION],
    ['tonumber',      TokenType.FUNCTION],
    ['tostring',      TokenType.FUNCTION],
    ['type',          TokenType.FUNCTION],
    ['error',         TokenType.FUNCTION],
    ['assert',        TokenType.FUNCTION],
    ['ipairs',        TokenType.FUNCTION],
    ['pairs',         TokenType.FUNCTION],
    ['next',          TokenType.FUNCTION],
    ['select',        TokenType.FUNCTION],
    ['getfenv',       TokenType.FUNCTION],
    ['setfenv',       TokenType.FUNCTION],
    ['getmetatable',  TokenType.FUNCTION],
    ['setmetatable',  TokenType.FUNCTION],
    ['rawget',        TokenType.FUNCTION],
    ['rawset',        TokenType.FUNCTION],
    ['rawequal',      TokenType.FUNCTION],
    ['rawlen',        TokenType.FUNCTION],
    ['pcall',         TokenType.FUNCTION],
    ['xpcall',        TokenType.FUNCTION],
    // String library
    ['string',        TokenType.TYPE],
    ['string.byte',   TokenType.FUNCTION],
    ['string.char',   TokenType.FUNCTION],
    ['string.find',   TokenType.FUNCTION],
    ['string.format', TokenType.FUNCTION],
    ['string.gmatch', TokenType.FUNCTION],
    ['string.gsub',   TokenType.FUNCTION],
    ['string.len',    TokenType.FUNCTION],
    ['string.lower',  TokenType.FUNCTION],
    ['string.upper',  TokenType.FUNCTION],
    ['string.rep',    TokenType.FUNCTION],
    ['string.reverse', TokenType.FUNCTION],
    ['string.sub',    TokenType.FUNCTION],
    // Table library
    ['table',         TokenType.TYPE],
    ['table.concat',  TokenType.FUNCTION],
    ['table.insert',  TokenType.FUNCTION],
    ['table.remove',  TokenType.FUNCTION],
    ['table.sort',    TokenType.FUNCTION],
    ['table.pack',    TokenType.FUNCTION],
    ['table.unpack',  TokenType.FUNCTION],
    // Math library
    ['math',          TokenType.TYPE],
    ['math.abs',      TokenType.FUNCTION],
    ['math.acos',     TokenType.FUNCTION],
    ['math.asin',     TokenType.FUNCTION],
    ['math.atan',     TokenType.FUNCTION],
    ['math.ceil',     TokenType.FUNCTION],
    ['math.cos',      TokenType.FUNCTION],
    ['math.deg',      TokenType.FUNCTION],
    ['math.exp',      TokenType.FUNCTION],
    ['math.floor',    TokenType.FUNCTION],
    ['math.log',      TokenType.FUNCTION],
    ['math.max',      TokenType.FUNCTION],
    ['math.min',      TokenType.FUNCTION],
    ['math.pi',       TokenType.LITERAL],
    ['math.rad',      TokenType.FUNCTION],
    ['math.random',   TokenType.FUNCTION],
    ['math.randomseed', TokenType.FUNCTION],
    ['math.sin',      TokenType.FUNCTION],
    ['math.sqrt',     TokenType.FUNCTION],
    ['math.tan',      TokenType.FUNCTION],
    // IO library
    ['io',            TokenType.TYPE],
    ['io.open',       TokenType.FUNCTION],
    ['io.close',      TokenType.FUNCTION],
    ['io.read',       TokenType.FUNCTION],
    ['io.write',      TokenType.FUNCTION],
    ['io.stdout',     TokenType.VARIABLE],
    ['io.stderr',     TokenType.VARIABLE],
    ['io.stdin',      TokenType.VARIABLE],
    // OS library
    ['os',            TokenType.TYPE],
    ['os.clock',      TokenType.FUNCTION],
    ['os.date',       TokenType.FUNCTION],
    ['os.difftime',   TokenType.FUNCTION],
    ['os.execute',    TokenType.FUNCTION],
    ['os.exit',       TokenType.FUNCTION],
    ['os.getenv',     TokenType.FUNCTION],
    ['os.remove',     TokenType.FUNCTION],
    ['os.rename',     TokenType.FUNCTION],
    ['os.setlocale',  TokenType.FUNCTION],
    ['os.time',       TokenType.FUNCTION],
    ['os.tmpname',    TokenType.FUNCTION],
    // Coroutine library
    ['coroutine',     TokenType.TYPE],
    ['coroutine.create', TokenType.FUNCTION],
    ['coroutine.resume', TokenType.FUNCTION],
    ['coroutine.running', TokenType.FUNCTION],
    ['coroutine.status', TokenType.FUNCTION],
    ['coroutine.wrap', TokenType.FUNCTION],
    ['coroutine.yield', TokenType.FUNCTION],
    // Debug library
    ['debug',         TokenType.TYPE],
    ['debug.debug',   TokenType.FUNCTION],
    ['debug.getinfo', TokenType.FUNCTION],
    ['debug.getlocal', TokenType.FUNCTION],
    ['debug.getupvalue', TokenType.FUNCTION],
    ['debug.setlocal', TokenType.FUNCTION],
    ['debug.setupvalue', TokenType.FUNCTION],
    ['debug.traceback', TokenType.FUNCTION],
    // Bit library (Lua 5.3+)
    ['bit32',         TokenType.TYPE],
    ['bit32.band',    TokenType.FUNCTION],
    ['bit32.bor',     TokenType.FUNCTION],
    ['bit32.bxor',    TokenType.FUNCTION],
    ['bit32.bnot',    TokenType.FUNCTION],
    ['bit32.lshift',  TokenType.FUNCTION],
    ['bit32.rshift',  TokenType.FUNCTION],
    ['bit32.arshift', TokenType.FUNCTION],
    ['bit32.btest',   TokenType.FUNCTION],
    // Literals
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['nil',           TokenType.LITERAL],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const longString = newState(def, 'long_string');
  const blockComment = newState(def, 'block_comment');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[abfnrtv\\"']|z|[0-9]{1,3}|x[0-9a-fA-F]{2})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted strings
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted strings
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Long strings: [[...]] or [=[...]=]
  longString.onUnmatched = OnUnmatched.CHARACTER;
  longString.contentTokenType = TokenType.STRING;

  // Block comments: --[[...]] or --[=[...]=]
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Shared rules
  // Block comments --[[ ... ]] / --[==[ ... ]==] (before line comments and
  // long strings; the closing bracket must use the same number of `=`)
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /--\[(=*)\[/.source;
    r.dynamicEnd = createDynamicEnd(1, '\\]${0}\\]');
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Line comments
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /--.*/.source;
    r.action = action(TokenType.COMMENT);
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

  // Single-quoted strings
  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // Long strings: [[...]] / [==[...]==]
  addRule(shared, 'long_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\[(=*)\[/.source;
    r.dynamicEnd = createDynamicEnd(1, '\\]${0}\\]');
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, longString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = longString.id;
  });

  // Numbers: hex (incl. hex floats 0x1p4, 0xA.8p-1) first, then decimal
  // float (with exponent) and int
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX](?:[0-9a-fA-F]+(?:\.(?!\.)[0-9a-fA-F]*)?|\.[0-9a-fA-F]+)(?:[pP][+-]?\d+)?/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:\b\d+\.(?!\.)\d*|(?<![\w.])\.\d+)(?:[eE][+-]?\d+)?|\b\d+[eE][+-]?\d+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators (longest first): ... .. // << >> == ~= <= >= and single chars
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\.\.\.|\.\.|\/\/|<<|>>|==|~=|<=|>=|[+\-*\/%^#&|~<>=]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];:,.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules
  // Goto label: ::label::
  addRule(root, 'goto_label', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(::)\s*([A-Za-z_]\w*)\s*(::)/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.PUNCTUATION, register: null },
      '2': { tokenType: TokenType.DECORATOR, register: null },
      '3': { tokenType: TokenType.PUNCTUATION, register: null },
    });
  });

  // Variable attributes (Lua 5.4): local x <const>, local f <close>
  addRule(root, 'variable_attribute', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(<)\s*(const|close)\s*(>)/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.PUNCTUATION, register: null },
      '2': { tokenType: TokenType.KEYWORD, register: null },
      '3': { tokenType: TokenType.PUNCTUATION, register: null },
    });
  });

  // Method call: obj:method(...), obj:method "str", obj:method { }
  addRule(root, 'method_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(:)([A-Za-z_]\w*)(?=\s*[("'{])/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.PUNCTUATION, register: null },
      '2': { tokenType: TokenType.FUNCTION, register: null },
    });
  });

  // Field call: obj.func(...)
  addRule(root, 'field_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(\.)([A-Za-z_]\w*)(?=\s*[("'])/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.PUNCTUATION, register: null },
      '2': { tokenType: TokenType.FUNCTION, register: null },
    });
  });

  // Property access: obj.name
  addRule(root, 'property_access', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(\.)([A-Za-z_]\w*)/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.PUNCTUATION, register: null },
      '2': { tokenType: TokenType.PROPERTY, register: null },
    });
  });

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Local function declaration: local function name(...)
  addRule(root, 'local_function_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(local)\s+(function)\s+([A-Za-z_]\w*)(?=\s*\()/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.KEYWORD, register: null },
      '2': { tokenType: TokenType.KEYWORD, register: null },
      '3': { tokenType: TokenType.FUNCTION, register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.STATE) },
    });
  });

  // Function declaration: function name(...), function M.name(...), function M:name(...)
  addRule(root, 'function_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(function)\s+(?:([A-Za-z_]\w*)\s*([.:]))?(?:([A-Za-z_]\w*)\s*([.:]))?([A-Za-z_]\w*)(?=\s*\()/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.KEYWORD, register: null },
      '2': { tokenType: TokenType.IDENTIFIER, register: null },
      '3': { tokenType: TokenType.PUNCTUATION, register: null },
      '4': { tokenType: TokenType.PROPERTY, register: null },
      '5': { tokenType: TokenType.PUNCTUATION, register: null },
      '6': { tokenType: TokenType.FUNCTION, register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL) },
    });
  });

  // Local variable declaration: local name
  addRule(root, 'local_variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(local)\s+(?!function\b)([A-Za-z_]\w*)/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.KEYWORD, register: null },
      '2': { tokenType: TokenType.VARIABLE, register: createSymbolRegister(TokenType.VARIABLE, RegisterScope.STATE) },
    });
  });

  // Goto statement: goto label
  addRule(root, 'goto_statement', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(goto)\s+([A-Za-z_]\w*)/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.KEYWORD, register: null },
      '2': { tokenType: TokenType.DECORATOR, register: null },
    });
  });

  // Keywords
  addRule(root, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for',
      'function', 'goto', 'if', 'in', 'local', 'nil', 'not', 'or',
      'repeat', 'return', 'then', 'true', 'until', 'while',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Function call: name(...), name "str", name 'str'
  addRule(root, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)(?=\s*[("'])/.source;
    r.action = captureAction({
      '1': { tokenType: TokenType.FUNCTION, register: null },
    });
  });

  // Identifier fallback
  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Example code
  def.exampleCode = `-- Lua example
-- This is a comment

--[[
  This is a block comment
  spanning multiple lines
]]

-- Variable declaration
local name = "Alice"
local age = 30
local pi = math.pi

-- Function definition
function greet(person)
    return "Hello, " .. person .. "!"
end

-- Local function
local function add(a, b)
    return a + b
end

-- Table / object
local person = {
    name = "Bob",
    age = 25,
    hobbies = { "reading", "coding", "gaming" },
    greet = function(self)
        return "Hello, I'm " .. self.name
    end
}

-- Method call
print(person:greet())

-- Control flow
if age > 18 then
    print("Adult")
elseif age == 18 then
    print("Just turned 18")
else
    print("Minor")
end

-- Loops
for i = 1, 5 do
    print("Iteration " .. i)
end

local count = 0
while count < 3 do
    print("Count: " .. count)
    count = count + 1
end

repeat
    print("At least once")
until count > 5

-- Table iteration
for key, value in pairs(person) do
    print(key .. ": " .. tostring(value))
end

-- Array-style table
local fruits = { "apple", "banana", "cherry" }
for i, fruit in ipairs(fruits) do
    print(fruit)
end

-- String methods
local str = "hello world"
print(string.upper(str))
print(str:sub(1, 5))

-- Error handling
local success, result = pcall(function()
    error("Something went wrong")
end)
if not success then
    print("Error: " .. tostring(result))
end

-- Goto
local i = 0
::loop::
    i = i + 1
    print(i)
    if i < 3 then goto loop end

-- Lua 5.4 syntax
local limit <const> = 0x10
local file <close> = io.open("data.txt")
local q, bits = 7 // 2, 0xFF & ~0x0F | 1 << 4
local ratio = 6.02e23 + 0x1p4
local long = [==[ a ]] inside ]==]
--[==[ level comment with ]] inside ]==]
for i = 1, 3 do
  if i == 2 then goto continue end
  print(i)
  ::continue::
end

-- Return statement
return true
`;
  return def;
}

export function createLuaLanguageStyles(luaDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(luaDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.TYPE,          '#4ec9b0'),
    createTokenStyle(TokenType.FUNCTION,      '#dcdcaa'),
    createTokenStyle(TokenType.VARIABLE,      '#9cdcfe'),
    createTokenStyle(TokenType.PROPERTY,      '#9cdcfe'),
    createTokenStyle(TokenType.IDENTIFIER,    '#9cdcfe'),
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

  const lightStyle = createHighlightStyle(luaDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#0000ff'),
    createTokenStyle(TokenType.TYPE,          '#267f99'),
    createTokenStyle(TokenType.FUNCTION,      '#795e26'),
    createTokenStyle(TokenType.VARIABLE,      '#001080'),
    createTokenStyle(TokenType.PROPERTY,      '#001080'),
    createTokenStyle(TokenType.IDENTIFIER,    '#001080'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.DECORATOR,     '#795e26'), // goto labels
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(luaDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.TYPE,          '#e5c07b'),
    createTokenStyle(TokenType.FUNCTION,      '#61afef'),
    createTokenStyle(TokenType.VARIABLE,      '#e06c75'),
    createTokenStyle(TokenType.PROPERTY,      '#e06c75'),
    createTokenStyle(TokenType.IDENTIFIER,    '#abb2bf'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.DECORATOR,     '#61afef'), // goto labels
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(luaDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.VARIABLE,      '#f8f8f2'),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.DECORATOR,     '#a6e22e'), // goto labels
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(luaDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.TYPE,          '#8be9fd', { italic: true }),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.VARIABLE,      '#f8f8f2'),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.DECORATOR,     '#50fa7b'), // goto labels
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(luaDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.TYPE,          '#953800'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.VARIABLE,      '#24292f'),
    createTokenStyle(TokenType.PROPERTY,      '#0550ae'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.DECORATOR,     '#8250df'), // goto labels
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}