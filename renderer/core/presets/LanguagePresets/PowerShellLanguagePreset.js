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

  const VARIABLE_PATTERN = /\$(?:[A-Za-z]\w*:)?[A-Za-z_]\w*|\$\{[^}]*\}|\$[?^$]/.source;

  // ── String escape state ────────────────────────────────────────────────────
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /`(?:u\{[0-9a-fA-F]+\}|.)/.source;
    r.action = action(TokenType.ESCAPE);
  });
  // `$( ... )` subexpression (one nesting level of parentheses)
  addRule(strEscape, 'subexpr_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$\((?:[^()]|\([^()]*\))*\)/.source;
    r.action = action(TokenType.VARIABLE);
  });
  addRule(strEscape, 'variable_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = VARIABLE_PATTERN;
    r.action = action(TokenType.VARIABLE);
  });

  // ── Double-quoted strings ──────────────────────────────────────────────────
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'double_escape', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /""/.source;
    r.action = action(TokenType.ESCAPE);
  });
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
  addRule(hereStringDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });
  hereStringSingle.onUnmatched = OnUnmatched.CHARACTER;
  hereStringSingle.contentTokenType = TokenType.STRING;

  // ── Block comments ──────────────────────────────────────────────────────────
  commentBlock.onUnmatched = OnUnmatched.CHARACTER;
  commentBlock.contentTokenType = TokenType.COMMENT;

  // ── Shared rules ────────────────────────────────────────────────────────────
  // #requires directive
  addRule(shared, 'requires_directive', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /^\s*#requires\b.*/.source;
    r.action = action(TokenType.DECORATOR);
  });

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

  // Here-strings: @" / @' at the end of a line, closed by "@ / '@ at the
  // start of a line. Must come before the plain strings.
  addRule(shared, 'here_string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /@"\s*$/.source;
    r.end   = /^"@/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, hereStringDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = hereStringDouble.id;
  });

  addRule(shared, 'here_string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /@'\s*$/.source;
    r.end   = /^'@/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, hereStringSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = hereStringSingle.id;
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

  // $true / $false / $null
  addRule(shared, 'literal_variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /\$(?:true|false|null)\b/.source;
    r.action = action(TokenType.LITERAL);
  });

  // Variables: $name, $env:PATH, $script:x, ${any name}, $?, $^, $$
  addRule(shared, 'variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = VARIABLE_PATTERN;
    r.action = action(TokenType.VARIABLE);
  });

  // Numbers: hex/binary, float with exponent, int; type and multiplier suffixes (5L, 1kb)
  addRule(shared, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?:[uU]?[lLsSyY]|[uUdDnN])?(?:[kKmMgGtTpP][bB])?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Comparison / logical / string operators: -eq, -ceq, -ilike, -notmatch, -and, -f ...
  // KEYWORDS would wrap these in \b...\b and never match - use a regex.
  addRule(shared, 'comparison_operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /(?<![\w-])-(?:[ci]?(?:eq|ne|gt|ge|lt|le|like|notlike|match|notmatch|contains|notcontains|in|notin|replace|split)|join|is|isnot|as|and|or|xor|not|band|bor|bxor|bnot|shl|shr|f)\b/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Parameters: -Name, -ErrorAction, -Parallel:$true
  addRule(shared, 'parameter', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=^|[\s(])-[A-Za-z_][\w-]*/.source;
    r.action = action(TokenType.PARAMETER);
  });

  // Static member access: [Type]::Method( / [Type]::Property
  addRule(shared, 'static_method', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(::)([A-Za-z_]\w*)(?=\s*\()/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.OPERATOR, register: null };
    caps.groups['2'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });
  addRule(shared, 'static_property', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(::)([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.OPERATOR, register: null };
    caps.groups['2'] = { tokenType: TokenType.PROPERTY, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Member access: .Method( / .Property
  addRule(shared, 'member_method', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=\.)[A-Za-z_]\w*(?=\()/.source;
    r.action = action(TokenType.FUNCTION);
  });
  addRule(shared, 'member_property', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=[^.]\.)[A-Za-z_]\w*/.source;
    r.action = action(TokenType.PROPERTY);
  });

  // Operators, longest alternatives first: ??=, ??, ?., ::, .., ++, +=, &&, 2>&1 ...
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\?\?=|\?\?|\?\.|::|\.\.|\+\+|--|[+\-*/%]=|&&|\|\||[*\d]?>>|[*\d]>&[12]|[*\d]?>|<|[+\-*/%=!?:&]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Pipeline
  addRule(shared, 'pipeline', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\|/.source;
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
  // Labels: :outer while (...) { break outer }
  addRule(root, 'label', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^\s*:[A-Za-z_]\w*/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // Attributes: [CmdletBinding()], [Parameter(Mandatory)]
  addRule(root, 'attribute', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\[[A-Za-z][\w.]*\((?:[^()]|\([^()]*\))*\)\]/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // Types in brackets: [string], [string[]], [System.IO.Path], [List[int]].
  // Not directly after a word or `)`, where `[` is an index ($a[i], $h.k[x]).
  addRule(root, 'type_bracket', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<![\w)])(\[)([A-Za-z_][\w.]*(?:\[[^\]]*\])?)(\])/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE, register: null };
    caps.groups['3'] = { tokenType: TokenType.PUNCTUATION, register: null };
    a.captures = caps;
    r.action = a;
  });

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // using namespace System.Text / using module Foo
  addRule(root, 'using_statement', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /\b(using)(\s+)(namespace|module|assembly)(\s+)([A-Za-z_][\w.]*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['3'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['5'] = { tokenType: TokenType.NAMESPACE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // function Name / filter Name / workflow Name
  addRule(root, 'function_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /\b(function|filter|workflow|configuration)(\s+)([A-Za-z_][\w-]*(?::[\w-]+)?)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['3'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // class Name / enum Name / interface Name
  addRule(root, 'type_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /\b(class|enum|interface)(\s+)([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['3'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Cmdlets (Verb-Noun) - before keywords so `ForEach-Object` stays whole
  addRule(root, 'cmdlet', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Za-z]+-[A-Za-z]\w*\b/.source;
    r.action = action(TokenType.FUNCTION);
  });

  // Keywords
  addRule(root, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      'if', 'else', 'elseif', 'switch', 'foreach', 'for', 'while', 'do', 'until',
      'continue', 'break', 'return', 'exit', 'throw', 'trap',
      'try', 'catch', 'finally',
      'function', 'filter', 'workflow', 'configuration', 'class', 'enum', 'interface',
      'begin', 'process', 'end', 'clean', 'dynamicparam',
      'using', 'module', 'namespace', 'assembly',
      'data', 'param', 'private', 'public', 'static', 'hidden',
      'in', 'default', 'parallel', 'sequence', 'inlinescript',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Hashtable keys: @{ Name = 'x' }
  addRule(root, 'hashtable_key', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Za-z_]\w*(?=\s*=(?!=))/.source;
    r.action = action(TokenType.PROPERTY);
  });

  // Class methods / constructors: ToString() { ... }
  addRule(root, 'method_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Za-z_]\w*(?=\()/.source;
    r.action = action(TokenType.FUNCTION);
  });

  // Splatting: @params
  addRule(root, 'splatting', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
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

# PowerShell 7: ternary, null-coalescing, pipeline chains, parallel loops
$label = $counter -gt 0 ? 'positive' : 'zero'
$name = $env:USERNAME ?? 'unknown'
$cache ??= @{}
Test-Path $PSHOME && Write-Host 'ok' || Write-Host 'missing'
1..10 | ForEach-Object -Parallel { $_ * 2 } -ThrottleLimit 4
$path = [System.IO.Path]::Combine($HOME, 'logs')
Invoke-Command @params -Verbose:$false
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
    createTokenStyle(TokenType.IDENTIFIER,    '#9cdcfe'),
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