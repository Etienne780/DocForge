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

export function createShellLanguage() {
  const def = createSyntaxDefinition('Shell');
  def.aliases = ['sh', 'bash', 'zsh', 'ksh', 'dash', 'shell'];
  def.id = 'ShellLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['$0',             TokenType.VARIABLE],
    ['$#',             TokenType.VARIABLE],
    ['$*',             TokenType.VARIABLE],
    ['$@',             TokenType.VARIABLE],
    ['$?',             TokenType.VARIABLE],
    ['$$',             TokenType.VARIABLE],
    ['$!',             TokenType.VARIABLE],
    ['$-',             TokenType.VARIABLE],
    ['$_',             TokenType.VARIABLE],
    ['$PATH',          TokenType.VARIABLE],
    ['$HOME',          TokenType.VARIABLE],
    ['$USER',          TokenType.VARIABLE],
    ['$PWD',           TokenType.VARIABLE],
    ['$OLDPWD',        TokenType.VARIABLE],
    ['$SHELL',         TokenType.VARIABLE],
    ['$TERM',          TokenType.VARIABLE],
    ['$EDITOR',        TokenType.VARIABLE],
    ['$LANG',          TokenType.VARIABLE],
    ['$LANGUAGE',      TokenType.VARIABLE],
    ['$LC_ALL',        TokenType.VARIABLE],
    ['$LC_CTYPE',      TokenType.VARIABLE],
    ['$RANDOM',        TokenType.VARIABLE],
    ['$SECONDS',       TokenType.VARIABLE],
    ['$LINENO',        TokenType.VARIABLE],
    ['$BASH',          TokenType.VARIABLE],
    ['$BASH_VERSION',  TokenType.VARIABLE],
    ['$BASHOPTS',      TokenType.VARIABLE],
    ['$SHELLOPTS',     TokenType.VARIABLE],
    ['$SHLVL',         TokenType.VARIABLE],
    ['$HOSTNAME',      TokenType.VARIABLE],
    ['$HOSTTYPE',      TokenType.VARIABLE],
    ['$OSTYPE',        TokenType.VARIABLE],
    ['$MACHTYPE',      TokenType.VARIABLE],
    ['$IFS',           TokenType.VARIABLE],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const heredocContent = newState(def, 'heredoc_content');
  const caseContent = newState(def, 'case_content');
  const strAnsi = newState(def, 'string_ansi');           // $'...'
  const heredocRaw = newState(def, 'heredoc_raw');        // <<'EOF' (no expansion)
  const cmdSubstContent = newState(def, 'cmd_subst_content'); // $( ... ), `...`, <( ... )
  const arithContent = newState(def, 'arith_content');    // (( ... )), $(( ... ))

  // `$(( ... ))` - arithmetic expansion. Must come before `$( ... )`.
  function addArithSubst(state, name) {
    addRule(state, name, r => {
      r.type = RuleType.BEGIN_END;
      r.begin = /\$\(\(/.source;
      r.end   = /\)\)/.source;
      r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, arithContent.id));
      r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
      r.contentTokenType = TokenType.NUMBER;
      r.innerStateId = arithContent.id;
    });
  }

  // `$( ... )` - command substitution, content is lexed as shell code.
  function addCmdSubst(state, name) {
    addRule(state, name, r => {
      r.type = RuleType.BEGIN_END;
      r.begin = /\$\((?!\()/.source;
      r.end   = /\)/.source;
      r.beginAction = action(TokenType.FUNCTION, createSyntaxStateTransition(TransitionType.PUSH, cmdSubstContent.id));
      r.endAction   = action(TokenType.FUNCTION, createSyntaxStateTransition(TransitionType.POP));
      r.innerStateId = cmdSubstContent.id;
    });
  }

  // `` `...` `` - legacy command substitution.
  function addBacktickSubst(state, name) {
    addRule(state, name, r => {
      r.type = RuleType.BEGIN_END;
      r.begin = /`/.source;
      r.end   = /`/.source;
      r.beginAction = action(TokenType.FUNCTION, createSyntaxStateTransition(TransitionType.PUSH, cmdSubstContent.id));
      r.endAction   = action(TokenType.FUNCTION, createSyntaxStateTransition(TransitionType.POP));
      r.innerStateId = cmdSubstContent.id;
    });
  }

  const VARIABLE_PATTERN = /\$[A-Za-z_]\w*|\$\{[^}]*\}|\$[0-9*#@?_!$-]/.source;

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"$`]|[0-7]{1,3}|x[0-9a-fA-F]{1,2})/.source;
    r.action = action(TokenType.ESCAPE);
  });
  addArithSubst(strEscape, 'arith_subst_in_string');
  addCmdSubst(strEscape, 'cmd_subst_in_string');
  addBacktickSubst(strEscape, 'backtick_subst_in_string');
  addRule(strEscape, 'var_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = VARIABLE_PATTERN;
    r.action = action(TokenType.VARIABLE);
  });

  // Double-quoted strings
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted strings
  strSingle.onUnmatched = OnUnmatched.CHARACTER;

  // ANSI-C strings $'...'
  strAnsi.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strAnsi, 'ansi_escape', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abeEfnrtv'"?]|[0-7]{1,3}|x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{1,4}|U[0-9a-fA-F]{1,8}|c.)/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Heredoc content
  heredocContent.onUnmatched = OnUnmatched.CHARACTER;
  addArithSubst(heredocContent, 'arith_subst_in_heredoc');
  addCmdSubst(heredocContent, 'cmd_subst_in_heredoc');
  addRule(heredocContent, 'var_in_heredoc', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = VARIABLE_PATTERN;
    r.action = action(TokenType.VARIABLE);
  });

  // Quoted heredoc content: no expansion at all
  heredocRaw.onUnmatched = OnUnmatched.CHARACTER;

  // Case content
  caseContent.onUnmatched = OnUnmatched.CHARACTER;
  addRule(caseContent, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });
  addRule(caseContent, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Command substitution content: regular shell code
  cmdSubstContent.onUnmatched = OnUnmatched.CHARACTER;
  addRule(cmdSubstContent, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });
  addRule(cmdSubstContent, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Arithmetic content
  arithContent.onUnmatched = OnUnmatched.CHARACTER;
  addRule(arithContent, 'arith_numbers', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:0[xX][0-9a-fA-F]+|\d+#[0-9a-zA-Z@_]+|\d+)\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(arithContent, 'arith_operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!<>=?:]+/.source;
    r.action = action(TokenType.OPERATOR);
  });
  addRule(arithContent, 'arith_vars', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$\{[^}]*\}|\$?[A-Za-z_]\w*|\$[0-9#@?]/.source;
    r.action = action(TokenType.VARIABLE);
  });
  addRule(arithContent, 'arith_punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[()\[\],]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Common rules (shared by root, case_content and cmd_subst_content)
  // `function name {` (no parentheses)
  addRule(common, 'function_keyword_def', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(function)(\s+)([A-Za-z_][\w-]*)/.source;
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

  // `name=`, `name+=`, `arr[i]=` - assignment target
  addRule(common, 'assignment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Za-z_]\w*(?=(?:\[[^\]]*\])?\+?=(?!=))/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'if', 'elif', 'else', 'then', 'fi', 'case', 'esac', 'for', 'while',
      'until', 'do', 'done', 'select', 'time', 'function', 'in', 'coproc',
      'test',
      'bg', 'fg', 'jobs', 'kill', 'wait', 'disown',
      'export', 'unset', 'set', 'shopt', 'env', 'alias', 'unalias',
      'echo', 'printf', 'read', 'mapfile', 'readarray', 'cat', 'grep', 'sed', 'awk',
      'cd', 'pwd', 'pushd', 'popd', 'dirs', 'ls', 'mkdir', 'rmdir',
      'rm', 'cp', 'mv', 'ln', 'chmod', 'chown', 'chgrp',
      'exec', 'source', 'eval', 'trap', 'exit', 'return', 'break',
      'continue', 'shift', 'getopts', 'type', 'which', 'command', 'builtin',
      'let', 'declare', 'typeset', 'local', 'readonly',
      'umask', 'ulimit', 'nice', 'nohup', 'hash', 'caller', 'enable',
      'complete', 'compgen', 'compopt', 'history', 'logout', 'times',
      'true', 'false',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // `[ ... ]` test command and `.` (source) as standalone words
  addRule(common, 'test_bracket', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=^|[\s;&|(!])\[(?=\s)|(?<=\s)\](?=$|[\s;&|)])|(?<=^|[\s;&|])\.(?=\s)/.source;
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'function_def', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(function\s+)?([A-Za-z_]\w*)\s*(?=\(\s*\))/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'here_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /<<</.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(common, 'arith_expr', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\(\(/.source;
    r.end   = /\)\)/.source;
    r.beginAction = action(TokenType.PUNCTUATION);
    r.endAction   = action(TokenType.PUNCTUATION);
    r.contentTokenType = TokenType.NUMBER;
    r.innerStateId = arithContent.id;
  });

  addRule(common, 'conditional_expr', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\[\[/.source;
    r.end   = /\]\]/.source;
    r.beginAction = action(TokenType.KEYWORD);
    r.endAction   = action(TokenType.KEYWORD);
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = newState(def, 'cond_content').id;
    const condContent = def.states[def.states.length - 1];
    condContent.onUnmatched = OnUnmatched.CHARACTER;
    // `=~ regex` - the right-hand side is a regular expression
    addRule(condContent, 'cond_regex', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /(=~)\s*((?:[^\s\\"']|\\.)+)/.source;
      const a = createSyntaxRuleAction();
      const caps = createSyntaxCaptureMap();
      caps.groups['1'] = { tokenType: TokenType.OPERATOR, register: null };
      caps.groups['2'] = { tokenType: TokenType.STRING, register: null };
      a.captures = caps;
      r.action = a;
    });
    // KEYWORDS would wrap these in \b...\b and never match - use a regex.
    addRule(condContent, 'cond_operators', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /(?<![\w-])-(?:eq|ne|gt|lt|ge|le|nt|ot|ef|[a-zA-Z])\b|==|!=|=~|&&|\|\||[<>!=]/.source;
      r.action = action(TokenType.OPERATOR);
    });
    addRule(condContent, 'cond_vars', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = VARIABLE_PATTERN;
      r.action = action(TokenType.VARIABLE);
    });
    addRule(condContent, 'include_shared', r => {
      r.type = RuleType.INCLUDE;
      r.includeStateId = shared.id;
    });
    addRule(condContent, 'cond_identifiers', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /[A-Za-z_]\w*/.source;
      r.action = action(TokenType.IDENTIFIER);
    });
  });

  // Options: `-a`, `-la`, `--flag`, `--opt=value`
  addRule(common, 'option', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=^|[\s(])--?[A-Za-z][\w-]*/.source;
    r.action = action(TokenType.PARAMETER);
  });

  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_][\w-]*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules
  // `#` only starts a comment at the beginning of a word.
  addRule(shared, 'comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=^|[\s;&|()])#.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  addRule(shared, 'string_ansi', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\$'/.source;
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strAnsi.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strAnsi.id;
  });

  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\$?"/.source;
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // Quoted heredoc <<'EOF' / <<"EOF" / <<-'EOF': content is not expanded
  addRule(shared, 'heredoc_quoted', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(<<-?)\s*(['"])([A-Za-z_][\w-]*)\2/.source;
    r.dynamicEnd = createDynamicEnd(3, '^\\s*${0}\\s*$');

    const beginAction = createSyntaxRuleAction();
    beginAction.tokenType = TokenType.STRING;
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.OPERATOR, register: null };
    caps.groups['2'] = { tokenType: TokenType.STRING, register: null };
    caps.groups['3'] = { tokenType: TokenType.KEYWORD, register: null };
    beginAction.captures = caps;
    beginAction.transition = createSyntaxStateTransition(TransitionType.PUSH, heredocRaw.id);
    r.beginAction = beginAction;

    r.endAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = heredocRaw.id;
  });

  // Heredoc <<EOF / <<-EOF with dynamic end delimiter
  addRule(shared, 'heredoc', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(<<-?)\s*([A-Za-z_][\w-]*)/.source;
    r.dynamicEnd = createDynamicEnd(2, '^\\s*${0}\\s*$');

    const beginAction = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.OPERATOR, register: null };
    caps.groups['2'] = { tokenType: TokenType.KEYWORD, register: null };
    beginAction.captures = caps;
    beginAction.transition = createSyntaxStateTransition(TransitionType.PUSH, heredocContent.id);
    r.beginAction = beginAction;

    r.endAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = heredocContent.id;
  });

  addArithSubst(shared, 'arith_subst');
  addCmdSubst(shared, 'cmd_subst');
  addBacktickSubst(shared, 'backtick_subst');

  // Process substitution <( ... ) / >( ... )
  addRule(shared, 'process_subst', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /[<>]\(/.source;
    r.end   = /\)/.source;
    r.beginAction = action(TokenType.OPERATOR, createSyntaxStateTransition(TransitionType.PUSH, cmdSubstContent.id));
    r.endAction   = action(TokenType.OPERATOR, createSyntaxStateTransition(TransitionType.POP));
    r.innerStateId = cmdSubstContent.id;
  });

  addRule(shared, 'variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = VARIABLE_PATTERN;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(shared, 'numbers', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[0-9]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Longest alternatives first.
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /;;&|;;|;&|&&|\|\||\|&|&>>|&>|>>|>&|<&|<>|>\||<<-|<<|\+=|==|!=|=~|[<>&|;!=*?]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules
  addRule(root, 'shebang', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^#!.*/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Case block
  addRule(root, 'case_block', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\bcase\b/.source;
    r.end   = /\besac\b/.source;
    r.beginAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, caseContent.id));
    r.endAction   = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.innerStateId = caseContent.id;
  });

  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Example code
  def.exampleCode = `#!/bin/bash
# This is a comment
echo "Hello, World!"

# Variables
name="Alice"
age=30
echo "Name: $name, Age: $age"

# Command substitution
current_dir=$(pwd)
echo "Current directory: $current_dir"

# Arithmetic
sum=$((10 + 20))
echo "Sum: $sum"

# Conditional
if [[ -f "/etc/passwd" && $age -gt 18 ]]; then
    echo "Adult with passwd file"
elif [[ $age -eq 18 ]]; then
    echo "Just turned 18"
else
    echo "Minor"
fi

# Loop
for i in {1..5}; do
    echo "Iteration $i"
done

# While loop
count=0
while [[ $count -lt 3 ]]; do
    echo "Count: $count"
    ((count++))
done

# Function
function greet() {
    local person=$1
    echo "Hello, $person!"
}
greet "Alice"

# Pipeline and redirection
ls -la | grep ".sh" > output.txt 2>&1

# Heredoc
cat <<EOF
This is a heredoc
with variables: $name and $age
and command substitution: $(date)
EOF

# Here-string
grep "bash" <<< "bash zsh ksh"

# Case
case $name in
    "Alice") echo "Alice" ;;
    "Bob") echo "Bob" ;;
    *) echo "Other" ;;
esac

# Arrays (Bash)
fruits=("apple" "banana" "cherry")
echo "First fruit: \${fruits[0]}"
echo "All fruits: \${fruits[@]}"

# Associative arrays, regex match, process substitution
declare -A ports=([http]=80 [https]=443)
if [[ $version =~ ^v([0-9]+)\\.([0-9]+)$ ]]; then
    echo "Major: \${BASH_REMATCH[1]}"
fi
diff <(sort a.txt) <(sort b.txt)
mapfile -t lines < input.txt
printf $'Tab:\\t%s\\n' "\${lines[@]:-none}"
cat <<'RAW'
No $expansion here
RAW

# Exit
exit 0
`;
  return def;
}

export function createShellLanguageStyles(shDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(shDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.VARIABLE,      '#9cdcfe'),
    createTokenStyle(TokenType.PARAMETER,     '#9cdcfe', { italic: true }),
    createTokenStyle(TokenType.FUNCTION,      '#dcdcaa'),
    createTokenStyle(TokenType.STRING,        '#ce9178'),
    createTokenStyle(TokenType.COMMENT,       '#6a9955', { italic: true }),
    createTokenStyle(TokenType.NUMBER,        '#b5cea8'),
    createTokenStyle(TokenType.OPERATOR,      '#d4d4d4'),
    createTokenStyle(TokenType.PUNCTUATION,   '#d4d4d4'),
    createTokenStyle(TokenType.IDENTIFIER,    '#d4d4d4'),
    createTokenStyle(TokenType.ESCAPE,        '#d7ba7d'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  const lightStyle = createHighlightStyle(shDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#af00db'),
    createTokenStyle(TokenType.VARIABLE,      '#001080'),
    createTokenStyle(TokenType.PARAMETER,     '#001080', { italic: true }),
    createTokenStyle(TokenType.FUNCTION,      '#795e26'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.IDENTIFIER,    '#000000'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(shDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.VARIABLE,      '#e06c75'),
    createTokenStyle(TokenType.PARAMETER,     '#e06c75', { italic: true }),
    createTokenStyle(TokenType.FUNCTION,      '#61afef'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.IDENTIFIER,    '#abb2bf'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(shDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.VARIABLE,      '#fd971f'),
    createTokenStyle(TokenType.PARAMETER,     '#fd971f', { italic: true }),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(shDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.VARIABLE,      '#bd93f9'),
    createTokenStyle(TokenType.PARAMETER,     '#ffb86c', { italic: true }),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(shDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.VARIABLE,      '#953800'),
    createTokenStyle(TokenType.PARAMETER,     '#24292f'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}