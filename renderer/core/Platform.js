import { blobManager } from '@core/BlobManager.js';

export const PLATFORM_WIN = 'win';
export const PLATFORM_LINUX = 'linux';
export const PLATFORM_MAC_OS = 'macOS';
export const PLATFORM_WEB = 'web';

/**
 * Returns the current platform as a string.
 * @returns {string} 'win', 'linux', 'macOS', 'web', 'unknown'.
 */
export function getPlatform() {
  if (window.electronAPI)
    return window.electronAPI.getPlatform();

  return PLATFORM_WEB;
}

/**
 * Returns the current platform detected from the web browser environment.
 *
 * This function is used when running outside of the Electron desktop app,
 * where the platform information is not available through the Electron API.
 *
 * @returns {string} 'win', 'linux', 'macOS', 'web' or null when no in web.
 */
export function getWebPlatform() {
  if (getPlatform() !== PLATFORM_WEB)
    return null;

  const platform = navigator.platform.toLowerCase();

  if (platform.includes('win'))
    return PLATFORM_WIN;
  
  if (platform.includes('mac'))
    return PLATFORM_MAC_OS;
  
  if (platform.includes('linux'))
    return PLATFORM_LINUX;
  
  return PLATFORM_WEB;
}

/**
 * Checks if a given string is a valid platform. (use the PLATFORM constants for better compatibility)
 * @param {string} platform - The platform string to check.
 * @returns {boolean} True if the platform is one of 'win', 'linux', 'macOS', or 'web'.
 */
export function isPlatform(platform) {
  return platform === PLATFORM_WIN || platform === PLATFORM_LINUX || 
    platform === PLATFORM_MAC_OS || platform === PLATFORM_WEB;
}

/**
 * Checks if the current platform is 'web'/PLATFORM_WEB.
 * @returns {boolean} True if the platform is 'web'/PLATFORM_WEB.
 */
export function isPlatformWeb() {
  return getPlatform() === PLATFORM_WEB;
}

/**
 * Checks if the current platform is 'macOS'.
 * @returns {boolean} True if the platform is 'macOS'.
 */
export function isPlatformMacOS() {
  return getPlatform() === PLATFORM_MAC_OS;
}

/**
 * Determines if the current platform matches a platform specification string.
 * Supports multiple platforms separated by spaces and negation with '!'.
 * Use isPlatform internally to validate the given platform.
 * 
 * Examples:
 *  - "win linux"   -> matches only if platform is 'win' or 'linux'
 *  - "!win linux"  -> matches if platform is not 'win' but is 'linux'
 *  - "!macOS !web" -> matches if platform is neither 'macOS' nor 'web'
 *  - "any" or ""   -> always matches
 *
 * @param {string} itemPlat - Platform specification string.
 * @returns {boolean} True if the current platform matches the specification.
 */
export function isPlatformMatch(itemPlat) {
  if (!itemPlat || itemPlat === 'any')
    return true;

  const plat = getPlatform();
  const items = itemPlat.split(' ');

  return items.some(i => {
    const negation = i.startsWith('!');
    const platform = i.slice(negation ? 1 : 0);

    if (!isPlatform(platform)) {
      console.log(`Invalid platform '${platform}' skipped in 'isPlatformMatch'`);
      return false;
    }

    return negation ? plat !== platform : plat === platform;
  });
}

/**
 * Toggles the developer tools panel in an Electron environment.
 */
export function toggleDeveloperTools() {
  if (window.electronAPI)
    window.electronAPI.toggleDevTools();
}

/**
 * @brief Determines whether the current runtime is in development mode.
 *
 * This function provides a unified way to detect development mode across
 * different environments:
 *
 * - **Vite (Renderer / Browser)**:
 *   Uses `import.meta.env.DEV`, which is statically replaced at build time
 *   by the Vite bundler.
 *
 * - **Node.js / Electron (Fallback)**:
 *   Falls back to `process.env.NODE_ENV === 'development'` when Vite-specific
 *   environment variables are not available.
 *
 * If neither environment indicator is present, the function safely defaults
 * to `false`.
 *
 * @return {boolean} `true` if running in development mode, otherwise `false`.
 */
export function isDevelopment() {
  // Vite environment (renderer / browser)
  if(typeof import.meta !== 'undefined' && import.meta.env) {
    return !!import.meta.env.DEV;
  }

  // Node / Electron fallback
  if(typeof process !== 'undefined') {
    return process.env.NODE_ENV === 'development';
  }

  return false;
}

export async function onAppClose(callback) {
  if(window.electronAPI) {
    window.electronAPI.onBeforeClose(async () => {
      callback();
    });
    return;
  }

  _displayNotSupportedInWebWarn('onAppClose');
}


export function confirmAppSaveComplete() {
  if(window.electronAPI) {
    window.electronAPI.confirmSaveComplete();
    return;
  }

  _displayNotSupportedInWebWarn('onAppClose');
}

/**
 * Opens a file picker and returns the file content.
 *
 * @param {string[]} extensions Allowed extensions (e.g. ['json']). Use ['*'] for all files.
 *
 * @returns {Promise<{ canceled: boolean, data: string|null, fileName?: string, filePath?: string, filePaths?: string[], extension?: string }>}
 */
export async function pickImportFile(extensions = ['*']) {
  const getExtension = (fileName) => {
    const index = fileName.lastIndexOf('.');
    return index !== -1 ? fileName.substring(index + 1) : '';
  };

  const buildResult = (filePath, fileName, data) => {
    return {
      canceled: false,
      data,
      fileName,
      filePath,
      extension: getExtension(fileName)
    };
  };

  // Electron
  if (!isPlatformWeb() && window.electronAPI?.openDialog) {
    const result = await window.electronAPI.openDialog({
      type: 'file',
      multiselect: false,
      filters: extensions[0] === '*'
        ? undefined
        : [{ name: 'Allowed files', extensions }]
    });

    if (result.canceled || !result.filePaths.length) {
      return { canceled: true, data: null };
    }

    const filePaths = result.filePaths;
    const filePath = filePaths[0];

    const loadedData = await window.electronAPI.readFile(filePath);
    if (!loadedData.ok) {
      return { canceled: false, data: null, error: 'Failed to read file' };
    }

    const fileContent = loadedData.data;

    let data;
    if (typeof fileContent === 'string') {
      data = fileContent;
    } else if (fileContent instanceof ArrayBuffer) {
      data = new TextDecoder('utf-8').decode(fileContent);
    } else if (typeof fileContent === 'object' && fileContent !== null) {
      data = JSON.stringify(fileContent);
    } else {
      data = null;
    }

    const fileName = filePath.split(/[\\/]/).pop();

    return buildResult(filePath, fileName, data);
  }

  // Web
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';

    if (extensions[0] !== '*') {
      input.accept = extensions.map(ext => `.${ext}`).join(',');
    }

    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file) {
        resolve({ canceled: true, data: null });
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      const text = new TextDecoder('utf-8').decode(arrayBuffer);

      resolve(buildResult(null, file.name, text));
    };

    input.click();
  });
}

/**
 * Opens a folder picker and returns the selected folder's path.
 *
 * Desktop only - there is no reliable, permission-free directory picker in
 * the web build, so this resolves with `canceled: true` there (same pattern
 * as openFolder/showInFolder below). Unlike pickImportFile this does NOT read
 * any content - a folder project has to be read via the structured
 * documentIO folder reader (see `readFolderProjectData` in
 * @core/DocumentManager.js), not a flat file read.
 *
 * @returns {Promise<{ canceled: boolean, filePath: string|null }>}
 */
export async function pickImportFolder() {
  if (!isPlatformWeb() && window.electronAPI?.openDialog) {
    const result = await window.electronAPI.openDialog({
      type: 'folder',
      multiselect: false,
    });

    if (result.canceled || !result.filePaths.length) {
      return { canceled: true, filePath: null };
    }

    return { canceled: false, filePath: result.filePaths[0] };
  }

  _displayNotSupportedInWebWarn('pickImportFolder');
  return { canceled: true, filePath: null };
}

 /**
  * Opens the native file save dialog (if supported) and writes the provided content
  * to the selected file location. Falls back to Blob-based download if the File System
  * Access API is not available or the user cancels the dialog.
  *
  * @param {BlobPart} content - The data to be written to the file (string, Blob, or ArrayBuffer).
  * @param {string} fileName - Base file name without extension.
  * @param {string} extension - File extension including dot (e.g. ".json").
  * @param {string} mimeType - MIME type of the file content (e.g. "application/json").
  *
  * @returns {Promise<void>} Resolves when the file is written or fallback download is triggered.
  *
  * @throws {Error} May throw if the File System Access API fails unexpectedly (handled internally).
  */
export async function exportWithSaveDialog(content, fileName, extension, mimeType) {
  try {
    const fullName = fileName + extension;

    // Request a file handle from the user
    const handle = await window.showSaveFilePicker({
      suggestedName: fullName,
      types: [
        {
          description: 'Export file',
          accept: {
            [mimeType]: [extension]
          }
        }
      ]
    });

    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  }
  catch (error) {
    // User cancelled the dialog on purpose - do NOT fall back to a forced download
    if (error.name === 'AbortError')
      return false;

    try {
      await blobManager.downloadOnce(
        content,
        mimeType,
        fileName,
        extension
      );
      return true;
    } catch (fallbackError) {
      console.warn('[ExportHelper] Fallback download failed:', fallbackError);
      return false;
    }
  }
}

export async function openFolder(path) {
  if(window.electronAPI) {
    await window.electronAPI.openFolder(path);
    return;
  }

  _displayNotSupportedInWebWarn('openFolder');
}

export async function showInFolder(path) {
  if(window.electronAPI) {
    await window.electronAPI.showInFolder(path);
    return;
  }

  _displayNotSupportedInWebWarn('showInFolder');
}

export async function getUserDataPath() {
  if(window.electronAPI) {
    return await window.electronAPI.getUserDataPath();
  }

  _displayNotSupportedInWebWarn('getUserDataPath');
}

export const watcherAPI = {
  watchProject(project) {
    if(window.watcherAPI) {
      window.watcherAPI.watchProject(project.id, project.sourcePath);
      return;
    }

    _displayNotSupportedInWebWarn('watchProject');
  },

  unwatchProject(projectId) {
    if (window.watcherAPI) {
      return window.watcherAPI.unwatchProject(projectId);
    }

    _displayNotSupportedInWebWarn('unwatchProject');
  },

  async ignoreNextChange(project) {
    if (window.watcherAPI) {
      await window.watcherAPI.ignoreNextChange(project.id, project.sourcePath);
      return;
    }

    _displayNotSupportedInWebWarn('ignoreNextChange');
  },

  ignorePathTree(project) {
    if (window.watcherAPI) {
      window.watcherAPI.ignorePathTree(project.id, project.sourcePath);
      return;
    }

    _displayNotSupportedInWebWarn('ignorePathTree');
  },

  releasePathTree(project) {
    if (window.watcherAPI) {
      window.watcherAPI.releasePathTree(project.id, project.sourcePath);
      return;
    }

    _displayNotSupportedInWebWarn('releasePathTree');
  },

  isPathIgnored(project) {
    if (window.watcherAPI) {
      return window.watcherAPI.isPathIgnored(project.id, project.sourcePath);
    }

    _displayNotSupportedInWebWarn('isPathIgnored');
  },

  isWatching(projectId) {
    if (window.watcherAPI) {
      return window.watcherAPI.isWatching(projectId);
    }

    _displayNotSupportedInWebWarn('isWatching');
    return false;
  },

  onFileChanged(callback) {
    if (window.watcherAPI) {
      return window.watcherAPI.onFileChanged(callback);
    }

    _displayNotSupportedInWebWarn('onFileChanged');
    return () => {};
  },

  onError(callback) {
    if (window.watcherAPI) {
      return window.watcherAPI.onError(callback);
    }

    _displayNotSupportedInWebWarn('onError');
    return () => {};
  }
};

function _displayNotSupportedInWebWarn(funcName) {
  console.warn(`${funcName} is not supported in web mode`);
}