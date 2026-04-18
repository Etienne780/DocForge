/**
 * Returns the current platform as a string.
 * @returns {string} 'win', 'linux', 'macOS', 'web', 'unknown'.
 */
export function getPlatform() {
  if (window.electronAPI)
    return window.electronAPI.getPlatform();

  return 'web';
}

/**
 * Checks if a given string is a valid platform.
 * @param {string} platform - The platform string to check.
 * @returns {boolean} True if the platform is one of 'win', 'linux', 'macOS', or 'web'.
 */
export function isPlatform(platform) {
  return platform === 'win' || platform === 'linux' || 
    platform === 'macOS' || platform === 'web';
}

/**
 * Checks if the current platform is 'web'.
 * @returns {boolean} True if the platform is 'web'.
 */
export function isPlatformWeb() {
  return getPlatform() === 'web';
}

/**
 * Checks if the current platform is 'macOS'.
 * @returns {boolean} True if the platform is 'macOS'.
 */
export function isPlatformMacOS() {
  return getPlatform() === 'macOS';
}

/**
 * Determines if the current platform matches a platform specification string.
 * Supports multiple platforms separated by spaces and negation with '!'.
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

  return items.every(i => {
    const negation = i.startsWith('!');
    const platform = i.slice(negation ? 1 : 0);

    if (!isPlatform(platform)) {
      console.log(`Invalid platform '${platform}' skipped in 'isPlatformMatch'`);
      return true; // ignore invalid entries
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

/**
 * Opens a file picker and returns the file content.
 *
 * @param {string[]} extensions Allowed extensions (e.g. ['json']). Use ['*'] for all files.
 *
 * @returns {Promise<{ canceled: boolean, data: string|null, fileName?: string, extension?: string }>}
 */
export async function pickImportFile(extensions = ['*']) {
  const getExtension = (fileName) => {
    const index = fileName.lastIndexOf('.');
    return index !== -1 ? fileName.substring(index + 1) : '';
  };

  const buildResult = (fileName, data) => {
    return {
      canceled: false,
      data,
      fileName,
      extension: getExtension(fileName)
    };
  };

  // Electron
  if (window.electronAPI?.openDialog) {
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

    const filePath = result.filePaths[0];
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
    return buildResult(fileName, data);
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
      resolve(buildResult(file.name, text));
    };

    input.click();
  });
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
  }
  catch (error) {
    // Fallback for unsupported browsers or user cancellation
    blobManager.downloadOnce(
      content,
      mimeType,
      fileName,
      extension
    );
  }
}