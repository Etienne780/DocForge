// core/documentIO/DocumentIOAdapter.js
export class DocumentIOAdapter {
  /** true if this platform can "save writes back to the same source" */
  supportsLiveSave() {
    return false;
  }
  /** true if folder-based projects are supported at all */
  supportsFolders() {
    return false;
  }

  /** Opens a picker dialog, reads the source, returns { ref, kind, data } or null (canceled) */
  async open(kind /* 'file' | 'folder' | 'both' */) { 
    throw new Error('not implemented');
  }

  /** Reads again from an already known ref (e.g. reloading the last open project on app start) */
  async read(ref, kind) { 
    throw new Error('not implemented');
  }

  /** Writes to the existing ref. Should never be called if !supportsLiveSave(). */
  async write(ref, kind, data) { 
    throw new Error('not implemented');
  }

  /** "Save as" – prompts for a new location/name, returns the new ref (or null) */
  async pickSaveTarget(kind, suggestedName) {
    throw new Error('not implemented');
  }
}