import { buildAboutModal } from "./modal/AboutModal";
import { buildUpdateModal } from "./modal/UpdateModal";
import { buildCreateProjectModal } from "./modal/CreateProjectModal";

/* 
  Call following events to open a specific modal:

  name | events | payload | html-id
  AboutModal | show:modal:about | {} | application-about-modal
  UpdateModal | show:modal:update | {} | application-update-modal
  CreateProjectModal | show:modal:createProject | {} | application-create_project-modal

*/

const _sharedModals = {
  about: null,
  update: null,
  createProject: null,
};

export function initSharedModals() {
  _sharedModals.about = buildAboutModal();
  _sharedModals.update = buildUpdateModal();
  _sharedModals.createProject = buildCreateProjectModal();
}

export function getSharedModal(name) {
  const modal = _sharedModals[name];
  if (!modal) 
    throw new Error(`[SharedModals] Modal '${name}' not found or not yet initialized`);
  return modal;
}