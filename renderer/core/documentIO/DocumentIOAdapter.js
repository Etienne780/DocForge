// core/documentIO/DocumentIOAdapter.js
export class DocumentIOAdapter {
  /** true, wenn diese Plattform "Speichern schreibt dieselbe Quelle erneut" kann */
  supportsLiveSave() {
    return false;
  }
  /** true, wenn Ordner-Projekte grundsätzlich möglich sind */
  supportsFolders() {
    return false;
  }

  /** Öffnet einen Auswahl-Dialog, liest die Quelle, gibt { ref, kind, data } oder null (abgebrochen) zurück */
  async open(kind /* 'file' | 'folder' | 'both' */) { 
    throw new Error('not implemented');
  }

  /** Liest erneut von einer bereits bekannten ref (z.B. beim App-Start ein zuletzt offenes Projekt neu laden) */
  async read(ref, kind) { 
    throw new Error('not implemented');
  }

  /** Schreibt an die bestehende ref. Wenn !supportsLiveSave(), sollte das nie aufgerufen werden. */
  async write(ref, kind, data) { 
    throw new Error('not implemented');
  }

  /** "Speichern unter" – fragt neuen Ort/Namen ab, gibt neue ref zurück (oder null) */
  async pickSaveTarget(kind, suggestedName) {
    throw new Error('not implemented');
  }
}