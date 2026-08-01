import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxCaptureMap,
  createSymbolRegister,
  createSyntaxStateTransition,
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

export function createPHPLanguage() {
  const def = createSyntaxDefinition('PHP');
  def.aliases = ['php'];
  def.id = 'PhpLang';
  def.builtIn = true;
  // PHP declares functions / classes globally, but for variables more scope-based
  // – we use hoisting for symbols.
  def.symbolHoisting = true;

  const root = def.states.find(s => s.id === def.rootStateId);

  // ── Predefined symbols ──────────────────────────────────────────────────
  const predefined = [
    // Superglobals
    ['$_SERVER', TokenType.VARIABLE],
    ['$_GET',    TokenType.VARIABLE],
    ['$_POST',   TokenType.VARIABLE],
    ['$_FILES',  TokenType.VARIABLE],
    ['$_COOKIE', TokenType.VARIABLE],
    ['$_SESSION',TokenType.VARIABLE],
    ['$_REQUEST',TokenType.VARIABLE],
    ['$_ENV',    TokenType.VARIABLE],
    ['$GLOBALS', TokenType.VARIABLE],
    ['$this',    TokenType.VARIABLE],
    // Reserved constants
    ['__LINE__',      TokenType.LITERAL],
    ['__FILE__',      TokenType.LITERAL],
    ['__DIR__',       TokenType.LITERAL],
    ['__FUNCTION__',  TokenType.LITERAL],
    ['__CLASS__',     TokenType.LITERAL],
    ['__TRAIT__',     TokenType.LITERAL],
    ['__METHOD__',    TokenType.LITERAL],
    ['__NAMESPACE__', TokenType.LITERAL],
    // Types / classes
    ['stdClass',  TokenType.TYPE],
    ['Exception', TokenType.TYPE],
    ['Error',     TokenType.TYPE],
    ['PDO',       TokenType.TYPE],
    ['mysqli',    TokenType.TYPE],
    ['DateTime',  TokenType.TYPE],
    ['DateTimeImmutable', TokenType.TYPE],
    ['ArrayObject', TokenType.TYPE],
    ['ArrayIterator', TokenType.TYPE],
    // Common functions (only a few dozen)
    ['echo',       TokenType.FUNCTION],
    ['print',      TokenType.FUNCTION],
    ['die',        TokenType.FUNCTION],
    ['exit',       TokenType.FUNCTION],
    ['var_dump',   TokenType.FUNCTION],
    ['print_r',    TokenType.FUNCTION],
    ['isset',      TokenType.FUNCTION],
    ['unset',      TokenType.FUNCTION],
    ['empty',      TokenType.FUNCTION],
    ['defined',    TokenType.FUNCTION],
    ['define',     TokenType.FUNCTION],
    ['class_exists', TokenType.FUNCTION],
    ['interface_exists', TokenType.FUNCTION],
    ['trait_exists', TokenType.FUNCTION],
    ['method_exists', TokenType.FUNCTION],
    ['property_exists', TokenType.FUNCTION],
    ['function_exists', TokenType.FUNCTION],
    ['count',      TokenType.FUNCTION],
    ['sizeof',     TokenType.FUNCTION],
    ['array_push', TokenType.FUNCTION],
    ['array_pop',  TokenType.FUNCTION],
    ['array_shift',TokenType.FUNCTION],
    ['array_unshift', TokenType.FUNCTION],
    ['array_keys', TokenType.FUNCTION],
    ['array_values', TokenType.FUNCTION],
    ['array_merge', TokenType.FUNCTION],
    ['array_diff', TokenType.FUNCTION],
    ['array_intersect', TokenType.FUNCTION],
    ['in_array',   TokenType.FUNCTION],
    ['explode',    TokenType.FUNCTION],
    ['implode',    TokenType.FUNCTION],
    ['strlen',     TokenType.FUNCTION],
    ['strpos',     TokenType.FUNCTION],
    ['strrpos',    TokenType.FUNCTION],
    ['substr',     TokenType.FUNCTION],
    ['str_replace',TokenType.FUNCTION],
    ['preg_match', TokenType.FUNCTION],
    ['preg_replace', TokenType.FUNCTION],
    ['json_encode',TokenType.FUNCTION],
    ['json_decode',TokenType.FUNCTION],
    ['file_get_contents', TokenType.FUNCTION],
    ['file_put_contents', TokenType.FUNCTION],
    ['fopen',      TokenType.FUNCTION],
    ['fclose',     TokenType.FUNCTION],
    ['fread',      TokenType.FUNCTION],
    ['fwrite',     TokenType.FUNCTION],
    ['fgets',      TokenType.FUNCTION],
    ['feof',       TokenType.FUNCTION],
    ['header',     TokenType.FUNCTION],
    ['session_start', TokenType.FUNCTION],
    ['session_destroy', TokenType.FUNCTION],
    ['setcookie',  TokenType.FUNCTION],
    ['filter_var', TokenType.FUNCTION],
    ['filter_input', TokenType.FUNCTION],
    ['date',       TokenType.FUNCTION],
    ['time',       TokenType.FUNCTION],
    ['strtotime',  TokenType.FUNCTION],
    ['htmlspecialchars', TokenType.FUNCTION],
    ['htmlentities', TokenType.FUNCTION],
    ['strip_tags', TokenType.FUNCTION],
    ['urlencode',  TokenType.FUNCTION],
    ['urldecode',  TokenType.FUNCTION],
    ['base64_encode', TokenType.FUNCTION],
    ['base64_decode', TokenType.FUNCTION],
    ['hash',       TokenType.FUNCTION],
    ['password_hash', TokenType.FUNCTION],
    ['password_verify', TokenType.FUNCTION],
    ['gettype',    TokenType.FUNCTION],
    ['settype',    TokenType.FUNCTION],
    ['intval',     TokenType.FUNCTION],
    ['floatval',   TokenType.FUNCTION],
    ['strval',     TokenType.FUNCTION],
    ['boolval',    TokenType.FUNCTION],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // ── States ──────────────────────────────────────────────────────────────────

  // Shared rules (included in root and other states)
  const shared = newState(def, 'shared_rules');

  // String states
  const strDouble = newState(def, 'string_double');
  const strSingle = newState(def, 'string_single');
  const strEscape = newState(def, 'string_escape');
  const heredoc    = newState(def, 'heredoc');
  const nowdoc     = newState(def, 'nowdoc');

  // Comment state
  const blockComment = newState(def, 'block_comment');

  // PHP tag content (after <?php)
  const phpContent = newState(def, 'php_content');

  // ── Helper string escape ────────────────────────────────────────────────────
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[nrtvfe\\$"']|x[0-9a-fA-F]{1,2}|[0-7]{1,3})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // ── Strings ──────────────────────────────────────────────────────────────────

  // Double quotes
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });
  // Variables in strings (interpolated)
  addRule(strDouble, 'variable_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*/.source;
    r.action = action(TokenType.VARIABLE);
  });
  // Complex string interpolation {$…}
  addRule(strDouble, 'complex_var_in_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\{\$[a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*\}/.source;
    r.action = action(TokenType.VARIABLE);
  });

  // Single quotes (no interpolation)
  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // Heredoc / Nowdoc (state is dynamically set with label – simplified here)
  heredoc.onUnmatched = OnUnmatched.CHARACTER;
  heredoc.contentTokenType = TokenType.STRING;
  nowdoc.onUnmatched = OnUnmatched.CHARACTER;
  nowdoc.contentTokenType = TokenType.STRING;

  // ── Block comment ──────────────────────────────────────────────────────────
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // ── Shared Rules ────────────────────────────────────────────────────────────

  // Line comments (// and #)
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:#|\/\/).*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Block comment
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // Double quotes
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Single quotes
  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = "'";
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // Heredoc (simplified: <<<LABEL)
  addRule(shared, 'heredoc', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<<<\s*(["']?)([A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*)\1/.source;
    r.end   = /^\s*\2\s*;?$/m; // ends with label at start of line
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, heredoc.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = heredoc.id;
  });

  // Nowdoc (<<<'LABEL')
  addRule(shared, 'nowdoc', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<<<\s*'([A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*)'/.source;
    r.end   = /^\s*\1\s*;?$/m;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, nowdoc.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = nowdoc.id;
  });

  // Numbers
  addRule(shared, 'numbers', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[0-7]+|\d+\.\d+|\d+)\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!]=?|\.\.\.?|=>|<=>|<<|>>|===|!==|&&|\|\||::/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,:.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // ── PHP‑Content‑State (after <?php) ──────────────────────────────────────

  phpContent.onUnmatched = OnUnmatched.CHARACTER;

  // Keywords
  addRule(phpContent, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      // control structures
      'if', 'else', 'elseif', 'for', 'foreach', 'while', 'do', 'switch',
      'case', 'default', 'break', 'continue', 'return', 'goto', 'match',
      // declarations
      'function', 'fn', 'class', 'interface', 'trait', 'enum', 'abstract',
      'final', 'readonly', 'private', 'protected', 'public', 'static',
      'var', 'const', 'use', 'namespace', 'declare', 'strict_types',
      // types
      'int', 'float', 'string', 'bool', 'array', 'object', 'mixed',
      'callable', 'iterable', 'void', 'never', 'true', 'false', 'null',
      // miscellaneous
      'new', 'clone', 'instanceof', 'implements', 'extends', 'throws',
      'yield', 'yield from', 'eval', 'include', 'include_once', 'require', 'require_once',
      'isset', 'unset', 'empty', 'die', 'exit', 'echo', 'print', 'list',
      'match', 'attribute', 'readonly', 'enum', 'interface', 'trait',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Type declarations (classes / interfaces / traits / enums) → register
  addRule(phpContent, 'type_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(class|interface|trait|enum)\s+([A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Namespace declaration
  addRule(phpContent, 'namespace_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(namespace)\s+([A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*(?:\\[A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*)*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.NAMESPACE,
                         register: createSymbolRegister(TokenType.NAMESPACE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // use – Import (alias)
  addRule(phpContent, 'use_import', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\buse\s+([A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*(?:\\[A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*)*)(?:\s+as\s+([A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*))?/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.NAMESPACE, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Function definition – registered globally
  addRule(phpContent, 'function_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bfunction\s+([A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*)\s*\(/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION,
                         register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Class names in code (after new, instanceof, etc.)
  addRule(phpContent, 'class_usage', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=new\s+)([A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*)(?:\s*\(|;|\s)/.source;
    r.action = action(TokenType.TYPE);
  });

  // Variables ($)
  addRule(phpContent, 'variables', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$[A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*/.source;
    // We don't register them automatically because PHP is dynamic,
    // but we color them as VARIABLE.
    r.action = action(TokenType.VARIABLE);
  });

  // Attributes #[...]
  addRule(phpContent, 'attribute', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /#\[[^\]]+\]/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // PHP tag – and other tags (here only for completeness)
  // The parser should run root at the start, but we ignore tags for display.
  // That's fine because text outside PHP is marked as OTHER.

  // ── Root ────────────────────────────────────────────────────────────────────
  // Root contains the shared rules and then redirects to phpContent as soon as <?php appears.
  // But since we expect a pure PHP file, we can treat root directly as phpContent.
  // Or we copy all rules from phpContent into root.
  // For simplicity: root contains all rules from phpContent + shared rules.
  // We also add PHP tags as BEGIN_END to distinguish between HTML and PHP.

  // PHP tag BEGIN_END for <?php ... ?>
  addRule(root, 'php_tag', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<\?php/.source;
    r.end   = /\?>/.source;
    r.beginAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, phpContent.id));
    r.endAction   = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = phpContent.id;
  });

  // Short form <?= (for echo)
  addRule(root, 'short_echo_tag', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<\?=/.source;
    r.end   = /\?>/.source;
    r.beginAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, phpContent.id));
    r.endAction   = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = phpContent.id;
  });

  // Everything outside PHP tags is OTHER
  // Therefore no additional rules in root.

  // ── Example code ──────────────────────────────────────────────────────────
  def.exampleCode = `<?php

namespace App\\Controller;

use Symfony\\Component\\HttpFoundation\\Response;
use App\\Entity\\User;

class UserController
{
    private UserRepository $repo;

    public function __construct(UserRepository $repo)
    {
        $this->repo = $repo;
    }

    public function show(int $id): Response
    {
        $user = $this->repo->find($id);
        if (!$user) {
            throw $this->createNotFoundException('User not found');
        }

        return $this->render('user/show.html.twig', [
            'user' => $user,
            'title' => 'User Profile',
        ]);
    }

    #[Route('/user/{id}', name: 'user_show')]
    public function userAction(int $id): Response
    {
        // do something
        return new Response('Hello ' . $id);
    }
}

// string interpolation
$name = "John";
echo "Hello, $name!\\n";
echo 'Hello, $name!\\n';

// heredoc
$html = <<<HTML
<div class="container">
    <h1>Hello, $name</h1>
</div>
HTML;

// nowdoc
$css = <<<'CSS'
.container { color: #fff; }
CSS;

// constants
define('APP_ENV', 'dev');
if (APP_ENV === 'prod') {
    // ...
}

// match
$result = match($status) {
    200 => 'OK',
    404 => 'Not Found',
    default => 'Unknown',
};

// attributes
#[\\Attribute]
class MyAttribute {}

// array
$data = [1, 2, 3, 'key' => 'value'];
`;

  // ── HighlightStyle ────────────────────────────────────────────────────────
  const style = createHighlightStyle('Dark+');
  style.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#569cd6'),
    createTokenStyle(TokenType.TYPE,          '#4ec9b0'),
    createTokenStyle(TokenType.IDENTIFIER,    '#9cdcfe'),
    createTokenStyle(TokenType.VARIABLE,      '#9cdcfe'),
    createTokenStyle(TokenType.FUNCTION,      '#dcdcaa'),
    createTokenStyle(TokenType.PARAMETER,     '#9cdcfe', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#9cdcfe'),
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