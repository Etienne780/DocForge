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
  // createTestLanguage // needs to be comment out if in release builds
]; 