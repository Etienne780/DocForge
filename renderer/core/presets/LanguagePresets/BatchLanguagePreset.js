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

export function createBatchLanguage() {
  const def = createSyntaxDefinition('Batch');
  def.aliases = ['bat', 'cmd', 'batch'];
  def.id = 'BatchLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // ── Predefined symbols ──────────────────────────────────────────────────
  const predefined = [
    ['%CD%',          TokenType.VARIABLE],
    ['%DATE%',        TokenType.VARIABLE],
    ['%TIME%',        TokenType.VARIABLE],
    ['%RANDOM%',      TokenType.VARIABLE],
    ['%ERRORLEVEL%',  TokenType.VARIABLE],
    ['%CMDEXTVERSION%', TokenType.VARIABLE],
    ['%CMDCMDLINE%',  TokenType.VARIABLE],
    ['%PATH%',        TokenType.VARIABLE],
    ['%PATHEXT%',     TokenType.VARIABLE],
    ['%PROMPT%',      TokenType.VARIABLE],
    ['%COMSPEC%',     TokenType.VARIABLE],
    ['%OS%',          TokenType.VARIABLE],
    ['%PROCESSOR_ARCHITECTURE%', TokenType.VARIABLE],
    ['%NUMBER_OF_PROCESSORS%', TokenType.VARIABLE],
    ['%USERNAME%',    TokenType.VARIABLE],
    ['%USERDOMAIN%',  TokenType.VARIABLE],
    ['%HOMEDRIVE%',   TokenType.VARIABLE],
    ['%HOMEPATH%',    TokenType.VARIABLE],
    ['%APPDATA%',     TokenType.VARIABLE],
    ['%TEMP%',        TokenType.VARIABLE],
    ['%TMP%',         TokenType.VARIABLE],
    ['%0',            TokenType.VARIABLE],
    ['%*',            TokenType.VARIABLE],
    ['%~dp0',         TokenType.VARIABLE],
    ['%~nx0',         TokenType.VARIABLE],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // ── States for strings ──────────────────────────────────────────────────
  const shared = newState(def, 'shared_rules');
  const doubleQuoted = newState(def, 'double_quoted_string');
  const singleQuoted = newState(def, 'single_quoted_string');
  const variables = newState(def, 'variables'); // shared by code and strings

  doubleQuoted.onUnmatched = OnUnmatched.CHARACTER;
  doubleQuoted.contentTokenType = TokenType.STRING;
  singleQuoted.onUnmatched = OnUnmatched.CHARACTER;
  singleQuoted.contentTokenType = TokenType.STRING;

  // ── Variables ─────────────────────────────────────────────────────────────
  // for-loop variables: %%a, %%~dpnxa
  addRule(variables, 'loop_var', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /%%(?:~[fdpnxsatz]*(?:\$[^:%]+:)?)?[A-Za-z]/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Command-line parameters: %1, %~1, %~dp0, %*
  addRule(variables, 'cmd_params', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /%(?:~[fdpnxsatz]*(?:\$[^:%]+:)?)?[0-9]|%\*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Environment variables incl. substring/replace: %var%, %var:~0,5%, %var:a=b%, !var!
  addRule(variables, 'env_var', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /%[^%\s"]+%|![^!\s"]+!/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(doubleQuoted, 'include_variables', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = variables.id;
  });

  // ── Shared rules ──────────────────────────────────────────────────────────
  // REM and :: comments (REM also after `@` or `&`)
  addRule(shared, 'comment_rem', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /(?<=^\s*@?|&\s*)rem(?:[\s:.].*|$)/.source;
    r.action = action(TokenType.COMMENT);
  });
  addRule(shared, 'comment_double_colon', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^\s*::.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Labels
  addRule(shared, 'label', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^[ \t]*:[A-Za-z0-9_\-.]+/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // Double-quoted strings (never span lines)
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = /"|$/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, doubleQuoted.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = doubleQuoted.id;
  });

  // Single-quoted command in `for /f %%i in ('cmd')` (never spans lines)
  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?<=\(\s*)'/.source;
    r.end   = /'|$/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, singleQuoted.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = singleQuoted.id;
  });

  // ^ escapes the next character (or continues the line)
  addRule(shared, 'caret_escape', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\^.?/.source;
    r.action = action(TokenType.ESCAPE);
  });

  addRule(shared, 'include_variables', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = variables.id;
  });

  // goto label / goto :label / call :label
  addRule(shared, 'goto_label', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /\b(goto)(\s+)(:?[A-Za-z0-9_\-.]+)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['3'] = { tokenType: TokenType.DECORATOR, register: null };
    a.captures = caps;
    r.action = a;
  });
  addRule(shared, 'call_label', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /\b(call)(\s+)(:[A-Za-z0-9_\-.]+)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['3'] = { tokenType: TokenType.DECORATOR, register: null };
    a.captures = caps;
    r.action = a;
  });

  // set NAME=..., set /a N+=1, set "NAME=..."
  addRule(shared, 'set_variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /(?<=\bset\s+(?:\/[ap]\s+)?"?)[A-Za-z_][\w.\-]*(?=\s*[+\-*/%]?=)/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Switches: /f, /i, /a, /p, /b, /?
  addRule(shared, 'switches', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=^|[\s(])\/(?:[A-Za-z][\w:-]*|\?)/.source;
    r.action = action(TokenType.PARAMETER);
  });

  // Numbers
  addRule(shared, 'numbers', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:0[xX][0-9a-fA-F]+|\d+)\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators and redirections, longest alternatives first
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\|\||&&|==|[12]?>>|[12]?>&[12]|[<>|&]|[+\-*/%]?=|[+\-*/%!~]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[();,:.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // `echo off` / `echo on`
  addRule(shared, 'echo_state', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /(?<=\becho\s+)(?:on|off)\b(?=\s*(?:$|[&|)]))/.source;
    r.action = action(TokenType.LITERAL);
  });

  // setlocal options and reserved device names
  addRule(shared, 'literals', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      'enabledelayedexpansion', 'disabledelayedexpansion',
      'enableextensions', 'disableextensions',
      'nul', 'con', 'prn', 'aux',
    ];
    r.action = action(TokenType.LITERAL);
  });

  // Built-in commands
  addRule(shared, 'commands', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      'echo', 'set', 'if', 'else', 'for', 'do', 'in', 'not', 'goto', 'call', 'shift', 'exit',
      'equ', 'neq', 'lss', 'leq', 'gtr', 'geq',
      'rem', 'del', 'erase', 'copy', 'xcopy', 'move', 'ren', 'rename',
      'mkdir', 'md', 'rmdir', 'rd', 'cd', 'chdir', 'dir', 'type', 'find',
      'findstr', 'sort', 'more', 'fc', 'comp', 'attrib', 'chcp', 'chkdsk',
      'color', 'date', 'time', 'prompt', 'pushd', 'popd', 'setlocal',
      'endlocal', 'start', 'title', 'ver', 'vol', 'label', 'ping', 'ipconfig',
      'tracert', 'net', 'netstat', 'nslookup', 'tasklist', 'taskkill',
      'schtasks', 'systeminfo', 'driverquery', 'wmic', 'powercfg', 'shutdown',
      'reg', 'regedit', 'sfc', 'chkntfs', 'cls', 'path', 'append', 'assoc',
      'ftype', 'break', 'cmd', 'command', 'forfiles', 'where', 'robocopy',
      'mklink', 'openfiles', 'bcdedit', 'diskpart', 'format', 'diskcomp',
      'diskcopy', 'mode', 'print', 'subst', 'tree',
      'pause', 'choice', 'timeout', 'verify', 'whoami', 'clip', 'certutil',
      'errorlevel', 'exist', 'defined', 'cmdextversion',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Identifier fallback (file names, arguments, variable names)
  addRule(shared, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_][\w.\-]*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // ── Root rules ─────────────────────────────────────────────────────────────
  // @ (suppress echo) at the start of a line, e.g. @echo off
  addRule(root, 'echo_off', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^[ \t]*@/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Include shared rules
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // ── Example code ──────────────────────────────────────────────────────────
  def.exampleCode = `@echo off
:: This is a comment
REM Another comment

setlocal enabledelayedexpansion

set MY_VAR=Hello
set /a COUNTER=0

echo %MY_VAR% World!
echo The value is: !MY_VAR!

if "%MY_VAR%"=="Hello" (
    echo It says Hello!
) else (
    echo It says something else.
)

for %%i in (a b c) do (
    echo %%i
    set /a COUNTER+=1
)

goto :label
:label
echo Done.

call :subroutine arg1 arg2
exit /b 0

:subroutine
echo First arg: %~1
echo Second arg: %~2
exit /b

:: Pipeline and redirection
dir | find ".txt" > output.txt 2>&1

:: Parsing command output, substrings and conditional chains
for /f "tokens=1,2 delims==" %%a in ('set MY_') do echo %%a = %%b
set "SCRIPT_DIR=%~dp0"
echo Prefix: %MY_VAR:~0,3% Replaced: %MY_VAR:l=L%
if /i "%~1"=="/?" goto :usage
mkdir "%TEMP%\\build" 2>nul || echo Could not create folder ^& exit /b 1
`;
  return def;
}

export function createBatchLanguageStyles(batchDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(batchDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.VARIABLE,      '#9cdcfe'),
    createTokenStyle(TokenType.PARAMETER,     '#9cdcfe', { italic: true }),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.ESCAPE,        '#d7ba7d'),
    createTokenStyle(TokenType.STRING,        '#ce9178'),
    createTokenStyle(TokenType.COMMENT,       '#6a9955', { italic: true }),
    createTokenStyle(TokenType.NUMBER,        '#b5cea8'),
    createTokenStyle(TokenType.OPERATOR,      '#d4d4d4'),
    createTokenStyle(TokenType.PUNCTUATION,   '#808080'),
    createTokenStyle(TokenType.DECORATOR,     '#c8c8c8'),
    createTokenStyle(TokenType.IDENTIFIER,    '#d4d4d4'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  const lightStyle = createHighlightStyle(batchDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#0000ff'),
    createTokenStyle(TokenType.VARIABLE,      '#001080'),
    createTokenStyle(TokenType.PARAMETER,     '#001080', { italic: true }),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.DECORATOR,     '#795e26'), // labels
    createTokenStyle(TokenType.IDENTIFIER,    '#000000'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(batchDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.VARIABLE,      '#e06c75'),
    createTokenStyle(TokenType.PARAMETER,     '#e06c75', { italic: true }),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.DECORATOR,     '#61afef'),
    createTokenStyle(TokenType.IDENTIFIER,    '#abb2bf'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(batchDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.VARIABLE,      '#fd971f'),
    createTokenStyle(TokenType.PARAMETER,     '#fd971f', { italic: true }),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.DECORATOR,     '#a6e22e'),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(batchDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.VARIABLE,      '#bd93f9'),
    createTokenStyle(TokenType.PARAMETER,     '#ffb86c', { italic: true }),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.DECORATOR,     '#50fa7b'),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(batchDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.VARIABLE,      '#953800'),
    createTokenStyle(TokenType.PARAMETER,     '#24292f'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.DECORATOR,     '#8250df'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}