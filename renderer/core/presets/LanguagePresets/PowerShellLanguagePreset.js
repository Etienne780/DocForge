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

export function createPowerShellLanguage() {
  const def = createSyntaxDefinition('PowerShell');
  def.aliases = ['ps1', 'psm1', 'psd1', 'ps1xml', 'powershell'];
  def.id = 'PowerShellLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // ── Predefined symbols ──────────────────────────────────────────────────
  const predefined = [
    ['$true',            TokenType.LITERAL],
    ['$false',           TokenType.LITERAL],
    ['$null',            TokenType.LITERAL],
    ['$?',               TokenType.VARIABLE],
    ['$^',               TokenType.VARIABLE],
    ['$$',               TokenType.VARIABLE],
    ['$_',               TokenType.VARIABLE],
    ['$PSVersionTable',  TokenType.VARIABLE],
    ['$Host',            TokenType.VARIABLE],
    ['$PWD',             TokenType.VARIABLE],
    ['$HOME',            TokenType.VARIABLE],
    ['$env',             TokenType.VARIABLE],
    ['$args',            TokenType.VARIABLE],
    ['$input',           TokenType.VARIABLE],
    ['$error',           TokenType.VARIABLE],
    ['$LASTEXITCODE',    TokenType.VARIABLE],
    ['$MyInvocation',    TokenType.VARIABLE],
    ['$PsHome',          TokenType.VARIABLE],
    ['$CurrentCulture',  TokenType.VARIABLE],
    ['$CurrentUICulture', TokenType.VARIABLE],
    ['$Global',          TokenType.VARIABLE],
    ['$Local',           TokenType.VARIABLE],
    ['$Script',          TokenType.VARIABLE],
    ['$Using',           TokenType.VARIABLE],
    ['Get-Process',      TokenType.FUNCTION],
    ['Get-Service',      TokenType.FUNCTION],
    ['Get-ChildItem',    TokenType.FUNCTION],
    ['Get-Content',      TokenType.FUNCTION],
    ['Set-Content',      TokenType.FUNCTION],
    ['Add-Content',      TokenType.FUNCTION],
    ['Write-Output',     TokenType.FUNCTION],
    ['Write-Host',       TokenType.FUNCTION],
    ['Write-Debug',      TokenType.FUNCTION],
    ['Write-Warning',    TokenType.FUNCTION],
    ['Write-Error',      TokenType.FUNCTION],
    ['Write-Verbose',    TokenType.FUNCTION],
    ['Write-Information', TokenType.FUNCTION],
    ['Read-Host',        TokenType.FUNCTION],
    ['Import-Module',    TokenType.FUNCTION],
    ['Export-ModuleMember', TokenType.FUNCTION],
    ['New-Object',       TokenType.FUNCTION],
    ['New-Item',         TokenType.FUNCTION],
    ['New-Variable',     TokenType.FUNCTION],
    ['Remove-Variable',  TokenType.FUNCTION],
    ['Get-Variable',     TokenType.FUNCTION],
    ['Set-Variable',     TokenType.FUNCTION],
    ['Test-Path',        TokenType.FUNCTION],
    ['Resolve-Path',     TokenType.FUNCTION],
    ['Split-Path',       TokenType.FUNCTION],
    ['Join-Path',        TokenType.FUNCTION],
    ['ConvertTo-Json',   TokenType.FUNCTION],
    ['ConvertFrom-Json', TokenType.FUNCTION],
    ['ConvertTo-Csv',    TokenType.FUNCTION],
    ['ConvertFrom-Csv',  TokenType.FUNCTION],
    ['Select-Object',    TokenType.FUNCTION],
    ['Where-Object',     TokenType.FUNCTION],
    ['Sort-Object',      TokenType.FUNCTION],
    ['Group-Object',     TokenType.FUNCTION],
    ['Measure-Object',   TokenType.FUNCTION],
    ['ForEach-Object',   TokenType.FUNCTION],
    ['Compare-Object',   TokenType.FUNCTION],
    ['Format-Table',     TokenType.FUNCTION],
    ['Format-List',      TokenType.FUNCTION],
    ['Out-File',         TokenType.FUNCTION],
    ['Out-String',       TokenType.FUNCTION],
    ['Out-Host',         TokenType.FUNCTION],
    ['Out-Null',         TokenType.FUNCTION],
    ['Start-Process',    TokenType.FUNCTION],
    ['Stop-Process',     TokenType.FUNCTION],
    ['Start-Service',    TokenType.FUNCTION],
    ['Stop-Service',     TokenType.FUNCTION],
    ['Restart-Service',  TokenType.FUNCTION],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // ── States ──────────────────────────────────────────────────────────────────
  const shared = newState(def, 'shared_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const hereStringDouble = newState(def, 'here_string_double');
  const hereStringSingle = newState(def, 'here_string_single');
  const commentBlock = newState(def, 'block_comment');

  // ── String escape state ────────────────────────────────────────────────────
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /`[0nrt"']/.source;
    r.action = action(TokenType.ESCAPE);
  });
  addRule(strEscape, 'variable_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?/.source;
    r.action = action(TokenType.VARIABLE);
  });
  addRule(strEscape, 'subexpr_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$\([^)]*\)/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // ── Double-quoted strings ──────────────────────────────────────────────────
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // ── Single-quoted strings ──────────────────────────────────────────────────
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'single_escape', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /''/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // ── Here-strings ──────────────────────────────────────────────────────────
  hereStringDouble.onUnmatched = OnUnmatched.CHARACTER;
  hereStringDouble.contentTokenType = TokenType.STRING;
  hereStringSingle.onUnmatched = OnUnmatched.CHARACTER;
  hereStringSingle.contentTokenType = TokenType.STRING;

  // ── Block comments ──────────────────────────────────────────────────────────
  commentBlock.onUnmatched = OnUnmatched.CHARACTER;
  commentBlock.contentTokenType = TokenType.COMMENT;

  // ── Shared rules ────────────────────────────────────────────────────────────
  // Line comments
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#(?!>).*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Block comments <# ... #>
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<#/.source;
    r.end   = /#>/.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, commentBlock.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = commentBlock.id;
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

  // Here-strings
  addRule(shared, 'here_string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /@"\r?\n/.source;
    r.end   = /^@"\s*$/m;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, hereStringDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = hereStringDouble.id;
  });

  addRule(shared, 'here_string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /@'\r?\n/.source;
    r.end   = /^@'\s*$/m;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, hereStringSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = hereStringSingle.id;
  });

  // Variables
  addRule(shared, 'variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$(?:global:|script:|local:|private:|using:|)[A-Za-z_]\w*|\${[^}]*}/.source;
    r.action = action(TokenType.VARIABLE);
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
    r.pattern = /\b0[xX][0-9a-fA-F]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.\d*\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'comparison_operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      '-eq', '-ne', '-gt', '-lt', '-ge', '-le',
      '-and', '-or', '-xor', '-not', '-!',
      '-like', '-notlike', '-match', '-notmatch',
      '-replace', '-contains', '-notcontains', '-in', '-notin',
      '-is', '-isnot', '-as', '-band', '-bor', '-bxor', '-bnot',
      '-shl', '-shr', '-f', '-format', '-join', '-split'
    ];
    r.action = action(TokenType.OPERATOR);
  });

  addRule(shared, 'arith_operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%]=?|(\+\+)|(--)/.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(shared, 'cstyle_ops', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /!==?|==|<=|>=|&&|\|\|/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Pipeline and redirection
  addRule(shared, 'pipeline', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\|/.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(shared, 'redirection', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = />>?|2>&1|>\&/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // ── Root rules ─────────────────────────────────────────────────────────────
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Keywords
  addRule(root, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      'if', 'else', 'elseif', 'switch', 'foreach', 'for', 'while', 'do',
      'continue', 'break', 'return', 'exit', 'throw', 'trap',
      'function', 'filter', 'workflow', 'class', 'enum', 'interface',
      'begin', 'process', 'end', 'dynamicparam',
      'using', 'module', 'namespace',
      'data', 'param', 'private', 'public', 'static', 'hidden',
      'in', 'not', 'and', 'or', 'xor', 'like', 'match', 'contains',
      'is', 'as',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Types in brackets
  addRule(root, 'type_bracket', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\[[A-Za-z.]+(?:\[[^\]]*\])?\]/.source;
    r.action = action(TokenType.TYPE);
  });

  // Attributes
  addRule(root, 'attribute', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\[[A-Za-z]+\([^)]*\)\]/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // Cmdlets (verb-noun)
  addRule(root, 'cmdlet', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Za-z]+-[A-Za-z]+\b/.source;
    r.action = action(TokenType.FUNCTION);
  });

  // Splatting @var – handled as punctuation + variable
  addRule(root, 'splatting', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@(?=[A-Za-z_])/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // @( ... ), @{ ... } – handled as punctuation
  addRule(root, 'at_punct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@(?=[({])/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Identifier fallback
  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // ── Example code ──────────────────────────────────────────────────────────
  def.exampleCode = `# PowerShell example script
# This script demonstrates various language features

<#
  This is a block comment
  spanning multiple lines
#>

param (
    [Parameter(Mandatory=$true)]
    [string]$Name,

    [int]$Age = 30
)

function Get-Greeting {
    param([string]$Person)
    return "Hello, $Person!"
}

class Person {
    [string]$Name
    [int]$Age

    Person([string]$name, [int]$age) {
        $this.Name = $name
        $this.Age = $age
    }

    [string]ToString() {
        return "$($this.Name) ($($this.Age))"
    }
}

$person = [Person]::new($Name, $Age)
Write-Host "Created person: $person"

$greeting = Get-Greeting -Person $person.Name
Write-Output $greeting

$numbers = @(1, 2, 3, 4, 5)
foreach ($n in $numbers) {
    if ($n -gt 3) {
        Write-Host "$n is greater than 3" -ForegroundColor Green
    } else {
        Write-Host "$n is less or equal to 3"
    }
}

$config = @{
    Name = "MyApp"
    Version = "1.0.0"
    Settings = @{
        Debug = $true
        LogLevel = "Info"
    }
}

$dateStr = "Today is $(Get-Date -Format 'yyyy-MM-dd')"
Write-Host $dateStr

Get-Process | Where-Object { $_.CPU -gt 10 } | Sort-Object CPU -Descending | Select-Object -First 5

try {
    Get-Content "nonexistent.txt" -ErrorAction Stop
} catch {
    Write-Error "Failed to read file: $_"
} finally {
    Write-Host "Done"
}

$params = @{
    Name = "Test"
    Age = 25
}
$testPerson = [Person]::new(@params.Name, @params.Age)

[int]$counter = 0
[string]$message = "Hello"

if ($counter -eq 0 -and $message -match "Hello") {
    $counter += 1
}
`;
  return def;
}

export function createPowerShellLanguageStyles(ps1Def) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(ps1Def.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.TYPE,          '#4ec9b0'),
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

  const lightStyle = createHighlightStyle(ps1Def.id, 'Light+');
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
    createTokenStyle(TokenType.DECORATOR,     '#af00db'), // attributes [...()]
    createTokenStyle(TokenType.NAMESPACE,     '#267f99'),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(ps1Def.id, 'One Dark');
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
    createTokenStyle(TokenType.DECORATOR,     '#c678dd'), // attributes [...()]
    createTokenStyle(TokenType.NAMESPACE,     '#e5c07b'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(ps1Def.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#fd971f'),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.PARAMETER,     '#fd971f', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.DECORATOR,     '#f92672'), // attributes [...()]
    createTokenStyle(TokenType.NAMESPACE,     '#66d9ef'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(ps1Def.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.TYPE,          '#8be9fd', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#ffb86c'),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.PARAMETER,     '#ffb86c', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.DECORATOR,     '#ff79c6'), // attributes [...()]
    createTokenStyle(TokenType.NAMESPACE,     '#8be9fd'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(ps1Def.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.TYPE,          '#6639ba'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.VARIABLE,      '#953800'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.PARAMETER,     '#24292f'),
    createTokenStyle(TokenType.PROPERTY,      '#0550ae'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.DECORATOR,     '#8250df'), // attributes [...()]
    createTokenStyle(TokenType.NAMESPACE,     '#6639ba'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}