import { createAssemblyLanguage, createAssemblyLanguageStyles } from './AssemblyLanguagePreset.js'
import { createCPPLanguage, createCPPLanguageStyles } from './CppLanguagePreset.js'
import { createHTMLLanguage, createHTMLLanguageStyles } from './HtmlLanguagePreset.js'
import { createXMLLanguage, createXMLLanguageStyles } from './XmlLanguagePreset.js'
import { createCSSLanguage, createCSSLanguageStyles } from './CssLanguagePreset.js'
import { createPHPLanguage, createPHPLanguageStyles } from './PHPLanguagePreset.js'
import { createCSharpLanguage, createCSharpLanguageStyles } from './CSharpLanguagePreset.js'
import { createCLanguage, createCLanguageStyles } from './CLanguagePreset.js'
import { createBatchLanguage, createBatchLanguageStyles } from './BatchLanguagePreset.js'
import { createPowerShellLanguage, createPowerShellLanguageStyles } from './PowerShellLanguagePreset.js'
import { createShellLanguage, createShellLanguageStyles } from './ShellLanguagePreset.js'
import { createJavaScriptLanguage, createJavaScriptLanguageStyles } from './JavaScriptLanguagePreset.js'
import { createTypeScriptLanguage, createTypeScriptLanguageStyles } from './TypeScriptLanguagePreset.js'
import { createLuaLanguage, createLuaLanguageStyles } from './LuaLanguagePreset.js'
import { createJsonLanguage, createJsonLanguageStyles } from './JsonLanguagePreset.js'
import { createPythonLanguage, createPythonLanguageStyles } from './PythonLanguagePreset.js'
import { createRubyLanguage, createRubyLanguageStyles } from './RubyLanguagePreset.js'
import { createGoLanguage, createGoLanguageStyles } from './GoLanguagePreset.js'
import { createRustLanguage, createRustLanguageStyles } from './RustLanguagePreset.js'
import { createJavaLanguage, createJavaLanguageStyles } from './JavaLanguagePreset.js'
import { createSqlLanguage, createSqlLanguageStyles } from './SqlLanguagePreset.js'
import { createYamlLanguage, createYamlLanguageStyles } from './YamlLanguagePreset.js'
import { createDockerfileLanguage, createDockerfileLanguageStyles } from './DockerfileLanguagePreset.js'
import { createOtnLanguage, createOtnLanguageStyles } from './OtnLanguagePreset.js'
import { createBrainfuckLanguage, createBrainfuckLanguageStyles } from './BrainfuckLanguagePreset.js'
import { createIniLanguage, createIniLanguageStyles } from './IniLanguagePreset.js'
import { createTomlLanguage, createTomlLanguageStyles } from './TomlLanguagePreset.js'
import { createKotlinLanguage, createKotlinLanguageStyles } from './KotlinLanguagePreset.js'
import { createSwiftLanguage, createSwiftLanguageStyles } from './SwiftLanguagePreset.js'
import { createPerlLanguage, createPerlLanguageStyles } from './PerlLanguagePreset.js'
import { createObjectiveCLanguage, createObjectiveCLanguageStyles } from './ObjectiveCLanguagePreset.js'
import { createObjectiveCppLanguage, createObjectiveCppLanguageStyles } from './ObjectiveCppLanguagePreset.js'
import { createGroovyLanguage, createGroovyLanguageStyle } from './GroovyLanguagePreset.js'
import { createHolyCLanguage, createHolyCLanguageStyles } from './HolyCLanguagePreset.js'
import { createScalaLanguage, createScalaLanguageStyles } from './ScalaLanguagePreset.js'
import { createHaskellLanguage, createHaskellLanguageStyles } from './HaskellLanguagePreset.js'
import { createGraphQLLanguage, createGraphQLLanguageStyles } from './GraphQLLanguagePreset.js'
import { createSassLanguage, createSassLanguageStyles } from './SassLanguagePreset.js'
import { createLessLanguage, createLessLanguageStyles } from './LessLanguagePreset.js'
import { createTSqlLanguage, createTSqlLanguageStyles } from './TSqlLanguagePreset.js'
import { createPlSqlLanguage, createPlSqlLanguageStyles } from './PlSqlLanguagePreset.js'
// import { createTestLanguage, createTestLanguageStyles } from './TestSyntaxDefinitionPreset.js';

function createPreset(lang, style) {
  return { createLanguage: lang, createStyles: style };
}

export const LANGUAGE_PRESETS = [
  createPreset(createAssemblyLanguage, createAssemblyLanguageStyles),
  createPreset(createCPPLanguage, createCPPLanguageStyles),
  createPreset(createHTMLLanguage, createHTMLLanguageStyles),
  createPreset(createXMLLanguage, createXMLLanguageStyles),
  createPreset(createCSSLanguage, createCSSLanguageStyles),
  createPreset(createPHPLanguage, createPHPLanguageStyles),
  createPreset(createCSharpLanguage, createCSharpLanguageStyles),
  createPreset(createCLanguage, createCLanguageStyles),
  createPreset(createBatchLanguage, createBatchLanguageStyles),
  createPreset(createPowerShellLanguage, createPowerShellLanguageStyles),
  createPreset(createShellLanguage, createShellLanguageStyles),
  createPreset(createJavaScriptLanguage, createJavaScriptLanguageStyles),
  createPreset(createTypeScriptLanguage, createTypeScriptLanguageStyles),
  createPreset(createLuaLanguage, createLuaLanguageStyles),
  createPreset(createJsonLanguage, createJsonLanguageStyles),
  createPreset(createPythonLanguage, createPythonLanguageStyles),
  createPreset(createRubyLanguage, createRubyLanguageStyles),
  createPreset(createGoLanguage, createGoLanguageStyles),
  createPreset(createRustLanguage, createRustLanguageStyles),
  createPreset(createJavaLanguage, createJavaLanguageStyles),
  createPreset(createSqlLanguage, createSqlLanguageStyles),
  createPreset(createYamlLanguage, createYamlLanguageStyles),
  createPreset(createDockerfileLanguage, createDockerfileLanguageStyles),
  createPreset(createOtnLanguage, createOtnLanguageStyles),
  createPreset(createBrainfuckLanguage, createBrainfuckLanguageStyles),
  createPreset(createIniLanguage, createIniLanguageStyles),
  createPreset(createTomlLanguage, createTomlLanguageStyles),
  createPreset(createKotlinLanguage, createKotlinLanguageStyles),
  createPreset(createSwiftLanguage, createSwiftLanguageStyles),
  createPreset(createPerlLanguage, createPerlLanguageStyles),
  createPreset(createObjectiveCLanguage, createObjectiveCLanguageStyles),
  createPreset(createObjectiveCppLanguage, createObjectiveCppLanguageStyles),
  createPreset(createGroovyLanguage, createGroovyLanguageStyle),
  createPreset(createHolyCLanguage, createHolyCLanguageStyles),
  createPreset(createScalaLanguage, createScalaLanguageStyles),
  createPreset(createHaskellLanguage, createHaskellLanguageStyles),
  createPreset(createGraphQLLanguage, createGraphQLLanguageStyles),
  createPreset(createSassLanguage, createSassLanguageStyles),
  createPreset(createLessLanguage, createLessLanguageStyles),
  createPreset(createTSqlLanguage, createTSqlLanguageStyles),
  createPreset(createPlSqlLanguage, createPlSqlLanguageStyles),
  // createPreset(createTestLanguage, createTestLanguageStyles), // needs to be comment out if in release builds
]; 