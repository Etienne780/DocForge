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

export function createObjectiveCLanguage() {
  const def = createSyntaxDefinition('Objective-C');
  def.aliases = ['objc', 'objectivec', 'm', 'h'];
  def.id = 'ObjectiveCLang';
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
    ['nil',           TokenType.LITERAL],
    ['NULL',          TokenType.LITERAL],
    ['YES',           TokenType.LITERAL],
    ['NO',            TokenType.LITERAL],
    ['TRUE',          TokenType.LITERAL],
    ['FALSE',         TokenType.LITERAL],
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
    ['NSLocalizedStringFromTable', TokenType.FUNCTION],
    ['NSLocalizedStringWithDefaultValue', TokenType.FUNCTION],
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

  // String escape sequences
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

  // Double-quoted string content
  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  addRule(strDouble, 'include_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = strEscape.id;
  });

  // @"..." string content
  atString.onUnmatched = OnUnmatched.CHARACTER;
  addRule(atString, 'include_at_escape', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = atStringEscape.id;
  });

  // Block comments
  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  // Preprocessor
  preproc.onUnmatched = OnUnmatched.CHARACTER;

  // Common rules
  // C keywords
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

  // Objective-C @keywords
  addRule(common, 'objc_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@(?:interface|implementation|protocol|end|class|import|property|synthesize|dynamic|public|protected|private|package|selector|encode|synchronized|try|catch|finally|throw|autoreleasepool|available|compatibility_alias|defs)/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Objective-C modifiers
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

  // Method definition (implementation) – captures return type and method name
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

  // Method declaration (in @interface/@protocol) – captures return type, method name without registration
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

  // Function call
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

  // @property declarations
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

  // @class forward declaration
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

  // @protocol forward declaration
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

  // C-style double-quoted strings
  addRule(shared, 'string_double', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = '"';
    r.end   = '"';
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strDouble.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  // Objective-C @"..." string literals
  addRule(shared, 'at_string', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /@"/.source;
    r.end   = /"/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, atString.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = atString.id;
  });

  // @number literals
  addRule(shared, 'at_number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@-?\d+\.?\d*/.source;
    r.action = action(TokenType.NUMBER);
  });

  // @YES, @NO, @true, @false, @nil, @NULL
  addRule(shared, 'at_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /@(YES|NO|true|false|nil|NULL)/.source;
    r.action = action(TokenType.LITERAL);
  });

  // Boxed expressions: @(...)
  addRule(shared, 'at_boxed', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@\([^)]*\)/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Array literals: @[...]
  addRule(shared, 'at_array', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@\[[^\]]*\]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Dictionary literals: @{...}
  addRule(shared, 'at_dictionary', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@\{[^}]*\}/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Selector: @selector(methodName:)
  addRule(shared, 'selector', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@selector\s*\([A-Za-z_:]\w*\)/.source;
    r.action = action(TokenType.FUNCTION);
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
    r.pattern = /[+\-*/%&|^~!<>=]=?|<<|>>|<=|>=|==|!=|&&|\|\||\?|:|=|->|\.\.\./.source;
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
  addRule(root, 'include_common', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = common.id;
  });

  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Example code
  def.exampleCode = `//  Person.h
//  Objective-C example
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// A simple Person class
@interface Person : NSObject

// Properties
@property (nonatomic, copy) NSString *name;
@property (nonatomic, assign) NSInteger age;
@property (nullable, nonatomic, copy) NSString *email;

// Class methods
+ (instancetype)personWithName:(NSString *)name age:(NSInteger)age;

// Instance methods
- (instancetype)initWithName:(NSString *)name age:(NSInteger)age NS_DESIGNATED_INITIALIZER;
- (NSString *)greeting;

@end

NS_ASSUME_NONNULL_END

//
//  Person.m
//  Objective-C example
//

#import "Person.h"

@interface Person ()

@property (nonatomic, strong) NSMutableArray *hobbies;

@end

@implementation Person

+ (instancetype)personWithName:(NSString *)name age:(NSInteger)age {
    return [[self alloc] initWithName:name age:age];
}

- (instancetype)initWithName:(NSString *)name age:(NSInteger)age {
    self = [super init];
    if (self) {
        _name = [name copy];
        _age = age;
        _hobbies = [NSMutableArray array];
    }
    return self;
}

- (NSString *)greeting {
    return [NSString stringWithFormat:@"Hello, my name is %@ and I'm %ld years old.", self.name, (long)self.age];
}

- (void)addHobby:(NSString *)hobby {
    [self.hobbies addObject:hobby];
}

- (NSArray *)allHobbies {
    return [self.hobbies copy];
}

- (NSString *)description {
    return [NSString stringWithFormat:@"<Person: %p, name=%@, age=%ld>", self, self.name, (long)self.age];
}

@end

// MARK: - Main function

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        // Literals
        NSString *greeting = @"Hello, World!";
        NSNumber *number = @42;
        NSNumber *pi = @3.14159;
        NSNumber *yes = @YES;
        NSNumber *no = @NO;

        // Array literal
        NSArray *fruits = @[@"Apple", @"Banana", @"Cherry"];

        // Dictionary literal
        NSDictionary *personDict = @{
            @"name": @"Alice",
            @"age": @30,
            @"email": @"alice@example.com"
        };

        // Boxed expression
        NSNumber *computed = @(10 + 20);

        // Selector
        SEL selector = @selector(greeting);

        // Create person
        Person *person = [Person personWithName:@"Alice" age:30];
        [person addHobby:@"Reading"];
        [person addHobby:@"Hiking"];

        // Log
        NSLog(@"%@", [person greeting]);
        NSLog(@"Hobbies: %@", [person allHobbies]);
        NSLog(@"Person: %@", person);

        // Conditional
        if (person.age >= 18) {
            NSLog(@"Adult");
        } else {
            NSLog(@"Minor");
        }

        // Loop
        for (NSString *fruit in fruits) {
            NSLog(@"Fruit: %@", fruit);
        }

        // For loop (C-style)
        for (int i = 0; i < 5; i++) {
            NSLog(@"i = %d", i);
        }

        // While loop
        int count = 0;
        while (count < 3) {
            NSLog(@"count = %d", count);
            count++;
        }

        // Try-catch
        @try {
            NSArray *empty = @[];
            NSString *first = empty[0];
        } @catch (NSException *exception) {
            NSLog(@"Caught: %@", exception);
        } @finally {
            NSLog(@"Finally block");
        }

        // Blocks
        void (^printBlock)(NSString *) = ^(NSString *text) {
            NSLog(@"Block: %@", text);
        };
        printBlock(@"Hello from block!");

        // GCD
        dispatch_queue_t queue = dispatch_queue_create("com.example.queue", DISPATCH_QUEUE_SERIAL);
        dispatch_async(queue, ^{
            NSLog(@"Async task");
        });

        // C-style function call
        printf("C-style printf\\n");
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