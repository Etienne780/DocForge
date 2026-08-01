import { createAssemblyLanguage } from './AssemblyLanguagePreset.js'
import { createCPPLanguage } from './CppLanguagePreset.js'
import { createHTMLLanguage } from './HtmlLanguagePreset.js'
import { createXMLLanguage } from './XmlLanguagePreset.js'
import { createCSSLanguage } from './CssLanguagePreset.js'
// import { createTestLanguage } from './TestSyntaxDefinitionPreset.js';

export const LANGUAGE_PRESETS = [
  createAssemblyLanguage,
  createCPPLanguage,
  createHTMLLanguage,
  createXMLLanguage,
  createCSSLanguage,
  // createTestLanguage // needs to be comment out if in release builds
];