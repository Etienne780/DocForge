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

  doubleQuoted.onUnmatched = OnUnmatched.CHARACTER;
  doubleQuoted.contentTokenType = TokenType.STRING;
  singleQuoted.onUnmatched = OnUnmatched.CHARACTER;
  singleQuoted.contentTokenType = TokenType.STRING;

  // ── Shared rules ──────────────────────────────────────────────────────────
  // REM and :: comments
  addRule(shared, 'comment_rem', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /^\s*rem\s+.*/.source;
    r.action = action(TokenType.COMMENT);
  });
  addRule(shared, 'comment_double_colon', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^\s*::.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Double-quoted strings
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, doubleQuoted.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = doubleQuoted.id;
  });

  // Single-quoted strings
  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, singleQuoted.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = singleQuoted.id;
  });

  // Environment variables
  addRule(shared, 'env_var', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /%[A-Za-z0-9_]*%|![A-Za-z0-9_]*!/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Command-line parameters
  addRule(shared, 'cmd_params', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /%~?[0-9*]|%~?[a-z][0-9*]?/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Numbers
  addRule(shared, 'numbers', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators and redirections
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = />>?|<<?|&>|>\&|2>&1|1>&2|<<?|>>?|\||&{1,2}|={1,2}|[=<>|&]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[();,]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Labels
  addRule(shared, 'label', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^[ \t]*:[A-Za-z0-9_\-]+\b/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // Built-in commands
  addRule(shared, 'commands', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      'echo', 'set', 'if', 'else', 'for', 'do', 'goto', 'call', 'shift', 'exit',
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
      'diskcopy', 'label', 'mode', 'more', 'print', 'subst', 'tree',
      'xcopy', 'errorlevel', 'exist', 'defined',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // ── Root rules ─────────────────────────────────────────────────────────────
  // Include shared rules
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // @echo off
  addRule(root, 'echo_off', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^[ \t]*@/.source;
    r.action = action(TokenType.KEYWORD);
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
    createTokenStyle(TokenType.STRING,        '#ce9178'),
    createTokenStyle(TokenType.COMMENT,       '#6a9955', { italic: true }),
    createTokenStyle(TokenType.NUMBER,        '#b5cea8'),
    createTokenStyle(TokenType.OPERATOR,      '#d4d4d4'),
    createTokenStyle(TokenType.PUNCTUATION,   '#808080'),
    createTokenStyle(TokenType.DECORATOR,     '#c8c8c8'),
    createTokenStyle(TokenType.IDENTIFIER,    '#d4d4d4'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  return [darkStyle];
}