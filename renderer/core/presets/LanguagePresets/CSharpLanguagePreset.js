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
  const strInterp = newState(def, 'string_interp');
  const strVerbatim = newState(def, 'string_verbatim');
  const strInterpVerbatim = newState(def, 'string_interp_verbatim');
  const strRaw = newState(def, 'string_raw');

  blockComment.onUnmatched = OnUnmatched.CHARACTER;
  blockComment.contentTokenType = TokenType.COMMENT;

  xmlDoc.onUnmatched = OnUnmatched.CHARACTER;
  xmlDoc.contentTokenType = TokenType.COMMENT;

  attribute.onUnmatched = OnUnmatched.CHARACTER;

  // Interpolation hole `{expr}` / `{expr,align:format}`; may contain strings
  const interpolationHole = /\{(?:[^{}"]|"(?:[^"\\]|\\.)*")*\}/.source;

  // $"..." content: escapes, `{{`/`}}`, holes
  strInterp.onUnmatched = OnUnmatched.CHARACTER;
  strInterp.contentTokenType = TokenType.STRING;
  addRule(strInterp, 'escape_sequence', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\\(?:u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|x[0-9a-fA-F]{1,4}|.)|\{\{|\}\}/.source;
    r.action = action(TokenType.ESCAPE);
  });
  addRule(strInterp, 'interpolation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = interpolationHole;
    r.action = action(TokenType.VARIABLE);
  });

  // @"..." content: `""` is an escaped quote
  strVerbatim.onUnmatched = OnUnmatched.CHARACTER;
  strVerbatim.contentTokenType = TokenType.STRING;
  addRule(strVerbatim, 'escaped_quote', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /""/.source;
    r.action = action(TokenType.ESCAPE);
  });

  // $@"..." / @$"..." content
  strInterpVerbatim.onUnmatched = OnUnmatched.CHARACTER;
  strInterpVerbatim.contentTokenType = TokenType.STRING;
  addRule(strInterpVerbatim, 'escaped_quote', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /""|\{\{|\}\}/.source;
    r.action = action(TokenType.ESCAPE);
  });
  addRule(strInterpVerbatim, 'interpolation', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = interpolationHole;
    r.action = action(TokenType.VARIABLE);
  });

  // """...""" content (no escapes)
  strRaw.onUnmatched = OnUnmatched.CHARACTER;
  strRaw.contentTokenType = TokenType.STRING;

  // Shared rules
  // Single-line comments (// and ///)
  addRule(shared, 'line_comment', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\/\/\/?.*/.source;
    r.action = action(TokenType.COMMENT);
  });

  // XML doc block /** ... */ (before 'block_comment', `/**/` is a plain comment)
  addRule(shared, 'xml_doc_block', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\/\*\*(?!\/)/.source;
    r.end   = /\*\//.source;
    r.beginAction = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.PUSH, xmlDoc.id));
    r.endAction   = action(TokenType.COMMENT, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = xmlDoc.id;
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

  // Numbers – order matters: hex -> binary -> float -> int. Floats need a digit
  // after the dot so ranges like `1..5` stay intact.
  addRule(shared, 'number_hex', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[xX][0-9a-fA-F_]+(?:[uU][lL]?|[lL][uU]?)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_bin', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b0[bB][01_]+(?:[uU][lL]?|[lL][uU]?)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_float', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?:\b\d[\d_]*(?:\.\d[\d_]*(?:[eE][+-]?\d[\d_]*)?[fFdDmM]?|[eE][+-]?\d[\d_]*[fFdDmM]?|[fFdDmM])|\B\.\d[\d_]*(?:[eE][+-]?\d[\d_]*)?[fFdDmM]?)(?!\w)/.source;
    r.action = action(TokenType.NUMBER);
  });
  addRule(shared, 'number_int', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d[\d_]*(?:[uU][lL]?|[lL][uU]?)?\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Operators – longest alternatives first
  addRule(shared, 'operators', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = />>>=|<<=|>>=|\?\?=|>>>|=>|\?\?|\?\.|\.\.|->|::|\+\+|--|&&|\|\||<<|>>|[+\-*/%&|^!<>=]=?|[~?]/.source;
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

  // Attributes: [AttributeName(...)], [return: X]
  // Only at the start of a line or right after `(` / `,` (parameter
  // attributes), so indexers like `items[Count - 1]` stay code. Lookahead
  // ensures `[` is followed by an uppercase letter (attribute naming
  // convention) or an attribute target, but does NOT consume it.
  addRule(root, 'attribute_open', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /(?<=^\s*|[(,]\s*)\[(?=[A-Z]|(?:assembly|module|return|field|property|param|method|type|event|typevar)\s*:)/.source;
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
    r.pattern = /[(),.:=|]/.source;
    r.action = action(TokenType.PUNCTUATION);
  });
  addRule(attribute, 'attr_string', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@"(?:[^"]|"")*"|"(?:[^"\\]|\\.)*"/.source;
    r.action = action(TokenType.STRING);
  });
  addRule(attribute, 'attr_number', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b\d+\.?\d*\b/.source;
    r.action = action(TokenType.NUMBER);
  });

  // Character literal
  addRule(root, 'char_literal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /'(?:\\(?:u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|x[0-9a-fA-F]{1,4}|.)|[^'\\])'/.source;
    r.action = action(TokenType.STRING);
  });

  // Strings (various forms) – raw strings first, otherwise `"""` is lexed as
  // an empty string plus an open string.
  // Raw string literal: 3+ quotes, closed by the same number of quotes;
  // optional `$`/`$$`... prefix for interpolated raw strings.
  addRule(root, 'string_raw', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\$*("{3,})/.source;
    r.dynamicEnd = createDynamicEnd(1, '${0}(?!")(?:u8)?');
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strRaw.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strRaw.id;
  });
  addRule(root, 'string_interp_verbatim', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\$@"|@\$"/.source;
    r.end   = /"(?!")/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strInterpVerbatim.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strInterpVerbatim.id;
  });
  addRule(root, 'string_verbatim', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /@"/.source;
    r.end   = /"(?!")/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strVerbatim.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strVerbatim.id;
  });
  // $"..." – single line, an unterminated string ends at EOL
  addRule(root, 'string_interp', r => {
    r.type = RuleType.BEGIN_END;
    r.begin = /\$"/.source;
    r.end   = /"|$/.source;
    r.beginAction = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.PUSH, strInterp.id));
    r.endAction   = action(TokenType.STRING, createSyntaxStateTransition(TransitionType.POP));
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strInterp.id;
  });
  addRule(root, 'string_normal', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /"(?:[^"\\]|\\.)*"(?:u8)?/.source;
    r.action = action(TokenType.STRING);
  });

  // Using directive: `using X.Y;`, `global using static X.Y;`
  // Declaration rules run before 'keywords', otherwise the bare keyword
  // matches first.
  addRule(root, 'using_directive', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(?:(global)\s+)?(using)\s+(?:(static)\s+)?([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(?=\s*;)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['3'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['4'] = { tokenType: TokenType.NAMESPACE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Namespace declaration (block-scoped and file-scoped `namespace A.B;`)
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

  // Type declarations (incl. records and primary constructors) -> TYPE
  addRule(root, 'type_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(record(?:\s+(?:class|struct))?|class|struct|interface|enum)\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE,
                         register: createSymbolRegister(TokenType.TYPE, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // `new Name` – constructor call, color the class name as TYPE
  addRule(root, 'new_expression', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b(new)\s+([A-Za-z_]\w*)/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.KEYWORD, register: null };
    caps.groups['2'] = { tokenType: TokenType.TYPE, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Contextual keywords that are only keywords in a specific position, so
  // they stay usable as identifiers elsewhere.
  addRule(root, 'contextual_keywords', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = [
      /\b(?:get|set|init|add|remove)(?=\s*(?:;|\{|=>))/.source,          // accessors
      /\bglobal(?=\s+using\b|::)/.source,                                 // global using / global::
      /\bwith(?=\s*\{)/.source,                                           // p with { ... }
      /\ballows(?=\s+ref\b)/.source,                                      // allows ref struct
      /\b(?:required|file|scoped)(?=\s+(?!(?:is|as|in|and|or|switch|with)\b)[A-Za-z_@])/.source, // modifiers
    ].join('|');
    r.action = action(TokenType.KEYWORD);
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
      'nint', 'nuint',
      'true', 'false', 'null', 'default', 'operator', 'implicit', 'explicit',
      'params', 'ref', 'out', 'in', 'where', 'join', 'on', 'equals', 'let',
      'orderby', 'ascending', 'descending', 'group', 'by', 'into', 'from', 'select',
      'await', 'async', 'yield', 'nullable', 'enable', 'disable', 'restore',
      'record', 'when', 'not', 'and', 'or', 'notnull', 'unmanaged',
    ];
    r.action = action(TokenType.KEYWORD);
  });

  // Generic content for the two rules below (up to two nesting levels):
  // identifiers, `,`, `.`, `?`, `[]`, whitespace. Excludes comparisons like
  // `a < b && c > d`.
  const genericArgs = /<(?:[\w\s,.?\[\]]|<(?:[\w\s,.?\[\]]|<[\w\s,.?\[\]]*>)*>)*>/.source;

  // Generic method call / declaration: `Get<int>(`
  addRule(root, 'generic_method', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b[A-Za-z_]\\w*(?=\\s*${genericArgs}\\s*\\()`;
    r.action = action(TokenType.FUNCTION);
  });

  // Generic type (e.g., List<int>) – `<` stays an operator
  addRule(root, 'generic_type', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = `\\b[A-Za-z_]\\w*(?=\\s*${genericArgs})`;
    r.action = action(TokenType.TYPE);
  });

  // Method declaration: `<type> Name(` -> registers FUNCTION. Decided by the
  // regex alone (lookbehind), because symbol hoisting pre-scans without
  // token context: a preceding word/`>`/`]`/`?` (return type) is required,
  // and calls after `new`/`return`/`await`/... or constructors after an
  // access modifier are excluded so a class's TYPE symbol is not overwritten.
  addRule(root, 'method_declaration', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /(?<=[\w>\]?]\s+)(?<!\b(?:new|return|await|throw|yield|in|is|as|case|when|else|not|and|or|with|from|select|where|out|ref|params|goto|using|lock|public|private|protected|internal|static|nameof|typeof|sizeof)\s+)\b([A-Za-z_]\w*)(?=\s*\()/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION,
                         register: createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL) };
    a.captures = caps;
    r.action = a;
  });

  // Method call / constructor – FUNCTION without registration
  addRule(root, 'method_call', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /\b([A-Za-z_]\w*)(?=\s*\()/.source;
    const a = createSyntaxRuleAction();
    const caps = createSyntaxCaptureMap();
    caps.groups['1'] = { tokenType: TokenType.FUNCTION, register: null };
    a.captures = caps;
    r.action = a;
  });

  // Include shared rules
  addRule(root, 'include_shared', r => {
    r.type = RuleType.INCLUDE;
    r.includeStateId = shared.id;
  });

  // Identifier fallback (`@class` verbatim identifiers included)
  addRule(root, 'identifier', r => {
    r.type = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern = /@?[A-Za-z_]\w*/.source;
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

            // Records, with-expressions and pattern matching
            var point = new Point(3, 4);
            var moved = point with { X = 10 };
            string size = moved.X switch
            {
                > 100 => "far",
                >= 10 and <= 100 => "near",
                _ => "origin"
            };

            // Raw string literals and collection expressions
            var payload = $$"""
                {"name": "{{p.Name}}", "size": "{{size}}"}
                """;
            List<int> primes = [2, 3, 5, 7];
            double ratio = 2.5e-3;
            long big = 1_000_000L;
            cache ??= new Dictionary<string, int>();
        }

        private static Dictionary<string, int>? cache;
    }

    public record struct Point(int X, int Y);

    public class Options
    {
        public required string Name { get; init; }
    }
}
`;
  return def;
}

export function createCSharpLanguageStyles(csharpDef) {
  // ── Dark ────────────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(csharpDef.id, 'Dark+');
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

  const lightStyle = createHighlightStyle(csharpDef.id, 'Light+');
  lightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#0000ff'),
    createTokenStyle(TokenType.TYPE,          '#267f99'),
    createTokenStyle(TokenType.IDENTIFIER,    '#001080'),
    createTokenStyle(TokenType.VARIABLE,      '#001080'),
    createTokenStyle(TokenType.FUNCTION,      '#795e26'),
    createTokenStyle(TokenType.PARAMETER,     '#001080', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#001080'),
    createTokenStyle(TokenType.OPERATOR,      '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,   '#000000'),
    createTokenStyle(TokenType.NUMBER,        '#098658'),
    createTokenStyle(TokenType.STRING,        '#a31515'),
    createTokenStyle(TokenType.COMMENT,       '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#ee0000'),
    createTokenStyle(TokenType.DECORATOR,     '#af00db'), // attributes [...]
    createTokenStyle(TokenType.NAMESPACE,     '#000000'),
    createTokenStyle(TokenType.LITERAL,       '#0000ff'),
    createTokenStyle(TokenType.OTHER,         '#000000'),
  ];

  const oneDarkStyle = createHighlightStyle(csharpDef.id, 'One Dark');
  oneDarkStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#c678dd'),
    createTokenStyle(TokenType.TYPE,          '#e5c07b'),
    createTokenStyle(TokenType.IDENTIFIER,    '#abb2bf'),
    createTokenStyle(TokenType.VARIABLE,      '#e06c75'),
    createTokenStyle(TokenType.FUNCTION,      '#61afef'),
    createTokenStyle(TokenType.PARAMETER,     '#e06c75', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#e06c75'),
    createTokenStyle(TokenType.OPERATOR,      '#56b6c2'),
    createTokenStyle(TokenType.PUNCTUATION,   '#abb2bf'),
    createTokenStyle(TokenType.NUMBER,        '#d19a66'),
    createTokenStyle(TokenType.STRING,        '#98c379'),
    createTokenStyle(TokenType.COMMENT,       '#7f848e', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,        '#56b6c2'),
    createTokenStyle(TokenType.DECORATOR,     '#c678dd'), // attributes [...]
    createTokenStyle(TokenType.NAMESPACE,     '#abb2bf'),
    createTokenStyle(TokenType.LITERAL,       '#d19a66'),
    createTokenStyle(TokenType.OTHER,         '#abb2bf'),
  ];

  const monokaiStyle = createHighlightStyle(csharpDef.id, 'Monokai');
  monokaiStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#f92672'),
    createTokenStyle(TokenType.TYPE,          '#66d9ef', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#a6e22e'),
    createTokenStyle(TokenType.PARAMETER,     '#fd971f', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#f92672'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#ae81ff'),
    createTokenStyle(TokenType.STRING,        '#e6db74'),
    createTokenStyle(TokenType.COMMENT,       '#88846f'),
    createTokenStyle(TokenType.ESCAPE,        '#ae81ff'),
    createTokenStyle(TokenType.DECORATOR,     '#f92672'), // attributes [...]
    createTokenStyle(TokenType.NAMESPACE,     '#f8f8f2'),
    createTokenStyle(TokenType.LITERAL,       '#ae81ff'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const draculaStyle = createHighlightStyle(csharpDef.id, 'Dracula');
  draculaStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#ff79c6'),
    createTokenStyle(TokenType.TYPE,          '#8be9fd', { italic: true }),
    createTokenStyle(TokenType.IDENTIFIER,    '#f8f8f2'),
    createTokenStyle(TokenType.VARIABLE,      '#f8f8f2'),
    createTokenStyle(TokenType.FUNCTION,      '#50fa7b'),
    createTokenStyle(TokenType.PARAMETER,     '#ffb86c', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,      '#f8f8f2'),
    createTokenStyle(TokenType.OPERATOR,      '#ff79c6'),
    createTokenStyle(TokenType.PUNCTUATION,   '#f8f8f2'),
    createTokenStyle(TokenType.NUMBER,        '#bd93f9'),
    createTokenStyle(TokenType.STRING,        '#f1fa8c'),
    createTokenStyle(TokenType.COMMENT,       '#6272a4'),
    createTokenStyle(TokenType.ESCAPE,        '#ff79c6'),
    createTokenStyle(TokenType.DECORATOR,     '#ff79c6'), // attributes [...]
    createTokenStyle(TokenType.NAMESPACE,     '#f8f8f2'),
    createTokenStyle(TokenType.LITERAL,       '#bd93f9'),
    createTokenStyle(TokenType.OTHER,         '#f8f8f2'),
  ];

  const githubLightStyle = createHighlightStyle(csharpDef.id, 'GitHub Light');
  githubLightStyle.tokenStyles = [
    createTokenStyle(TokenType.KEYWORD,       '#cf222e'),
    createTokenStyle(TokenType.TYPE,          '#953800'),
    createTokenStyle(TokenType.IDENTIFIER,    '#24292f'),
    createTokenStyle(TokenType.VARIABLE,      '#24292f'),
    createTokenStyle(TokenType.FUNCTION,      '#8250df'),
    createTokenStyle(TokenType.PARAMETER,     '#24292f'),
    createTokenStyle(TokenType.PROPERTY,      '#0550ae'),
    createTokenStyle(TokenType.OPERATOR,      '#cf222e'),
    createTokenStyle(TokenType.PUNCTUATION,   '#24292f'),
    createTokenStyle(TokenType.NUMBER,        '#0550ae'),
    createTokenStyle(TokenType.STRING,        '#0a3069'),
    createTokenStyle(TokenType.COMMENT,       '#6e7781'),
    createTokenStyle(TokenType.ESCAPE,        '#116329'),
    createTokenStyle(TokenType.DECORATOR,     '#953800'), // attributes [...]
    createTokenStyle(TokenType.NAMESPACE,     '#24292f'),
    createTokenStyle(TokenType.LITERAL,       '#0550ae'),
    createTokenStyle(TokenType.OTHER,         '#24292f'),
  ];

  return [darkStyle, lightStyle, oneDarkStyle, monokaiStyle, draculaStyle, githubLightStyle];
}