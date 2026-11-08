import {
  FILE_EXTENSION_PROJECT,
  FILE_EXTENSION_DOCTHEME,
  FILE_EXTENSION_SYNTAXDEFINITION,
  FILE_EXTENSION_LANGUAGE_STYLE,
  FILE_EXTENSION_APP_THEME,
  RECENT_PROJECT_SOURCE_TYPE_FILE,
} from '@core/AppMeta.js';
import { eventBus } from '@core/EventBus.js';
import { isPlatformWeb, getPendingFiles, readTextFile } from '@core/Platform.js';
import { onModalClose } from '@core/ModalBuilder.js';
import { closeProject, getOpenProject } from '@data/ProjectManager.js';
import { confirmLeaveOpenProject } from '@common/UnsavedChangesGuard.js';

// Single entry point for files that come into the app from outside: dropped
// onto the window (FileDrop component) or opened via the OS (double-click /
// "open with", see main/fs/FileOpenManager.js). Files are handled one after
// another; each import modal has to be closed before the next file is shown.
//
// An incoming file: { name, path, read } - path is null on web,
// read() resolves with the file content as string (null on failure).

const _handlers = {
  [FILE_EXTENSION_PROJECT]:          _handleProject,
  [FILE_EXTENSION_DOCTHEME]:         file => _showImportModal('importDocTheme', file),
  [FILE_EXTENSION_SYNTAXDEFINITION]: file => _showImportModal('importLanguage', file),
  [FILE_EXTENSION_LANGUAGE_STYLE]:   file => _showImportModal('importLanguageStyle', file),
  [FILE_EXTENSION_APP_THEME]:        _handleAppTheme,
};

const _queue = [];
let _ready = false;
let _processing = false;

/**
 * Marks the app as ready (loader done) and handles everything queued so far,
 * including the files the app was started with (desktop).
 */
export async function startFileImports() {
  if (_ready)
    return;

  _ready = true;
  importFilePaths(await getPendingFiles());
}

/**
 * Queues files by absolute path (desktop).
 * @param {string[]} paths
 */
export function importFilePaths(paths) {
  importFiles((paths ?? []).map(path => ({
    name: path.split(/[\\/]/).pop(),
    path,
    read: () => readTextFile(path),
  })));
}

/**
 * Queues incoming files, see the file shape above.
 * @param {Array<{ name: string, path: string|null, read: Function }>} files
 */
export function importFiles(files) {
  _queue.push(...files);
  _processQueue();
}

/**
 * @param {string} fileName
 * @returns {boolean} true if the file type can be imported
 */
export function isImportableFile(fileName) {
  return !!_handlers[_getExtension(fileName)];
}

// ─── Private ──────────────────────────────────────────────────────

async function _processQueue() {
  if (!_ready || _processing)
    return;

  _processing = true;
  try {
    while (_queue.length) {
      await _waitForOpenModal();
      const file = _queue.shift();
      try {
        await _handleFile(file);
      } catch (error) {
        eventBus.emit('toast:show', { message: `Failed to open '${file.name}': ${error.message ?? error}`, type: 'error' });
      }
    }
  } finally {
    _processing = false;
  }
}

async function _handleFile(file) {
  const handler = _handlers[_getExtension(file.name)];
  if (!handler) {
    eventBus.emit('toast:show', { message: `Unsupported file: '${file.name}'`, type: 'error' });
    return;
  }

  await handler(file);
}

async function _handleProject(file) {
  // web: there is no live file, the project gets imported as a copy
  if (isPlatformWeb()) {
    await _showImportModal('importProject', file);
    return;
  }

  const openProject = getOpenProject();
  if (openProject) {
    if (openProject.sourcePath === file.path) {
      eventBus.emit('toast:show', { message: `'${openProject.name}' is already open`, type: 'info' });
      return;
    }

    if (!(await confirmLeaveOpenProject()))
      return;
    closeProject();
  }

  // adds the path to recents, a known path reopens its recents entry
  const { openDocument } = await import('@core/DocumentManager.js');
  await openDocument(RECENT_PROJECT_SOURCE_TYPE_FILE, file.path, { addToRecents: true });
}

/** App theme: added as a custom theme and selected (no modal). */
async function _handleAppTheme(file) {
  const data = await file.read();
  const { importAppThemeFromText, setActiveAppTheme } = await import('@data/AppThemeManager.js');
  const theme = data == null ? null : importAppThemeFromText(data);
  if (!theme) {
    eventBus.emit('toast:show', { message: `'${file.name}' is not a valid app theme`, type: 'error' });
    return;
  }
  setActiveAppTheme(theme.id);
  eventBus.emit('toast:show', { message: `Imported the app theme "${theme.name}"`, type: 'success' });
}

async function _showImportModal(modalName, file) {
  const data = await file.read();
  if (data == null) {
    eventBus.emit('toast:show', { message: `Failed to read '${file.name}'`, type: 'error' });
    return;
  }

  eventBus.emit(`show:modal:${modalName}`, {
    projectId: getOpenProject()?.id ?? null,
    data,
    filePath: file.path,
  });
}

/** Resolves once no modal is open anymore. */
function _waitForOpenModal() {
  const modal = document.querySelector('.modal-overlay--open');
  if (!modal)
    return Promise.resolve();

  return new Promise(resolve => {
    const stop = onModalClose(modal, () => {
      stop();
      resolve(_waitForOpenModal());
    });
  });
}

function _getExtension(fileName) {
  const index = fileName.lastIndexOf('.');
  return index !== -1 ? fileName.substring(index).toLowerCase() : '';
}
