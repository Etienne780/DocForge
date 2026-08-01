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

export function createCSharpLanguage() {
  const def = createSyntaxDefinition('C#');
  def.aliases = ['csharp', 'cs', 'dotnet'];
  def.id = 'CSharpLang';
  def.builtIn = true;
  def.symbolHoisting = true;

  const root = def.states.find(s => s.id === def.rootStateId);

  // Predefined symbols
  const predefined = [
    ['object', TokenType.TYPE],
    ['string', TokenType.TYPE],
    ['bool', TokenType.TYPE],
    ['byte', TokenType.TYPE],
    ['sbyte', TokenType.TYPE],
    ['char', TokenType.TYPE],
    ['short', TokenType.TYPE],
    ['ushort', TokenType.TYPE],
    ['int', TokenType.TYPE],
    ['uint', TokenType.TYPE],
    ['long', TokenType.TYPE],
    ['ulong', TokenType.TYPE],
    ['float', TokenType.TYPE],
    ['double', TokenType.TYPE],
    ['decimal', TokenType.TYPE],
    ['void', TokenType.TYPE],
    ['Array', TokenType.TYPE],
    ['List', TokenType.TYPE],
    ['Dictionary', TokenType.TYPE],
    ['HashSet', TokenType.TYPE],
    ['Queue', TokenType.TYPE],
    ['Stack', TokenType.TYPE],
    ['Exception', TokenType.TYPE],
    ['ArgumentException', TokenType.TYPE],
    ['ArgumentNullException', TokenType.TYPE],
    ['InvalidOperationException', TokenType.TYPE],
    ['NotImplementedException', TokenType.TYPE],
    ['Task', TokenType.TYPE],
    ['ValueTask', TokenType.TYPE],
    ['IEnumerable', TokenType.TYPE],
    ['IList', TokenType.TYPE],
    ['IDictionary', TokenType.TYPE],
    ['ISet', TokenType.TYPE],
    ['ICollection', TokenType.TYPE],
    ['IComparable', TokenType.TYPE],
    ['IEquatable', TokenType.TYPE],
    ['IDisposable', TokenType.TYPE],
    ['IAsyncDisposable', TokenType.TYPE],
    ['IFormattable', TokenType.TYPE],
    ['ISpanFormattable', TokenType.TYPE],
    ['Span', TokenType.TYPE],
    ['ReadOnlySpan', TokenType.TYPE],
    ['Memory', TokenType.TYPE],
    ['ReadOnlyMemory', TokenType.TYPE],
    ['Guid', TokenType.TYPE],
    ['DateTime', TokenType.TYPE],
    ['DateTimeOffset', TokenType.TYPE],
    ['TimeSpan', TokenType.TYPE],
    ['Uri', TokenType.TYPE],
    ['Version', TokenType.TYPE],
    ['Console', TokenType.TYPE],
    ['Math', TokenType.TYPE],
    ['Environment', TokenType.TYPE],
    ['String', TokenType.TYPE],
    ['Int32', TokenType.TYPE],
    ['Int64', TokenType.TYPE],
    ['Double', TokenType.TYPE],
    ['Boolean', TokenType.TYPE],
    ['Char', TokenType.TYPE],
    ['Convert', TokenType.TYPE],
    ['Enumerable', TokenType.TYPE],
    ['Queryable', TokenType.TYPE],
    ['Linq', TokenType.NAMESPACE],
    ['System', TokenType.NAMESPACE],
    ['Collections', TokenType.NAMESPACE],
    ['Generic', TokenType.NAMESPACE],
    ['Threading', TokenType.NAMESPACE],
    ['Tasks', TokenType.NAMESPACE],
    ['IO', TokenType.NAMESPACE],
    ['Text', TokenType.NAMESPACE],
    ['Reflection', TokenType.NAMESPACE],
    ['Diagnostics', TokenType.NAMESPACE],
    ['Security', TokenType.NAMESPACE],
    ['Net', TokenType.NAMESPACE],
    ['Http', TokenType.NAMESPACE],
    ['AspNetCore', TokenType.NAMESPACE],
    ['Mvc', TokenType.NAMESPACE],
    ['Razor', TokenType.NAMESPACE],
    ['Blazor', TokenType.NAMESPACE],
    ['true', TokenType.LITERAL],
    ['false', TokenType.LITERAL],
    ['null', TokenType.LITERAL],
    ['default', TokenType.LITERAL],
  ];
  def.predefinedSymbols = predefined.map(([n, t]) => createPredefinedSymbol(n, t));

  // States
  const shared = newState(def, 'shared_rules');
  const blockComment = newState(def, 'block_comment');
  const xmlDoc = newState(def, 'xml_doc');
  const attribute = newState(def, 'attribute');

  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  xmlDoc.onUnmatched = OnUnmatched.CHARACTER;
  xmlDoc.contentTokenType = TokenType.COMMENT;

  attribute.onUnmatched = OnUnmatched.CHARACTER;

  // Shared rules
  // Single-line comments (// and ///)
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/\/?.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // Block comment /* ... */
  addRule(shared, 'block_comment', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, blockComment.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = blockComment.id;
  });

  // XML doc block /** ... */
  addRule(shared, 'xml_doc_block', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*\*/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, xmlDoc.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = xmlDoc.id;
  });

  // Numbers
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d[\d_]*\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX][0-9a-fA-F_]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_bin', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[bB][01_]+\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d[\d_]*\.\d[\d_]*(?:[eE][+-]?\d+)?[fFdDmM]?/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /->|::|[+\-*/%&|^~!<>]=?|<<|>>|<=|>=|==|!=|&&|\|\||\+\+|--|\.\.\.|\?[\?]?/.source;
    r.action = action(TokenType.OPERATOR);
  });

  // Punctuation
  addRule(shared, 'punctuation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[{}()\[\];,:.]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });

  // Root rules
  // Preprocessor directives
  addRule(root, 'preprocessor', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /^[ \t]*#(?:define|undef|if|elif|else|endif|line|error|warning|region|endregion|pragma|nullable)\b/.source;
    r.action = action(TokenType.KEYWORD);
  });

  // Attributes: [AttributeName(...)]
  // Lookahead ensures `[` is followed by an uppercase letter (attribute naming convention)
  // but does NOT consume the letter – it stays in the content for attr_name to match.
  addRule(root, 'attribute_open', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\[(?=[A-Z])/.source;
    r.end   = /\]/.source;
    r.beginAction = action(TokenType.DECORATOR, createSyntaxStateTransition(TransitionType.PUSH, attribute.id));
    r.endAction   = action(TokenType.DECORATOR, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.OTHER;
    r.innerStateId = attribute.id;
  });

  // Rules inside attribute brackets
  addRule(attribute, 'attr_name', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.TYPE);
  });
  addRule(attribute, 'attr_punct', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[(),]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });
  addRule(attribute, 'attr_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /"(?:[^"\\]|\\.)*"/.source;
    r.action = action(TokenType.STRING);
  });
  addRule(attribute, 'attr_number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.?\d*\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Keywords
  addRule(root, 'keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.pattern = [
      'if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'default',
      'break', 'continue', 'return', 'goto', 'throw', 'try', 'catch', 'finally',
      'class', 'struct', 'interface', 'enum', 'delegate', 'event', 'namespace',
      'using', 'extern', 'partial', 'abstract', 'virtual', 'override', 'sealed',
      'static', 'const', 'readonly', 'volatile', 'unsafe', 'fixed', 'stackalloc',
      'new', 'this', 'base', 'as', 'is', 'typeof', 'sizeof', 'nameof',
      'checked', 'unchecked', 'lock',
      'public', 'private', 'protected', 'internal',
      'var', 'dynamic', 'object', 'string', 'bool', 'byte', 'sbyte', 'char',
      'short', 'ushort', 'int', 'uint', 'long', 'ulong', 'float', 'double', 'decimal', 'void',
      'true', 'false', 'null', 'default', 'operator', 'implicit', 'explicit',
      'params', 'ref', 'out', 'in', 'where', 'join', 'on', 'equals', 'let',
      'orderby', 'ascending', 'descending', 'group', 'by', 'into', 'from', 'select',
      'await', 'async', 'yield', 'nullable', 'enable', 'disable', 'restore',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Type declarations
  addRule(root, 'type_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(class|struct|interface|enum|delegate)\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Namespace declaration
  addRule(root, 'namespace_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(namespace)\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.NAMESPACE,
                         register: createSymbolRegister(TokenType.NAMESPACE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Method declaration
  addRule(root, 'method_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?!(?:class|struct|interface|enum|delegate|namespace|using|public|private|protected|internal|static|virtual|override|abstract|sealed|async)\b)([A-Za-z_]\w*)\s*\(/.source;
    r.context = { notAfterTokenType: [TokenType.KEYWORD] };
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION,
                         register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Using directive
  addRule(root, 'using_directive', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\busing\s+(?:static\s+)?([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*;/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.NAMESPACE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Generic type (e.g., List<int>)
  addRule(root, 'generic_type', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)\s*<(?![=])/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.TYPE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Character literal
  addRule(root, 'char_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /'(?:\\.|[^'\\])'/.source;
    r.action = action(TokenType.STRING);
  });

  // Strings (various forms)
  addRule(root, 'string_normal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /"(?:[^"\\]|\\.)*"/.source;
    r.action = action(TokenType.STRING);
  });
  addRule(root, 'string_verbatim', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@"(?:[^"]|"")*"/.source;
    r.action = action(TokenType.STRING);
  });
  addRule(root, 'string_interp', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$"(?:[^"\\]|\\.)*"/.source;
    r.action = action(TokenType.STRING);
  });
  addRule(root, 'string_interp_verbatim', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\$@"(?:[^"]|"")*"/.source;
    r.action = action(TokenType.STRING);
  });

  // Include shared rules
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Identifier fallback
  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /[A-Za-z_]\w*/.source;
    r.action = action(TokenType.IDENTIFIER);
  });

  // Example code
  def.exampleCode = `using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace MyApp
{
    /// <summary>
    /// Represents a person.
    /// </summary>
    public class Person
    {
        private string _name;

        public Person(string name)
        {
            _name = name ?? throw new ArgumentNullException(nameof(name));
        }

        public string Name => _name;

        public override string ToString() => $"Person: {Name}";

        public void Greet()
        {
            Console.WriteLine($"Hello, {Name}!");
        }
    }

    internal static class Program
    {
        private static async Task Main(string[] args)
        {
            var p = new Person("Alice");
            p.Greet();

            string path = @"C:\\Users\\Public\\Documents";
            string json = $@"{{ ""name"": ""{p.Name}"" }}";
            string regex = "\\d+";

            int[] numbers = { 1, 2, 3 };
            var evens = from n in numbers
                        where n % 2 == 0
                        select n;

            [Obsolete("Use NewMethod instead")]
            static void OldMethod() { }

            string? maybe = null;
            if (maybe is not null)
            {
                Console.WriteLine(maybe.Length);
            }

            await Task.Delay(100);
        }
    }
}
`;

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