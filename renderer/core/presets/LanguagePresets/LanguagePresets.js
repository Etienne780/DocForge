import { createAssemblyLanguage } from './AssemblyLanguagePreset.js'
import { createCPPLanguage } from './CppLanguagePreset.js'
import { createTestLanguage } from './TestSyntaxDefinitionPreset.js';

export const LANGUAGE_PRESETS = [
  createAssemblyLanguage,
  createCPPLanguage,
  createTestLanguage // needs to be comment out if in release builds
];