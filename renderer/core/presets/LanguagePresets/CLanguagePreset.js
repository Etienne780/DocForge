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
    r.pattern = /\\(?:['"\\abfnrtv0]|x[0-9a-fA-F]{1,2}|[0-7]{1,3})/.source;
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
    r.begin = '<';
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
    r.begin = '"';
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

  addRule(sharedRules, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
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

  addRule(sharedRules, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = "'";
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

  // Numbers
  addRule(sharedRules, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /0[xX][0-9a-fA-F]+(?:[uUlL]*)/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.NUMBER;
    r.action = a;
  });

  addRule(sharedRules, 'number_oct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /0[0-7]+(?:[uUlL]*)/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.NUMBER;
    r.action = a;
  });

  addRule(sharedRules, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.\d*(?:[eE][+-]?\d+)?[fFlL]?\b/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.NUMBER;
    r.action = a;
  });

  addRule(sharedRules, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+(?:[uUlL]*)\b/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.NUMBER;
    r.action = a;
  });

  // Operators and punctuation
  addRule(sharedRules, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /->|::|<<|>>|<<=|>>=|\+\+|--|&&|\|\||[+\-*/%&|^~!<>=?:]=?|\.\.\./.source;
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
    r.pattern = ['include', 'define', 'undef', 'if', 'ifdef', 'ifndef',
                 'elif', 'else', 'endif', 'pragma', 'error', 'warning', 'line'];
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.KEYWORD;
    r.action = a;
  });

  addRule(preproc, 'include_path', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = preprocInclude.id;
    r.context = { afterTokenType: [TokenType.KEYWORD] };
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

  addRule(root, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
      'break', 'continue', 'return', 'goto',
      'const', 'volatile', 'restrict', 'inline', '_Noreturn', '_Atomic',
      'static', 'extern', 'register', 'auto', 'thread_local',
      'struct', 'union', 'enum', 'typedef',
      'sizeof', 'alignof', '_Alignof', '_Alignas', '_Generic',
      'void', 'char', 'short', 'int', 'long', 'float', 'double',
      'signed', 'unsigned', '_Bool', '_Complex', '_Imaginary',
    ];
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.KEYWORD;
    r.action = a;
  });

  addRule(root, 'literals', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = ['NULL'];
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.LITERAL;
    r.action = a;
  });

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

  addRule(root, 'typedef_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\btypedef\s+.*\s+([A-Za-z_]\w*)\s*;/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  addRule(root, 'function_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*(?=\()/.source;
    r.context = {
      notAfterTokenType: [TokenType.PUNCTUATION]
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

  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Za-z_]\w*\b/.source;
    const a = createSyntaxRuleAction();
    a.tokenType = TokenType.IDENTIFIER;
    r.action = a;
  });

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = sharedRules.id;
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

  return [darkStyle];
}