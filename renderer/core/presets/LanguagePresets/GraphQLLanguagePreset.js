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

export function createGraphQLLanguage() {
  const def = createSyntaxDefinition('GraphQL');
  def.aliases = ['graphql', 'gql'];
  def.id = 'GraphQLLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols – common GraphQL types (scalars and built-ins)
  const predefined = [
    ['Int',           TokenType.TYPE],
    ['Float',         TokenType.TYPE],
    ['String',        TokenType.TYPE],
    ['Boolean',       TokenType.TYPE],
    ['ID',            TokenType.TYPE],
    ['__Schema',      TokenType.TYPE],
    ['__Type',        TokenType.TYPE],
    ['__TypeKind',    TokenType.TYPE],
    ['__Field',       TokenType.TYPE],
    ['__InputValue',  TokenType.TYPE],
    ['__EnumValue',   TokenType.TYPE],
    ['__Directive',   TokenType.TYPE],
    ['__DirectiveLocation', TokenType.TYPE],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['null',          TokenType.LITERAL],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strTriple = newState(def, 'string_triple');
  const strEscape = newState(def, 'string_escape');
  const blockComment = newState(def, 'block_comment');

  // String escape sequences
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Triple-quoted string content (description strings)
  strTriple.onUnmatched = OnUnmatched.CHARACTER;
  strTriple.contentTokenType = TokenType.STRING;

  // Block comments (not standard, but often supported in tooling)
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Common rules
  // GraphQL keywords (SDL + query language)
  addRule(common, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'query', 'mutation', 'subscription', 'fragment', 'on', 'implements',
      'interface', 'type', 'union', 'enum', 'input', 'scalar', 'schema',
      'directive', 'extend', 'repeatable',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Directives: @include, @skip, @deprecated, @specifiedBy, etc.
  addRule(common, 'directive', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@[A-Za-z_]\w*/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // Variable: $var
  addRule(common, 'variable', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_]\w*/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Fragment spread: ...name, ... on Type
  addRule(common, 'fragment_spread', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\.\.\.\s*[A-Za-z_]\w*/.source;
    r.action = action(TokenType.FUNCTION);
  });

  // Type name (uppercase identifier) – colored as TYPE
  addRule(common, 'type_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Z][A-Za-z_]\w*/.source;
    r.action = action(TokenType.TYPE);
  });

  // Field name (lowercase identifier) – colored as IDENTIFIER
  addRule(common, 'field_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[a-z][A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Enum values (uppercase) – colored as LITERAL
  addRule(common, 'enum_value', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Z][A-Z0-9_]*/.source;
    r.action = action(TokenType.LITERAL);
  });

  // Operators: : = ! | &
  addRule(common, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[:=!|&]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation: ( ) { } [ ] , ...
  addRule(common, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\],.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Numbers
  addRule(common, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(common, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.\d+\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Shared rules
  // Line comments: #
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Block comments (optional extension)
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Double-quoted strings
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Triple-quoted strings (for descriptions)
  addRule(shared, 'string_triple', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /"""/.source;
    r.end   = /"""/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strTriple.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strTriple.id;
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
  def.exampleCode = `# GraphQL schema example
# This is a comment

"""
Description of the query type.
"""
type Query {
  "Get a user by ID"
  user(id: ID!): User
  allUsers: [User!]!
  search(term: String!, limit: Int = 10): [SearchResult!]!
}

type Mutation {
  createUser(input: UserInput!): User!
  updateUser(id: ID!, input: UserInput!): User!
  deleteUser(id: ID!): Boolean!
}

type Subscription {
  userAdded: User!
  userUpdated: User!
}

type User implements Node & Timestamped {
  id: ID!
  name: String!
  email: String!
  age: Int
  role: Role!
  posts: [Post!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

interface Node {
  id: ID!
}

interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Post implements Node & Timestamped {
  id: ID!
  title: String!
  content: String!
  author: User!
  comments: [Comment!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Comment implements Node & Timestamped {
  id: ID!
  text: String!
  author: User!
  post: Post!
  createdAt: DateTime!
  updatedAt: DateTime!
}

union SearchResult = User | Post | Comment

enum Role {
  ADMIN
  MODERATOR
  USER
  GUEST
}

scalar DateTime

input UserInput {
  name: String!
  email: String!
  age: Int
  role: Role = USER
}

directive @auth(requires: Role!) on OBJECT | FIELD_DEFINITION

extend type Query {
  me: User @auth(requires: ADMIN)
}

# Example query
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    ...UserFields
  }
}

fragment UserFields on User {
  id
  name
  email
  role
  posts {
    title
  }
}
`;
  return def;
}

export function createGraphQLLanguageStyles(gqlDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(gqlDef.id, 'Dark+');
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

  return [darkStyle];
}