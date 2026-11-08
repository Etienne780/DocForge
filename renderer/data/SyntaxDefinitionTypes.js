// Syntax definition enums and pure accessors. Must stay dependency-free:
// imported by SyntaxHighlightWorker, which must not pull in app/UI modules.

// ─── Enums ────────────────────────────────────────────────────────────────────

export const TokenType = Object.freeze({
  KEYWORD:       'keyword',
  IDENTIFIER:    'identifier',
  TYPE:          'type',
  VARIABLE:      'variable',
  FUNCTION:      'function',
  PARAMETER:     'parameter',
  PROPERTY:      'property',
  OPERATOR:      'operator',
  PUNCTUATION:   'punctuation',
  NUMBER:        'number',
  STRING:        'string',
  COMMENT:       'comment',
  REGEXP:        'regexp',
  ESCAPE:        'escape',
  INTERPOLATION: 'interpolation',
  DECORATOR:     'decorator',
  NAMESPACE:     'namespace',
  LITERAL:       'literal',
  WHITESPACE:    'whitespace',
  OTHER:         'other',
  LINEBREAK:     'linebreak',
});

/**
 * Visibility scope of a dynamically registered symbol.
 *
 * GLOBAL -> symbol is known for the rest of the entire document after registration.
 * STATE  -> symbol is only known while the SyntaxState that registered it is on the
 *           stack. It is automatically removed when that state is popped.
 *
 * When symbolHoisting is true, scope is irrelevant - all symbols are global.
 */
export const RegisterScope = Object.freeze({ GLOBAL: 'global', STATE: 'state' });

/**
 * The variant of a SyntaxStateRule.
 *
 * MATCH     -> matches once at the current position (keywords, operators, numbers, …)
 * BEGIN_END -> matches an opening and closing delimiter; pushes/pops the state stack
 *             (strings, comments, template literals, blocks, …)
 * INCLUDE   -> inlines all rules of another SyntaxState here (shared rule sets)
 */
export const RuleType = Object.freeze({ MATCH: 'match', BEGIN_END: 'beginEnd', INCLUDE: 'include' });

/**
 * How the pattern of a MATCH rule is interpreted.
 *
 * REGEX    -> raw regular expression string
 * KEYWORDS -> String[], compiled internally to \b(a|b|c)\b
 * WORD     -> single word, compiled to \b<word>\b
 */
export const PatternType = Object.freeze({ REGEX: 'regex', KEYWORDS: 'keywords', WORD: 'word' });

/**
 * How a RuleAction manipulates the state stack.
 *
 * PUSH -> enter targetStateId, keep current state on the stack
 * POP  -> return to the previous state (popCount levels up)
 * SET  -> replace the current state with targetStateId without changing the stack depth
 */
export const TransitionType = Object.freeze({ PUSH: 'push', POP: 'pop', SET: 'set' });

/**
 * What happens to a character that is not matched by any rule in the current state.
 *
 * CHARACTER -> emit it as a single OTHER token and advance one character
 * SKIP      -> silently advance one character
 */
export const OnUnmatched = Object.freeze({ CHARACTER: 'character', SKIP: 'skip' });

// ─── SyntaxState Accessors ────────────────────────────────────────────────────

export function findSyntaxState(def, stateId) {
  return def?.states?.find(s => s.id === stateId) ?? null;
}

export function findRootSyntaxState(def) {
  return def?.states?.find(s => s.id === def.rootStateId) ?? null;
}

export function findSyntaxStateByName(def, name) {
  return def?.states?.find(s => s.name === name) ?? null;
}
