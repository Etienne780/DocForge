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

export function createHolyCLanguage() {
  const def = createSyntaxDefinition('Holy-C');
  def.aliases = ['hc', 'holyc', 'templeos'];
  def.id = 'HolyCLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['I8',            TokenType.TYPE],
    ['U8',            TokenType.TYPE],
    ['I16',           TokenType.TYPE],
    ['U16',           TokenType.TYPE],
    ['I32',           TokenType.TYPE],
    ['U32',           TokenType.TYPE],
    ['I64',           TokenType.TYPE],
    ['U64',           TokenType.TYPE],
    ['F32',           TokenType.TYPE],
    ['F64',           TokenType.TYPE],
    ['Bool',          TokenType.TYPE],
    ['CDoc',          TokenType.TYPE],
    ['CDocItem',      TokenType.TYPE],
    ['CHashTable',    TokenType.TYPE],
    ['CQueue',        TokenType.TYPE],
    ['CStack',        TokenType.TYPE],
    ['CVector',       TokenType.TYPE],
    ['CList',         TokenType.TYPE],
    ['CTask',         TokenType.TYPE],
    ['CWindow',       TokenType.TYPE],
    ['CDir',          TokenType.TYPE],
    ['CFile',         TokenType.TYPE],
    ['CMouse',        TokenType.TYPE],
    ['CKeyboard',     TokenType.TYPE],
    ['CScreen',       TokenType.TYPE],
    ['CSound',        TokenType.TYPE],
    ['CNetwork',      TokenType.TYPE],
    ['CDateTime',     TokenType.TYPE],
    ['CRandom',       TokenType.TYPE],
    ['CMath',         TokenType.TYPE],
    ['CString',       TokenType.TYPE],
    ['CMemory',       TokenType.TYPE],
    ['public',        TokenType.KEYWORD],
    ['private',       TokenType.KEYWORD],
    ['protected',     TokenType.KEYWORD],
    ['static',        TokenType.KEYWORD],
    ['virtual',       TokenType.KEYWORD],
    ['override',      TokenType.KEYWORD],
    ['final',         TokenType.KEYWORD],
    ['abstract',      TokenType.KEYWORD],
    ['property',      TokenType.KEYWORD],
    ['event',         TokenType.KEYWORD],
    ['delegate',      TokenType.KEYWORD],
    ['lambda',        TokenType.KEYWORD],
    ['typeof',        TokenType.KEYWORD],
    ['sizeof',        TokenType.KEYWORD],
    ['new',           TokenType.KEYWORD],
    ['delete',        TokenType.KEYWORD],
    ['this',          TokenType.KEYWORD],
    ['base',          TokenType.KEYWORD],
    ['null',          TokenType.LITERAL],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['Print',         TokenType.FUNCTION],
    ['PrintLn',       TokenType.FUNCTION],
    ['PrintF',        TokenType.FUNCTION],
    ['PrintS',        TokenType.FUNCTION],
    ['Input',         TokenType.FUNCTION],
    ['InputS',        TokenType.FUNCTION],
    ['GetChar',       TokenType.FUNCTION],
    ['Key',           TokenType.FUNCTION],
    ['MouseX',        TokenType.FUNCTION],
    ['MouseY',        TokenType.FUNCTION],
    ['MouseButtons',  TokenType.FUNCTION],
    ['Wait',          TokenType.FUNCTION],
    ['Sleep',         TokenType.FUNCTION],
    ['Yield',         TokenType.FUNCTION],
    ['Exit',          TokenType.FUNCTION],
    ['ExitToShell',   TokenType.FUNCTION],
    ['Reboot',        TokenType.FUNCTION],
    ['PowerOff',      TokenType.FUNCTION],
    ['Beep',          TokenType.FUNCTION],
    ['Sound',         TokenType.FUNCTION],
    ['PlaySound',     TokenType.FUNCTION],
    ['GetTime',       TokenType.FUNCTION],
    ['GetDate',       TokenType.FUNCTION],
    ['SetTime',       TokenType.FUNCTION],
    ['SetDate',       TokenType.FUNCTION],
    ['FileOpen',      TokenType.FUNCTION],
    ['FileClose',     TokenType.FUNCTION],
    ['FileRead',      TokenType.FUNCTION],
    ['FileWrite',     TokenType.FUNCTION],
    ['FileExists',    TokenType.FUNCTION],
    ['DirOpen',       TokenType.FUNCTION],
    ['DirClose',      TokenType.FUNCTION],
    ['DirRead',       TokenType.FUNCTION],
    ['Malloc',        TokenType.FUNCTION],
    ['Free',          TokenType.FUNCTION],
    ['Calloc',        TokenType.FUNCTION],
    ['Realloc',       TokenType.FUNCTION],
    ['MemCopy',       TokenType.FUNCTION],
    ['MemSet',        TokenType.FUNCTION],
    ['MemCmp',        TokenType.FUNCTION],
    ['StrLen',        TokenType.FUNCTION],
    ['StrCopy',       TokenType.FUNCTION],
    ['StrCat',        TokenType.FUNCTION],
    ['StrCmp',        TokenType.FUNCTION],
    ['StrFind',       TokenType.FUNCTION],
    ['StrReplace',    TokenType.FUNCTION],
    ['StrToInt',      TokenType.FUNCTION],
    ['StrToFloat',    TokenType.FUNCTION],
    ['IntToStr',      TokenType.FUNCTION],
    ['FloatToStr',    TokenType.FUNCTION],
    ['Sin',           TokenType.FUNCTION],
    ['Cos',           TokenType.FUNCTION],
    ['Tan',           TokenType.FUNCTION],
    ['ASin',          TokenType.FUNCTION],
    ['ACos',          TokenType.FUNCTION],
    ['ATan',          TokenType.FUNCTION],
    ['Sqrt',          TokenType.FUNCTION],
    ['Pow',           TokenType.FUNCTION],
    ['Exp',           TokenType.FUNCTION],
    ['Log',           TokenType.FUNCTION],
    ['Log10',         TokenType.FUNCTION],
    ['Abs',           TokenType.FUNCTION],
    ['Min',           TokenType.FUNCTION],
    ['Max',           TokenType.FUNCTION],
    ['Clamp',         TokenType.FUNCTION],
    ['Lerp',          TokenType.FUNCTION],
    ['Random',        TokenType.FUNCTION],
    ['RandomSeed',    TokenType.FUNCTION],
    ['DrawPixel',     TokenType.FUNCTION],
    ['DrawLine',      TokenType.FUNCTION],
    ['DrawRect',      TokenType.FUNCTION],
    ['DrawCircle',    TokenType.FUNCTION],
    ['DrawEllipse',   TokenType.FUNCTION],
    ['DrawText',      TokenType.FUNCTION],
    ['DrawImage',     TokenType.FUNCTION],
    ['ClearScreen',   TokenType.FUNCTION],
    ['SetColor',      TokenType.FUNCTION],
    ['GetColor',      TokenType.FUNCTION],
    ['SetPixel',      TokenType.FUNCTION],
    ['GetPixel',      TokenType.FUNCTION],
    ['CreateWindow',  TokenType.FUNCTION],
    ['DestroyWindow', TokenType.FUNCTION],
    ['ShowWindow',    TokenType.FUNCTION],
    ['HideWindow',    TokenType.FUNCTION],
    ['MoveWindow',    TokenType.FUNCTION],
    ['ResizeWindow',  TokenType.FUNCTION],
    ['SetTitle',      TokenType.FUNCTION],
    ['GetTitle',      TokenType.FUNCTION],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const blockComment = newState(def, 'block_comment');
  const preproc = newState(def, 'preprocessor');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted string content
  strSingle.onUnmatched = OnUnmatched.CHARACTER;

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Preprocessor state
  preproc.onUnmatched = OnUnmatched.CHARACTER;

  // Common rules
  addRule(common, 'c_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
      'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
      'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof',
      'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void',
      'volatile', 'while',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'holyc_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'class', 'interface', 'enum', 'struct', 'union', 'typedef',
      'public', 'private', 'protected', 'static', 'virtual', 'override',
      'final', 'abstract', 'property', 'event', 'delegate', 'lambda',
      'typeof', 'new', 'delete', 'this', 'base',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'type_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(class|struct|interface|enum)\s+([A-Za-z_]\w*)(?:\s*<[^>]*>)?/.source;
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

  addRule(common, 'function_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*\(/.source;
    r.context = { notAfterTokenType: [TokenType.KEYWORD, TokenType.TYPE] };
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

  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules
  // Line comments (must come before preprocessor to avoid confusion)
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Block comments
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Preprocessor directives: #include, #define, #ifdef, etc.
  addRule(shared, 'preprocessor', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /^[ \t]*#/.source;
    r.end   = /(?<!\\)$/.source; // end of line, respecting line continuation
    r.beginAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, preproc.id));
    r.endAction   = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.KEYWORD;
    r.innerStateId = preproc.id;
  });

  // Preprocessor keyword (first token after #)
  addRule(preproc, 'preproc_keyword', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'include', 'define', 'undef', 'if', 'ifdef', 'ifndef',
      'elif', 'else', 'endif', 'pragma', 'error', 'warning', 'line',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // The rest of the preprocessor line (e.g., file name, expression) is handled by contentTokenType,
  // but for `#include "file.h"` we want the string to be colored as STRING.
  // We add a rule in preproc state to match quoted strings and color them as STRING.
  addRule(preproc, 'preproc_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /"[^"]*"|'[^']*'/.source;
    r.action = action(TokenType.STRING);
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

  // Character literal
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
  addRule(shared, 'number_oct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[0-7_]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.\d*(?:[eE][+-]?\d+)?[fF]?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|<=|>=|==|!=|&&|\|\||\?|:|=|->|\.\.\./.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules – line comments first, then shared, then common
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
  def.exampleCode = `// Holy-C example - Temple OS style
// This program demonstrates Holy-C features

#include "HolyC.h"

// Basic function
public U32 Add(U32 a, U32 b) {
    return a + b;
}

// Class definition
class Person {
    public I32 age;
    public U8 *name;

    // Constructor
    public Person(U8 *name, I32 age) {
        this->name = name;
        this->age = age;
    }

    // Method
    public U8 *GetGreeting() {
        return Print("Hello, I'm %s, %d years old", name, age);
    }
}

// Interface
interface Drawable {
    public void Draw(I32 x, I32 y);
}

// Struct
struct Point {
    I32 x, y;
};

// Enum
enum Color {
    RED = 0xFF0000,
    GREEN = 0x00FF00,
    BLUE = 0x0000FF
};

// Main function
public I32 Main() {
    // Variables
    I32 x = 42;
    U32 y = 100;
    F32 pi = 3.14159;
    Bool flag = TRUE;
    U8 *str = "Hello, World!";

    // Print functions
    Print("x = %d\\n", x);
    PrintLn("Hello, TempleOS!");
    PrintF("Pi = %f\\n", pi);

    // If statement
    if (x > 10) {
        Print("x is greater than 10\\n");
    } else {
        Print("x is less or equal to 10\\n");
    }

    // For loop
    for (I32 i = 0; i < 5; i++) {
        Print("i = %d\\n", i);
    }

    // While loop
    I32 count = 0;
    while (count < 3) {
        Print("count = %d\\n", count);
        count++;
    }

    // Do-while loop
    I32 n = 0;
    do {
        Print("n = %d\\n", n);
        n++;
    } while (n < 3);

    // Switch statement
    switch (x) {
        case 0: Print("x is 0\\n"); break;
        case 42: Print("x is 42\\n"); break;
        default: Print("x is other\\n");
    }

    // Array
    I32 arr[5] = {1, 2, 3, 4, 5};
    for (I32 i = 0; i < 5; i++) {
        Print("arr[%d] = %d\\n", i, arr[i]);
    }

    // Create object
    Person *p = New(Person, "Alice", 30);
    p->GetGreeting();

    // Delete object
    Delete(p);

    // Graphics
    SetColor(RED);
    DrawRect(10, 10, 100, 100);
    DrawLine(10, 10, 200, 200);
    DrawCircle(320, 240, 50);

    // Input
    I32 key = GetChar();
    Print("Key pressed: %c\\n", key);

    // Mouse
    I32 mx = MouseX();
    I32 my = MouseY();
    Print("Mouse position: %d, %d\\n", mx, my);

    // Sound
    PlaySound(440, 500);

    // Random
    I32 rnd = Random();
    Print("Random: %d\\n", rnd);

    // String operations
    U8 *str1 = "Hello";
    U8 *str2 = "World";
    U8 *combined = StrCat(str1, " ", str2);
    Print("%s\\n", combined);

    // Memory operations
    U8 *buffer = Malloc(100);
    MemSet(buffer, 0, 100);
    Free(buffer);

    // Return
    return 0;
}

// Event handler
public void OnKeyPress(I32 key) {
    Print("Key pressed: %c\\n", key);
}

// Delegate
delegate void Callback(I32 value);

public void Process(Callback cb) {
    cb(42);
}
`;
  return def;
}

export function createHolyCLanguageStyles(hsDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(hsDef.id, 'Dark+');
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