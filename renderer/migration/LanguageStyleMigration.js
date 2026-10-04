import { SYNTAX_DEFINITION_SCHEMA_VERSION } from '@core/AppMeta.js';
import { unwrapEntity } from '@core/Envelope.js';
import { createHighlightStyle } from '@data/SyntaxDefinitionManager.js';
import { migrateSyntaxDefinition } from './SyntaxDefinitionMigration.js';

const migrationSteps = {

};

/**
 * Migrates an exported language style package
 * ({ style, refs, language }) to the current schema.
 */
export function migrateLanguageStyle(raw, storedVersion = 0) {
  let pkg = raw ?? {};

  for (const v of Object.keys(migrationSteps).map(Number).sort((a,b) => a - b)) {
    if (storedVersion < v) {
      pkg = migrationSteps[v](pkg);
    }
  }

  const defaultStyle = createHighlightStyle(null, 'unknown');
  const style = pkg.style ?? {};

  return {
    style: {
      ...defaultStyle,
      ...style,
      tokenStyles:      Array.isArray(style.tokenStyles) ? style.tokenStyles : [],
      stateTokenStyles: Array.isArray(style.stateTokenStyles) ? style.stateTokenStyles : [],
      overrides:        Array.isArray(style.overrides) ? style.overrides : [],
    },
    refs: {
      langName: pkg.refs?.langName ?? null,
      states:   pkg.refs?.states ?? {},
      rules:    pkg.refs?.rules ?? {},
    },
    language: pkg.language
      ? unwrapEntity(pkg.language, migrateSyntaxDefinition, SYNTAX_DEFINITION_SCHEMA_VERSION)
      : null,
  };
}
