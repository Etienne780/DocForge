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

  // String escape: T-SQL has no backslash escapes, a quote is doubled ('').
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

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Common rules
  // Built-in function calls - before keywords so `REPLACE(`, `LEFT(` stay functions
  addRule(common, 'builtin_functions', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = new RegExp('\\b(?:' + [
      'GETDATE', 'GETUTCDATE', 'SYSDATETIME', 'SYSUTCDATETIME', 'SYSDATETIMEOFFSET',
      'DATEADD', 'DATEDIFF', 'DATEDIFF_BIG', 'DATEPART', 'DATENAME', 'DATEFROMPARTS',
      'DATETRUNC', 'DATE_BUCKET', 'EOMONTH', 'YEAR', 'MONTH', 'DAY', 'ISDATE',
      'ISNULL', 'COALESCE', 'NULLIF', 'IIF', 'CHOOSE', 'GREATEST', 'LEAST',
      'CAST', 'CONVERT', 'PARSE', 'TRY_PARSE', 'TRY_CAST', 'TRY_CONVERT', 'ISNUMERIC',
      'LEN', 'DATALENGTH', 'CHARINDEX', 'PATINDEX', 'SUBSTRING', 'LEFT', 'RIGHT',
      'REPLACE', 'STUFF', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'REPLICATE',
      'SPACE', 'REVERSE', 'STR', 'FORMAT', 'CONCAT', 'CONCAT_WS', 'QUOTENAME',
      'PARSENAME', 'TRANSLATE', 'STRING_ESCAPE', 'STRING_AGG', 'STRING_SPLIT',
      'SOUNDEX', 'DIFFERENCE', 'ASCII', 'CHAR', 'NCHAR', 'UNICODE',
      'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LEAD', 'LAG',
      'FIRST_VALUE', 'LAST_VALUE', 'PERCENT_RANK', 'CUME_DIST',
      'PERCENTILE_CONT', 'PERCENTILE_DISC', 'APPROX_COUNT_DISTINCT',
      'SUM', 'AVG', 'COUNT', 'COUNT_BIG', 'MIN', 'MAX', 'STDEV', 'STDEVP', 'VAR', 'VARP',
      'GROUPING', 'GROUPING_ID', 'CHECKSUM', 'CHECKSUM_AGG', 'BINARY_CHECKSUM', 'HASHBYTES',
      'OPENJSON', 'JSON_VALUE', 'JSON_QUERY', 'JSON_MODIFY', 'JSON_OBJECT', 'JSON_ARRAY',
      'JSON_OBJECTAGG', 'JSON_ARRAYAGG', 'ISJSON', 'JSON_PATH_EXISTS',
      'OPENROWSET', 'OPENQUERY', 'OPENXML', 'OPENDATASOURCE', 'GENERATE_SERIES',
      'OBJECT_ID', 'OBJECT_NAME', 'DB_ID', 'DB_NAME', 'SCHEMA_ID', 'SCHEMA_NAME',
      'COL_LENGTH', 'COLUMNPROPERTY', 'OBJECTPROPERTY', 'SERVERPROPERTY',
      'SCOPE_IDENTITY', 'IDENT_CURRENT', 'NEWID', 'NEWSEQUENTIALID', 'SUSER_SNAME',
      'USER_NAME', 'ERROR_MESSAGE', 'ERROR_NUMBER', 'ERROR_SEVERITY', 'ERROR_STATE',
      'ERROR_LINE', 'ERROR_PROCEDURE', 'XACT_STATE', 'TRIGGER_NESTLEVEL', 'CONTEXT_INFO',
      'SQUARE', 'SQRT', 'POWER', 'SIGN', 'ABS', 'CEILING', 'FLOOR', 'ROUND',
      'EXP', 'LOG', 'LOG10', 'PI', 'RAND', 'RADIANS', 'DEGREES',
      'CONTAINS', 'FREETEXT', 'CONTAINSTABLE', 'FREETEXTTABLE',
    ].join('|') + ')(?=\\s*\\()').source;
    r.action = action(TokenType.FUNCTION);
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
      'CROSS', 'NATURAL', 'USING', 'ON', 'UNION', 'INTERSECT', 'EXCEPT',
      'DISTINCT', 'ALL', 'AS', 'OR', 'AND', 'IN', 'IS', 'BETWEEN', 'LIKE', 'ESCAPE',
      'EXISTS', 'ANY', 'SOME', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
      'OVER', 'PARTITION', 'ROW', 'ROWS', 'RANGE', 'UNBOUNDED', 'PRECEDING',
      'FOLLOWING', 'CURRENT', 'VALUES', 'DEFAULT', 'NULL', 'NOT',
      'APPLY', 'WITHIN', 'ONLY', 'WINDOW', 'TOP', 'PERCENT', 'TIES',
      'PIVOT', 'UNPIVOT', 'TABLESAMPLE', 'GROUPING', 'SETS', 'CUBE', 'ROLLUP',
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
      'SP_EXECUTESQL', 'WHILE', 'BREAK', 'CONTINUE', 'WAITFOR', 'DELAY',
      'RETURN', 'GOTO', 'IF', 'ELSE',
      // Transactions
      'TRAN', 'TRANSACTION', 'COMMIT', 'ROLLBACK', 'SAVE', 'DISTRIBUTED',
      'ISOLATION', 'LEVEL', 'READ', 'COMMITTED', 'UNCOMMITTED', 'REPEATABLE',
      'SERIALIZABLE', 'SNAPSHOT',
      // DDL / DCL
      'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'PROCEDURE', 'PROC', 'FUNCTION',
      'TRIGGER', 'VIEW', 'INDEX', 'SCHEMA', 'DATABASE', 'TABLE', 'SEQUENCE',
      'SYNONYM', 'TYPE', 'LOGIN', 'USER', 'ROLE', 'GRANT', 'REVOKE', 'DENY',
      'ADD', 'COLUMN', 'NOCHECK', 'ENABLE', 'DISABLE', 'REBUILD', 'REORGANIZE',
      'CONSTRAINT', 'PRIMARY', 'KEY', 'FOREIGN', 'UNIQUE', 'CHECK',
      'REFERENCES', 'CASCADE', 'RESTRICT', 'NO', 'ACTION',
      'CLUSTERED', 'NONCLUSTERED', 'COLUMNSTORE', 'WITH', 'FILESTREAM', 'FILETABLE',
      'IDENTITY', 'IDENTITY_INSERT', 'IDENTITY_SEED', 'IDENTITY_INCREMENT',
      'ROWGUIDCOL', 'COLLATE', 'COMPRESSION', 'DATA_COMPRESSION',
      'SCHEMABINDING', 'ENCRYPTION', 'EXECUTE_AS', 'CALLER', 'OWNER',
      'AUTHORIZATION', 'OUTPUT', 'OUT', 'READONLY', 'VARYING', 'RECOMPILE', 'OPTION',
      'GENERATED', 'ALWAYS', 'HIDDEN', 'PERIOD', 'SYSTEM_TIME', 'SYSTEM_VERSIONING',
      'MASKED', 'PERSISTED', 'SPARSE', 'BULK', 'DBCC', 'CHECKPOINT', 'KILL', 'RECONFIGURE',
      // Merge
      'MERGE', 'WHEN', 'MATCHED', 'SOURCE', 'TARGET', 'INSERTED', 'DELETED',
      // Table hints
      'NOLOCK', 'HOLDLOCK', 'UPDLOCK', 'ROWLOCK', 'TABLOCK', 'TABLOCKX',
      'READPAST', 'NOWAIT', 'FORCESEEK', 'MAXDOP',
      // Cursor
      'CURSOR', 'OPEN', 'CLOSE', 'DEALLOCATE', 'FETCH', 'NEXT',
      'PRIOR', 'FIRST', 'LAST', 'ABSOLUTE', 'RELATIVE', 'STATUS',
      'SCROLL', 'INSENSITIVE', 'KEYSET', 'DYNAMIC', 'FAST_FORWARD',
      'READ_ONLY', 'SCROLL_LOCKS', 'OPTIMISTIC', 'LOCAL', 'GLOBAL',
      'FORWARD_ONLY', 'STATIC',
      // Functions without parentheses
      'CONVERT', 'CAST', 'PARSE', 'TRY_CAST', 'TRY_CONVERT',
      'TRY_PARSE', 'FORMAT', 'CURRENT_TIMESTAMP', 'CURRENT_USER', 'SESSION_USER',
      'SYSTEM_USER',
      // Misc
      'ROWCOUNT', 'ERROR', 'XACT_ABORT', 'SYSNAME',
      // Function definition
      'RETURNS', 'AS',
      // Trigger
      'AFTER', 'INSTEAD', 'OF', 'BEFORE',
      // SET options
      'NOCOUNT', 'NOEXEC', 'STATISTICS', 'ARITHABORT', 'CONCAT_NULL_YIELDS_NULL',
      'ANSI_NULLS', 'ANSI_PADDING', 'ANSI_WARNINGS', 'QUOTED_IDENTIFIER', 'ON', 'OFF',
      // JSON / XML
      'FOR', 'JSON', 'XML', 'AUTO', 'PATH', 'RAW', 'ROOT', 'INCLUDE_NULL_VALUES',
      'WITHOUT_ARRAY_WRAPPER',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Data types (case-insensitive)
  addRule(common, 'data_types', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern = [
      'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'BIT', 'DECIMAL', 'DEC', 'NUMERIC',
      'MONEY', 'SMALLMONEY', 'FLOAT', 'REAL', 'CHAR', 'VARCHAR', 'NCHAR', 'NVARCHAR',
      'TEXT', 'NTEXT', 'DATE', 'TIME', 'DATETIME', 'DATETIME2', 'SMALLDATETIME',
      'DATETIMEOFFSET', 'BINARY', 'VARBINARY', 'IMAGE', 'UNIQUEIDENTIFIER',
      'ROWVERSION', 'TIMESTAMP', 'SQL_VARIANT', 'HIERARCHYID', 'GEOGRAPHY', 'GEOMETRY',
      'VECTOR', 'MAX',
    ];
    r.action = action(TokenType.TYPE);
  });

  // MERGE pseudo columns: $action, $identity, $rowguid, $partition
  addRule(common, 'pseudo_columns', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /\$(?:action|identity|rowguid|partition|node_id|edge_id)\b/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // System variable: @@var
  addRule(common, 'system_variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Variable: @var
  addRule(common, 'variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Temp tables: #tmp, ##global
  addRule(common, 'temp_table', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /##?[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Schema-qualified function calls: dbo.fn_Name(
  addRule(common, 'qualified_function', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=\.)[A-Za-z_]\w*(?=\s*\()/.source;
    r.action = action(TokenType.FUNCTION);
  });

  // Identifier fallback
  addRule(common, 'identifier', r => {
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

  // [Bracketed identifiers]
  addRule(shared, 'bracket_identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\[(?:[^\]]|\]\])*\]/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // "Quoted identifiers" (QUOTED_IDENTIFIER ON)
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Single-quoted strings, N'unicode'
  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?:\b[nN])?'/.source;
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // Numbers: binary 0x..., float with exponent, int
  addRule(shared, 'number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:0[xX][0-9a-fA-F]*|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b|(?<![\w.])\.\d+(?:[eE][+-]?\d+)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators, longest alternatives first
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /::|[+\-*/%&|^]=|<>|!=|<=|>=|!<|!>|[+\-*/%&|^~<>=]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.:]/.source;
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

-- Modern T-SQL: temp tables, APPLY, JSON, paging, MERGE OUTPUT
DROP TABLE IF EXISTS #Staging;
SELECT e.[Name], j.[value] AS Tag
INTO #Staging
FROM Employees AS e
CROSS APPLY OPENJSON(N'["a","b"]') AS j
WHERE IIF(e.Salary > 5500, 1, 0) = 1
ORDER BY e.Id OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;

MERGE Employees AS t
USING #Staging AS s ON t.[Name] = s.[Name]
WHEN MATCHED THEN UPDATE SET t.Salary *= 1.05
OUTPUT $action, inserted.Id, deleted.Salary;
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
  return def;
}

export function createTSqlLanguageStyles(tsqlDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(tsqlDef.id, 'Dark+');
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

  const lightStyle = createHighlightStyle(tsqlDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#0000ff'),
    createTokenStyle(TokenType.TYPE,          '#267f99'),
    createTokenStyle(TokenType.VARIABLE,      '#001080'),
    createTokenStyle(TokenType.FUNCTION,      '#795e26'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.IDENTIFIER,    '#001080'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(tsqlDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.TYPE,          '#e5c07b'),
    createTokenStyle(TokenType.VARIABLE,      '#e06c75'),
    createTokenStyle(TokenType.FUNCTION,      '#61afef'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.IDENTIFIER,    '#abb2bf'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(tsqlDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.VARIABLE,      '#fd971f'),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(tsqlDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.TYPE,          '#8be9fd', { italic: true }),
    createTokenStyle(TokenType.VARIABLE,      '#ffb86c'),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(tsqlDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.TYPE,          '#953800'),
    createTokenStyle(TokenType.VARIABLE,      '#0550ae'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}