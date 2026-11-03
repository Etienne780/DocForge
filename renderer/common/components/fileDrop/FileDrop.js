import { Component } from '@core/Component.js';
import { getPathForFile } from '@core/Platform.js';
import { importFiles } from '@core/FileImportManager.js';
import { getFileDropIcon } from '@ui/Icon.js';

/**
 * FileDrop - full window overlay for files dragged onto the app.
 *
 * Only reacts to drags that carry files, so the internal drag & drop
 * (tabs, tree nodes) is not affected. Dropped files are handed to
 * the FileImportManager, which decides what happens with them.
 */
export default class FileDrop extends Component {

  onLoad() {
    this._overlay = this.element('overlay');
    this.element('icon').innerHTML = getFileDropIcon();

    this._onDragEnter = event => {
      if (!_hasFiles(event))
        return;
      event.preventDefault();
      this._setVisible(true);
    };

    // without preventDefault the drop is refused (Electron would even navigate to the file)
    this._onDragOver = event => {
      if (!_hasFiles(event))
        return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    };

    this._onDrop = event => {
      if (!_hasFiles(event))
        return;
      event.preventDefault();
      this._setVisible(false);
      this._import(event.dataTransfer.files);
    };

    // the overlay covers the window, so leaving it means leaving the window
    this._onDragLeave = event => {
      if (!this._overlay.contains(event.relatedTarget))
        this._setVisible(false);
    };

    window.addEventListener('dragenter', this._onDragEnter);
    window.addEventListener('dragover', this._onDragOver);
    window.addEventListener('drop', this._onDrop);
    this._overlay.addEventListener('dragleave', this._onDragLeave);
  }

  onDestroy() {
    window.removeEventListener('dragenter', this._onDragEnter);
    window.removeEventListener('dragover', this._onDragOver);
    window.removeEventListener('drop', this._onDrop);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _setVisible(visible) {
    this._overlay.classList.toggle('file-drop-overlay--visible', visible);
  }

  _import(fileList) {
    importFiles([...fileList].map(file => ({
      name: file.name,
      path: getPathForFile(file),
      read: () => file.text(),
    })));
  }
}

function _hasFiles(event) {
  return !!event.dataTransfer?.types.includes('Files');
}
