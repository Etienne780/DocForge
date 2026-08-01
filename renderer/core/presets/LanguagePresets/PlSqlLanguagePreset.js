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

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2})/.source;
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

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Common rules
  // SQL keywords (standard)
  addRule(common, 'sql_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'INTO', 'FROM',
      'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT',
      'OFFSET', 'FETCH', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER',
      'CROSS', 'NATURAL', 'USING', 'ON', 'UNION', 'INTERSECT', 'EXCEPT',
      'DISTINCT', 'ALL', 'AS', 'OR', 'AND', 'IN', 'BETWEEN', 'LIKE',
      'EXISTS', 'ANY', 'SOME', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
      'OVER', 'PARTITION', 'ROW', 'RANGE', 'UNBOUNDED', 'PRECEDING',
      'FOLLOWING', 'CURRENT', 'VALUES', 'DEFAULT', 'NULL', 'NOT',
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
      'ELSIF', 'LOOP', 'EXIT', 'FOR', 'WHILE', 'CONTINUE', 'GOTO',
      'RETURN', 'RAISE', 'PRAGMA', 'EXCEPTION_INIT', 'INLINE',
      'CURSOR', 'OPEN', 'FETCH', 'CLOSE', 'BULK', 'COLLECT', 'INTO',
      'EXECUTE', 'IMMEDIATE', 'USING', 'DYNAMIC', 'SQL', 'NO_DATA_FOUND',
      'TOO_MANY_ROWS', 'OTHERS', 'SUBTYPE', 'TYPE', 'IS', 'AS',
      'PACKAGE', 'BODY', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'BEFORE',
      'AFTER', 'INSTEAD', 'OF', 'FORWARD', 'REF', 'OUT', 'IN', 'OUT',
      'NOCOPY', 'DEFAULT', 'CONSTANT', 'AUTHID', 'CURRENT_USER',
      'DEFINER', 'DETERMINISTIC', 'PIPELINED', 'PARALLEL_ENABLE',
      'RESULT_CACHE', 'RELIES_ON', 'ACCESSIBLE', 'MEMBER', 'CONSTRUCTOR',
      'STATIC', 'FINAL', 'OVERLOADING', 'RESTRICT_REFERENCES',
      'SERVERERROR', 'LOGON', 'LOGOFF', 'STARTUP', 'SHUTDOWN',
      'DATABASE', 'TRANSACTION', 'ROLLBACK', 'COMMIT', 'SAVEPOINT',
      'SET', 'AUTONOMOUS', 'TRANSACTION',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Variable: :variable (bind variable)
  addRule(common, 'bind_variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /:[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Variable: v_variable (PL/SQL variable)
  addRule(common, 'plsql_variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
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

  // Numbers
  addRule(shared, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+(?:\.\d+)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|<=|>=|<>|!=|&&|\|\||\?/.source;
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
/`;

  // HighlightStyle
  const style = createHighlightStyle('Dark+');
  style.tokenStyles = [
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
  def.styles.push(style);

  return def;
}