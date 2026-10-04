import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxStateTransition,
  createHighlightStyle,
  createTokenStyle,
  RuleType,
  PatternType,
  TokenType,
  TransitionType,
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

export function createBrainfuckLanguage() {
  const def = createSyntaxDefinition('Brainfuck');
  def.aliases = ['bf', 'brainfuck'];
  def.id = 'BrainfuckLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // States
  const shared = newState(def, 'shared_rules');

  // Shared rules
  // Comments – any character that is not a Brainfuck command
  addRule(shared, 'comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[^><+\-.,[\]]/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Pointer movement
  addRule(shared, 'pointer_right', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = />/.source;
    r.action = action(TokenType.OPERATOR);
  });
  addRule(shared, 'pointer_left', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /</.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Value modification
  addRule(shared, 'increment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\+/.source;
    r.action = action(TokenType.OPERATOR);
  });
  addRule(shared, 'decrement', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /-/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // I/O operations
  addRule(shared, 'output', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\./.source;
    r.action = action(TokenType.FUNCTION);
  });
  addRule(shared, 'input', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /,/.source;
    r.action = action(TokenType.FUNCTION);
  });

  // Loop control
  addRule(shared, 'loop_start', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\[/.source;
    r.action = action(TokenType.KEYWORD);
  });
  addRule(shared, 'loop_end', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\]/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Root rules
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Example code
  def.exampleCode = `// Brainfuck "Hello World!"
// This program prints "Hello World!"

++++++++++              // Set cell 0 to 10 (loop counter)
[
  >+++++++              // Add 7 to cell 1
  >++++++++++           // Add 10 to cell 2
  >+++                  // Add 3 to cell 3
  >+                    // Add 1 to cell 4
  <<<<-                 // Decrement loop counter
]
>++ .                   // Print 'H' (cell 1: 72)
>+ .                    // Print 'e' (cell 2: 101)
+++++++ .               // Print 'l' (cell 2: 108)
.                       // Print 'l'
+++ .                   // Print 'o' (cell 2: 111)
>++ .                   // Print ' ' (cell 3: 32)
<<+++++++++++++++ .     // Print ',' (cell 1: 44)
>.                      // Print ' ' (cell 2: 32)
+++ .                   // Print 'W' (cell 2: 87)
------ .                // Print 'o' (cell 2: 111)
-------- .              // Print 'r' (cell 2: 114)
+++ .                   // Print 'l' (cell 2: 108)
------ .                // Print 'd' (cell 2: 100)
-------- .              // Print '!' (cell 2: 33)
>+ .                    // Print newline (cell 3: 10)

// Cat program – copies input to output
,[.,]`;
  return def;
}

export function createBrainfuckLanguageStyles(bfDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(bfDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'), // [ and ]
    createTokenStyle(TokenType.OPERATOR,      '#d4d4d4'), // > < + -
    createTokenStyle(TokenType.FUNCTION,      '#dcdcaa'), // . and ,
    createTokenStyle(TokenType.COMMENT,       '#6a9955', { italic: true }),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  const lightStyle = createHighlightStyle(bfDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#af00db'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.FUNCTION,      '#795e26'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(bfDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.FUNCTION,      '#61afef'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(bfDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.OPERATOR,      '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(bfDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.OPERATOR,      '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(bfDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.OPERATOR,      '#24292f'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}