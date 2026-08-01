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
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const heredocContent = newState(def, 'heredoc_content');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"$]|[0-7]{1,3}|x[0-9a-fA-F]{1,2})/.source;
    r.action = action(TokenType.ESCAPE);
  });
  addRule(strEscape, 'var_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*|\${[^}]*}|\$[0-9*#@?_-]/.source;
    r.action = action(TokenType.VARIABLE);
  });
  addRule(strEscape, 'cmd_subst_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$\([^)]*\)/.source;
    r.action = action(TokenType.FUNCTION);
  });

  // Double-quoted strings
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted strings
  strSingle.onUnmatched = OnUnmatched.CHARACTER;

  // Heredoc content
  heredocContent.onUnmatched = OnUnmatched.CHARACTER;
  heredocContent.contentTokenType = TokenType.STRING;

  // Shared rules
  addRule(shared, 'comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
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

  addRule(shared, 'heredoc', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<<-?([A-Za-z_]\w*)/.source;
    r.end = /^\s*\1\s*$/m;
    r.beginAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.OPERATOR;
      a.transition = createSyntaxStateTransition(TransitionType.PUSH, heredocContent.id);
      return a;
    })();
    r.endAction = (() => {
      const a = createSyntaxRuleAction();
      a.tokenType = TokenType.STRING;
      a.transition = createSyntaxStateTransition(TransitionType.POP);
      return a;
    })();
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = heredocContent.id;
  });

  addRule(shared, 'variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*|\${[^}]*}|\$[0-9*#@?_-]/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(shared, 'cmd_subst', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$\([^)]*\)/.source;
    r.action = action(TokenType.FUNCTION);
  });

  addRule(shared, 'arith_subst', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$\(\([^)]*\)\)/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(shared, 'numbers', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[0-9]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /<<-?|>>?|>&?|&>|>|&|\||&&|\|\||;;|;/m.source;
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

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(root, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'if', 'elif', 'else', 'then', 'fi', 'case', 'esac', 'for', 'while',
      'until', 'do', 'done', 'select', 'time', 'function', 'in',
      '[', '[[', ']]', 'test',
      'bg', 'fg', 'jobs', 'kill', 'wait', 'disown',
      'export', 'unset', 'set', 'env', 'alias', 'unalias',
      'echo', 'printf', 'read', 'cat', 'grep', 'sed', 'awk',
      'cd', 'pwd', 'pushd', 'popd', 'dirs', 'ls', 'mkdir', 'rmdir',
      'rm', 'cp', 'mv', 'ln', 'chmod', 'chown', 'chgrp',
      'exec', 'source', '.', 'eval', 'trap', 'exit', 'return', 'break',
      'continue', 'shift', 'getopts', 'type', 'which', 'command',
      'let', 'declare', 'typeset', 'local', 'readonly',
      'umask', 'ulimit', 'nice', 'nohup',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(root, 'function_def', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(function\s+)?([A-Za-z_]\w*)\s*(?=\()/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['2'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(root, 'here_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /<<</.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(root, 'arith_expr', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\(\(/.source;
    r.end   = /\)\)/.source;
    r.beginAction = action(TokenType.PUNCTUATION);
    r.endAction   = action(TokenType.PUNCTUATION);
    r.contentTokenType = TokenType.NUMBER;
    r.innerStateId = newState(def, 'arith_content').id;
    const arithContent = def.states[def.states.length - 1];
    arithContent.onUnmatched = OnUnmatched.CHARACTER;
    addRule(arithContent, 'arith_operators', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /[+\-*/%&|^~!<>=]+/.source;
      r.action = action(TokenType.OPERATOR);
    });
    addRule(arithContent, 'arith_vars', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /[A-Za-z_]\w*|\$[A-Za-z_]\w*/.source;
      r.action = action(TokenType.VARIABLE);
    });
    addRule(arithContent, 'arith_numbers', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /\b\d+\b/.source;
      r.action = action(TokenType.NUMBER);
    });
  });

  addRule(root, 'conditional_expr', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\[\[/.source;
    r.end   = /\]\]/.source;
    r.beginAction = action(TokenType.KEYWORD);
    r.endAction   = action(TokenType.KEYWORD);
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = newState(def, 'cond_content').id;
    const condContent = def.states[def.states.length - 1];
    condContent.onUnmatched = OnUnmatched.CHARACTER;
    addRule(condContent, 'cond_operators', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.KEYWORDS;
      r.pattern = ['-eq', '-ne', '-gt', '-lt', '-ge', '-le',
                   '-z', '-n', '-d', '-f', '-e', '-x', '-r', '-w',
                   '==', '!=', '=', '&&', '||', '!'];
      r.action = action(TokenType.OPERATOR);
    });
    addRule(condContent, 'cond_vars', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /\$[A-Za-z_]\w*/.source;
      r.action = action(TokenType.VARIABLE);
    });
    addRule(condContent, 'cond_strings', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /["'][^"']*["']/.source;
      r.action = action(TokenType.STRING);
    });
    addRule(condContent, 'cond_identifiers', r => {
      r.type = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern = /[A-Za-z_]\w*/.source;
      r.action = action(TokenType.IDENTIFIER);
    });
  });

  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
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
with multiple lines
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

# Exit
exit 0
`;

  // HighlightStyle
  const style = createHighlightStyle('Dark+');
  style.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.VARIABLE,      '#9cdcfe'),
    createTokenStyle(TokenType.FUNCTION,      '#dcdcaa'),
    createTokenStyle(TokenType.STRING,        '#ce9178'),
    createTokenStyle(TokenType.COMMENT,       '#6a9955', { italic: true }),
    createTokenStyle(TokenType.NUMBER,        '#b5cea8'),
    createTokenStyle(TokenType.OPERATOR,      '#d4d4d4'),
    createTokenStyle(TokenType.PUNCTUATION,   '#d4d4d4'),
    createTokenStyle(TokenType.IDENTIFIER,    '#d4d4d4'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];
  def.styles.push(style);

  return def;
}