// core/documentIO/WebDocumentIOAdapter.js
import { DocumentIOAdapter } from './DocumentIOAdapter.js';
import { FILE_EXTENSION_PROJECT } from '@core/AppMeta.js'

export class WebDocumentIOAdapter extends DocumentIOAdapter {
  constructor() {
    super();
    this._hasFsAccess = 'showOpenFilePicker' in window;
  }

  supportsLiveSave() { 
    return this._hasFsAccess;
  }
  supportsFolders()  { 
    return this._hasFsAccess && 'showDirectoryPicker' in window;
  }

  async open(kind) {
    if (this._hasFsAccess) {
      try {
        if (kind === 'folder') {
          const dirHandle = await window.showDirectoryPicker();
          const data = await this._readFolder(dirHandle);
          return { ref: dirHandle, kind, data };
        }

        const [fileHandle] = await window.showOpenFilePicker({
          types: [{ accept: { 'application/json': [FILE_EXTENSION_PROJECT] } }],
        });
        
        const file = await fileHandle.getFile();
        return { ref: fileHandle, kind, data: await file.text() };
      } catch (err) {
        if (err.name === 'AbortError') 
            return null;
        throw err;
      }
    }

    return this._openViaInput(kind);
  }

  async write(ref, kind, data) {
    if (!this._hasFsAccess)
        return false;

    if (kind === 'folder')
        return this._writeFolder(ref, data);

    const writable = await ref.createWritable();
    await writable.write(data);
    await writable.close();
    return true;
  }

  async pickSaveTarget(kind, suggestedName) {
    if (!this._hasFsAccess) 
        return null;
    if (kind === 'folder') 
        return window.showDirectoryPicker({ mode: 'readwrite' });
    return window.showSaveFilePicker({ suggestedName });
  }
}