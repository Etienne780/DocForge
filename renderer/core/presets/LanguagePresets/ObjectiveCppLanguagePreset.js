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
    ['string_view',   TokenType.TYPE],
    ['array',         TokenType.TYPE],
    ['span',          TokenType.TYPE],
    ['expected',      TokenType.TYPE],
    ['same_as',       TokenType.TYPE],
    ['derived_from',  TokenType.TYPE],
    ['convertible_to', TokenType.TYPE],
    ['integral',      TokenType.TYPE],
    ['floating_point', TokenType.TYPE],
    ['invocable',     TokenType.TYPE],
    ['NSObject',      TokenType.TYPE],
    ['NSInteger',     TokenType.TYPE],
    ['NSUInteger',    TokenType.TYPE],
    ['CGFloat',       TokenType.TYPE],
    ['BOOL',          TokenType.TYPE],
    ['NSError',       TokenType.TYPE],
    ['NSException',   TokenType.TYPE],
    ['NSMutableArray', TokenType.TYPE],
    ['NSMutableDictionary', TokenType.TYPE],
    ['NSMutableString', TokenType.TYPE],
    ['NSCopying',     TokenType.TYPE],
    ['cout',          TokenType.VARIABLE],
    ['cin',           TokenType.VARIABLE],
    ['cerr',          TokenType.VARIABLE],
    ['endl',          TokenType.VARIABLE],
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
  const strSingle = newState(def, 'string_single');
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

  strSingle.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strSingle, 'include_escape', r => {
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
    r.pattern = /::|[,<>]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });
  addRule(templateArgs, 'template_amp', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[&*]/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Common rules
  // C++ declarations first: they must run before the keyword rules,
  // otherwise the bare keyword gets matched alone.

  // `class/struct/union/enum (class) Name` -> registers TYPE
  addRule(common, 'cpp_type_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(class|struct|union|enum(?:\s+class)?)\s+([A-Za-z_]\w*)/.source;
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

  // `namespace Name(::Name)*` -> registers NAMESPACE
  addRule(common, 'namespace_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(namespace)\s+([A-Za-z_]\w*)(?:(::)([A-Za-z_]\w*))?(?:(::)([A-Za-z_]\w*))?/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    for (const g of ['2', '4', '6']) {
      caps.groups[g] = {
        tokenType: TokenType.NAMESPACE,
        register: createSymbolRegister(TokenType.NAMESPACE, RegisterScope.GLOBAL)
      };
    }
    caps.groups['3'] = { tokenType: TokenType.OPERATOR, register: null };
    caps.groups['5'] = { tokenType: TokenType.OPERATOR, register: null };
    a.captures = caps;
    r.action = a;
  });

  // `concept Name` -> registers TYPE
  addRule(common, 'concept_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(concept)\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // `using Name =` -> registers TYPE alias
  addRule(common, 'using_alias', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(using)\s+([A-Za-z_]\w*)\s*(?==(?!=))/.source;
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

  // C++ attributes `[[nodiscard]]`, `[[deprecated("x")]]`. Strict word list
  // so nested message sends like `[[Foo alloc] init]` don't match.
  addRule(common, 'attribute', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\[\[\s*[A-Za-z_][\w:]*(?:\([^)]*\))?(?:\s*,\s*[A-Za-z_][\w:]*(?:\([^)]*\))?)*\s*\]\]/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // `@interface/@implementation/@class Name (: Super)` -> registers TYPE.
  // Must run before objc_keywords, otherwise the bare @keyword wins.
  addRule(common, 'class_forward', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(@(?:interface|implementation|class))\s+([A-Za-z_]\w*)(?:\s*(:)\s*([A-Za-z_]\w*))?/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    caps.groups['3'] = { tokenType: TokenType.OPERATOR, register: null };
    caps.groups['4'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // `@protocol Name` -> registers TYPE (same ordering reason as above)
  addRule(common, 'protocol_forward', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(@protocol)\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Selector: @selector(methodName:with:)
  addRule(common, 'selector', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(@selector)\s*(\()\s*([A-Za-z_][\w:]*)\s*(\))/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['3'] = { tokenType: TokenType.FUNCTION, register: null };
    caps.groups['4'] = { tokenType: TokenType.PUNCTUATION, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Objective-C @keywords
  addRule(common, 'objc_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@(?:interface|implementation|protocol|end|class|import|property|synthesize|dynamic|public|protected|private|package|optional|required|selector|encode|synchronized|try|catch|finally|throw|autoreleasepool|available|compatibility_alias|defs)\b/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // C keywords
  addRule(common, 'c_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
      'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
      'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof',
      'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void',
      'volatile', 'while', 'inline', 'restrict', 'bool', '_Bool',
      '_Atomic', '_Static_assert', 'typeof', '__typeof', '__typeof__',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  addRule(common, 'cpp_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'alignas', 'alignof', 'and', 'and_eq', 'asm', 'bitand', 'bitor',
      'bool', 'catch', 'class', 'compl', 'const_cast', 'constexpr',
      'consteval', 'constinit', 'concept', 'requires',
      'co_await', 'co_yield', 'co_return',
      'decltype', 'delete', 'dynamic_cast', 'explicit', 'export',
      'final', 'friend', 'inline', 'mutable', 'namespace', 'new', 'noexcept',
      'not', 'not_eq', 'operator', 'or', 'or_eq', 'override', 'private', 'protected',
      'public', 'reinterpret_cast', 'static_assert', 'static_cast',
      'template', 'this', 'thread_local', 'throw', 'try', 'typeid', 'typename',
      'using', 'virtual', 'xor', 'xor_eq',
      'wchar_t', 'char8_t', 'char16_t', 'char32_t',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // `@property (nonatomic, copy, ...)` attributes - only inside the
  // parentheses, so `[name copy]` stays a plain method name.
  addRule(common, 'property_attributes', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=@property\s*\([^)]*)\b(?:atomic|nonatomic|strong|weak|copy|assign|retain|unsafe_unretained|readonly|readwrite|getter|setter|class|direct|nullable|nonnull|null_unspecified|null_resettable)\b/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Objective-C modifiers
  addRule(common, 'objc_modifiers', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'instancetype', 'id', 'Class', 'SEL', 'IMP',
      'super', 'self', 'nil', 'Nil', 'in',
      'nullable', 'nonnull', 'null_unspecified',
      '_Nonnull', '_Nullable', '_Null_unspecified', '__nonnull', '__nullable',
      '__kindof', 'kindof', '__weak', '__strong', '__block',
      '__unsafe_unretained', '__autoreleasing',
      '__bridge', '__bridge_transfer', '__bridge_retained',
      'NS_NONATOMIC_IOSONLY',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // `NS_ENUM(NSInteger, Name)` / `NS_OPTIONS(...)` -> registers Name as TYPE
  addRule(common, 'ns_enum_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(NS_(?:ENUM|OPTIONS|CLOSED_ENUM|ERROR_ENUM)|CF_(?:ENUM|OPTIONS))\s*(\()\s*([A-Za-z_]\w*)\s*(,)\s*([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['3'] = { tokenType: TokenType.TYPE, register: null };
    caps.groups['4'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['5'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Attribute-like SDK macros: NS_SWIFT_NAME(x), NS_ASSUME_NONNULL_BEGIN,
  // API_AVAILABLE(ios(13)), ...
  addRule(common, 'sdk_macros', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:NS|CF|API|UI)_[A-Z][A-Z0-9_]*\b/.source;
    r.action = action(TokenType.DECORATOR);
  });

  // Method definition (implementation) – return type and first selector
  // part. Only at the start of a line, so `a - (int)b` isn't a method.
  addRule(common, 'method_definition', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=^\s*)([-+])\s*(\()([^)]*)(\))\s*([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.OPERATOR, register: null };
    caps.groups['2'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['3'] = { tokenType: TokenType.TYPE, register: null };
    caps.groups['4'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['5'] = {
      tokenType: TokenType.FUNCTION,
      register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL)
    };
    a.captures = caps;
    r.action = a;
  });

  // Method declaration (in @interface/@protocol) – same shape as above,
  // without registration
  addRule(common, 'method_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=^\s*)([-+])\s*(\()([^)]*)(\))\s*([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.OPERATOR, register: null };
    caps.groups['2'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['3'] = { tokenType: TokenType.TYPE, register: null };
    caps.groups['4'] = { tokenType: TokenType.PUNCTUATION, register: null };
    caps.groups['5'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Function call / C function definition: `name(` (lookahead, the `(`
  // stays punctuation). Not after a TYPE: `Foo foo(1)` declares a variable.
  addRule(common, 'function_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)(?=\s*\()/.source;
    r.context = { notAfterTokenType: [TokenType.TYPE] };
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  // @property name (the last identifier before `;`). Not registered: the
  // same name is commonly reused as selector label/parameter (`name:(id)name`).
  addRule(common, 'property_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=@property\b[^;]*)\b([A-Za-z_]\w*)(?=\s*;)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.PROPERTY, register: null };
    a.captures = caps;
    r.action = a;
  });

  // dot-syntax member access: `self.name`, `rect.size`
  addRule(common, 'member_access', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=(?<!\.)\.\s*)[A-Za-z_]\w*/.source;
    r.action = action(TokenType.PROPERTY);
  });

  // `Type<...>` template arguments, only directly after a TYPE token
  // (`vector<int>`, `NSArray<NSString *>`) so `a < b` stays an operator.
  // Ends at the line end at the latest.
  addRule(common, 'template_declaration', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /<(?![<=])/.source;
    r.end   = />|$/.source;
    r.context = { afterTokenType: [TokenType.TYPE] };
    r.beginAction = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.PUSH, templateArgs.id));
    r.endAction   = action(TokenType.PUNCTUATION, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.TYPE;
    r.innerStateId = templateArgs.id;
  });

  // `Name::` scope qualifier -> NAMESPACE
  addRule(common, 'namespace_qualifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b[A-Za-z_]\w*(?=::)/.source;
    r.action = action(TokenType.NAMESPACE);
  });

  // Identifier fallback
  addRule(common, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Shared rules
  // Line comments
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Block comments
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // C-style double-quoted strings. Strings end at the line end unless it
  // is continued with `\`, so an unclosed string can't bleed.
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = /"|(?<!\\)$/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Objective-C @"..." string literals
  addRule(shared, 'at_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /@"/.source;
    r.end   = /"|(?<!\\)$/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, atString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = atString.id;
  });

  // Character literals 'a', '\n' (never span lines)
  addRule(shared, 'string_single', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = "'";
    r.end   = /'|(?<!\\)$/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strSingle.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // @number literals: @42, @3.14, @-1, @0xFF, @1e3, @10u
  addRule(shared, 'at_number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@-?(?:0[xX][\da-fA-F]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)\w*/.source;
    r.action = action(TokenType.NUMBER);
  });

  // @YES, @NO, @true, @false, @nil, @NULL
  addRule(shared, 'at_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /@(YES|NO|true|false|nil|NULL)\b/.source;
    r.action = action(TokenType.LITERAL);
  });

  // Boxed expressions: only the `@(` opener, the content is lexed normally
  addRule(shared, 'at_boxed', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@\(/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Array literals: only the `@[` opener
  addRule(shared, 'at_array', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@\[/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Dictionary literals: only the `@{` opener
  addRule(shared, 'at_dictionary', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@\{/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Preprocessor directives
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
      'include_next', 'defined', '__has_include', '__has_feature',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // `<Foundation/Foundation.h>` / `"Person.h"` after #import/#include
  addRule(preproc, 'include_path', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=#\s*(?:include|include_next|import)\s*)(?:<[^>]*>|"[^"]*")/.source;
    r.action = action(TokenType.STRING);
  });

  // other string literals in a directive, e.g. `#define MSG @"hi"`
  addRule(preproc, 'preproc_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@?"(?:\\.|[^"\\])*"/.source;
    r.action = action(TokenType.STRING);
  });

  // Numbers: hex/bin -> float (incl. exponent) -> oct -> int. `'` is a
  // digit separator (only between digits); `\w*` covers suffixes.
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX](?:[\da-fA-F]|'(?=[\da-fA-F]))*(?:\.(?:[\da-fA-F]|'(?=[\da-fA-F]))*)?(?:[pP][+-]?\d+)?\w*/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_bin', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[bB](?:[01]|'(?=[01]))+\w*/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:\b\d(?:\d|'(?=\d))*(?:\.(?!\.)(?:\d(?:\d|'(?=\d))*)?(?:[eE][+-]?\d+)?|[eE][+-]?\d+)|\.\d(?:\d|'(?=\d))*(?:[eE][+-]?\d+)?)\w*/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_oct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[0-7]+(?:'[0-7]+)*[uUlL]*\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d(?:\d|'(?=\d))*\w*/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators (longest alternatives first)
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /<=>|->\*|->|\.\*|::|<<=|>>=|<<|>>|\+\+|--|&&|\|\||\.\.\.|[+\-*/%&|^~!<>=]=?|\?|:/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules – common first (method definitions must beat the `-`/`+`
  // operators; template_declaration only fires after a TYPE token, so
  // `<<`/`<=` and plain comparisons still reach the shared operators)
  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Example code
  def.exampleCode = `//  Person.mm
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
}

// Modern C++ inside Objective-C++
namespace app::util {
template<typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

[[nodiscard]] constexpr auto clamp(Numeric auto v, Numeric auto lo, Numeric auto hi) {
    static_assert(sizeof(int) == 4);
    return v < lo ? lo : (v > hi ? hi : v);
}
}

auto order = 1'000'000ULL <=> 0x1.8p3;
std::vector<std::string> names = {"a", "b"};
char32_t letter = 'x';`;
  return def;
}

export function createObjectiveCppLanguageStyles(objcppDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(objcppDef.id, 'Dark+');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
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

  const lightStyle = createHighlightStyle(objcppDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#0000ff'),
    createTokenStyle(TokenType.TYPE,          '#267f99'),
    createTokenStyle(TokenType.IDENTIFIER,    '#001080'),
    createTokenStyle(TokenType.FUNCTION,      '#795e26'),
    createTokenStyle(TokenType.PROPERTY,      '#001080'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.DECORATOR,     '#795e26'), // attribute macros
    createTokenStyle(TokenType.NAMESPACE,     '#267f99'),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(objcppDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.TYPE,          '#e5c07b'),
    createTokenStyle(TokenType.IDENTIFIER,    '#abb2bf'),
    createTokenStyle(TokenType.FUNCTION,      '#61afef'),
    createTokenStyle(TokenType.PROPERTY,      '#e06c75'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.DECORATOR,     '#61afef'), // attribute macros
    createTokenStyle(TokenType.NAMESPACE,     '#e5c07b'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(objcppDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.DECORATOR,     '#a6e22e'), // attribute macros
    createTokenStyle(TokenType.NAMESPACE,     '#66d9ef'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(objcppDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.TYPE,          '#8be9fd', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.DECORATOR,     '#50fa7b'), // attribute macros
    createTokenStyle(TokenType.NAMESPACE,     '#8be9fd'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(objcppDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.TYPE,          '#953800'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.PROPERTY,      '#0550ae'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.DECORATOR,     '#8250df'), // attribute macros
    createTokenStyle(TokenType.NAMESPACE,     '#953800'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}