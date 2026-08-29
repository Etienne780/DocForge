import { PROJECT_SCHEMA_VERSION } from '@core/AppMeta.js'
import { unwrapEntity } from '@core/Envelope.js';
import { createProject, createRecentProject } from "@data/ProjectManager.js";
import { migrateProject } from '@migration/ProjectMigration.js';
import { removeUnknownProperties } from '@common/Common.js';

export function migrateRecentProject(raw, storedVersion = 0) {
  let recent = raw ?? [];

  if (!Array.isArray(recent))
    return [];

  const defaultRecent = createRecentProject({});
  for (let i = 0; i < recent.length; i++) {
    const re = recent[i];
    // in web project is stored inside of a recent project
    if (re.project) {
      const proj = unwrapEntity(re.project, migrateProject, PROJECT_SCHEMA_VERSION);
      re.project = proj ?? createProject('unknown');
    }

    const tmp = {
      ...defaultRecent,
      ...re,
    };

    // removes old props or user added ones
    removeUnknownProperties(tmp, defaultRecent);
    recent[i] = tmp;
  }

  return recent;
}