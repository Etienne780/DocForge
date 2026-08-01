import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxCaptureMap,
  createSymbolRegister,
  createSyntaxStateTransition,
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
  // Line comments
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /--(?!\[\[).*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Block comments --[[ ... ]]
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /--\[=*\[/.source;
    r.end   = /\]=\*\]/.source;
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

  // Long strings: [[...]]
  addRule(shared, 'long_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\[=*\[/.source;
    r.end   = /\]=\*\]/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, longString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = longString.id;
  });

  // Numbers (integer and float)
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX][0-9a-fA-F]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.\d+\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%^]=?|\.\.|[<>=]=?|~=|#|&|\||<<|>>/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];:,.](?![.])/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
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

  // Function declaration: function name(...)
  addRule(root, 'function_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bfunction\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?(?::[A-Za-z_]\w*)?)\s*\(/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Local function declaration: local function name(...)
  addRule(root, 'local_function_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\blocal\s+function\s+([A-Za-z_]\w*)\s*\(/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.STATE)
    };
    a.captures = caps;
    r.action = a;
  });

  // Local variable declaration: local name
  addRule(root, 'local_variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\blocal\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.VARIABLE,
      register: createSymbolRegister(TokenType.VARIABLE, RegisterScope.STATE)
    };
    a.captures = caps;
    r.action = a;
  });

  // Function call: name(...)
  addRule(root, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?(?::[A-Za-z_]\w*)?)\s*\(/.source;
    r.context = { notAfterTokenType: [TokenType.PUNCTUATION, TokenType.KEYWORD] };
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Method call: obj:method(...)
  addRule(root, 'method_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /:([A-Za-z_]\w*)\s*\(/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Property access: obj.name
  addRule(root, 'property_access', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\.([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.PROPERTY, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Goto label: ::label::
  addRule(root, 'goto_label', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /::([A-Za-z_]\w*)::/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.DECORATOR, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Goto statement: goto label
  addRule(root, 'goto_statement', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bgoto\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.DECORATOR, register: null };
    a.captures = caps;
    r.action = a;
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

-- Return statement
return true
`;

  // HighlightStyle
  const style = createHighlightStyle('Dark+');
  style.tokenStyles = [
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
  def.styles.push(style);

  return def;
}