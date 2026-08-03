// core/DocumentManager.js
import { isPlatformWeb } from '@core/Platform.js';
import { ElectronDocumentIOAdapter } from '@core/documentIO/ElectronDocumentIOAdapter.js';
import { WebDocumentIOAdapter } from '@core/documentIO/WebDocumentIOAdapter.js';

const documentIO = isPlatformWeb()
  ? new WebDocumentIOAdapter()
  : new ElectronDocumentIOAdapter();

export async function openDocument(kind) {
  const result = await documentIO.open(kind);
  if (!result) 
    return null;

  const project = _deserializeProject(JSON.parse(result.data), result.ref, kind);
  addProject(project);

  if (documentIO.supportsLiveSave()) {
    await addRecentDocument({ ref: result.ref, kind, name: project.name });
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