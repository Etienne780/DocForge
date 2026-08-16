import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxStateTransition,
  createPredefinedSymbol,
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

export function createSqlLanguage() {
  const def = createSyntaxDefinition('SQL');
  def.aliases = ['sql', 'postgresql', 'mysql', 'sqlite'];
  def.id = 'SqlLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['INT',           TokenType.TYPE],
    ['INTEGER',       TokenType.TYPE],
    ['BIGINT',        TokenType.TYPE],
    ['SMALLINT',      TokenType.TYPE],
    ['TINYINT',       TokenType.TYPE],
    ['NUMERIC',       TokenType.TYPE],
    ['DECIMAL',       TokenType.TYPE],
    ['REAL',          TokenType.TYPE],
    ['DOUBLE',        TokenType.TYPE],
    ['FLOAT',         TokenType.TYPE],
    ['CHAR',          TokenType.TYPE],
    ['VARCHAR',       TokenType.TYPE],
    ['TEXT',          TokenType.TYPE],
    ['STRING',        TokenType.TYPE],
    ['DATE',          TokenType.TYPE],
    ['TIME',          TokenType.TYPE],
    ['TIMESTAMP',     TokenType.TYPE],
    ['DATETIME',      TokenType.TYPE],
    ['BOOLEAN',       TokenType.TYPE],
    ['BOOL',          TokenType.TYPE],
    ['BLOB',          TokenType.TYPE],
    ['BYTEA',         TokenType.TYPE],
    ['JSON',          TokenType.TYPE],
    ['JSONB',         TokenType.TYPE],
    ['UUID',          TokenType.TYPE],
    ['SERIAL',        TokenType.TYPE],
    ['BIGSERIAL',     TokenType.TYPE],
    ['COUNT',         TokenType.FUNCTION],
    ['SUM',           TokenType.FUNCTION],
    ['AVG',           TokenType.FUNCTION],
    ['MIN',           TokenType.FUNCTION],
    ['MAX',           TokenType.FUNCTION],
    ['GROUP_CONCAT',  TokenType.FUNCTION],
    ['STRING_AGG',    TokenType.FUNCTION],
    ['ARRAY_AGG',     TokenType.FUNCTION],
    ['CONCAT',        TokenType.FUNCTION],
    ['CONCAT_WS',     TokenType.FUNCTION],
    ['SUBSTRING',     TokenType.FUNCTION],
    ['SUBSTR',        TokenType.FUNCTION],
    ['UPPER',         TokenType.FUNCTION],
    ['LOWER',         TokenType.FUNCTION],
    ['LENGTH',        TokenType.FUNCTION],
    ['CHAR_LENGTH',   TokenType.FUNCTION],
    ['REPLACE',       TokenType.FUNCTION],
    ['TRIM',          TokenType.FUNCTION],
    ['LTRIM',         TokenType.FUNCTION],
    ['RTRIM',         TokenType.FUNCTION],
    ['POSITION',      TokenType.FUNCTION],
    ['INSTR',         TokenType.FUNCTION],
    ['EXTRACT',       TokenType.FUNCTION],
    ['TO_CHAR',       TokenType.FUNCTION],
    ['TO_DATE',       TokenType.FUNCTION],
    ['TO_TIMESTAMP',  TokenType.FUNCTION],
    ['CAST',          TokenType.FUNCTION],
    ['NOW',           TokenType.FUNCTION],
    ['CURRENT_DATE',  TokenType.FUNCTION],
    ['CURRENT_TIME',  TokenType.FUNCTION],
    ['CURRENT_TIMESTAMP', TokenType.FUNCTION],
    ['DATE_PART',     TokenType.FUNCTION],
    ['DATE_TRUNC',    TokenType.FUNCTION],
    ['AGE',           TokenType.FUNCTION],
    ['COALESCE',      TokenType.FUNCTION],
    ['NULLIF',        TokenType.FUNCTION],
    ['IFNULL',        TokenType.FUNCTION],
    ['NVL',           TokenType.FUNCTION],
    ['DECODE',        TokenType.FUNCTION],
    ['ROW_NUMBER',    TokenType.FUNCTION],
    ['RANK',          TokenType.FUNCTION],
    ['DENSE_RANK',    TokenType.FUNCTION],
    ['LEAD',          TokenType.FUNCTION],
    ['LAG',           TokenType.FUNCTION],
    ['FIRST_VALUE',   TokenType.FUNCTION],
    ['LAST_VALUE',    TokenType.FUNCTION],
    ['NTILE',         TokenType.FUNCTION],
    ['::',            TokenType.OPERATOR],
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
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})/.source;
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

  // Block comment
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Common rules (keywords, strings, numbers, operators, punctuation)
  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME',
      'TABLE', 'VIEW', 'INDEX', 'SEQUENCE', 'SCHEMA', 'DATABASE',
      'FUNCTION', 'PROCEDURE', 'TRIGGER', 'FOREIGN', 'KEY',
      'PRIMARY', 'UNIQUE', 'CHECK', 'DEFAULT', 'NOT', 'NULL',
      'CONSTRAINT', 'REFERENCES', 'ON', 'DELETE', 'CASCADE',
      'RESTRICT', 'SET', 'NO', 'ACTION', 'WITH', 'OPTION',
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'MERGE',
      'INTO', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING',
      'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'FETCH',
      'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER',
      'CROSS', 'NATURAL', 'USING', 'UNION', 'INTERSECT',
      'EXCEPT', 'DISTINCT', 'ALL', 'AS', 'OR', 'AND', 'IN',
      'BETWEEN', 'LIKE', 'ILIKE', 'EXISTS', 'ANY', 'SOME',
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'OVER', 'PARTITION',
      'ROW', 'RANGE', 'UNBOUNDED', 'PRECEDING', 'FOLLOWING',
      'CURRENT', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
      'TRANSACTION', 'GRANT', 'REVOKE', 'PRIVILEGES', 'PUBLIC',
      'VALUES', 'DEFAULT', 'NULLS', 'FIRST', 'LAST', 'WINDOW',
      'RECURSIVE', 'WITHIN', 'LATERAL', 'UNNEST', 'ARRAY',
      'EXPLAIN', 'ANALYZE', 'VACUUM', 'REINDEX', 'CLUSTER',
      'COMMENT', 'DO', 'DECLARE', 'RAISE', 'NOTICE',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  addRule(common, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  addRule(common, 'numbers', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+(?:\.\d+)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(common, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|<=|>=|<>|!=|&&|\|\||\?/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(common, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Shared rules – comments
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:--|#).*/.source;
    r.action = action(TokenType.COMMENT);
  });

  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Root rules – comments must match before operators, so include shared first
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });

  // Identifier fallback
  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Example code
  def.exampleCode = `-- SQL example with common features
/*
  Multi-line comment
*/

-- Basic query
SELECT first_name, last_name, email
FROM users
WHERE active = true
ORDER BY last_name ASC, first_name ASC;

-- Join example
SELECT
    o.order_id,
    o.order_date,
    c.customer_name,
    p.product_name,
    od.quantity,
    od.price
FROM orders o
INNER JOIN customers c ON o.customer_id = c.customer_id
INNER JOIN order_details od ON o.order_id = od.order_id
INNER JOIN products p ON od.product_id = p.product_id
WHERE o.order_date >= '2024-01-01'
  AND o.status = 'completed'
ORDER BY o.order_date DESC
LIMIT 100;

-- Aggregation with GROUP BY and HAVING
SELECT
    DATE_TRUNC('month', order_date) AS month,
    COUNT(*) AS total_orders,
    SUM(total_amount) AS revenue,
    AVG(total_amount) AS avg_order_value
FROM orders
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', order_date)
HAVING SUM(total_amount) > 10000
ORDER BY month DESC;

-- Window function example
SELECT
    employee_id,
    first_name,
    last_name,
    salary,
    department_id,
    ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rank_in_dept,
    LAG(salary) OVER (PARTITION BY department_id ORDER BY salary) AS prev_salary
FROM employees;

-- Subquery with EXISTS
SELECT product_name, price
FROM products p
WHERE EXISTS (
    SELECT 1
    FROM order_details od
    WHERE od.product_id = p.product_id
);

-- CTE (Common Table Expression)
WITH monthly_sales AS (
    SELECT
        DATE_TRUNC('month', order_date) AS month,
        SUM(total_amount) AS total_sales
    FROM orders
    WHERE status = 'completed'
    GROUP BY DATE_TRUNC('month', order_date)
)
SELECT month, total_sales
FROM monthly_sales
WHERE total_sales > 5000;

-- INSERT with RETURNING (PostgreSQL)
INSERT INTO users (username, email, created_at)
VALUES ('alice', 'alice@example.com', NOW())
RETURNING user_id, username;

-- UPDATE with FROM (PostgreSQL)
UPDATE products
SET price = price * 0.9
FROM categories
WHERE categories.category_id = products.category_id
  AND categories.name = 'Electronics';

-- DELETE with USING (PostgreSQL)
DELETE FROM orders
USING users
WHERE orders.user_id = users.user_id
  AND users.last_login < NOW() - INTERVAL '1 year';

-- CASE statement
SELECT
    order_id,
    total_amount,
    CASE
        WHEN total_amount >= 1000 THEN 'Large'
        WHEN total_amount >= 500 THEN 'Medium'
        ELSE 'Small'
    END AS order_size
FROM orders;

-- String functions
SELECT
    CONCAT(first_name, ' ', last_name) AS full_name,
    UPPER(email) AS email_upper,
    LENGTH(phone) AS phone_digits
FROM customers;

-- Date functions
SELECT
    order_id,
    order_date,
    EXTRACT(YEAR FROM order_date) AS year,
    EXTRACT(MONTH FROM order_date) AS month,
    AGE(NOW(), order_date) AS age_since_order
FROM orders;

-- JSON functions (PostgreSQL)
SELECT
    id,
    data->>'name' AS name,
    data->'address'->>'city' AS city
FROM json_table;

-- Coalesce and null handling
SELECT
    product_id,
    COALESCE(discount_price, price) AS final_price,
    NULLIF(discount_price, 0) AS non_zero_discount
FROM products;

-- Full-text search (PostgreSQL)
SELECT title, body
FROM articles
WHERE to_tsvector('english', body) @@ to_tsquery('english', 'database & performance');

-- Type casting
SELECT
    price::text AS price_text,
    CAST(quantity AS numeric) AS quantity_num
FROM order_details;

-- Explain plan
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM large_table WHERE column = 'value';

-- Comments within query
SELECT /* inline comment */ column1, column2
FROM table_name;

-- PostgreSQL dollar-quoted strings
DO $$
DECLARE
    counter INT := 0;
BEGIN
    FOR counter IN 1..10 LOOP
        RAISE NOTICE 'Counter: %', counter;
    END LOOP;
END $$;
`;
  return def;
}

export function createSqlLanguageStyles(sqlDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(sqlDef.id, 'Dark+');
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
    createTokenStyle(TokenType.LITERAL,       '#569cd6'),
    createTokenStyle(TokenType.OTHER,         '#d4d4d4'),
  ];

  return [darkStyle];
}