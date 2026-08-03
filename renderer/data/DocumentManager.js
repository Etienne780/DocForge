// core/DocumentManager.js
import { isPlatformWeb } from '@core/Platform.js';
import { ElectronDocumentIOAdapter } from '@core/documentIO/ElectronDocumentIOAdapter.js';
import { WebDocumentIOAdapter } from '@core/documentIO/WebDocumentIOAdapter.js';

const documentIO = isPlatformWeb()
  ? new WebDocumentIOAdapter()
  : new ElectronDocumentIOAdapter();

/**
 * Öffnet einen Datei-Dialog und lädt ein Projekt.
 * @param {string} kind - 'file' | 'folder' | 'both'
 * @param {string|null} directPath - Optional: Direkter Pfad (überspringt Dialog)
 * @returns {Promise<Object|null>} Das geladene Projekt oder null
 */
export async function openDocument(kind, directPath = null) {
  let result;

  if (directPath) {
    const data = await documentIO.read(directPath, kind);
    result = { ref: directPath, kind, data };
  } else {
    result = await documentIO.open(kind);
  }

  if (!result)
    return null;

  const project = _deserializeProject(JSON.parse(result.data), result.ref, kind);
  
  if (project) {
    session.set('openProject', project);
    addRecentProject(project);
  }

  return project;
}

export async function saveDocument(project) {
  if (!project.sourceRef) 
    return false;

  if (!documentIO.supportsLiveSave()) {
    eventBus.emit('document:save:unsupported', { project });
    return false;
  }

  const payload = JSON.stringify(_serializeProject(project), null, 2);
  const ok = await documentIO.write(project.sourceRef, project.sourceKind, payload);
  project.isDirty = !ok;
  return ok;
}

export function getSaveCapabilities(project) {
  return {
    canSave: !!project.sourceRef && documentIO.supportsLiveSave(),
    canSaveAs: true,
    canSaveAsFolder: documentIO.supportsFolders(),
  };
}