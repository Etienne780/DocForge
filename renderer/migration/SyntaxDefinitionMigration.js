import { createSyntaxDefinition } from '@data/SyntaxDefinitionManager.js';

const migrationSteps = {

};

export function migrateSyntaxDefinition(raw, storedVersion = 0) {
  let def = raw ?? {};
  
  for (const v of Object.keys(migrationSteps).map(Number).sort((a,b) => a - b)) {
    if (storedVersion < v) {
      def = migrationSteps[v](def);
    }
  }

  const defaultDef = createSyntaxDefinition('unknown');
  return { ...defaultDef, ...def, states: Array.isArray(def.states) ? def.states : defaultDef.states };
}