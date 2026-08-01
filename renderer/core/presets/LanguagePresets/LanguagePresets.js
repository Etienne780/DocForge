import { createAssemblyLanguage } from './AssemblyLanguagePreset.js'
import { createCPPLanguage } from './CppLanguagePreset.js'
import { createHTMLLanguage } from './HtmlLanguagePreset.js'
import { createXMLLanguage } from './XmlLanguagePreset.js'
import { createCSSLanguage } from './CssLanguagePreset.js'
import { createPHPLanguage } from './PHPLanguagePreset.js'
import { createCSharpLanguage } from './CSharpLanguagePreset.js'
import { createCLanguage } from './CLanguagePreset.js'
import { createBatchLanguage } from './BatchLanguagePreset.js'
import { createPowerShellLanguage } from './PowerShellLanguagePreset.js'
import { createShellLanguage } from './ShellLanguagePreset.js'
import { createJavaScriptLanguage } from './JavaScriptLanguagePreset.js'
import { createTypeScriptLanguage } from './TypeScriptLanguagePreset.js'
import { createLuaLanguage } from './LuaLanguagePreset.js'
import { createJsonLanguage } from './JsonLanguagePreset.js'
import { createPythonLanguage } from './PythonLanguagePreset.js'
import { createRubyLanguage } from './RubyLanguagePreset.js'
import { createGoLanguage } from './GoLanguagePreset.js'
import { createRustLanguage } from './RustLanguagePreset.js'
import { createJavaLanguage } from './JavaLanguagePreset.js'
import { createSqlLanguage } from './SqlLanguagePreset.js'
import { createYamlLanguage } from './YamlLanguagePreset.js'
import { createDockerfileLanguage } from './DockerfileLanguagePreset.js'
import { createOtnLanguage } from './OtnLanguagePreset.js'
import { createBrainfuckLanguage } from './BrainfuckLanguagePreset.js'
import { createIniLanguage } from './IniLanguagePreset.js'
import { createTomlLanguage } from './TomlLanguagePreset.js'
import { createKotlinLanguage } from './KotlinLanguagePreset.js'
import { createSwiftLanguage } from './SwiftLanguagePreset.js'
import { createPerlLanguage } from './PerlLanguagePreset.js'
import { createObjectiveCLanguage } from './ObjectiveCLanguagePreset.js'
import { createObjectiveCppLanguage } from './ObjectiveCppLanguagePreset.js'
import { createGroovyLanguage } from './GroovyLanguagePreset.js'
import { createHolyCLanguage } from './HolyCLanguagePreset.js'
import { createScalaLanguage } from './ScalaLanguagePreset.js'
import { createHaskellLanguage } from './HaskellLanguagePreset.js'
import { createGraphQLLanguage } from './GraphQLLanguagePreset.js'
import { createSassLanguage } from './SassLanguagePreset.js'
import { createLessLanguage } from './LessLanguagePreset.js'
import { createTSqlLanguage } from './TSqlLanguagePreset.js'
import { createPlSqlLanguage } from './PlSqlLanguagePreset.js'
// import { createTestLanguage } from './TestSyntaxDefinitionPreset.js';

export const LANGUAGE_PRESETS = [
  createAssemblyLanguage,
  createCPPLanguage,
  createHTMLLanguage,
  createXMLLanguage,
  createCSSLanguage,
  createPHPLanguage,
  createCSharpLanguage,
  createCLanguage,
  createBatchLanguage,
  createPowerShellLanguage,
  createShellLanguage,
  createJavaScriptLanguage,
  createTypeScriptLanguage,
  createLuaLanguage,
  createJsonLanguage,
  createPythonLanguage,
  createRubyLanguage,
  createGoLanguage,
  createRustLanguage,
  createJavaLanguage,
  createSqlLanguage,
  createYamlLanguage,
  createDockerfileLanguage,
  createOtnLanguage,
  createBrainfuckLanguage,
  createIniLanguage,
  createTomlLanguage,
  createKotlinLanguage,
  createSwiftLanguage,
  createPerlLanguage,
  createObjectiveCLanguage,
  createObjectiveCppLanguage,
  createGroovyLanguage,
  createHolyCLanguage,
  createScalaLanguage,
  createHaskellLanguage,
  createGraphQLLanguage,
  createSassLanguage,
  createLessLanguage,
  createTSqlLanguage,
  createPlSqlLanguage,
  // createTestLanguage // needs to be comment out if in release builds
]; 