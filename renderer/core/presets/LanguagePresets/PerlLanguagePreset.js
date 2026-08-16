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

export function createPerlLanguage() {
  const def = createSyntaxDefinition('Perl');
  def.aliases = ['perl', 'pl', 'pm', 't', 'pod'];
  def.id = 'PerlLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['$_',            TokenType.VARIABLE],
    ['$@',            TokenType.VARIABLE],
    ['$!',            TokenType.VARIABLE],
    ['$?',            TokenType.VARIABLE],
    ['$$',            TokenType.VARIABLE],
    ['$0',            TokenType.VARIABLE],
    ['$ARGV',         TokenType.VARIABLE],
    ['$|',            TokenType.VARIABLE],
    ['$\\',           TokenType.VARIABLE],
    ['$"',            TokenType.VARIABLE],
    ['$;',            TokenType.VARIABLE],
    ['$%',            TokenType.VARIABLE],
    ['$=',            TokenType.VARIABLE],
    ['$-',            TokenType.VARIABLE],
    ['$~',            TokenType.VARIABLE],
    ['$^',            TokenType.VARIABLE],
    ['$:',            TokenType.VARIABLE],
    ['$]',            TokenType.VARIABLE],
    ['$^O',           TokenType.VARIABLE],
    ['$^V',           TokenType.VARIABLE],
    ['$^T',           TokenType.VARIABLE],
    ['$^X',           TokenType.VARIABLE],
    ['$^W',           TokenType.VARIABLE],
    ['$^D',           TokenType.VARIABLE],
    ['$^F',           TokenType.VARIABLE],
    ['$^H',           TokenType.VARIABLE],
    ['$^I',           TokenType.VARIABLE],
    ['$^M',           TokenType.VARIABLE],
    ['$^N',           TokenType.VARIABLE],
    ['$^P',           TokenType.VARIABLE],
    ['$^R',           TokenType.VARIABLE],
    ['$^S',           TokenType.VARIABLE],
    ['$^U',           TokenType.VARIABLE],
    ['@ARGV',         TokenType.VARIABLE],
    ['@INC',          TokenType.VARIABLE],
    ['@_',            TokenType.VARIABLE],
    ['%ENV',          TokenType.VARIABLE],
    ['%SIG',          TokenType.VARIABLE],
    ['print',         TokenType.FUNCTION],
    ['printf',        TokenType.FUNCTION],
    ['sprintf',       TokenType.FUNCTION],
    ['push',          TokenType.FUNCTION],
    ['pop',           TokenType.FUNCTION],
    ['shift',         TokenType.FUNCTION],
    ['unshift',       TokenType.FUNCTION],
    ['keys',          TokenType.FUNCTION],
    ['values',        TokenType.FUNCTION],
    ['each',          TokenType.FUNCTION],
    ['defined',       TokenType.FUNCTION],
    ['undef',         TokenType.FUNCTION],
    ['die',           TokenType.FUNCTION],
    ['warn',          TokenType.FUNCTION],
    ['exit',          TokenType.FUNCTION],
    ['open',          TokenType.FUNCTION],
    ['close',         TokenType.FUNCTION],
    ['read',          TokenType.FUNCTION],
    ['write',         TokenType.FUNCTION],
    ['tell',          TokenType.FUNCTION],
    ['seek',          TokenType.FUNCTION],
    ['truncate',      TokenType.FUNCTION],
    ['flock',         TokenType.FUNCTION],
    ['select',        TokenType.FUNCTION],
    ['sysopen',       TokenType.FUNCTION],
    ['sysread',       TokenType.FUNCTION],
    ['syswrite',      TokenType.FUNCTION],
    ['send',          TokenType.FUNCTION],
    ['recv',          TokenType.FUNCTION],
    ['socket',        TokenType.FUNCTION],
    ['bind',          TokenType.FUNCTION],
    ['connect',       TokenType.FUNCTION],
    ['listen',        TokenType.FUNCTION],
    ['accept',        TokenType.FUNCTION],
    ['shutdown',      TokenType.FUNCTION],
    ['setsockopt',    TokenType.FUNCTION],
    ['getsockopt',    TokenType.FUNCTION],
    ['getsockname',   TokenType.FUNCTION],
    ['getpeername',   TokenType.FUNCTION],
    ['time',          TokenType.FUNCTION],
    ['localtime',     TokenType.FUNCTION],
    ['gmtime',        TokenType.FUNCTION],
    ['sleep',         TokenType.FUNCTION],
    ['alarm',         TokenType.FUNCTION],
    ['rand',          TokenType.FUNCTION],
    ['srand',         TokenType.FUNCTION],
    ['chomp',         TokenType.FUNCTION],
    ['chop',          TokenType.FUNCTION],
    ['split',         TokenType.FUNCTION],
    ['join',          TokenType.FUNCTION],
    ['reverse',       TokenType.FUNCTION],
    ['sort',          TokenType.FUNCTION],
    ['map',           TokenType.FUNCTION],
    ['grep',          TokenType.FUNCTION],
    ['substr',        TokenType.FUNCTION],
    ['index',         TokenType.FUNCTION],
    ['rindex',        TokenType.FUNCTION],
    ['length',        TokenType.FUNCTION],
    ['lc',            TokenType.FUNCTION],
    ['uc',            TokenType.FUNCTION],
    ['lcfirst',       TokenType.FUNCTION],
    ['ucfirst',       TokenType.FUNCTION],
    ['pack',          TokenType.FUNCTION],
    ['unpack',        TokenType.FUNCTION],
    ['vec',           TokenType.FUNCTION],
    ['hex',           TokenType.FUNCTION],
    ['oct',           TokenType.FUNCTION],
    ['chdir',         TokenType.FUNCTION],
    ['mkdir',         TokenType.FUNCTION],
    ['rmdir',         TokenType.FUNCTION],
    ['unlink',        TokenType.FUNCTION],
    ['rename',        TokenType.FUNCTION],
    ['link',          TokenType.FUNCTION],
    ['symlink',       TokenType.FUNCTION],
    ['readlink',      TokenType.FUNCTION],
    ['stat',          TokenType.FUNCTION],
    ['lstat',         TokenType.FUNCTION],
    ['utime',         TokenType.FUNCTION],
    ['kill',          TokenType.FUNCTION],
    ['system',        TokenType.FUNCTION],
    ['exec',          TokenType.FUNCTION],
    ['fork',          TokenType.FUNCTION],
    ['wait',          TokenType.FUNCTION],
    ['waitpid',       TokenType.FUNCTION],
    ['eval',          TokenType.FUNCTION],
    ['do',            TokenType.FUNCTION],
    ['require',       TokenType.FUNCTION],
    ['use',           TokenType.FUNCTION],
    ['__FILE__',      TokenType.LITERAL],
    ['__LINE__',      TokenType.LITERAL],
    ['__PACKAGE__',   TokenType.LITERAL],
    ['__SUB__',       TokenType.LITERAL],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['undef',         TokenType.LITERAL],
    ['STDIN',         TokenType.LITERAL],
    ['STDOUT',        TokenType.LITERAL],
    ['STDERR',        TokenType.LITERAL],
    ['DATA',          TokenType.LITERAL],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const backtick = newState(def, 'backtick');
  const regexLiteral = newState(def, 'regex_literal');
  const substitution = newState(def, 'substitution');
  const transliteration = newState(def, 'transliteration');
  const heredocContent = newState(def, 'heredoc_content');
  const pod = newState(def, 'pod');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2}|x\{[0-9a-fA-F]+\}|N\{[^}]+\}|c.)/.source;
    r.action = action(TokenType.ESCAPE);
  });
  addRule(strEscape, 'var_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*|\$\{[^}]*\}|@[A-Za-z_]\w*|@\{[^}]*\}|%[A-Za-z_]\w*|%\{[^}]*\}/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted strings
  strSingle.onUnmatched = OnUnmatched.CHARACTER;

  // Backtick command execution
  backtick.onUnmatched = OnUnmatched.CHARACTER;
  backtick.contentTokenType = TokenType.STRING;
  addRule(backtick, 'backtick_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Regex literal content
  regexLiteral.onUnmatched = OnUnmatched.CHARACTER;
  regexLiteral.contentTokenType = TokenType.REGEXP;

  // Substitution content
  substitution.onUnmatched = OnUnmatched.CHARACTER;
  substitution.contentTokenType = TokenType.STRING;

  // Transliteration content
  transliteration.onUnmatched = OnUnmatched.CHARACTER;
  transliteration.contentTokenType = TokenType.STRING;

  // Heredoc content
  heredocContent.onUnmatched = OnUnmatched.CHARACTER;
  heredocContent.contentTokenType = TokenType.STRING;
  addRule(heredocContent, 'var_in_heredoc', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*|\$\{[^}]*\}|@[A-Za-z_]\w*|@\{[^}]*\}|%[A-Za-z_]\w*|%\{[^}]*\}/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // POD documentation
  pod.onUnmatched = OnUnmatched.CHARACTER;
  pod.contentTokenType = TokenType.COMMENT;

  // Common rules
  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'if', 'unless', 'elsif', 'else', 'given', 'when', 'default',
      'for', 'foreach', 'while', 'until', 'do', 'continue', 'next',
      'last', 'redo', 'goto', 'return', 'sub', 'my', 'local', 'our',
      'state', 'package', 'use', 'require', 'import', 'no', 'eval',
      'BEGIN', 'END', 'CHECK', 'INIT', 'UNITCHECK', 'AUTOLOAD',
      'DESTROY', 'isa', 'bless', 'ref', 'tie', 'untie', 'tied',
      'dbmopen', 'dbmclose', 'fc', 'say', 'state', '__DATA__', '__END__',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'sub_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bsub\s+([A-Za-z_]\w*)\s*(?=[{:(])/.source;
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

  addRule(common, 'variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*|\$\{[^}]*\}|@[A-Za-z_]\w*|@\{[^}]*\}|%[A-Za-z_]\w*|%\{[^}]*\}/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(common, 'package', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bpackage\s+([A-Za-z_:]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.NAMESPACE,
      register: createSymbolRegister(TokenType.NAMESPACE, RegisterScope.GLOBAL)
    };
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
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // POD blocks
  addRule(shared, 'pod', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /^=pod/.source;
    r.end   = /^=cut/.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, pod.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = pod.id;
  });

  // POD headings
  addRule(shared, 'pod_heading', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /^=head[1-4]/.source;
    r.end   = /^=cut/.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, pod.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = pod.id;
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

  // Backticks
  addRule(shared, 'backtick', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /`/.source;
    r.end   = /`/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, backtick.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = backtick.id;
  });

  // Heredoc
  addRule(shared, 'heredoc', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<<-?(["']?)([A-Za-z_]\w*)\1/.source;
    r.dynamicEnd = createDynamicEnd(2, '^\\s*${0}\\s*$');
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.OPERATOR;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, heredocContent.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.KEYWORD;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.innerStateId = heredocContent.id;
  });

  // Regular expressions: /.../ and m/.../
  addRule(shared, 'regex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(m|qr)?\s*\/[^\/\\]*(?:\\.[^\/\\]*)*\/[msixpodualngc]*/.source;
    r.context = { afterTokenType: [TokenType.OPERATOR, TokenType.PUNCTUATION, TokenType.KEYWORD] };
    r.action = action(TokenType.REGEXP);
  });

  // Substitution: s/.../.../
  addRule(shared, 'substitution', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bs\/[^\/\\]*(?:\\.[^\/\\]*)*\/[^\/\\]*(?:\\.[^\/\\]*)*\/[msixpodualngcer]*/.source;
    r.context = { afterTokenType: [TokenType.OPERATOR, TokenType.PUNCTUATION, TokenType.KEYWORD] };
    r.action = action(TokenType.STRING);
  });

  // Transliteration: tr/.../.../ and y/.../.../
  addRule(shared, 'transliteration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(tr|y)\/[^\/\\]*(?:\\.[^\/\\]*)*\/[^\/\\]*(?:\\.[^\/\\]*)*\/[cds]*/.source;
    r.context = { afterTokenType: [TokenType.OPERATOR, TokenType.PUNCTUATION, TokenType.KEYWORD] };
    r.action = action(TokenType.STRING);
  });

  // Quote-like operators: qw//, q//, qq//, qx//
  addRule(shared, 'quote_like', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(qw|q|qq|qx)\s*[(\[{<][^\]})>]*[)\]}>]/.source;
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
  addRule(shared, 'number_bin', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[bB][01_]+\b/.source;
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
    r.pattern = /\b\d+\.\d*(?:[eE][+-]?\d+)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|<=>|==|!=|<=|>=|&&|\|\||\.{2,3}|\.|->|=>|:|=|\?|!|~|,/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules
  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Example code
  def.exampleCode = `#!/usr/bin/perl
use strict;
use warnings;

# This is a comment

=pod
This is a POD documentation block.
=cut

# Variables
my $name = "Alice";
my $age = 30;
my @fruits = qw(apple banana cherry);
my %person = ( name => "Alice", age => 30 );

# String interpolation
print "Hello, $name!\\n";
print 'Hello, $name!\\n'; # literal

# Heredoc
my $html = <<HTML;
<div>
  <h1>Hello, $name!</h1>
</div>
HTML

# Regular expressions
if ($name =~ /^A/) {
    print "Starts with A\\n";
}

my $text = "Hello world";
$text =~ s/world/Perl/;
print "$text\\n";

# Subroutine
sub greet {
    my ($person) = @_;
    return "Hello, $person!";
}

print greet("Bob"), "\\n";

# Arrays and hashes
push @fruits, "date";
foreach my $fruit (@fruits) {
    print "Fruit: $fruit\\n";
}

for my $key (keys %person) {
    print "$key: $person{$key}\\n";
}

# Conditionals
if ($age > 18) {
    print "Adult\\n";
} elsif ($age == 18) {
    print "Just turned 18\\n";
} else {
    print "Minor\\n";
}

# Loops
for my $i (0..4) {
    print "i = $i\\n";
}

my $count = 0;
while ($count < 3) {
    print "count = $count\\n";
    $count++;
}

# Filehandle
open my $fh, '<', 'data.txt' or die "Cannot open file: $!";
while (my $line = <$fh>) {
    chomp $line;
    print "Line: $line\\n";
}
close $fh;

# Backticks
my $date = \`date\`;
print "Date: $date";

# eval
eval {
    die "Error!";
};
if ($@) {
    warn "Caught: $@";
}

# Package
package MyPackage;
our $VERSION = '1.0';
sub new { bless {}, shift }

# Anonymous subroutine
my $add = sub { my ($a, $b) = @_; return $a + $b; };
print $add->(3, 4), "\\n";

# Special variables
print "Script: $0\\n";
print "PID: $$\\n";
`;
  return def;
}

export function createPerlLanguageStyles(plDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(plDef.id, 'Dark+');
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
    createTokenStyle(TokenType.REGEXP,        '#d7ba7d'),
    createTokenStyle(TokenType.DECORATOR,     '#c8c8c8'),
    createTokenStyle(TokenType.NAMESPACE,     '#4ec9b0'),
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  return [darkStyle];
}