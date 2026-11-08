import common from './common.js';
import preferences from './preferences.js';
import titlebar from './titlebar.js';
import appTheme from './appTheme.js';
import hotkeys from './hotkeys.js';
import backup from './backup.js';
import projectModals from './projectModals.js';
import appModals from './appModals.js';
import exportModals from './exportModals.js';
import importModals from './importModals.js';
import hub from './hub.js';
import editor from './editor.js';
import find from './find.js';
import structure from './structure.js';
import editorTools from './editorTools.js';
import sidebar from './sidebar.js';
import links from './links.js';
import appearance from './appearance.js';
import themeEditor from './themeEditor.js';
import data from './data.js';

/**
 * All texts of the app UI. One file per area, the file name is the first part of the key
 * ('preferences.title' is `title` in preferences.js). Format: see core/i18n/I18n.js
 */
export const strings = {
  common,
  preferences,
  titlebar,
  appTheme,
  hotkeys,
  backup,
  projectModals,
  appModals,
  exportModals,
  importModals,
  hub,
  editor,
  find,
  structure,
  editorTools,
  sidebar,
  links,
  appearance,
  themeEditor,
  data,
};
