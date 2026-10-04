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

export function createCLanguage() {
  const def = createSyntaxDefinition('C');
  def.aliases = ['c'];
  def.id = 'CLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  // Predefined symbols
  const predefined = [
    ['FILE',          TokenType.TYPE],
    ['size_t',        TokenType.TYPE],
    ['ptrdiff_t',     TokenType.TYPE],
    ['wchar_t',       TokenType.TYPE],
    ['char16_t',      TokenType.TYPE],
    ['char32_t',      TokenType.TYPE],
    ['int8_t',        TokenType.TYPE],
    ['int16_t',       TokenType.TYPE],
    ['int32_t',       TokenType.TYPE],
    ['int64_t',       TokenType.TYPE],
    ['uint8_t',       TokenType.TYPE],
    ['uint16_t',      TokenType.TYPE],
    ['uint32_t',      TokenType.TYPE],
    ['uint64_t',      TokenType.TYPE],
    ['intptr_t',      TokenType.TYPE],
    ['uintptr_t',     TokenType.TYPE],
    ['NULL',          TokenType.LITERAL],
    ['stdin',         TokenType.VARIABLE],
    ['stdout',        TokenType.VARIABLE],
    ['stderr',        TokenType.VARIABLE],
    ['printf',        TokenType.FUNCTION],
    ['scanf',         TokenType.FUNCTION],
    ['fprintf',       TokenType.FUNCTION],
    ['fscanf',        TokenType.FUNCTION],
    ['sprintf',       TokenType.FUNCTION],
    ['snprintf',      TokenType.FUNCTION],
    ['puts',          TokenType.FUNCTION],
    ['gets',          TokenType.FUNCTION],
    ['getchar',       TokenType.FUNCTION],
    ['putchar',       TokenType.FUNCTION],
    ['fopen',         TokenType.FUNCTION],
    ['fclose',        TokenType.FUNCTION],
    ['fread',         TokenType.FUNCTION],
    ['fwrite',        TokenType.FUNCTION],
    ['fseek',         TokenType.FUNCTION],
    ['ftell',         TokenType.FUNCTION],
    ['rewind',        TokenType.FUNCTION],
    ['feof',          TokenType.FUNCTION],
    ['ferror',        TokenType.FUNCTION],
    ['malloc',        TokenType.FUNCTION],
    ['calloc',        TokenType.FUNCTION],
    ['realloc',       TokenType.FUNCTION],
    ['free',          TokenType.FUNCTION],
    ['memcpy',        TokenType.FUNCTION],
    ['memmove',       TokenType.FUNCTION],
    ['memset',        TokenType.FUNCTION],
    ['memcmp',        TokenType.FUNCTION],
    ['strlen',        TokenType.FUNCTION],
    ['strcpy',        TokenType.FUNCTION],
    ['strncpy',       TokenType.FUNCTION],
    ['strcat',        TokenType.FUNCTION],
    ['strncat',       TokenType.FUNCTION],
    ['strcmp',        TokenType.FUNCTION],
    ['strncmp',       TokenType.FUNCTION],
    ['strchr',        TokenType.FUNCTION],
    ['strrchr',       TokenType.FUNCTION],
    ['strstr',        TokenType.FUNCTION],
    ['strtok',        TokenType.FUNCTION],
    ['atoi',          TokenType.FUNCTION],
    ['atol',          TokenType.FUNCTION],
    ['atof',          TokenType.FUNCTION],
    ['exit',          TokenType.FUNCTION],
    ['abort',         TokenType.FUNCTION],
    ['assert',        TokenType.FUNCTION],
    ['qsort',         TokenType.FUNCTION],
    ['bsearch',       TokenType.FUNCTION],
    ['time',          TokenType.FUNCTION],
    ['clock',         TokenType.FUNCTION],
    ['rand',          TokenType.FUNCTION],
    ['srand',         TokenType.FUNCTION],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const root = def.states.find(s => s.id === def.rootStateId);

  const sharedRules = newState(def, 'shared_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const blockComment = newState(def, 'block_comment');
  const preproc = newState(def, 'preprocessor');
  const preprocInclude = newState(def, 'preprocessor_include');
  const preprocSysHeader = newState(def, 'preprocessor_sysheader');
  const preprocStrHeader = newState(def, 'preprocessor_strheader');

  // Escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:['"?\\abfnrtv]|x[0-9a-fA-F]+|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[0-7]{1,3})/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.ESCAPE;
    r.action = a;
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

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Preprocessor
  preproc.onUnmatched = OnUnmatched.CHARACTER;

  // System header: #include <...>
  addRule(preprocInclude, 'sys_header', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?<=#\s*(?:include|include_next|embed)\s*)</.source;
    r.end   = '>';
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.PUNCTUATION;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, preprocSysHeader.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.PUNCTUATION;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = preprocSysHeader.id;
  });
  preprocSysHeader.onUnmatched = OnUnmatched.CHARACTER;

  // Project header: #include "..."
  addRule(preprocInclude, 'str_header', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?<=#\s*(?:include|include_next|embed)\s*)"/.source;
    r.end   = '"';
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.STRING;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, preprocStrHeader.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.STRING;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = preprocStrHeader.id;
  });
  preprocStrHeader.onUnmatched = OnUnmatched.CHARACTER;

  // Shared rules
  addRule(sharedRules, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.COMMENT;
    r.action = a;
  });

  addRule(sharedRules, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.COMMENT;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, blockComment.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.COMMENT;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Numbers: hex/bin -> float (incl. exponent) -> oct -> int. `'` is a C23
  // digit separator; it is only consumed between digits, so it never opens
  // a char literal here. Trailing `\w*` covers suffixes (u, l, ull, f, wb).
  addRule(sharedRules, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX](?:[\da-fA-F]|'(?=[\da-fA-F]))*(?:\.(?:[\da-fA-F]|'(?=[\da-fA-F]))*)?(?:[pP][+-]?\d+)?\w*/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.NUMBER;
    r.action = a;
  });

  addRule(sharedRules, 'number_bin', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[bB](?:[01]|'(?=[01]))+\w*/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.NUMBER;
    r.action = a;
  });

  addRule(sharedRules, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:\b\d(?:\d|'(?=\d))*(?:\.(?!\.)(?:\d(?:\d|'(?=\d))*)?(?:[eE][+-]?\d+)?|[eE][+-]?\d+)|\.\d(?:\d|'(?=\d))*(?:[eE][+-]?\d+)?)\w*/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.NUMBER;
    r.action = a;
  });

  addRule(sharedRules, 'number_oct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[0-7]+(?:'[0-7]+)*[uUlL]*\b/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.NUMBER;
    r.action = a;
  });

  addRule(sharedRules, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d(?:\d|'(?=\d))*\w*/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.NUMBER;
    r.action = a;
  });

  // `"..."` with optional u8/u/U/L prefix. Ends at the line end unless the
  // line is continued with a backslash, so an unclosed string can't bleed.
  addRule(sharedRules, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?:u8|[uUL])?"/.source;
    r.end   = /"|(?<!\\)$/.source;
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.STRING;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, strDouble.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.STRING;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // `'x'` with optional u8/u/U/L prefix. Never spans lines.
  addRule(sharedRules, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?:u8|[uUL])?'/.source;
    r.end   = /'|(?<!\\)$/.source;
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.STRING;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, strSingle.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.STRING;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // Operators and punctuation (longest alternatives first)
  addRule(sharedRules, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /->|::|<<=|>>=|<<|>>|\+\+|--|&&|\|\||\.\.\.|[+\-*/%&|^~!<>=?:]=?/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.OPERATOR;
    r.action = a;
  });

  addRule(sharedRules, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\],.;]/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.PUNCTUATION;
    r.action = a;
  });

  // Root rules
  addRule(root, 'preprocessor', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /^[ \t]*#/.source;
    r.end   = /(?<!\\)$/.source;
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.KEYWORD;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, preproc.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.KEYWORD;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.contentTokenType = TokenType.KEYWORD;
    r.innerStateId = preproc.id;
  });

  addRule(preproc, 'preproc_keyword', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = ['include', 'include_next', 'embed', 'define', 'undef',
                 'if', 'ifdef', 'ifndef', 'elif', 'elifdef', 'elifndef',
                 'else', 'endif', 'pragma', 'error', 'warning', 'line',
                 'defined', '__has_include', '__has_embed', '__has_c_attribute'];
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.KEYWORD;
    r.action = a;
  });

  // `<...>` / `"..."` path, only right after include/include_next/embed
  // (so `#if A < B` doesn't open a header string).
  addRule(preproc, 'include_path', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = preprocInclude.id;
    r.context = { afterTokenType: [TokenType.KEYWORD] };
  });

  // string literal anywhere else in a directive, e.g. `#define MSG "hi"`
  addRule(preproc, 'preproc_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /"(?:\\.|[^"\\])*"/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.STRING;
    r.action = a;
  });

  addRule(preproc, 'macro_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=\bdefine\s+)[A-Z_][A-Z0-9_]*/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.FUNCTION;
    a.register = createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL);
    r.action = a;
  });

  // C23 attributes: `[[nodiscard]]`, `[[deprecated("x")]]`, ...
  addRule(root, 'attribute', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\[\[[^\]]*\]\]/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.DECORATOR;
    r.action = a;
  });

  // comments/strings/numbers/operators/punctuation. Included before the
  // identifier rules so prefixed literals (`u8"..."`, `L'x'`) win over `u8`/`L`.
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = sharedRules.id;
  });

  // `struct/union/enum Name` -> registers TYPE. Must run before 'keywords',
  // otherwise the bare keyword gets matched alone first.
  addRule(root, 'type_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(struct|union|enum)\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  addRule(root, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
      'break', 'continue', 'return', 'goto',
      'const', 'volatile', 'restrict', 'inline', '_Noreturn', '_Atomic',
      'static', 'extern', 'register', 'auto', 'thread_local', '_Thread_local',
      'constexpr', 'struct', 'union', 'enum', 'typedef',
      'sizeof', 'alignof', '_Alignof', 'alignas', '_Alignas', '_Generic',
      'static_assert', '_Static_assert', 'typeof', 'typeof_unqual',
      '__attribute__', 'asm', '__asm__',
      'void', 'char', 'short', 'int', 'long', 'float', 'double',
      'signed', 'unsigned', 'bool', '_Bool', '_Complex', '_Imaginary',
      '_BitInt', '_Decimal32', '_Decimal64', '_Decimal128',
    ];
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.KEYWORD;
    r.action = a;
  });

  addRule(root, 'literals', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = ['NULL', 'nullptr', 'true', 'false'];
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.LITERAL;
    r.action = a;
  });

  // Alias name of a single-line `typedef ... Name;` and of the closing
  // `} Name;` of a multi-line `typedef struct { ... } Name;` -> registers
  // TYPE. Matches only the name; the rest of the line is lexed normally.
  addRule(root, 'typedef_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:(?<=\btypedef\b[^;{}()]*[\s*])|(?<=^\s*\}\s*))([A-Za-z_]\w*)(?=\s*;)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // `name(` -> FUNCTION (lookahead, the `(` stays punctuation)
  addRule(root, 'function_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*(?=\()/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Za-z_]\w*\b/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.IDENTIFIER;
    r.action = a;
  });

  // Example code
  def.exampleCode = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

#define MAX_NAME 64
#define PI 3.14159f

/* function prototype */
int add(int a, int b);

// struct definition
typedef struct {
    char name[MAX_NAME];
    int age;
} Person;

int main(int argc, char *argv[]) {
    // variable declarations
    int x = 42;
    float y = 3.14f;
    char c = 'A';
    const char *msg = "Hello, world!";

    // array and pointer
    int numbers[] = {1, 2, 3, 4, 5};
    int *p = numbers;

    // control flow
    for (int i = 0; i < 5; i++) {
        printf("numbers[%d] = %d\\n", i, p[i]);
    }

    // struct usage
    Person person;
    strcpy(person.name, "Alice");
    person.age = 30;

    if (person.age >= 18) {
        puts("Adult");
    } else {
        puts("Minor");
    }

    // function call
    int sum = add(x, 100);
    printf("sum = %d\\n", sum);

    return 0;
}

int add(int a, int b) {
    return a + b;
}

// C23
#embed "palette.bin"
typedef unsigned long long u64;
constexpr int MASK = 0b1010'1010;
const u64 BIG = 1'000'000ULL;
double avogadro = 6.022e23, half = 0x1.8p-1;

[[nodiscard]] static inline bool is_even(unsigned _BitInt(12) v) {
    static_assert(sizeof(int) >= 4, "int too small");
    typeof(v) h = v / 2;
    return h * 2 == v;
}

int *ptr = nullptr;
`;
  return def;
}

export function createCLanguageStyles(cDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(cDef.id, 'Dark+');
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

  const lightStyle = createHighlightStyle(cDef.id, 'Light+');
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
    createTokenStyle(TokenType.DECORATOR,     '#af00db'),
    createTokenStyle(TokenType.NAMESPACE,     '#267f99'),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(cDef.id, 'One Dark');
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
    createTokenStyle(TokenType.DECORATOR,     '#c678dd'),
    createTokenStyle(TokenType.NAMESPACE,     '#e5c07b'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(cDef.id, 'Monokai');
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
    createTokenStyle(TokenType.DECORATOR,     '#f92672'),
    createTokenStyle(TokenType.NAMESPACE,     '#66d9ef'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(cDef.id, 'Dracula');
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
    createTokenStyle(TokenType.DECORATOR,     '#ff79c6'),
    createTokenStyle(TokenType.NAMESPACE,     '#8be9fd'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(cDef.id, 'GitHub Light');
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
    createTokenStyle(TokenType.DECORATOR,     '#cf222e'),
    createTokenStyle(TokenType.NAMESPACE,     '#953800'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}