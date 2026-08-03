// core/documentIO/ElectronDocumentIOAdapter.js
import { DocumentIOAdapter } from './DocumentIOAdapter.js';
import { FILE_EXTENSION_PROJECT, FILE_EXTENSION_PROJECT_CONFIG, PROJECT_NODES_DIR } from '@core/AppMeta.js'


const PROJECT_EXT_NO_DOT = FILE_EXTENSION_PROJECT.replace(/\./g, "");
const CONFIG_FILE = FILE_EXTENSION_PROJECT_CONFIG;
const NODES_DIR = PROJECT_NODES_DIR;

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
      filters: kind === 'file' ? [{ name: 'DocForge Project', extensions: [PROJECT_EXT_NO_DOT] }] : undefined,
    });
    if (result.canceled || !result.filePaths.length) 
        return null;

    const path = result.filePaths[0];
    const data = await this.read(path, kind);
    return { ref: path, kind, data };
  }

  async read(ref, kind) {
    return kind === 'folder' 
        ? this._readFolder(ref) 
        : (await window.electronAPI.readFile(ref)).data;
  }

  async write(ref, kind, data) {
    return kind === 'folder' 
        ? this._writeFolder(ref, data) 
        : (await window.electronAPI.writeFile(ref, data)).ok;
  }

  async pickSaveTarget(kind, suggestedName) {
    if (kind === 'folder') {
      const result = await window.electronAPI.openDialog({ type: 'folder', promptToCreate: true, defaultPath: suggestedName });
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

  async _readFolder(folderPath) {
    const configPath = await window.electronAPI.joinPath(folderPath, CONFIG_FILE);
    const configResult = await window.electronAPI.readFile(configPath);
    if (!configResult.ok) 
        throw new Error(CONFIG_FILE + ' is missing or is inaccessible');
    
    const config = JSON.parse(configResult.data);

    const nodesDirPath = await window.electronAPI.joinPath(folderPath, NODES_DIR);
    const dirResult = await window.electronAPI.readDir(nodesDirPath);
    const nodeContents = {};

    if (dirResult.ok) {
      for (const entry of dirResult.entries) {
        if (entry.isDirectory || !entry.name.endsWith('.md')) 
            continue;
        
        const filePath = await window.electronAPI.joinPath(nodesDirPath, entry.name);
        const fileResult = await window.electronAPI.readFile(filePath);
        if (fileResult.ok) {
          const nodeId = entry.name.replace(/\.md$/, '');
          nodeContents[nodeId] = _splitFrontmatter(fileResult.data).content;
        }
      }
    }

    return JSON.stringify({ ...config, __nodeContents: nodeContents });
  }

  async _writeFolder(folderPath, jsonString) {
    const { __nodeContents, ...config } = JSON.parse(jsonString);

    await window.electronAPI.mkdir(folderPath);
    const nodesDirPath = await window.electronAPI.joinPath(folderPath, NODES_DIR);
    await window.electronAPI.mkdir(nodesDirPath);

    const configPath = await window.electronAPI.joinPath(folderPath, CONFIG_FILE);
    const configOk = (await window.electronAPI.writeFile(configPath, JSON.stringify(config, null, 2))).ok;

    let allOk = configOk;
    const currentNodeIds = new Set(Object.keys(__nodeContents ?? {}));

    for (const [nodeId, content] of Object.entries(__nodeContents ?? {})) {
      const filePath = await window.electronAPI.joinPath(nodesDirPath, `${nodeId}.md`);
      const written = (await window.electronAPI.writeFile(filePath, `---\nid: ${nodeId}\n---\n\n${content}`)).ok;
      allOk = allOk && written;
    }

    // Remove leftover node files that no longer belong to the project (deleted nodes).
    // Re-reads the directory instead of diffing against a previous save state - the
    // current write pass above is always the source of truth for what should exist.
    const cleanupOk = await this._removeOrphanedNodeFiles(nodesDirPath, currentNodeIds);
    allOk = allOk && cleanupOk;

    return allOk;
  }

  /**
   * @brief Deletes every .md file in nodesDirPath whose id is not in currentNodeIds.
   *
   * Must run after the current nodes have already been written, so a node file
   * is never deleted and re-created in the same pass. Missing/empty directories
   * are treated as "nothing to clean up" rather than an error.
   *
   * @param {string} nodesDirPath
   * @param {Set<string>} currentNodeIds
   * @returns {Promise<boolean>}
   */
  async _removeOrphanedNodeFiles(nodesDirPath, currentNodeIds) {
    const dirResult = await window.electronAPI.readDir(nodesDirPath);
    if (!dirResult.ok) 
        return true;

    let allOk = true;

    for (const entry of dirResult.entries) {
      if (entry.isDirectory || !entry.name.endsWith('.md')) 
          continue;

      const nodeId = entry.name.replace(/\.md$/, '');
      if (currentNodeIds.has(nodeId)) 
          continue;

      const filePath = await window.electronAPI.joinPath(nodesDirPath, entry.name);
      const removed = (await window.electronAPI.removePath(filePath)).ok;
      allOk = allOk && removed;
    }

    return allOk;
  }
}