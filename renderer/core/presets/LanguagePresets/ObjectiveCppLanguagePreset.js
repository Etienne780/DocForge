import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxCaptureMap,
  createSymbolRegister,
  createSyntaxStateTransition,
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

export function createObjectiveCppLanguage() {
  const def = createSyntaxDefinition('Objective-C++');
  def.aliases = ['mm', 'objc++', 'objcpp', 'objcxx', 'objective-c++', 'objective-cpp', 'objective-cxx'];
  def.id = 'ObjectiveCppLang';
  def.builtIn = true;
  def.symbolHoisting = false;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['NSString',      TokenType.TYPE],
    ['NSArray',       TokenType.TYPE],
    ['NSDictionary',  TokenType.TYPE],
    ['NSSet',         TokenType.TYPE],
    ['NSNumber',      TokenType.TYPE],
    ['NSValue',       TokenType.TYPE],
    ['NSData',        TokenType.TYPE],
    ['NSDate',        TokenType.TYPE],
    ['NSURL',         TokenType.TYPE],
    ['NSURLRequest',  TokenType.TYPE],
    ['NSURLResponse', TokenType.TYPE],
    ['NSHTTPURLResponse', TokenType.TYPE],
    ['NSURLSession',  TokenType.TYPE],
    ['NSURLConnection', TokenType.TYPE],
    ['NSFileManager', TokenType.TYPE],
    ['NSBundle',      TokenType.TYPE],
    ['NSUserDefaults', TokenType.TYPE],
    ['NSNotification', TokenType.TYPE],
    ['NSNotificationCenter', TokenType.TYPE],
    ['NSRunLoop',     TokenType.TYPE],
    ['NSTimer',       TokenType.TYPE],
    ['NSThread',      TokenType.TYPE],
    ['NSOperation',   TokenType.TYPE],
    ['NSOperationQueue', TokenType.TYPE],
    ['NSManagedObject', TokenType.TYPE],
    ['NSManagedObjectContext', TokenType.TYPE],
    ['NSFetchRequest', TokenType.TYPE],
    ['NSEntityDescription', TokenType.TYPE],
    ['NSExpression',  TokenType.TYPE],
    ['NSIndexPath',   TokenType.TYPE],
    ['NSIndexSet',    TokenType.TYPE],
    ['NSCharacterSet', TokenType.TYPE],
    ['NSLocale',      TokenType.TYPE],
    ['NSTimeZone',    TokenType.TYPE],
    ['NSCalendar',    TokenType.TYPE],
    ['NSDateComponents', TokenType.TYPE],
    ['NSUUID',        TokenType.TYPE],
    ['NSDecimalNumber', TokenType.TYPE],
    ['NSNumberFormatter', TokenType.TYPE],
    ['NSDateFormatter', TokenType.TYPE],
    ['NSJSONSerialization', TokenType.TYPE],
    ['NSXMLParser',   TokenType.TYPE],
    ['NSPropertyListSerialization', TokenType.TYPE],
    ['UIView',        TokenType.TYPE],
    ['UIViewController', TokenType.TYPE],
    ['UIButton',      TokenType.TYPE],
    ['UILabel',       TokenType.TYPE],
    ['UITextField',   TokenType.TYPE],
    ['UITextView',    TokenType.TYPE],
    ['UIImageView',   TokenType.TYPE],
    ['UITableView',   TokenType.TYPE],
    ['UICollectionView', TokenType.TYPE],
    ['UIScrollView',  TokenType.TYPE],
    ['UINavigationController', TokenType.TYPE],
    ['UITabBarController', TokenType.TYPE],
    ['UIWindow',      TokenType.TYPE],
    ['UIApplication', TokenType.TYPE],
    ['UIResponder',   TokenType.TYPE],
    ['NSView',        TokenType.TYPE],
    ['NSViewController', TokenType.TYPE],
    ['NSButton',      TokenType.TYPE],
    ['NSTextField',   TokenType.TYPE],
    ['NSTableView',   TokenType.TYPE],
    ['NSOutlineView', TokenType.TYPE],
    ['NSScrollView',  TokenType.TYPE],
    ['NSWindow',      TokenType.TYPE],
    ['NSWindowController', TokenType.TYPE],
    ['NSApplication', TokenType.TYPE],
    ['NSResponder',   TokenType.TYPE],
    ['CGPoint',       TokenType.TYPE],
    ['CGSize',        TokenType.TYPE],
    ['CGRect',        TokenType.TYPE],
    ['CGColor',       TokenType.TYPE],
    ['CGImage',       TokenType.TYPE],
    ['CGGradient',    TokenType.TYPE],
    ['CGContext',     TokenType.TYPE],
    ['CGAffineTransform', TokenType.TYPE],
    ['CALayer',       TokenType.TYPE],
    ['CAAnimation',   TokenType.TYPE],
    ['CABasicAnimation', TokenType.TYPE],
    ['CAKeyframeAnimation', TokenType.TYPE],
    ['CATransition',  TokenType.TYPE],
    ['CATransform3D', TokenType.TYPE],
    ['dispatch_queue_t', TokenType.TYPE],
    ['dispatch_group_t', TokenType.TYPE],
    ['dispatch_semaphore_t', TokenType.TYPE],
    ['dispatch_source_t', TokenType.TYPE],
    ['dispatch_block_t', TokenType.TYPE],
    ['std',           TokenType.NAMESPACE],
    ['string',        TokenType.TYPE],
    ['vector',        TokenType.TYPE],
    ['map',           TokenType.TYPE],
    ['unordered_map', TokenType.TYPE],
    ['set',           TokenType.TYPE],
    ['unordered_set', TokenType.TYPE],
    ['list',          TokenType.TYPE],
    ['deque',         TokenType.TYPE],
    ['queue',         TokenType.TYPE],
    ['stack',         TokenType.TYPE],
    ['pair',          TokenType.TYPE],
    ['tuple',         TokenType.TYPE],
    ['optional',      TokenType.TYPE],
    ['variant',       TokenType.TYPE],
    ['any',           TokenType.TYPE],
    ['function',      TokenType.TYPE],
    ['shared_ptr',    TokenType.TYPE],
    ['unique_ptr',    TokenType.TYPE],
    ['weak_ptr',      TokenType.TYPE],
    ['enable_shared_from_this', TokenType.TYPE],
    ['nullptr_t',     TokenType.TYPE],
    ['nil',           TokenType.LITERAL],
    ['NULL',          TokenType.LITERAL],
    ['nullptr',       TokenType.LITERAL],
    ['YES',           TokenType.LITERAL],
    ['NO',            TokenType.LITERAL],
    ['TRUE',          TokenType.LITERAL],
    ['FALSE',         TokenType.LITERAL],
    ['true',          TokenType.LITERAL],
    ['false',         TokenType.LITERAL],
    ['NSNotFound',    TokenType.LITERAL],
    ['NSIntegerMax',  TokenType.LITERAL],
    ['NSIntegerMin',  TokenType.LITERAL],
    ['CGFLOAT_MAX',   TokenType.LITERAL],
    ['CGFLOAT_MIN',   TokenType.LITERAL],
    ['INFINITY',      TokenType.LITERAL],
    ['NAN',           TokenType.LITERAL],
    ['NSLog',         TokenType.FUNCTION],
    ['NSAssert',      TokenType.FUNCTION],
    ['NSCAssert',     TokenType.FUNCTION],
    ['NSParameterAssert', TokenType.FUNCTION],
    ['NSLocalizedString', TokenType.FUNCTION],
    ['NSStringFromClass', TokenType.FUNCTION],
    ['NSStringFromSelector', TokenType.FUNCTION],
    ['NSSelectorFromString', TokenType.FUNCTION],
    ['NSClassFromString', TokenType.FUNCTION],
    ['NSProtocolFromString', TokenType.FUNCTION],
    ['NSMakeRange',   TokenType.FUNCTION],
    ['NSMaxRange',    TokenType.FUNCTION],
    ['NSLocationInRange', TokenType.FUNCTION],
    ['NSEqualRanges', TokenType.FUNCTION],
    ['NSUnionRange',  TokenType.FUNCTION],
    ['NSIntersectionRange', TokenType.FUNCTION],
    ['std::cout',     TokenType.FUNCTION],
    ['std::cin',      TokenType.FUNCTION],
    ['std::cerr',     TokenType.FUNCTION],
    ['std::endl',     TokenType.FUNCTION],
    ['std::make_shared', TokenType.FUNCTION],
    ['std::make_unique', TokenType.FUNCTION],
    ['std::move',     TokenType.FUNCTION],
    ['std::forward',  TokenType.FUNCTION],
    ['std::swap',     TokenType.FUNCTION],
    ['NS_DESIGNATED_INITIALIZER', TokenType.DECORATOR],
    ['NS_UNAVAILABLE', TokenType.DECORATOR],
    ['NS_REQUIRES_SUPER', TokenType.DECORATOR],
    ['NS_RETURNS_RETAINED', TokenType.DECORATOR],
    ['NS_RETURNS_NOT_RETAINED', TokenType.DECORATOR],
    ['NS_RETURNS_INNER_POINTER', TokenType.DECORATOR],
    ['NS_REQUIRES_NIL_TERMINATION', TokenType.DECORATOR],
    ['NS_NOESCAPE',   TokenType.DECORATOR],
    ['NS_SWIFT_NAME', TokenType.DECORATOR],
    ['NS_SWIFT_UNAVAILABLE', TokenType.DECORATOR],
    ['NS_ASSUME_NONNULL_BEGIN', TokenType.DECORATOR],
    ['NS_ASSUME_NONNULL_END', TokenType.DECORATOR],
    ['NS_FORMAT_ARGUMENT', TokenType.DECORATOR],
    ['NS_FORMAT_FUNCTION', TokenType.DECORATOR],
    ['NS_PRINTF_FORMAT', TokenType.DECORATOR],
    ['NS_SCANF_FORMAT', TokenType.DECORATOR],
    ['NS_WARN_UNUSED_RESULT', TokenType.DECORATOR],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const common = newState(def, 'common_rules');
  const strDouble = newState(def, 'string_double');
  const strEscape = newState(def, 'string_escape');
  const atString = newState(def, 'at_string');
  const atStringEscape = newState(def, 'at_string_escape');
  const blockComment = newState(def, 'block_comment');
  const preproc = newState(def, 'preprocessor');
  const templateArgs = newState(def, 'template_args');

  // String escapes
  strEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strEscape, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  atStringEscape.onUnmatched = OnUnmatched.CHARACTER;
  addRule(atStringEscape, 'at_escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:[\\abfnrtv"']|[0-7]{1,3}|x[0-9a-fA-F]{2})/.source;
    r.action = action(TokenType.ESCAPE);
  });

  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  atString.onUnmatched = OnUnmatched.CHARACTER;
  addRule(atString, 'include_at_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = atStringEscape.id;
  });

  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  preproc.onUnmatched = OnUnmatched.CHARACTER;

  templateArgs.onUnmatched = OnUnmatched.CHARACTER;
  addRule(templateArgs, 'template_type', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.TYPE);
  });
  addRule(templateArgs, 'template_punct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[,<>]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });
  addRule(templateArgs, 'template_amp', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[&*]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Common rules
  addRule(common, 'c_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
      'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
      'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof',
      'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void',
      'volatile', 'while',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'cpp_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'alignas', 'alignof', 'and', 'and_eq', 'asm', 'bitand', 'bitor',
      'bool', 'catch', 'class', 'compl', 'const_cast', 'constexpr',
      'decltype', 'delete', 'dynamic_cast', 'explicit', 'export',
      'friend', 'inline', 'mutable', 'namespace', 'new', 'noexcept',
      'not', 'not_eq', 'operator', 'or', 'or_eq', 'private', 'protected',
      'public', 'reinterpret_cast', 'static_assert', 'static_cast',
      'template', 'this', 'throw', 'try', 'typeid', 'typename',
      'using', 'virtual', 'xor', 'xor_eq',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'objc_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@(?:interface|implementation|protocol|end|class|import|property|synthesize|dynamic|public|protected|private|package|selector|encode|synchronized|try|catch|finally|throw|autoreleasepool|available|compatibility_alias|defs)/.source;
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'objc_modifiers', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'instancetype', 'id', 'Class', 'SEL', 'IMP',
      'super', 'self', 'nil', 'Nil',
      'atomic', 'nonatomic', 'strong', 'weak', 'copy', 'assign',
      'retain', 'readonly', 'readwrite', 'getter', 'setter',
      'nullable', 'nonnull', 'null_unspecified', 'null_resettable',
      'kindof', 'NS_NONATOMIC_IOSONLY',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'method_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /([-+])\s*\(([^)]*)\)\s*([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.OPERATOR, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE, register: null };
    caps.groups['3'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'method_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /([-+])\s*\(([^)]*)\)\s*([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.OPERATOR, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE, register: null };
    caps.groups['3'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*\(/.source;
    r.context = { notAfterTokenType: [TokenType.KEYWORD, TokenType.TYPE] };
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'property_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@property\s*\([^)]*\)\s*([A-Za-z_]\w*)\s*\*?\s*([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.TYPE, register: null };
    caps.groups['2'] = { tokenType: TokenType.PROPERTY,
                         register: createSymbolRegister(TokenType.PROPERTY, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'class_forward', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@class\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'protocol_forward', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@protocol\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'namespace_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\bnamespace\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.NAMESPACE,
      register: createSymbolRegister(TokenType.NAMESPACE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'cpp_type_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(class|struct)\s+([A-Za-z_]\w*)(?:\s*<[^>]*>)?/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'template_declaration', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<(?![<=])/.source;
    r.end   = />/.source;
    r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, templateArgs.id));
    r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.TYPE;
    r.innerStateId = templateArgs.id;
  });

  addRule(common, 'using_alias', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\busing\s+([A-Za-z_]\w*)\s*=\s*/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = {
      tokenType: TokenType.TYPE,
      register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
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

  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  addRule(shared, 'at_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /@"/.source;
    r.end   = /"/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, atString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = atString.id;
  });

  addRule(shared, 'at_number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@-?\d+\.?\d*/.source;
    r.action = action(TokenType.NUMBER);
  });

  addRule(shared, 'at_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /@(YES|NO|true|false|nil|NULL)/.source;
    r.action = action(TokenType.LITERAL);
  });

  addRule(shared, 'at_boxed', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@\([^)]*\)/.source;
    r.action = action(TokenType.OPERATOR);
  });

  addRule(shared, 'at_array', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@\[[^\]]*\]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(shared, 'at_dictionary', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@\{[^}]*\}/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  addRule(shared, 'selector', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@selector\s*\([A-Za-z_:]\w*\)/.source;
    r.action = action(TokenType.FUNCTION);
  });

  addRule(shared, 'preprocessor', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /^[ \t]*#/.source;
    r.end   = /(?<!\\)$/.source;
    r.beginAction = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.PUSH, preproc.id));
    r.endAction   = action(TokenType.KEYWORD, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.KEYWORD;
    r.innerStateId = preproc.id;
  });

  addRule(preproc, 'preproc_keyword', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'include', 'import', 'define', 'undef', 'if', 'ifdef', 'ifndef',
      'elif', 'else', 'endif', 'pragma', 'error', 'warning', 'line',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Numbers
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX][0-9a-fA-F_]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_oct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[0-7_]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.\d*(?:[eE][+-]?\d+)?[fF]?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|<=|>=|==|!=|&&|\|\||\?|:|=|->|\.\.\.|::/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules – WICHTIG: shared (Operatoren) VOR common (Templates) einbinden
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });

  // Example code
  def.exampleCode = `//
//  Person.mm
//  Objective-C++ example
//

#import <Foundation/Foundation.h>
#import <vector>
#import <string>

using namespace std;

@interface Person : NSObject {
@private
    string _cppName;
    vector<string> _hobbies;
}

@property (nonatomic, assign) NSInteger age;
@property (nonatomic, copy) NSString *email;

- (instancetype)initWithName:(const string&)name age:(NSInteger)age;
- (const string&)cppName;
- (void)addHobby:(const string&)hobby;
- (vector<string>)getHobbies;

@end

@implementation Person

- (instancetype)initWithName:(const string&)name age:(NSInteger)age {
    self = [super init];
    if (self) {
        _cppName = name;
        _age = age;
    }
    return self;
}

- (const string&)cppName {
    return _cppName;
}

- (void)addHobby:(const string&)hobby {
    _hobbies.push_back(hobby);
}

- (vector<string>)getHobbies {
    return _hobbies;
}

- (NSString *)description {
    return [NSString stringWithFormat:@"<Person: %p, name=%s, age=%ld>",
            self, _cppName.c_str(), (long)self.age];
}

@end

// C++ function with templates
template<typename T>
T max(T a, T b) {
    return (a > b) ? a : b;
}

// C++ class
class Greeter {
public:
    Greeter(const string& name) : _name(name) {}
    string greet() const {
        return "Hello, " + _name + "!";
    }
private:
    string _name;
};

// Objective-C++ main
int main(int argc, const char * argv[]) {
    @autoreleasepool {
        // C++ string
        string name = "Alice";

        // Objective-C object
        Person *person = [[Person alloc] initWithName:name age:30];
        [person addHobby:"Reading"];
        [person addHobby:"Hiking"];

        // NSLog with C++ string
        NSLog(@"%@", person);
        NSLog(@"Hobbies: %s", [person getHobbies].front().c_str());

        // C++ template function
        int maxInt = max<int>(10, 20);
        double maxDouble = max(3.14, 2.71);

        // C++ class
        Greeter greeter("Bob");
        string greeting = greeter.greet();

        // C++11 auto and lambda
        auto add = [](int a, int b) -> int { return a + b; };
        int sum = add(5, 7);

        // STL container
        vector<int> numbers = {1, 2, 3, 4, 5};
        for (int n : numbers) {
            cout << n << endl;
        }

        // Objective-C literals
        NSArray *fruits = @[@"Apple", @"Banana", @"Cherry"];
        NSDictionary *dict = @{@"key": @"value"};

        // C++ nullptr and Objective-C nil
        Person *p = nil;
        int *ptr = nullptr;

        // Block with C++ capture
        __block int counter = 0;
        void (^block)(void) = ^{
            counter++;
            NSLog(@"Counter: %d", counter);
        };
        block();
    }
    return 0;
}`;

  // HighlightStyle
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