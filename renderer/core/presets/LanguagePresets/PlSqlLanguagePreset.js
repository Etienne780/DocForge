import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxStateTransition,
  createSyntaxCaptureMap,
  createSymbolRegister,
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

export function createPlSqlLanguage() {
  const def = createSyntaxDefinition('PL/SQL');
  def.aliases = ['plsql', 'pl/sql', 'oracle'];
  def.id = 'PlSqlLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols – common PL/SQL data types and functions
  const predefined = [
    // Data types
    ['NUMBER',        TokenType.TYPE],
    ['INTEGER',       TokenType.TYPE],
    ['INT',           TokenType.TYPE],
    ['SMALLINT',      TokenType.TYPE],
    ['BINARY_INTEGER', TokenType.TYPE],
    ['PLS_INTEGER',   TokenType.TYPE],
    ['VARCHAR2',      TokenType.TYPE],
    ['VARCHAR',       TokenType.TYPE],
    ['CHAR',          TokenType.TYPE],
    ['NCHAR',         TokenType.TYPE],
    ['NVARCHAR2',     TokenType.TYPE],
    ['DATE',          TokenType.TYPE],
    ['TIMESTAMP',     TokenType.TYPE],
    ['INTERVAL',      TokenType.TYPE],
    ['BOOLEAN',       TokenType.TYPE],
    ['CLOB',          TokenType.TYPE],
    ['NCLOB',         TokenType.TYPE],
    ['BLOB',          TokenType.TYPE],
    ['BFILE',         TokenType.TYPE],
    ['RAW',           TokenType.TYPE],
    ['LONG',          TokenType.TYPE],
    ['LONG RAW',      TokenType.TYPE],
    ['REF CURSOR',    TokenType.TYPE],
    ['SYS_REFCURSOR', TokenType.TYPE],
    ['RECORD',        TokenType.TYPE],
    ['TABLE',         TokenType.TYPE],
    ['VARRAY',        TokenType.TYPE],
    ['%TYPE',         TokenType.TYPE],
    ['%ROWTYPE',      TokenType.TYPE],
    // Common functions
    ['SQLCODE',       TokenType.FUNCTION],
    ['SQLERRM',       TokenType.FUNCTION],
    ['TO_CHAR',       TokenType.FUNCTION],
    ['TO_DATE',       TokenType.FUNCTION],
    ['TO_NUMBER',     TokenType.FUNCTION],
    ['TO_TIMESTAMP',  TokenType.FUNCTION],
    ['NVL',           TokenType.FUNCTION],
    ['NVL2',          TokenType.FUNCTION],
    ['COALESCE',      TokenType.FUNCTION],
    ['DECODE',        TokenType.FUNCTION],
    ['CASE',          TokenType.FUNCTION],
    ['SUBSTR',        TokenType.FUNCTION],
    ['INSTR',         TokenType.FUNCTION],
    ['LENGTH',        TokenType.FUNCTION],
    ['LPAD',          TokenType.FUNCTION],
    ['RPAD',          TokenType.FUNCTION],
    ['TRIM',          TokenType.FUNCTION],
    ['LTRIM',         TokenType.FUNCTION],
    ['RTRIM',         TokenType.FUNCTION],
    ['REPLACE',       TokenType.FUNCTION],
    ['TRANSLATE',     TokenType.FUNCTION],
    ['UPPER',         TokenType.FUNCTION],
    ['LOWER',         TokenType.FUNCTION],
    ['INITCAP',       TokenType.FUNCTION],
    ['SYSDATE',       TokenType.FUNCTION],
    ['SYSTIMESTAMP',  TokenType.FUNCTION],
    ['CURRENT_DATE',  TokenType.FUNCTION],
    ['CURRENT_TIMESTAMP', TokenType.FUNCTION],
    ['EXTRACT',       TokenType.FUNCTION],
    ['ADD_MONTHS',    TokenType.FUNCTION],
    ['MONTHS_BETWEEN', TokenType.FUNCTION],
    ['LAST_DAY',      TokenType.FUNCTION],
    ['NEXT_DAY',      TokenType.FUNCTION],
    ['ROUND',         TokenType.FUNCTION],
    ['TRUNC',         TokenType.FUNCTION],
    ['CEIL',          TokenType.FUNCTION],
    ['FLOOR',         TokenType.FUNCTION],
    ['MOD',           TokenType.FUNCTION],
    ['POWER',         TokenType.FUNCTION],
    ['SQRT',          TokenType.FUNCTION],
    ['SIGN',          TokenType.FUNCTION],
    ['ABS',           TokenType.FUNCTION],
    ['DBMS_OUTPUT',   TokenType.NAMESPACE],
    ['DBMS_LOB',      TokenType.NAMESPACE],
    ['DBMS_SQL',      TokenType.NAMESPACE],
    ['DBMS_JOB',      TokenType.NAMESPACE],
    ['UTL_FILE',      TokenType.NAMESPACE],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const blockComment = newState(def, 'block_comment');
  const strQuoted = newState(def, 'string_q_quoted'); // q'[...]', q'{...}', q'!...!'

  // String escape: no backslash escapes in Oracle, a quote is doubled ('').
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /''|""/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Single-quoted string content
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // q-quoted string content: no escapes at all
  strQuoted.onUnmatched = OnUnmatched.CHARACTER;

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Common rules
  // Built-in function calls - before keywords so `REPLACE(` stays a function
  addRule(common, 'builtin_functions', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = new RegExp('\\b(?:' + [
      'SQLCODE', 'SQLERRM', 'TO_CHAR', 'TO_DATE', 'TO_NUMBER', 'TO_TIMESTAMP', 'TO_CLOB',
      'TO_BLOB', 'TO_DSINTERVAL', 'TO_YMINTERVAL', 'CAST', 'NVL', 'NVL2', 'COALESCE',
      'NULLIF', 'DECODE', 'GREATEST', 'LEAST', 'SUBSTR', 'INSTR', 'LENGTH', 'LPAD',
      'RPAD', 'TRIM', 'LTRIM', 'RTRIM', 'REPLACE', 'TRANSLATE', 'UPPER', 'LOWER',
      'INITCAP', 'CONCAT', 'CHR', 'ASCII', 'REGEXP_LIKE', 'REGEXP_SUBSTR',
      'REGEXP_REPLACE', 'REGEXP_INSTR', 'REGEXP_COUNT', 'EXTRACT', 'ADD_MONTHS',
      'MONTHS_BETWEEN', 'LAST_DAY', 'NEXT_DAY', 'ROUND', 'TRUNC', 'CEIL', 'FLOOR',
      'MOD', 'REMAINDER', 'POWER', 'SQRT', 'SIGN', 'ABS', 'EXP', 'LN', 'LOG',
      'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'LISTAGG', 'ROW_NUMBER', 'RANK',
      'DENSE_RANK', 'LEAD', 'LAG', 'FIRST_VALUE', 'LAST_VALUE', 'NTILE',
      'JSON_VALUE', 'JSON_QUERY', 'JSON_OBJECT', 'JSON_ARRAY', 'JSON_TABLE',
      'JSON_ARRAYAGG', 'JSON_OBJECTAGG', 'XMLELEMENT', 'XMLAGG', 'SYS_GUID',
      'SYS_CONTEXT', 'USERENV', 'RAISE_APPLICATION_ERROR', 'DBTIMEZONE', 'SESSIONTIMEZONE',
    ].join('|') + ')(?=\\s*\\()').source;
    r.action = action(TokenType.FUNCTION);
  });

  // PROCEDURE name / FUNCTION name declarations
  addRule(common, 'subprogram_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /\b(PROCEDURE|FUNCTION)(\s+)([A-Za-z_][\w$#]*)/.source;
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

  // Package-qualified calls: DBMS_OUTPUT.PUT_LINE( -> PUT_LINE
  addRule(common, 'qualified_function', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=\.)[A-Za-z_][\w$#]*(?=\s*\()/.source;
    r.action = action(TokenType.FUNCTION);
  });

  // Built-in packages: DBMS_*, UTL_*, APEX_* before a `.`
  addRule(common, 'builtin_packages', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /\b(?:DBMS|UTL|APEX|OWA|HTP|HTF)_?\w*(?=\.)/.source;
    r.action = action(TokenType.NAMESPACE);
  });

  // TRUE / FALSE / NULL
  addRule(common, 'literals', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = ['TRUE', 'FALSE'];
    r.action = action(TokenType.LITERAL);
  });

  // SQL keywords (standard)
  addRule(common, 'sql_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'INTO', 'FROM',
      'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT',
      'OFFSET', 'FETCH', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER',
      'CROSS', 'NATURAL', 'USING', 'ON', 'UNION', 'INTERSECT', 'EXCEPT', 'MINUS',
      'DISTINCT', 'ALL', 'AS', 'OR', 'AND', 'IN', 'BETWEEN', 'LIKE',
      'EXISTS', 'ANY', 'SOME', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
      'OVER', 'PARTITION', 'ROW', 'ROWS', 'RANGE', 'UNBOUNDED', 'PRECEDING',
      'FOLLOWING', 'CURRENT', 'VALUES', 'DEFAULT', 'NULL', 'NOT',
      'CREATE', 'REPLACE', 'ALTER', 'DROP', 'TRUNCATE', 'TABLE', 'VIEW', 'INDEX',
      'SEQUENCE', 'SYNONYM', 'GRANT', 'REVOKE', 'WITH', 'MATCHED', 'RETURNING',
      'NEXT', 'FIRST', 'LAST', 'ONLY', 'TIES', 'NULLS', 'PIVOT', 'UNPIVOT',
      'LATERAL', 'APPLY', 'START', 'CONNECT', 'PRIOR', 'LEVEL', 'NOCYCLE', 'SIBLINGS',
      'CONSTRAINT', 'PRIMARY', 'FOREIGN', 'KEY', 'REFERENCES', 'UNIQUE', 'CHECK',
      'GENERATED', 'ALWAYS', 'IDENTITY', 'COMMENT', 'ESCAPE',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // PL/SQL-specific keywords
  addRule(common, 'plsql_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      'DECLARE', 'BEGIN', 'END', 'EXCEPTION', 'WHEN', 'ELSE', 'IF',
      'ELSIF', 'LOOP', 'EXIT', 'FOR', 'FORALL', 'WHILE', 'CONTINUE', 'GOTO',
      'RETURN', 'RAISE', 'PRAGMA', 'EXCEPTION_INIT', 'INLINE', 'REVERSE',
      'CURSOR', 'OPEN', 'FETCH', 'CLOSE', 'BULK', 'COLLECT', 'INTO', 'LIMIT',
      'SAVE', 'EXCEPTIONS', 'INDICES', 'BOUND', 'PIPE',
      'EXECUTE', 'IMMEDIATE', 'USING', 'DYNAMIC', 'SQL', 'NO_DATA_FOUND',
      'TOO_MANY_ROWS', 'DUP_VAL_ON_INDEX', 'VALUE_ERROR', 'ZERO_DIVIDE',
      'INVALID_NUMBER', 'INVALID_CURSOR', 'CURSOR_ALREADY_OPEN', 'CASE_NOT_FOUND',
      'COLLECTION_IS_NULL', 'SUBSCRIPT_BEYOND_COUNT', 'ROWTYPE_MISMATCH',
      'OTHERS', 'SUBTYPE', 'TYPE', 'IS', 'AS', 'OF',
      'PACKAGE', 'BODY', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'BEFORE',
      'AFTER', 'INSTEAD', 'EACH', 'REFERENCING', 'NEW', 'OLD', 'PARENT',
      'FOLLOWS', 'PRECEDES', 'COMPOUND', 'ENABLE', 'DISABLE',
      'FORWARD', 'REF', 'OUT', 'IN', 'NOCOPY', 'DEFAULT', 'CONSTANT', 'AUTHID',
      'CURRENT_USER', 'DEFINER', 'DETERMINISTIC', 'PIPELINED', 'PARALLEL_ENABLE',
      'RESULT_CACHE', 'RELIES_ON', 'ACCESSIBLE', 'MEMBER', 'CONSTRUCTOR', 'SELF',
      'STATIC', 'FINAL', 'INSTANTIABLE', 'OVERRIDING', 'UNDER', 'MAP',
      'OVERLOADING', 'RESTRICT_REFERENCES', 'EDITIONABLE', 'NONEDITIONABLE',
      'SERVERERROR', 'LOGON', 'LOGOFF', 'STARTUP', 'SHUTDOWN',
      'DATABASE', 'TRANSACTION', 'ROLLBACK', 'COMMIT', 'SAVEPOINT',
      'SET', 'AUTONOMOUS_TRANSACTION', 'SERIALLY_REUSABLE', 'UDF', 'RECORD', 'VARRAY',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Data types (case-insensitive)
  addRule(common, 'data_types', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      'NUMBER', 'INTEGER', 'INT', 'SMALLINT', 'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL',
      'BINARY_INTEGER', 'PLS_INTEGER', 'SIMPLE_INTEGER', 'BINARY_FLOAT', 'BINARY_DOUBLE',
      'NATURAL', 'NATURALN', 'POSITIVE', 'POSITIVEN', 'SIGNTYPE',
      'VARCHAR2', 'VARCHAR', 'CHAR', 'NCHAR', 'NVARCHAR2', 'STRING', 'LONG', 'RAW',
      'DATE', 'TIMESTAMP', 'INTERVAL', 'BOOLEAN', 'CLOB', 'NCLOB', 'BLOB', 'BFILE',
      'ROWID', 'UROWID', 'XMLTYPE', 'JSON', 'VECTOR', 'SYS_REFCURSOR',
    ];
    r.action = action(TokenType.TYPE);
  });

  // Variable: :variable (bind variable, :new / :old in triggers)
  addRule(common, 'bind_variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<![:\w]):[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Variable: v_variable (PL/SQL variable)
  addRule(common, 'plsql_variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_][\w$#]*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Line comment: --
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /--.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Block comment: /* ... */
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Double-quoted identifiers
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // q-quoted strings: q'[...]', q'{...}', q'(...)', q'<...>' close with the
  // matching bracket, any other delimiter closes with itself: q'!...!'.
  // Must come before string_single.
  const Q_BRACKETS = [
    ['q_string_square', /\[/.source, /\]'/.source],
    ['q_string_curly',  /\{/.source, /\}'/.source],
    ['q_string_paren',  /\(/.source, /\)'/.source],
    ['q_string_angle',  /</.source,  />'/.source],
  ];
  for (const [name, open, close] of Q_BRACKETS) {
    addRule(shared, name, r => {
      r.type = RuleType.BEGIN_END;
      r.begin = `\\b[nN]?[qQ]'${open}`;
      r.end   = close;
      r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strQuoted.id));
      r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
      r.contentTokenType = TokenType.STRING;
      r.innerStateId = strQuoted.id;
    });
  }
  addRule(shared, 'q_string_other', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\b[nN]?[qQ]'([^\s\[{(<])/.source;
    r.dynamicEnd = createDynamicEnd(1, "${0}'");
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strQuoted.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strQuoted.id;
  });

  // Single-quoted strings, N'national'
  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?:\b[nN])?'/.source;
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // Numbers: 1, 3.14, 1e-5, 2.5f / 2.5d (BINARY_FLOAT / BINARY_DOUBLE)
  addRule(shared, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fFdD]?\b|(?<![\w.])\.\d+(?:[eE][+-]?\d+)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Labels: <<outer>>
  addRule(shared, 'label', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /<<\s*[A-Za-z_][\w$#]*\s*>>/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // Attributes: %TYPE, %ROWTYPE (types) and cursor attributes %FOUND, %ROWCOUNT ...
  addRule(shared, 'type_attribute', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /%(?:TYPE|ROWTYPE)\b/.source;
    r.action = action(TokenType.TYPE);
  });
  addRule(shared, 'cursor_attribute', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /%(?:FOUND|NOTFOUND|ISOPEN|ROWCOUNT|BULK_ROWCOUNT|BULK_EXCEPTIONS)\b/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Operators, longest alternatives first
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /:=|=>|\.\.|\*\*|\|\||<>|!=|~=|\^=|<=|>=|[+\-*/<>=@]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.%]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });

  // Example code
  def.exampleCode = `-- PL/SQL example
-- Oracle PL/SQL procedural language

CREATE OR REPLACE PACKAGE employee_pkg IS
    PROCEDURE hire_employee(
        p_name IN VARCHAR2,
        p_salary IN NUMBER
    );
    FUNCTION get_salary(
        p_emp_id IN NUMBER
    ) RETURN NUMBER;
END employee_pkg;
/

CREATE OR REPLACE PACKAGE BODY employee_pkg IS

    -- Private variable
    v_company_name VARCHAR2(100) := 'Oracle Corp';

    -- Procedure
    PROCEDURE hire_employee(
        p_name IN VARCHAR2,
        p_salary IN NUMBER
    ) IS
        v_emp_id NUMBER;
    BEGIN
        SELECT seq_employee.NEXTVAL INTO v_emp_id FROM DUAL;
        INSERT INTO employees (id, name, salary, hire_date)
        VALUES (v_emp_id, p_name, p_salary, SYSDATE);

        DBMS_OUTPUT.PUT_LINE('Hired employee: ' || p_name);
    EXCEPTION
        WHEN DUP_VAL_ON_INDEX THEN
            DBMS_OUTPUT.PUT_LINE('Duplicate employee');
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('Error: ' || SQLERRM);
    END hire_employee;

    -- Function
    FUNCTION get_salary(
        p_emp_id IN NUMBER
    ) RETURN NUMBER IS
        v_salary NUMBER;
    BEGIN
        SELECT salary INTO v_salary
        FROM employees
        WHERE id = p_emp_id;

        RETURN v_salary;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN NULL;
    END get_salary;

END employee_pkg;
/

-- Anonymous block
DECLARE
    v_name VARCHAR2(50) := 'Alice';
    v_salary NUMBER := 5000;
    v_result NUMBER;
BEGIN
    employee_pkg.hire_employee(v_name, v_salary);
    v_result := employee_pkg.get_salary(1);

    IF v_result IS NOT NULL THEN
        DBMS_OUTPUT.PUT_LINE('Salary: ' || v_result);
    ELSE
        DBMS_OUTPUT.PUT_LINE('No salary found');
    END IF;

    -- Cursor
    FOR rec IN (SELECT name, salary FROM employees) LOOP
        DBMS_OUTPUT.PUT_LINE(rec.name || ': ' || rec.salary);
    END LOOP;

    -- Bulk collect
    DECLARE
        TYPE emp_tab IS TABLE OF employees%ROWTYPE;
        l_emp_tab emp_tab;
    BEGIN
        SELECT * BULK COLLECT INTO l_emp_tab
        FROM employees;

        FOR i IN 1..l_emp_tab.COUNT LOOP
            DBMS_OUTPUT.PUT_LINE(l_emp_tab(i).name);
        END LOOP;
    END;

EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Error: ' || SQLERRM);
END;
/

-- FORALL with SAVE EXCEPTIONS, q-quoting, labels and cursor attributes
DECLARE
    TYPE id_list IS TABLE OF employees.id%TYPE;
    l_ids  id_list := id_list(1, 2, 3);
    l_note VARCHAR2(100) := q'[It's a "quoted" text]';
BEGIN
    FORALL i IN 1..l_ids.COUNT SAVE EXCEPTIONS
        UPDATE employees SET salary = salary * 1.1 WHERE id = l_ids(i);
    DBMS_OUTPUT.PUT_LINE(SQL%ROWCOUNT || ' rows, bind: ' || :p_user);

    <<outer_loop>>
    FOR i IN 1..10 LOOP
        EXIT outer_loop WHEN i > 5;
    END LOOP outer_loop;
END;
/`;
  return def;
}

export function createPlSqlLanguageStyles(plsqlDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(plsqlDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.TYPE,          '#4ec9b0'),
    createTokenStyle(TokenType.IDENTIFIER,    '#9cdcfe'),
    createTokenStyle(TokenType.VARIABLE,      '#9cdcfe'),
    createTokenStyle(TokenType.FUNCTION,      '#dcdcaa'),
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

  const lightStyle = createHighlightStyle(plsqlDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#0000ff'),
    createTokenStyle(TokenType.TYPE,          '#267f99'),
    createTokenStyle(TokenType.IDENTIFIER,    '#001080'),
    createTokenStyle(TokenType.VARIABLE,      '#001080'),
    createTokenStyle(TokenType.FUNCTION,      '#795e26'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.NAMESPACE,     '#267f99'),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.DECORATOR,     '#795e26'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(plsqlDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.TYPE,          '#e5c07b'),
    createTokenStyle(TokenType.IDENTIFIER,    '#abb2bf'),
    createTokenStyle(TokenType.VARIABLE,      '#e06c75'),
    createTokenStyle(TokenType.FUNCTION,      '#61afef'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.NAMESPACE,     '#e5c07b'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.DECORATOR,     '#61afef'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(plsqlDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#fd971f'),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.NAMESPACE,     '#66d9ef'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.DECORATOR,     '#a6e22e'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(plsqlDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.TYPE,          '#8be9fd', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#ffb86c'),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.NAMESPACE,     '#8be9fd'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.DECORATOR,     '#50fa7b'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(plsqlDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.TYPE,          '#953800'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.VARIABLE,      '#0550ae'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.NAMESPACE,     '#953800'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.DECORATOR,     '#8250df'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}