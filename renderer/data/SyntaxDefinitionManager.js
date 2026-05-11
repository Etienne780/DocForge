import { state } from '@core/State.js';
import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { generateId } from '@common/Common.js';

// ─── Enums ────────────────────────────────────────────────────────────────────

/**
 * The semantic type of a matched token.
 * Used by HighlightStyle to assign colors.
 * Custom strings are also valid for language-specific needs.
 */
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
});

/**
 * Visibility scope of a dynamically registered symbol.
 *
 * GLOBAL → symbol is known for the rest of the entire document after registration.
 * STATE  → symbol is only known while the SyntaxState that registered it is on the
 *          stack. It is automatically removed when that state is popped.
 *
 * When symbolHoisting is true, scope is irrelevant - all symbols are global.
 */
export const RegisterScope = Object.freeze({ GLOBAL: 'global', STATE: 'state' });

/**
 * The variant of a SyntaxStateRule.
 *
 * MATCH     → matches once at the current position (keywords, operators, numbers, …)
 * BEGIN_END → matches an opening and closing delimiter; pushes/pops the state stack
 *             (strings, comments, template literals, blocks, …)
 * INCLUDE   → inlines all rules of another SyntaxState here (shared rule sets)
 */
export const RuleType = Object.freeze({ MATCH: 'match', BEGIN_END: 'beginEnd', INCLUDE: 'include' });

/**
 * How the pattern of a MATCH rule is interpreted.
 *
 * REGEX    → raw regular expression string
 * KEYWORDS → String[], compiled internally to \b(a|b|c)\b
 * WORD     → single word, compiled to \b<word>\b
 */
export const PatternType = Object.freeze({ REGEX: 'regex', KEYWORDS: 'keywords', WORD: 'word' });

/**
 * How a RuleAction manipulates the state stack.
 *
 * PUSH → enter targetStateId, keep current state on the stack
 * POP  → return to the previous state (popCount levels up)
 * SET  → replace the current state with targetStateId without changing the stack depth
 */
export const TransitionType = Object.freeze({ PUSH: 'push', POP: 'pop', SET: 'set' });

/**
 * What happens to a character that is not matched by any rule in the current state.
 *
 * CHARACTER → emit it as a single OTHER token and advance one character
 * SKIP      → silently advance one character
 */
export const OnUnmatched = Object.freeze({ CHARACTER: 'character', SKIP: 'skip' });

// ─── ID Generation ────────────────────────────────────────────────────────────

/** @returns {string} */
export function generateSyntaxDefinitionId() {
  return 'syntaxDefinition_' + generateId();
}

/** @returns {string} */
export function generateSyntaxStateId() {
  return 'syntaxState_' + generateId();
}

/** @returns {string} */
export function generateSyntaxStateRuleId() {
  return 'syntaxStateRule_' + generateId();
}

/** @returns {string} */
export function generateHighlightStyleId() {
  return 'highlightStyle_' + generateId();
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * SyntaxDefinition - the root object for one language.
 *
 * Holds all SyntaxStates (the lexer logic) and HighlightStyles (the colors).
 * A root SyntaxState is created automatically and referenced via rootStateId.
 *
 * Symbol table behaviour:
 *   symbolHoisting: false (default, e.g. C++)
 *     → symbols are registered during lexing; a symbol is only known AFTER the
 *       rule that registered it has fired.
 *   symbolHoisting: true (e.g. JavaScript / Python)
 *     → the entire source is pre-scanned once before real highlighting; all
 *       registering rules fire during the pre-scan so every symbol is known
 *       everywhere regardless of declaration order.
 *
 * predefinedSymbols are loaded into the symbol table before any scanning,
 * so they are always known (e.g. std → namespace, cout → variable for C++).
 *
 * @param {string} name
 * @returns {Object}
 */
export function createSyntaxDefinition(name) {
  const rootState = createSyntaxState('root');
  return {
    id:                generateSyntaxDefinitionId(),
    name,
    aliases:           [],          // String[] - alternative names
    builtIn:           false,
    createdAt:         Date.now(),
    lastOpenedAt:      Date.now(),
    exampleCode:       '',
    symbolHoisting:    false,       // bool - see JSDoc above
    rootStateId:       rootState.id,
    states:            [rootState], // SyntaxState[]
    predefinedSymbols: [],          // PredefinedSymbol[] - always-known symbols
    styles:            [],          // HighlightStyle[]
  };
}

/**
 * PredefinedSymbol - a symbol that is known before any scanning begins.
 * Inserted into the symbol table at startup with a fixed TokenType.
 *
 * Example: { name: 'std', tokenType: TokenType.NAMESPACE }
 *
 * @param {string} name
 * @param {string} tokenType  - TokenType value or custom string
 * @returns {Object}
 */
export function createPredefinedSymbol(name, tokenType) {
  return { name, tokenType };
}

/**
 * SyntaxState - one lexer context.
 *
 * The lexer is always in exactly one state. It starts in the root state.
 * Each state owns an ordered list of SyntaxStateRules (first-match-wins).
 * States are entered/exited via a stack controlled by StateTransitions inside
 * RuleActions:
 *
 *   push → enter a new state, keep the current one on the stack
 *   pop  → return to the previous state
 *   set  → replace the current state without changing the stack depth
 *
 * Example states: 'root', 'string_double', 'template_literal', 'block_comment'
 *
 * @param {string} name
 * @returns {Object}
 */
export function createSyntaxState(name) {
  return {
    id:          generateSyntaxStateId(),
    name,
    rules:       [],                    // SyntaxStateRule[] - ordered, first-match-wins
    onUnmatched: OnUnmatched.CHARACTER, // what to do with unmatched characters
  };
}

/**
 * SyntaxStateRule - one matching rule inside a SyntaxState.
 * The active `type` determines which fields are used; unused fields are ignored.
 *
 * ── type: MATCH ──────────────────────────────────────────────────────────────
 *   Matches a single occurrence at the current position.
 *   Fields: patternType, pattern, caseInsensitive, action
 *
 *   patternType REGEX    → pattern is a regex string
 *   patternType KEYWORDS → pattern is a String[]; compiled to \b(a|b|c)\b
 *   patternType WORD     → pattern is a single string; compiled to \b<word>\b
 *
 *   action → what to do on match (see createSyntaxRuleAction)
 *
 * ── type: BEGIN_END ──────────────────────────────────────────────────────────
 *   Matches a delimited region (string, comment, template literal, …).
 *   On begin-match: beginAction fires, innerStateId becomes the active state
 *   (pushed onto the stack). On end-match: endAction fires, state is popped.
 *   Content between begin and end that is not matched by any rule in
 *   innerStateId receives contentTokenType.
 *
 *   Fields: begin, end, dynamicEnd, beginAction, endAction,
 *           contentTokenType, innerStateId
 *
 *   dynamicEnd: when the end delimiter depends on the begin match (e.g. C++
 *   raw strings R"hello(...)hello"), set dynamicEnd instead of a static end.
 *   The lexer builds the end-regex at runtime from the begin capture group.
 *   → see createDynamicEnd
 *
 * ── type: INCLUDE ─────────────────────────────────────────────────────────────
 *   Inlines all rules of another SyntaxState at this position.
 *   Use for shared rule sets that appear in multiple states.
 *   Fields: includeStateId
 *
 * ── context ──────────────────────────────────────────────────────────────────
 *   Optional guard that limits when a rule is allowed to fire, based on the
 *   TokenType of the immediately preceding token.
 *   Example use: JS regex `/…/` vs division `/` - regex is only valid after
 *   OPERATOR, KEYWORD, PUNCTUATION, not after IDENTIFIER or NUMBER.
 *
 * @param {string} name
 * @returns {Object}
 */
export function createSyntaxStateRule(name) {
  return {
    id:   generateSyntaxStateRuleId(),
    name,
    type: RuleType.MATCH, // 'match' | 'beginEnd' | 'include'

    // ── context guard (all types) ─────────────────────────────────────────
    context: {
      afterTokenType:    null, // TokenType[] | null - rule only fires after these types
      notAfterTokenType: null, // TokenType[] | null - rule never fires after these types
    },

    // ── type: 'match' ─────────────────────────────────────────────────────
    patternType:     PatternType.REGEX, // 'regex' | 'keywords' | 'word'
    pattern:         '',                // String | String[]
    caseInsensitive: false,
    action:          createSyntaxRuleAction(),

    // ── type: 'beginEnd' ──────────────────────────────────────────────────
    begin:            '',   // regex - triggers entry into innerStateId
    end:              '',   // regex - triggers exit (pop) from innerStateId
    dynamicEnd:       null, // DynamicEnd | null - overrides `end` when set
    beginAction:      createSyntaxRuleAction(),
    endAction:        createSyntaxRuleAction(),
    contentTokenType: null, // TokenType | null - fallback type for unmatched content
    innerStateId:     null, // string | null - SyntaxState active between begin and end

    // ── type: 'include' ───────────────────────────────────────────────────
    includeStateId: null, // string | null - SyntaxState whose rules are inlined here
  };
}

/**
 * DynamicEnd - builds the end-regex at runtime from a begin capture group.
 *
 * Used for constructs where the closing delimiter mirrors part of the opening
 * one, e.g. C++ raw string literals:
 *   begin: /R"([^(]*)\(/   captures the delimiter between " and (
 *   dynamicEnd: { captureGroup: 1, template: ')${0}"' }
 *   → if begin captured 'hello', end becomes \)hello"
 *
 * @param {number} captureGroup  - 1-based index of the begin-regex capture group
 * @param {string} template      - end-pattern template; ${0} is replaced by the capture
 * @returns {Object}
 */
export function createDynamicEnd(captureGroup, template) {
  return { captureGroup, template };
}

/**
 * SyntaxRuleAction - what happens when a rule (or begin/end) matches.
 *
 * tokenType → the TokenType assigned to the matched text.
 *             Mutually exclusive with captures (use one or the other).
 *
 * captures  → when the pattern contains regex groups, each group can receive
 *             its own TokenType and optionally register a symbol.
 *             → see createSyntaxCaptureMap
 *
 * register  → when set, the entire matched text (not a capture group) is
 *             registered as a dynamic symbol with the given TokenType and scope.
 *             Use captures[n].register instead when targeting a specific group.
 *             → see createSymbolRegister
 *
 * transition → optional stack manipulation after this action fires.
 *              Typically used in beginAction (push) and endAction (pop).
 *              → see createSyntaxStateTransition
 *
 * @returns {Object}
 */
export function createSyntaxRuleAction() {
  return {
    tokenType:  null, // TokenType | null
    captures:   null, // CaptureMap | null - used instead of tokenType when groups are present
    register:   null, // SymbolRegister | null - registers the whole match as a symbol
    transition: null, // StateTransition | null
  };
}

/**
 * CaptureMap - maps regex capture group indices to per-group actions.
 *
 * Each entry can have:
 *   tokenType → TokenType assigned to that group's matched text
 *   register  → SymbolRegister | null - registers that group's text as a symbol
 *
 * Example for pattern /(class|struct)\s+([A-Za-z_]\w*)/  :
 *   groups: {
 *     '1': { tokenType: TokenType.KEYWORD,    register: null },
 *     '2': { tokenType: TokenType.TYPE,       register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) },
 *   }
 * → 'class' becomes KEYWORD, 'MyClass' becomes TYPE and is registered globally.
 *
 * Populate after creation:
 *   const map = createSyntaxCaptureMap();
 *   map.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
 *
 * @returns {Object}
 */
export function createSyntaxCaptureMap() {
  return {
    groups: {}, // { [groupIndex: string]: { tokenType: TokenType, register: SymbolRegister | null } }
  };
}

/**
 * SymbolRegister - registers a matched string into the runtime symbol table.
 *
 * Once registered, subsequent occurrences of that string as an IDENTIFIER are
 * re-colored with the registered TokenType instead of plain IDENTIFIER.
 *
 * scope:
 *   GLOBAL → symbol persists for the whole document (or until the next parse).
 *   STATE  → symbol is removed from the table when the SyntaxState that
 *            registered it is popped from the stack. Use for block-scoped
 *            symbols (e.g. a class defined inside a function in C++).
 *
 * When symbolHoisting is true on the SyntaxDefinition, scope has no effect —
 * all symbols are treated as global because the pre-scan fills the table before
 * real highlighting begins.
 *
 * @param {string} tokenType
 * @param {'global'|'state'} scope
 * @returns {Object}
 */
export function createSymbolRegister(tokenType, scope = RegisterScope.GLOBAL) {
  return { tokenType, scope };
}

/**
 * StateTransition - manipulates the lexer state stack.
 *
 * PUSH + targetStateId → push the current state, enter targetStateId.
 *                        The current state is restored on the next POP.
 * POP  + popCount      → exit popCount levels and resume the state below.
 * SET  + targetStateId → replace the current state without touching the stack.
 *
 * @param {'push'|'pop'|'set'} type
 * @param {string|null} targetStateId  - required for PUSH and SET
 * @param {number}      popCount       - only used for POP (default 1)
 * @returns {Object}
 */
export function createSyntaxStateTransition(type = TransitionType.PUSH, targetStateId = null, popCount = 1) {
  return {
    type,
    targetStateId,
    popCount,
  };
}

/**
 * HighlightStyle - the color/style layer for a SyntaxDefinition.
 *
 * Completely decoupled from the lexer logic. One SyntaxDefinition can have
 * multiple styles (dark theme, light theme, high-contrast, …).
 *
 * tokenStyles → one entry per TokenType; applies to every token of that type
 *               across all states and rules.
 *
 * overrides   → exception entries that target a specific rule inside a specific
 *               state. Overrides take precedence over tokenStyles.
 *               Identified by stateId + ruleId.
 *
 * @param {string} name
 * @returns {Object}
 */
export function createHighlightStyle(name) {
  return {
    id:          generateHighlightStyleId(),
    name,
    tokenStyles: [], // TokenStyle[]  - global color per TokenType
    overrides:   [], // StyleOverride[] - per-rule color exceptions
  };
}

/**
 * TokenStyle - visual properties for one TokenType.
 *
 * @param {string} tokenType  - TokenType value or custom string
 * @param {string} color      - hex color string, e.g. '#569cd6'
 * @param {Object} [opts]     - { bold?: bool, italic?: bool, underline?: bool }
 * @returns {Object}
 */
export function createTokenStyle(tokenType, color, opts = {}) {
  return {
    tokenType,
    color,
    bold:      opts.bold      ?? false,
    italic:    opts.italic    ?? false,
    underline: opts.underline ?? false,
  };
}

/**
 * StyleOverride - overrides the color for one specific rule in one specific state.
 *
 * Takes precedence over the global TokenStyle for that TokenType.
 * Identified by stateId (SyntaxState.id) + ruleId (SyntaxStateRule.id).
 *
 * @param {string} stateId
 * @param {string} ruleId
 * @param {Object} tokenStyle  - createTokenStyle(…)
 * @returns {Object}
 */
export function createStyleOverride(stateId, ruleId, tokenStyle) {
  return { stateId, ruleId, style: tokenStyle };
}

// ─── SyntaxDefinition Accessors ───────────────────────────────────────────────

/** @returns {Object[]} */
export function getLanguages() {
  return state.get('languages') ?? [];
}

/** @returns {Object[]} */
export function getPresetLanguages() {
  return session.get('languagePresets') ?? [];
}

/**
 * @param {string} id
 * @param {Object[]|null} [list]
 * @returns {Object|null}
 */
export function findSyntaxDefinition(id, list = null) {
  const list = list ?? getLanguages();
  if(!list)
    return null;
  return list.find(l => l.id === id) ?? null;
}

/**
 * @param {string} alias
 * @param {Object[]|null} [list]
 * @returns {Object|null}
 */
export function findSyntaxDefinitionByAlias(alias, list = null) {
  const list = list ?? getLanguages();
  if(!list)
    return null;

  const lower = alias.toLowerCase();
  return list.find(l => {
    return l.aliases.find(a => a.toLowerCase() === lower);
  }) ?? null;
}

/**
 * @param {string} name
 * @param {Object[]|null} [list]
 * @returns {Object|null}
 */
export function findSyntaxDefinitionByName(name, list = null) {
  const q = name.toLowerCase();
  return (list ?? getLanguages()).find(l =>
    l.name.toLowerCase() === q || l.aliases.some(a => a.toLowerCase() === q)
  ) ?? null;
}

/** @param {Object} def */
export function addSyntaxDefinition(def) {
  state.set('languages', [...getLanguages(), def]);
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function removeSyntaxDefinition(id) {
  const langs = getLanguages();
  const idx = langs.findIndex(l => l.id === id);
  if (idx === -1)
    return false;

  const copy = [...langs];
  copy.splice(idx, 1);
  state.set('languages', copy);
  return true;
}

/**
 * @param {string} id
 * @param {Object} changes
 * @returns {boolean}
 */
export function updateSyntaxDefinition(id, changes) {
  const def = findSyntaxDefinition(id);
  if (!def)
    return false;

  Object.assign(def, changes);
  state.set('languages', [...getLanguages()]);
  return true;
}

/**
 * @param {Object} def
 * @param {string} query
 * @returns {boolean}
 */
export function syntaxDefinitionMatchesSearch(def, query) {
  if (!query)
    return true;

  const q = query.toLowerCase();
  if ((q === 'builtin' || q === 'built in') && def.builtIn)
    return true;
  return def.name.toLowerCase().includes(q) || def.aliases.some(a => a.toLowerCase().includes(q));
}

// ─── SyntaxState Accessors ────────────────────────────────────────────────────

/**
 * @param {Object} def
 * @param {string} stateId
 * @returns {Object|null}
 */
export function findSyntaxState(def, stateId) {
  return def?.states?.find(s => s.id === stateId) ?? null;
}

/**
 * @param {Object} def
 * @returns {Object|null}
 */
export function findRootSyntaxState(def) {
  return def?.states?.find(s => s.id === def.rootStateId) ?? null;
}

/**
 * @param {Object} def
 * @param {string} name
 * @returns {Object|null}
 */
export function findSyntaxStateByName(def, name) {
  return def?.states?.find(s => s.name === name) ?? null;
}

/**
 * @param {string} defId
 * @param {string} name
 * @returns {Object|null} the created state
 */
export function addSyntaxState(defId, name) {
  const def = findSyntaxDefinition(defId);
  if (!def)
    return null;

  const s = createSyntaxState(name);
  def.states.push(s);
  state.set('languages', [...getLanguages()]);
  return s;
}

/**
 * @param {string} defId
 * @param {string} stateId
 * @returns {boolean}
 */
export function removeSyntaxState(defId, stateId) {
  const def = findSyntaxDefinition(defId);
  if (!def)
    return false;

  const idx = def.states.findIndex(s => s.id === stateId);
  if (idx === -1)
    return false;

  def.states.splice(idx, 1);
  state.set('languages', [...getLanguages()]);
  return true;
}

// ─── SyntaxStateRule Accessors ────────────────────────────────────────────────

/**
 * @param {Object} syntaxState
 * @param {string} ruleId
 * @returns {Object|null}
 */
export function findSyntaxStateRule(syntaxState, ruleId) {
  return syntaxState?.rules?.find(r => r.id === ruleId) ?? null;
}

/**
 * @param {string} defId
 * @param {string} stateId
 * @param {string} name
 * @returns {Object|null} the created rule
 */
export function addSyntaxStateRule(defId, stateId, name) {
  const def = findSyntaxDefinition(defId);
  const syntaxState = findSyntaxState(def, stateId);
  if (!syntaxState)
    return null;

  const rule = createSyntaxStateRule(name);
  syntaxState.rules.push(rule);
  state.set('languages', [...getLanguages()]);
  return rule;
}

/**
 * @param {string} defId
 * @param {string} stateId
 * @param {string} ruleId
 * @returns {boolean}
 */
export function removeSyntaxStateRule(defId, stateId, ruleId) {
  const def = findSyntaxDefinition(defId);
  const syntaxState = findSyntaxState(def, stateId);
  const rule = findSyntaxStateRule(syntaxState, ruleId);
  if (!rule)
    return false;

  syntaxState.rules.splice(syntaxState.rules.indexOf(rule), 1);
  state.set('languages', [...getLanguages()]);
  return true;
}

/**
 * @param {string} defId
 * @param {string} stateId
 * @param {string} ruleId
 * @param {Object} changes
 * @returns {boolean}
 */
export function updateSyntaxStateRule(defId, stateId, ruleId, changes) {
  const def = findSyntaxDefinition(defId);
  const syntaxState = findSyntaxState(def, stateId);
  const rule = findSyntaxStateRule(syntaxState, ruleId);
  if (!rule)
    return false;

  Object.assign(rule, changes);
  state.set('languages', [...getLanguages()]);
  return true;
}

// ─── HighlightStyle Accessors ─────────────────────────────────────────────────

/**
 * @param {Object} def
 * @param {string} styleId
 * @returns {Object|null}
 */
export function findHighlightStyle(def, styleId) {
  return def?.styles?.find(s => s.id === styleId) ?? null;
}

/**
 * @param {string} defId
 * @param {string} name
 * @returns {Object|null} the created style
 */
export function addHighlightStyle(defId, name) {
  const def = findSyntaxDefinition(defId);
  if (!def)
    return null;

  const style = createHighlightStyle(name);
  def.styles.push(style);
  state.set('languages', [...getLanguages()]);
  return style;
}

/**
 * @param {string} defId
 * @param {string} styleId
 * @returns {boolean}
 */
export function removeHighlightStyle(defId, styleId) {
  const def = findSyntaxDefinition(defId);
  const style = findHighlightStyle(def, styleId);
  if (!style)
    return false;

  def.styles.splice(def.styles.indexOf(style), 1);
  state.set('languages', [...getLanguages()]);
  return true;
}

/**
 * Sets or replaces the TokenStyle for a given tokenType within a style.
 * @param {string} defId
 * @param {string} styleId
 * @param {string} tokenType
 * @param {string} color
 * @param {Object} [opts]
 * @returns {boolean}
 */
export function setHighlightStyleTokenStyle(defId, styleId, tokenType, color, opts = {}) {
  const def = findSyntaxDefinition(defId);
  const style = findHighlightStyle(def, styleId);
  if (!style)
    return false;

  const existing = style.tokenStyles.find(t => t.tokenType === tokenType);
  if (existing) {
    Object.assign(existing, createTokenStyle(tokenType, color, opts));
  } else {
    style.tokenStyles.push(createTokenStyle(tokenType, color, opts));
  }

  state.set('languages', [...getLanguages()]);
  return true;
}

/**
 * @param {string} defId
 * @param {string} styleId
 * @param {string} stateId
 * @param {string} ruleId
 * @param {Object} tokenStyle
 * @returns {boolean}
 */
export function setStyleOverride(defId, styleId, stateId, ruleId, tokenStyle) {
  const def = findSyntaxDefinition(defId);
  const style = findHighlightStyle(def, styleId);
  if (!style)
    return false;

  const existing = style.overrides.find(o => o.stateId === stateId && o.ruleId === ruleId);
  if (existing) {
    existing.style = tokenStyle;
  } else {
    style.overrides.push(createStyleOverride(stateId, ruleId, tokenStyle));
  }

  state.set('languages', [...getLanguages()]);
  return true;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export function openSyntaxDefinitionEditor(lang) {
  if (!lang)
    return;
  updateSyntaxDefinition(lang.id, { lastOpenedAt: Date.now() });
  eventBus.emit('save:request:languages');
  eventBus.emit('navigate:languageEditor', { langId: lang.id });
}