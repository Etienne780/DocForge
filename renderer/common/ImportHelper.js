import { eventBus } from '@core/EventBus.js';
import { createProject, createTab, createNode } from '@data/ProjectManager.js';
import { createDocTheme, addDocTheme  } from '@data/DocThemeManager.js';

export function importProject(jsonObj) {
  const warnings = [];
  
  if(!_validJSONObject(jsonObj)) {
    throw Error('Invalid project structure');
  }

  const projectJSON = jsonObj?.project;
  const themeJSON = jsonObj?.theme;
  
  if(!projectJSON) {
    throw Error('Missing project data');
  }

  const name = projectJSON?.name ?? 'untitled';
  const settings = projectJSON?.settings ?? {};
  
  const { tabs, warnings: tabWarnings } = _importProjectTabs(projectJSON?.tabs ?? []);
  warnings.push(...tabWarnings);

  const project = createProject(name);
  project.tabs = tabs;
  project.settings = settings;

  if(themeJSON) {
    try {
      const theme = importTheme(themeJSON);
      addDocTheme(theme);
      project.docThemeId = theme.id;
    } catch(error) {
      warnings.push('Theme could not be imported, using default');
    }
  }

  if(warnings.length > 0) {
    eventBus.emit('toast:show', { 
      message: `Project imported with ${warnings.length} warning(s)`, 
      type: 'warning',
    });
    console.warn('Import warnings:', warnings);
  }

  return project;
}

function _importProjectTabs(jsonObj) {
  const warnings = [];
  
  if(!Array.isArray(jsonObj)) {
    warnings.push('Tabs data is invalid');
    return { tabs: [], warnings };
  }

  let tabs = [];
  jsonObj.forEach((t, index) => {
    try {
      const name = t?.name ?? `untitled-tab-${index + 1}`;
      const { nodes, warnings: nodeWarnings } = _importProjectNodes(t?.nodes ?? []);
      warnings.push(...nodeWarnings.map(w => `Tab "${name}": ${w}`));

      const tab = createTab(name);
      tab.nodes = nodes;
      tabs.push(tab);
    } catch(error) {
      warnings.push(`Tab at index ${index} could not be imported: ${error.message}`);
    }
  });

  return { tabs, warnings };
}

function _importProjectNodes(jsonObj, path = 'root') {
  const warnings = [];
  
  if(!Array.isArray(jsonObj)) {
    warnings.push(`Invalid nodes data at ${path}`);
    return { nodes: [], warnings };
  }

  let nodes = [];
  jsonObj.forEach((n, index) => {
    const currentPath = `${path}[${index}]`;
    
    if(!_validJSONObject(n)) {
      warnings.push(`Node at ${currentPath} is invalid, skipping`);
      return;
    }
    
    const name = n?.name?.trim() || `untitled-${index + 1}`;
    const content = n?.content ?? '';
    const childrenJSON = n?.children ?? [];
    
    const { nodes: childNodes, warnings: childWarnings } = 
      _importProjectNodes(childrenJSON, `${currentPath}.children`);
    
    warnings.push(...childWarnings.map(w => `Node "${name}": ${w}`));
    
    nodes.push(createNode(name, content, childNodes));
  });

  return { nodes, warnings };
}

export function importTheme(jsonObj) {
  const warnings = [];
  
  if(!_validJSONObject(jsonObj)) {
    throw Error('jlfgksdr');
  }

  const name = jsonObj?.name ?? 'untitled theme';
  const { setting, warnings: mappingWarnings } = _importThemeSetting(jsonObj?.settings ?? {}, name);
  warnings.push(...mappingWarnings);

  let theme = createDocTheme(name);
  theme.settings = setting;

  if(warnings.length > 0) {
    eventBus.emit('toast:show', { 
      message: `Project imported with ${warnings.length} warning(s)`, 
      type: 'warning',
    });
    console.warn('Import warnings:', warnings);
  }

  return theme;
}

function _importThemeSetting(jsonObj, name) {
  const warnings = [];

  if(!_validJSONObject(jsonObj)) {
    warnings.push('Theme data is invalid');
    return { setting: {}, warnings };
  }

  const { entries, warnings: entryWarnings } = _importThemeEntries(jsonObj?.entries ?? [], name);
  const mapping = jsonObj?.mapping ?? {};

  warnings.push(...entryWarnings);
  
  if (typeof mapping !== 'object') {
    warnings.push(`Theme "${name}": mapping data is invalid`);
  }

  const setting = { entries, mapping };
  return { setting, warnings };
}

function _importThemeEntries(jsonObj, themeName) {
  const warnings = [];
  
  if(!Array.isArray(jsonObj)) {
    warnings.push(`Invalid entry data in theme ${themeName}`);
    return { entries: [], warnings };
  }

  let entries = [];
  jsonObj.forEach((e, index) => {
    const entryName = e?.name;
    const value = e?.value;
    const active = e?.active;

    if(!entryName || value === undefined || active === undefined) {
      warnings.push(`Theme '${themeName}' entry at index ${index} is invalid, skipping`);
      return;
    }

    entries.push({ 
      name: entryName, 
      value, 
      active
    });
  });
  
  return { entries, warnings };
}

export function importLang(jsonObj) {
  console.error('Not implemented');
}

function _validJSONObject(jsonObj) {
  return jsonObj && typeof jsonObj === 'object';
}