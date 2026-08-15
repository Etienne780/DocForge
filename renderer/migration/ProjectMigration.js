import {
  createProject,
  createDefaultTab,
  createProjectSettings,
  createProjectSession,
  createNode
} from '@data/ProjectManager.js';
import { migrateTheme } from './ThemeMigration.js';

const migrationSteps = {
  2: (oldProject) => {
    let project = oldProject.project;
    const theme = oldProject?.theme;

    if (theme) {
      const migratedTheme = migrateTheme(theme, 0);

      const settings = {
        isThemePreset: false,
        currentThemeId: migratedTheme.id,
      }

      project = {
        ...project, 
        themes: [migratedTheme], 
        settings: settings ,
      };
    } 

    return project;
  },
  // next file format changes ...
};

export function migrateProject(raw, storedVersion = 0) {
  let project = raw ?? {};

  for (const version of Object.keys(migrationSteps).map(Number).sort((a, b) => a - b)) {
    if (storedVersion < version) {
      project = migrationSteps[version](project);
    }
  }

  const defaultProject = createProject('unknown');
  return {
    ...defaultProject,
    ...project,
    settings: { ...createProjectSettings(), ...project.settings },
    session: createProjectSession(), // allways new session data
    tabs: Array.isArray(project.tabs)
      ? project.tabs.map(migrateTab)
      : [createDefaultTab()],
  };
}

/**
 * Migrates a single tab object to the current schema.
 *
 * The tab is merged with a default tab definition and its nodes
 * are recursively migrated to ensure schema consistency.
 *
 * Behavior:
 * - Missing fields are filled from defaultTab
 * - Nodes are migrated recursively via migrateNode
 * - Invalid or missing node arrays are replaced with an empty array
 *
 * @param {Object} tab - Raw tab data
 * @returns {Object} Migrated tab object
 */
export function migrateTab(tab) {
  const defaultTab = createDefaultTab();

  return {
    ...defaultTab,
    ...tab,
    nodes: Array.isArray(tab.nodes)
      ? tab.nodes.map(node => migrateNode(node))
      : []
  };
}

/**
 * Migrates a node recursively into the current internal node schema.
 *
 * Each node is merged with a default node template and its children
 * are recursively processed to ensure full tree consistency.
 *
 * Behavior:
 * - Missing fields are filled from defaultNode
 * - Children are recursively migrated via migrateNode
 * - Invalid or missing children arrays are replaced with an empty array
 *
 * @param {Object} node - Raw node data
 * @returns {Object} Migrated node object
 */
export function migrateNode(node) {
  const defaultNode = createNode('');

  return {
    ...defaultNode,
    ...node,
    children: Array.isArray(node.children)
      ? node.children.map(child => migrateNode(child))
      : []
  };
}