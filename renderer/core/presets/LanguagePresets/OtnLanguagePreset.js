import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxStateTransition,
  createHighlightStyle,
  createTokenStyle,
  createPredefinedSymbol,
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
  const state = createSyntaxState(name);
  def.states.push(state);
  return state;
}

function action(tokenType, transition = null) {
  const result = createSyntaxRuleAction();
  result.tokenType = tokenType;
  result.transition = transition;
  return result;
}

function push(stateId) {
  return createSyntaxStateTransition(TransitionType.PUSH, stateId);
}

function pop(count = 1) {
  return createSyntaxStateTransition(TransitionType.POP, null, count);
}

function include(state) {
  return { includeStateId: state.id };
}

export function createOtnLanguage() {
  const def = createSyntaxDefinition('OTN');

  def.aliases = ['otn'];
  def.id = 'OtnLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Built-in symbols.
  const predefined = [
    ['int', TokenType.TYPE],
    ['int64', TokenType.TYPE],
    ['uint64', TokenType.TYPE],
    ['float', TokenType.TYPE],
    ['double', TokenType.TYPE],
    ['bool', TokenType.TYPE],
    ['String', TokenType.TYPE],
    ['string', TokenType.TYPE],
    ['object', TokenType.TYPE],
    ['list', TokenType.TYPE],
    ['any', TokenType.TYPE],
    ['Ref', TokenType.KEYWORD],
    ['true', TokenType.LITERAL],
    ['false', TokenType.LITERAL],
    ['version', TokenType.KEYWORD],
    ['defType', TokenType.KEYWORD],
    ['defName', TokenType.KEYWORD],
    ['object', TokenType.KEYWORD],
  ];

  def.predefinedSymbols = predefined.map(([name, type]) =>
    createPredefinedSymbol(name, type)
  );

  // States.
  const shared = newState(def, 'shared_rules');
  const strDouble = newState(def, 'string_double');
  const strEscape = newState(def, 'string_escape');
  const blockComment = newState(def, 'block_comment');

  // object_entries: erkennt Objekt-Header ("Name[N] {") und alles, was
  // danach als lose Datenzeile herumsteht (Zahlen/Strings kommen bereits
  // über "shared", Kommas/Semikola/Klammern ebenfalls - siehe unten).
  // Wird von root UND objectBody per INCLUDE genutzt, damit Objekte
  // sowohl innerhalb als auch AUSSERHALB eines "@object: {}"-Blocks
  // erkannt werden.
  const objectEntries = newState(def, 'object_entries');

  const objectBody = newState(def, 'object_body');
  const objectFields = newState(def, 'object_fields');

  const defType = newState(def, 'def_type');
  const defName = newState(def, 'def_name');

  // String escapes.
  strEscape.onUnmatched = OnUnmatched.CHARACTER;

  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern =
      /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  strDouble.onUnmatched = OnUnmatched.CHARACTER;

  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Comments.
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end = /\*\//.source;
    r.beginAction = action(
      TokenType.COMMENT,
      push(blockComment.id)
    );
    r.endAction = action(
      TokenType.COMMENT,
      pop()
    );
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Strings.
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end = '"';
    r.beginAction = action(
      TokenType.STRING,
      push(strDouble.id)
    );
    r.endAction = action(
      TokenType.STRING,
      pop()
    );
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Numbers.
  addRule(shared, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern =
      /-?(?:\d+\.\d+|\d+)(?:[eE][+-]?\d+)?/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(shared, 'boolean', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:true|false)\b/.source;
    r.action = action(TokenType.LITERAL);
  });

  // Generische Satzzeichen, die praktisch überall auftauchen können:
  // Kommas/Semikola als Werte-Trenner, "[" "]" für Array-Literale in
  // Datenzeilen (beliebig tief verschachtelt, z.B. "[[1, 2], [3]]" -
  // da hier keine Tiefe gezählt werden muss, reicht ein Token pro
  // Klammer völlig aus).
  addRule(shared, 'comma', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /,/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(shared, 'semicolon', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /;/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(shared, 'bracket_open', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\[/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(shared, 'bracket_close', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Directives.
  addRule(shared, 'version_directive', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@version\b/.source;
    r.action = action(TokenType.KEYWORD);
  });

  addRule(shared, 'def_type_directive', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@defType\b/.source;
    r.action = action(
      TokenType.KEYWORD,
      push(defType.id)
    );
  });

  addRule(shared, 'def_name_directive', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@defName\b/.source;
    r.action = action(
      TokenType.KEYWORD,
      push(defName.id)
    );
  });

  // Fallback: falls @object mal ohne unmittelbar folgendem "{" auftaucht.
  addRule(shared, 'object_directive', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@object\b/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // ── object_entries ───────────────────────────────────────────────────
  // Objekt-Header, z.B. "Weapon[3] {" oder "Enemies[2] {".
  addRule(objectEntries, 'object_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*(?=\s*\[\s*\d+\s*\]\s*\{)/.source;
    r.action = action(TokenType.FUNCTION);
  });

  addRule(objectEntries, 'row_count', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\[\s*\d+\s*\]/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(objectEntries, 'object_open', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\{/.source;
    r.action = action(
      TokenType.PUNCTUATION,
      push(objectFields.id)
    );
  });

  // ── root ─────────────────────────────────────────────────────────────
  addRule(root, 'object_block', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@object\s*:\s*\{/.source;
    r.action = action(
      TokenType.KEYWORD,
      push(objectBody.id)
    );
  });

  addRule(root, 'include_object_entries', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = objectEntries.id;
  });

  // ── object_body ──────────────────────────────────────────────────────
  // Schliessende "}" des GESAMTEN @object-Blocks -> zurück nach root.
  addRule(objectBody, 'object_close', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\}/.source;
    r.action = action(
      TokenType.PUNCTUATION,
      pop()
    );
  });

  addRule(objectBody, 'include_object_entries', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = objectEntries.id;
  });

  // ── object_fields ────────────────────────────────────────────────────
  // Feld-Typ vor "/": Zahl, "Ref<Type>" oder Bezeichner, gefolgt von
  // beliebig vielen "[]" (unendlich tief verschachtelbare Arrays, z.B.
  // "Ref<Weapon>[][]/grid"), bevor der eigentliche Trenner "/" kommt.
  addRule(objectFields, 'field_type', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern =
      /(?:\d+|Ref<[A-Za-z_]\w*>|[A-Za-z_]\w*)(?=(?:\s*\[\])*\s*\/)/.source;
    r.action = action(TokenType.TYPE);
  });

  // Array-Marker "[]" nach dem Typ - matcht pro Aufruf ein Paar, wird bei
  // mehrfachem Vorkommen ("[][][]" ...) einfach mehrfach hintereinander
  // erneut getroffen, unterstützt also beliebige Verschachtelungstiefe.
  addRule(objectFields, 'field_array', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\[\]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(objectFields, 'field_separator', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\//.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Feldname direkt nach "/" - Bezeichner ODER numerischer Index
  // (Referenz in die @defName-Tabelle, z.B. "1/0", "0/1").
  addRule(objectFields, 'field_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=\/)\s*(?:[A-Za-z_]\w*|\d+)/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Ende der Feld-Deklarationen: die Liste schliesst direkt mit "}"
  // (KEIN ";" davor, z.B. "0/id, 0/level, 1/0\n};"). pop() zurück zu dem
  // State, der objectFields gepusht hat (root ODER object_body - stack-
  // basiert, funktioniert für beide automatisch richtig).
  addRule(objectFields, 'field_close', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\}/.source;
    r.action = action(
      TokenType.PUNCTUATION,
      pop()
    );
  });

  addRule(objectFields, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // @defType.
  addRule(defType, 'colon', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /:/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(defType, 'type_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern =
      /\b(?:int|int64|uint64|float|double|bool|String|string|object|list|any|Ref)\b/
        .source;
    r.action = action(TokenType.TYPE);
  });

  addRule(defType, 'definition_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*(?=\s*=)/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(defType, 'equals', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /=/.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(defType, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(defType, 'comma', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /,/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(defType, 'end', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /;/.source;
    r.action = action(
      TokenType.PUNCTUATION,
      pop()
    );
  });

  // @defName.
  addRule(defName, 'colon', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /:/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(defName, 'definition_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*(?=\s*=)/.source;
    r.action = action(TokenType.VARIABLE);
  });

  addRule(defName, 'equals', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /=/.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(defName, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(defName, 'comma', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /,/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(defName, 'end', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /;/.source;
    r.action = action(
      TokenType.PUNCTUATION,
      pop()
    );
  });

  // Root rules (nach object_block / include_object_entries).
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // object_body braucht ebenfalls Zugriff auf "shared" (Zahlen, Strings,
  // Kommentare, generische Satzzeichen für Datenzeilen).
  addRule(objectBody, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  def.exampleCode = `// OTN does not support comments natively - these are for explanation only.

@version: 1;
@defType: int = 0, float = 1, String = 2;
@defName: name = 0, value = 1;

@object: {
  Weapon[3] {
    int/name, float/damage, String/type
  };
  1, 15.5, "Sword";
  2, 8.0, "Dagger";
  3, 22.0, "Axe";

  Player[2] {
    String/name, int/health, Ref<Weapon>/weapon
  };
  "Alice", 100, 1;
  "Bob", 80, 3;

  // Type/Name als numerische Referenzen auf @defType / @defName
  Enemies[2] {
    0/id, 0/1, 1/0
  };
  0, 20, 0;
  1, 20, 1;

  // Beliebig tief verschachtelte Arrays, sowohl im Typ als auch als Daten
  Inventory[1] {
    int/owner, Ref<Weapon>[][]/weaponGrid
  };
  1, [[1, 2], [3]];
};

// Objekte funktionieren auch AUSSERHALB eines @object-Blocks
Standalone[1] {
  int/value
};
42;`;

  return def;
}

export function createOtnLanguageStyles(otnDef) {
  const darkStyle = createHighlightStyle(otnDef.id, 'Dark+');
  darkStyle.builtIn = true;

  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD, '#569cd6'),
    createTokenStyle(TokenType.TYPE, '#4ec9b0'),
    createTokenStyle(TokenType.IDENTIFIER, '#9cdcfe'),
    createTokenStyle(TokenType.VARIABLE, '#d7ba7d'),
    createTokenStyle(TokenType.FUNCTION, '#dcdcaa'),
    createTokenStyle(TokenType.OPERATOR, '#d4d4d4'),
    createTokenStyle(TokenType.PUNCTUATION, '#808080'),
    createTokenStyle(TokenType.NUMBER, '#b5cea8'),
    createTokenStyle(TokenType.STRING, '#ce9178'),
    createTokenStyle(TokenType.LITERAL, '#569cd6'),
    createTokenStyle(TokenType.COMMENT, '#6a9955', {
      italic: true,
    }),
    createTokenStyle(TokenType.ESCAPE, '#d7ba7d'),
    createTokenStyle(TokenType.OTHER, '#d4d4d4'),
  ];

  return [darkStyle];
}