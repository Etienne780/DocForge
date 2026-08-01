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

export function createTSqlLanguage() {
  const def = createSyntaxDefinition('T-SQL');
  def.aliases = ['tsql', 't-sql', 'mssql', 'sqlserver'];
  def.id = 'TSqlLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['INT',           TokenType.TYPE],
    ['BIGINT',        TokenType.TYPE],
    ['SMALLINT',      TokenType.TYPE],
    ['TINYINT',       TokenType.TYPE],
    ['BIT',           TokenType.TYPE],
    ['DECIMAL',       TokenType.TYPE],
    ['NUMERIC',       TokenType.TYPE],
    ['MONEY',         TokenType.TYPE],
    ['SMALLMONEY',    TokenType.TYPE],
    ['FLOAT',         TokenType.TYPE],
    ['REAL',          TokenType.TYPE],
    ['CHAR',          TokenType.TYPE],
    ['VARCHAR',       TokenType.TYPE],
    ['NCHAR',         TokenType.TYPE],
    ['NVARCHAR',      TokenType.TYPE],
    ['TEXT',          TokenType.TYPE],
    ['NTEXT',         TokenType.TYPE],
    ['DATE',          TokenType.TYPE],
    ['TIME',          TokenType.TYPE],
    ['DATETIME',      TokenType.TYPE],
    ['DATETIME2',     TokenType.TYPE],
    ['SMALLDATETIME', TokenType.TYPE],
    ['DATETIMEOFFSET', TokenType.TYPE],
    ['BINARY',        TokenType.TYPE],
    ['VARBINARY',     TokenType.TYPE],
    ['IMAGE',         TokenType.TYPE],
    ['XML',           TokenType.TYPE],
    ['JSON',          TokenType.TYPE],
    ['UNIQUEIDENTIFIER', TokenType.TYPE],
    ['ROWVERSION',    TokenType.TYPE],
    ['SQL_VARIANT',   TokenType.TYPE],
    ['HIERARCHYID',   TokenType.TYPE],
    ['GEOGRAPHY',     TokenType.TYPE],
    ['GEOMETRY',      TokenType.TYPE],
    ['GETDATE',       TokenType.FUNCTION],
    ['GETUTCDATE',    TokenType.FUNCTION],
    ['SYSDATETIME',   TokenType.FUNCTION],
    ['SYSUTCDATETIME', TokenType.FUNCTION],
    ['CURRENT_TIMESTAMP', TokenType.FUNCTION],
    ['DATEADD',       TokenType.FUNCTION],
    ['DATEDIFF',      TokenType.FUNCTION],
    ['DATEPART',      TokenType.FUNCTION],
    ['DATENAME',      TokenType.FUNCTION],
    ['YEAR',          TokenType.FUNCTION],
    ['MONTH',         TokenType.FUNCTION],
    ['DAY',           TokenType.FUNCTION],
    ['ISNULL',        TokenType.FUNCTION],
    ['COALESCE',      TokenType.FUNCTION],
    ['NULLIF',        TokenType.FUNCTION],
    ['CAST',          TokenType.FUNCTION],
    ['CONVERT',       TokenType.FUNCTION],
    ['PARSE',         TokenType.FUNCTION],
    ['TRY_PARSE',     TokenType.FUNCTION],
    ['TRY_CAST',      TokenType.FUNCTION],
    ['TRY_CONVERT',   TokenType.FUNCTION],
    ['LEN',           TokenType.FUNCTION],
    ['CHARINDEX',     TokenType.FUNCTION],
    ['PATINDEX',      TokenType.FUNCTION],
    ['SUBSTRING',     TokenType.FUNCTION],
    ['LEFT',          TokenType.FUNCTION],
    ['RIGHT',         TokenType.FUNCTION],
    ['REPLACE',       TokenType.FUNCTION],
    ['STUFF',         TokenType.FUNCTION],
    ['UPPER',         TokenType.FUNCTION],
    ['LOWER',         TokenType.FUNCTION],
    ['LTRIM',         TokenType.FUNCTION],
    ['RTRIM',         TokenType.FUNCTION],
    ['REPLICATE',     TokenType.FUNCTION],
    ['SPACE',         TokenType.FUNCTION],
    ['REVERSE',       TokenType.FUNCTION],
    ['STR',           TokenType.FUNCTION],
    ['FORMAT',        TokenType.FUNCTION],
    ['ROW_NUMBER',    TokenType.FUNCTION],
    ['RANK',          TokenType.FUNCTION],
    ['DENSE_RANK',    TokenType.FUNCTION],
    ['NTILE',         TokenType.FUNCTION],
    ['LEAD',          TokenType.FUNCTION],
    ['LAG',           TokenType.FUNCTION],
    ['FIRST_VALUE',   TokenType.FUNCTION],
    ['LAST_VALUE',    TokenType.FUNCTION],
    ['SUM',           TokenType.FUNCTION],
    ['AVG',           TokenType.FUNCTION],
    ['COUNT',         TokenType.FUNCTION],
    ['MIN',           TokenType.FUNCTION],
    ['MAX',           TokenType.FUNCTION],
    ['STDEV',         TokenType.FUNCTION],
    ['STDEVP',        TokenType.FUNCTION],
    ['VAR',           TokenType.FUNCTION],
    ['VARP',          TokenType.FUNCTION],
    ['CHECKSUM',      TokenType.FUNCTION],
    ['CHECKSUM_AGG',  TokenType.FUNCTION],
    ['HASHBYTES',     TokenType.FUNCTION],
    ['OPENJSON',      TokenType.FUNCTION],
    ['STRING_AGG',    TokenType.FUNCTION],
    ['STRING_SPLIT',  TokenType.FUNCTION],
    ['OBJECT_ID',     TokenType.FUNCTION],
    ['DB_ID',         TokenType.FUNCTION],
    ['SCHEMA_ID',     TokenType.FUNCTION],
    ['@@IDENTITY',    TokenType.VARIABLE],
    ['@@ROWCOUNT',    TokenType.VARIABLE],
    ['@@ERROR',       TokenType.VARIABLE],
    ['@@TRANCOUNT',   TokenType.VARIABLE],
    ['@@SPID',        TokenType.VARIABLE],
    ['@@VERSION',     TokenType.VARIABLE],
    ['@@SERVERNAME',  TokenType.VARIABLE],
    ['@@LANGUAGE',    TokenType.VARIABLE],
    ['@@DATEFIRST',   TokenType.VARIABLE],
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

  // T-SQL-specific keywords (vollständig)
  addRule(common, 'tsql_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      // Control flow
      'BEGIN', 'END', 'GO', 'USE', 'DECLARE', 'SET', 'PRINT',
      'RAISERROR', 'THROW', 'TRY', 'CATCH', 'EXEC', 'EXECUTE',
      'SP_EXECUTESQL', 'WHILE', 'BREAK', 'CONTINUE', 'WAITFOR',
      'RETURN', 'GOTO', 'IF', 'ELSE',
      // DDL
      'CREATE', 'ALTER', 'DROP', 'PROCEDURE', 'FUNCTION',
      'TRIGGER', 'VIEW', 'INDEX', 'SCHEMA', 'DATABASE', 'TABLE',
      'CONSTRAINT', 'PRIMARY', 'KEY', 'FOREIGN', 'UNIQUE', 'CHECK',
      'REFERENCES', 'CASCADE', 'RESTRICT', 'NO', 'ACTION',
      'CLUSTERED', 'NONCLUSTERED', 'WITH', 'FILESTREAM', 'FILETABLE',
      'IDENTITY', 'IDENTITY_INSERT', 'IDENTITY_SEED', 'IDENTITY_INCREMENT',
      'ROWGUIDCOL', 'COLLATE', 'COMPRESSION', 'DATA_COMPRESSION',
      'PARTITION', 'SCHEMABINDING', 'ENCRYPTION', 'EXECUTE_AS',
      'AUTHORIZATION', 'OUTPUT',
      // Merge
      'MERGE', 'WHEN', 'MATCHED', 'SOURCE', 'TARGET',
      // Cursor
      'CURSOR', 'OPEN', 'CLOSE', 'DEALLOCATE', 'FETCH', 'NEXT',
      'PRIOR', 'FIRST', 'LAST', 'ABSOLUTE', 'RELATIVE', 'STATUS',
      'SCROLL', 'INSENSITIVE', 'KEYSET', 'DYNAMIC', 'FAST_FORWARD',
      'READ_ONLY', 'SCROLL_LOCKS', 'OPTIMISTIC', 'LOCAL', 'GLOBAL',
      'FORWARD_ONLY', 'STATIC',
      // Functions
      'CONVERT', 'CAST', 'PARSE', 'TRY_CAST', 'TRY_CONVERT',
      'TRY_PARSE', 'FORMAT',
      // Math
      'SQUARE', 'SQRT', 'POWER', 'SIGN', 'ABS', 'CEILING', 'FLOOR',
      'EXP', 'LOG', 'LOG10', 'PI', 'RAND', 'RADIANS', 'DEGREES',
      // String
      'ISNUMERIC', 'ISDATE', 'ISNULL', 'NULLIF', 'COALESCE',
      'STUFF', 'REPLACE', 'SUBSTRING', 'LEFT', 'RIGHT',
      'LEN', 'CHARINDEX', 'PATINDEX', 'QUOTENAME',
      'PARSENAME', 'SYSNAME',
      // Misc
      'ROWCOUNT', 'ERROR', 'XACT_ABORT',
      // Function definition
      'RETURNS', 'BEGIN', 'END', 'AS',
      // Trigger
      'AFTER', 'INSTEAD', 'OF', 'BEFORE',
      // SET options
      'NOCOUNT', 'NOEXEC', 'STATISTICS', 'ARITHABORT', 'CONCAT_NULL_YIELDS_NULL',
      'ANSI_NULLS', 'ANSI_PADDING', 'ANSI_WARNINGS', 'QUOTED_IDENTIFIER',
      // JSON
      'FOR', 'JSON', 'AUTO', 'PATH', 'ROOT', 'INCLUDE_NULL_VALUES',
      'WITHOUT_ARRAY_WRAPPER',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Variable: @var
  addRule(common, 'variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // System variable: @@var
  addRule(common, 'system_variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
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
  def.exampleCode = `-- T-SQL example
-- Microsoft SQL Server Transact-SQL

USE master;
GO

CREATE DATABASE SampleDB;
GO

USE SampleDB;
GO

CREATE TABLE Employees (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Salary DECIMAL(18,2) NOT NULL,
    HireDate DATETIME DEFAULT GETDATE(),
    DepartmentId INT
);
GO

INSERT INTO Employees (Name, Salary, DepartmentId)
VALUES ('Alice', 5000, 1),
       ('Bob', 6000, 2),
       ('Charlie', 7000, 1);
GO

CREATE PROCEDURE sp_GetEmployeesByDepartment
    @DepartmentId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT Id, Name, Salary, HireDate
    FROM Employees
    WHERE DepartmentId = @DepartmentId
    ORDER BY Name;
END;
GO

CREATE FUNCTION fn_GetEmployeeCount()
RETURNS INT
AS
BEGIN
    DECLARE @Count INT;
    SELECT @Count = COUNT(*) FROM Employees;
    RETURN @Count;
END;
GO

CREATE TRIGGER tr_EmployeeAudit
ON Employees
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    PRINT 'Employee table modified';
END;
GO

DECLARE @EmpId INT = 1;
DECLARE @EmpName NVARCHAR(100);

DECLARE emp_cursor CURSOR FOR
    SELECT Id, Name FROM Employees;

OPEN emp_cursor;

FETCH NEXT FROM emp_cursor INTO @EmpId, @EmpName;

WHILE @@FETCH_STATUS = 0
BEGIN
    PRINT 'Employee: ' + @EmpName;

    FETCH NEXT FROM emp_cursor INTO @EmpId, @EmpName;
END;

CLOSE emp_cursor;
DEALLOCATE emp_cursor;
GO

BEGIN TRY
    EXEC sp_GetEmployeesByDepartment 1;

    DECLARE @Count INT;
    SELECT @Count = dbo.fn_GetEmployeeCount();
    PRINT 'Total employees: ' + CAST(@Count AS VARCHAR);

END TRY
BEGIN CATCH
    PRINT 'Error: ' + ERROR_MESSAGE();
END CATCH;
GO

DECLARE @Sql NVARCHAR(MAX);
SET @Sql = 'SELECT * FROM Employees';
EXEC sp_executesql @Sql;
GO

SELECT Id, Name, Salary
FROM Employees
FOR JSON AUTO;
GO

SELECT DepartmentId, STRING_AGG(Name, ', ') AS Employees
FROM Employees
GROUP BY DepartmentId;
GO

SELECT
    Name,
    Salary,
    ROW_NUMBER() OVER (ORDER BY Salary DESC) AS Rank
FROM Employees;
GO

DROP TABLE Employees;
DROP PROCEDURE sp_GetEmployeesByDepartment;
DROP FUNCTION fn_GetEmployeeCount;
DROP TRIGGER tr_EmployeeAudit;
GO

USE master;
GO

DROP DATABASE SampleDB;
GO`;

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