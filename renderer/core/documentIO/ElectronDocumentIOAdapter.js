// core/documentIO/ElectronDocumentIOAdapter.js
import { DocumentIOAdapter } from './DocumentIOAdapter.js';
import {
  FILE_EXTENSION_PROJECT,
  FILE_EXTENSION_PROJECT_CONFIG,
  FILE_EXTENSION_SYNTAXDEFINITION,
  PROJECT_THEME_FILE,
  PROJECT_LANGUAGES_DIR,
  PROJECT_TABS_DIR,
  RECENT_PROJECT_SOURCE_TYPE_FILE,
  RECENT_PROJECT_SOURCE_TYPE_FOLDER,
} from '@core/AppMeta.js'


const PROJECT_EXT_NO_DOT = FILE_EXTENSION_PROJECT.replace(/\./g, "");
const CONFIG_FILE = FILE_EXTENSION_PROJECT_CONFIG;
const THEME_FILE = PROJECT_THEME_FILE;
const LANGUAGES_DIR = PROJECT_LANGUAGES_DIR;
const TABS_DIR = PROJECT_TABS_DIR;
const LANG_EXT = FILE_EXTENSION_SYNTAXDEFINITION;

// See @core/AppMeta.js for the full on-disk layout of a 'folder' project.
export class ElectronDocumentIOAdapter extends DocumentIOAdapter {
  supportsLiveSave() { 
    return true;
  }
  supportsFolders()  { 
    return true;
  }

  async open(kind) {
    const result = await window.electronAPI.openDialog({
      type: kind,
      filters: kind === RECENT_PROJECT_SOURCE_TYPE_FILE ? [{ name: 'DocForge Project', extensions: [PROJECT_EXT_NO_DOT] }] : undefined,
    });
    if (result.canceled || !result.filePaths.length) 
        return null;

    const path = result.filePaths[0];
    const data = await this.read(path, kind);
    return { ref: path, kind, data };
  }

  async read(ref, kind) {
    return kind === RECENT_PROJECT_SOURCE_TYPE_FOLDER 
        ? this._readFolder(ref) 
        : (await window.electronAPI.readFile(ref)).data;
  }

  async write(ref, kind, data) {
    return kind === RECENT_PROJECT_SOURCE_TYPE_FOLDER 
        ? this._writeFolder(ref, data) 
        : (await window.electronAPI.writeFile(ref, data)).ok;
  }

  async pickSaveTarget(kind, suggestedName) {
    if (kind === RECENT_PROJECT_SOURCE_TYPE_FOLDER) {
      const result = await window.electronAPI.openDialog({ type: RECENT_PROJECT_SOURCE_TYPE_FOLDER, promptToCreate: true, defaultPath: suggestedName });
      if (result.canceled || !result.filePaths.length) 
        return null;
      
      const folderPath = await window.electronAPI.joinPath(result.filePaths[0], suggestedName);
      await window.electronAPI.mkdir(folderPath);
      return folderPath;
    }

    const result = await window.electronAPI.saveDialog({
      defaultPath: `${suggestedName}.dfproj`,
      filters: [{ name: 'DocForge Project', extensions: [PROJECT_EXT_NO_DOT] }],
    });
    return result.canceled ? null : result.filePath;
  }

  // ─── Folder read ────────────────────────────────────────────────────────
  //
  // Returns a JSON string shaped like:
  //   {
  //     project: { name, settings, tabs: [{ id, name, folderName, nodes: [{id,name,fileName,children}] }] },
  //     theme:     <DocTheme object> | null,
  //     languages: [<SyntaxDefinition object>, ...],
  //     __nodeContents: { [folderName]: { [fileName]: { name, content, id } } }
  //   }
  //
  // `project.tabs` here is only the hierarchy/names known from the config file -
  // it is reconciled against what's actually on disk under tabs/ (incl. unknown
  // tab folders and node files not referenced anywhere) by
  // DocumentManager._reconcileFolderProject.
  async _readFolder(folderPath) {
    const configPath = await window.electronAPI.joinPath(folderPath, CONFIG_FILE);
    const configResult = await window.electronAPI.readFile(configPath);
    if (!configResult.ok) 
        throw new Error(CONFIG_FILE + ' is missing or is inaccessible');
    
    const config = JSON.parse(configResult.data);

    const theme = await this._readTheme(folderPath);
    const languages = await this._readLanguages(folderPath);
    const __nodeContents = await this._readAllTabFolders(folderPath);

    return JSON.stringify({ project: config, theme, languages, __nodeContents });
  }

  async _readTheme(folderPath) {
    const themePath = await window.electronAPI.joinPath(folderPath, THEME_FILE);
    const themeResult = await window.electronAPI.readFile(themePath);
    if (!themeResult.ok) 
        return null;

    try {
      return JSON.parse(themeResult.data);
    } catch {
      return null;
    }
  }

  async _readLanguages(folderPath) {
    const languagesDirPath = await window.electronAPI.joinPath(folderPath, LANGUAGES_DIR);
    const dirResult = await window.electronAPI.readDir(languagesDirPath);
    if (!dirResult.ok) 
        return [];

    const languages = [];
    for (const entry of dirResult.entries) {
      if (entry.isDirectory || !entry.name.endsWith(LANG_EXT)) 
          continue;

      const filePath = await window.electronAPI.joinPath(languagesDirPath, entry.name);
      const fileResult = await window.electronAPI.readFile(filePath);
      if (!fileResult.ok) 
          continue;

      try {
        languages.push(JSON.parse(fileResult.data));
      } catch {
        // skip unreadable/corrupt language file rather than fail the whole load
      }
    }
    return languages;
  }

  /**
   * Reads every tab folder present under `tabs/` and returns a flat
   * { [folderName]: { [fileName]: { name, content, id } } } map. `folderName`
   * is used as the tab name by the caller when it doesn't match any tab
   * already known from the config file - that's how a manually created
   * folder becomes a new tab.
   */
  async _readAllTabFolders(folderPath) {
    const tabsDirPath = await window.electronAPI.joinPath(folderPath, TABS_DIR);
    const tabsDirResult = await window.electronAPI.readDir(tabsDirPath);
    if (!tabsDirResult.ok) return {};

    const nodeContents = {};

    for (const entry of tabsDirResult.entries) {
      if (!entry.isDirectory) 
        continue;

      const tabDirPath = await window.electronAPI.joinPath(tabsDirPath, entry.name);
      const dirResult = await window.electronAPI.readDir(tabDirPath);
      if (!dirResult.ok) 
        continue;

      const tabNodeContents = {};
      for (const fileEntry of dirResult.entries) {
        if (fileEntry.isDirectory || !fileEntry.name.endsWith('.md'))
          continue;

        const filePath = await window.electronAPI.joinPath(tabDirPath, fileEntry.name);
        const fileResult = await window.electronAPI.readFile(filePath);
        if (!fileResult.ok)
          continue;

        const fileName = fileEntry.name.replace(/\.md$/, '');
        const { frontmatter, content } = _splitFrontmatter(fileResult.data);
        const id = frontmatter.id || fileName;
        const name = frontmatter.name || fileName;
        tabNodeContents[fileName] = { name, content, id };
      }

      nodeContents[entry.name] = tabNodeContents;
    }

    return nodeContents;
  }

  // ─── Folder write ───────────────────────────────────────────────────────

  async _writeFolder(folderPath, jsonString) {
    const { project, theme, languages, __nodeContents, __deletedTabFolders, __deletedNodeFiles } = JSON.parse(jsonString);

    await window.electronAPI.mkdir(folderPath);

    const configPath = await window.electronAPI.joinPath(folderPath, CONFIG_FILE);
    let allOk = (await window.electronAPI.writeFile(configPath, JSON.stringify(project, null, 2))).ok;

    allOk = await this._writeTheme(folderPath, theme) && allOk;
    allOk = await this._writeLanguages(folderPath, languages ?? []) && allOk;
    // Explicit deletes run before the regular write/orphan-diff below, so a
    // tab/node that got renamed to reuse a just-deleted name still ends up
    // correct: the old content is removed first, then the new content for
    // that name is (re)written fresh by _writeTabFolders.
    allOk = await this._deleteExplicit(folderPath, __deletedTabFolders ?? [], __deletedNodeFiles ?? []) && allOk;
    allOk = await this._writeTabFolders(folderPath, project.tabs ?? [], __nodeContents ?? {}) && allOk;

    return allOk;
  }

  /**
   * @brief Explicitly deletes tab folders/node files that DocumentManager
   * tracked as removed (project.session.deletedTabIds/deletedNodeIds), in
   * addition to the regular orphan-diff cleanup in _writeTabFolders.
   *
   * This exists because a tab/node's folderName/fileName is only known for
   * certain at the moment it's deleted (it's recomputed from `name` on every
   * save) - tracking it explicitly at delete time is more robust than only
   * ever relying on "not present in the current tabs list" at the next save.
   *
   * @param {string} folderPath
   * @param {string[]} deletedTabFolders - tab folder names to remove entirely.
   * @param {{tabFolderName: string, fileName: string}[]} deletedNodeFiles
   * @returns {Promise<boolean>}
   */
  async _deleteExplicit(folderPath, deletedTabFolders, deletedNodeFiles) {
    const tabsDirPath = await window.electronAPI.joinPath(folderPath, TABS_DIR);
    let allOk = true;
  
    for (const folderName of deletedTabFolders) {
      if (!folderName)
        continue;
      const tabDirPath = await window.electronAPI.joinPath(tabsDirPath, folderName);
      allOk = (await window.electronAPI.removePath(tabDirPath, { recursive: true })).ok && allOk;
    }
  
    for (const entry of deletedNodeFiles) {
      const { tabFolderName, fileName } = entry ?? {};
      if (!tabFolderName || !fileName)
        continue;
      const tabDirPath = await window.electronAPI.joinPath(tabsDirPath, tabFolderName);
      const filePath = await window.electronAPI.joinPath(tabDirPath, `${fileName}.md`);
      allOk = (await window.electronAPI.removePath(filePath)).ok && allOk;
    }
  
    return allOk;
  }

  async _writeTheme(folderPath, theme) {
    const themePath = await window.electronAPI.joinPath(folderPath, THEME_FILE);

    if (!theme) {
      // No theme (anymore) - remove a stale file left over from a previous save.
      await window.electronAPI.removePath(themePath);
      return true;
    }

    return (await window.electronAPI.writeFile(themePath, JSON.stringify(theme, null, 2))).ok;
  }

  async _writeLanguages(folderPath, languages) {
    const languagesDirPath = await window.electronAPI.joinPath(folderPath, LANGUAGES_DIR);
    const currentLangIds = new Set(languages.map(lang => lang.id));

    let allOk = true;
    if (languages.length) {
      await window.electronAPI.mkdir(languagesDirPath);
      for (const lang of languages) {
        const langPath = await window.electronAPI.joinPath(languagesDirPath, `${lang.id}${LANG_EXT}`);
        const written = (await window.electronAPI.writeFile(langPath, JSON.stringify(lang, null, 2))).ok;
        allOk = allOk && written;
      }
    }

    // Remove language files that no longer belong to the project, same
    // reconcile-by-rewrite approach as node file cleanup below.
    allOk = await this._removeOrphanedFiles(languagesDirPath, currentLangIds, LANG_EXT) && allOk;
    return allOk;
  }

  async _writeTabFolders(folderPath, tabs, nodeContentsByTab) {
    const tabsDirPath = await window.electronAPI.joinPath(folderPath, TABS_DIR);
    await window.electronAPI.mkdir(tabsDirPath);

    let allOk = true;
    const currentFolderNames = new Set(tabs.map(tab => tab.folderName));

    for (const tab of tabs) {
      const tabDirPath = await window.electronAPI.joinPath(tabsDirPath, tab.folderName);
      await window.electronAPI.mkdir(tabDirPath);

      const tabNodeContents = nodeContentsByTab[tab.folderName] ?? {};
      const currentFileNames = new Set(Object.keys(tabNodeContents));

      for (const [fileName, { name, content, id }] of Object.entries(tabNodeContents)) {
        const filePath = await window.electronAPI.joinPath(tabDirPath, `${fileName}.md`);
        const written = (await window.electronAPI.writeFile(filePath, _buildFrontmatter(id, name, content))).ok;
        allOk = allOk && written;
      }

      allOk = await this._removeOrphanedFiles(tabDirPath, currentFileNames, '.md') && allOk;
    }

    allOk = await this._removeOrphanedTabFolders(tabsDirPath, currentFolderNames) && allOk;
    return allOk;
  }

  /**
   * @brief Deletes every file matching `extension` in `dirPath` whose fileName
   * (without extension) is not in `currentFileName`.
   *
   * Must run after the current files have already been written, so a file is
   * never deleted and re-created in the same pass. Missing/empty directories
   * are treated as "nothing to clean up" rather than an error.
   *
   * @param {string} dirPath
   * @param {Set<string>} currentFileNames
   * @param {string} extension - e.g. '.md', '.dflang' (with leading dot)
   * @returns {Promise<boolean>}
   */
  async _removeOrphanedFiles(dirPath, currentFileNames, extension) {
    const dirResult = await window.electronAPI.readDir(dirPath);
    if (!dirResult.ok) 
        return true;

    let allOk = true;

    for (const entry of dirResult.entries) {
      if (entry.isDirectory || !entry.name.endsWith(extension)) 
          continue;

      const id = entry.name.slice(0, -extension.length);
      if (currentFileNames.has(id)) 
          continue;

      const filePath = await window.electronAPI.joinPath(dirPath, entry.name);
      const removed = (await window.electronAPI.removePath(filePath)).ok;
      allOk = allOk && removed;
    }

    return allOk;
  }

  /**
   * @brief Deletes every subfolder of `tabsDirPath` whose name is not in `currentTabNames`.
   *
   * @param {string} tabsDirPath
   * @param {Set<string>} currentTabNames
   * @returns {Promise<boolean>}
   */
  async _removeOrphanedTabFolders(tabsDirPath, currentTabNames) {
    const dirResult = await window.electronAPI.readDir(tabsDirPath);
    if (!dirResult.ok) 
      return true;

    let allOk = true;

    for (const entry of dirResult.entries) {
      if (!entry.isDirectory) 
        continue;

      if (currentTabNames.has(entry.name)) 
        continue;

      const tabDirPath = await window.electronAPI.joinPath(tabsDirPath, entry.name);
      const removed = (await window.electronAPI.removePath(tabDirPath)).ok;
      allOk = allOk && removed;
    }

    return allOk;
  }
}

// ─── Node file frontmatter helpers ─────────────────────────────────────────
//
// Node files store `id` and `name` in a small YAML-ish frontmatter block so
// a node's identity/display name survives even when it isn't referenced by
// the config file's node tree (see the orphan-node handling in
// DocumentManager._reconcileFolderProject).

function _buildFrontmatter(id, name, content) {
  return `---\nid: ${id}\nname: ${_escapeFrontmatterValue(name)}\n---\n\n${content}`;
}

function _escapeFrontmatterValue(value) {
  return String(value ?? '').replace(/\r?\n/g, ' ');
}

function _splitFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw ?? '');
  if (!match) 
    return { frontmatter: {}, content: raw ?? '' };

  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) 
      continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) 
      frontmatter[key] = value;
  }

  return { frontmatter, content: match[2].replace(/^\r?\n/, '') };
}