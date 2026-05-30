import { createCPPLanguage } from './CppLanguagePresets.js'
import { createTestLanguage } from './TestSyntaxDefinitionPreset.js';

export const LANGUAGE_PRESETS = [
  createCPPLanguage,
  createTestLanguage // needs to be comment out if in release builds
];