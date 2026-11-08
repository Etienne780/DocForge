import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { createProjectPreset, findRecentProject } from '@data/ProjectManager.js';
import { addModalEnterAction } from '@common/BaseModals.js';
import { loadTargetProject } from '@common/ProjectPersistence.js';
import { escapeHTML } from '@common/Common.js';
import { t } from '@core/i18n/I18n.js';

const tx = key => escapeHTML(t(`projectModals.template.${key}`));

const modalId = 'application-create_template-modal';
const nameInputId = `${modalId}-name`;
const descriptionInputId = `${modalId}-description`;

export function buildCreateTemplateModal() {
  let source = null; // { project } | { recentProjectId }

  const templateModal = buildStandardModal(modalId, {
    title: t('projectModals.template.title'),
    bodyHTML: `
      <div class="form-group">
        <label class="form-label" for="${nameInputId}">${escapeHTML(t('common.name'))}</label>
        <input type="text" class="form-input" id="${nameInputId}" autocomplete="off" placeholder="${tx('namePlaceholder')}">
      </div>
      <div class="form-group form-group--spaced">
        <label class="form-label" for="${descriptionInputId}">${tx('description')}</label>
        <input type="text" class="form-input" id="${descriptionInputId}" autocomplete="off" placeholder="${tx('descriptionPlaceholder')}">
      </div>`,
    primaryLabel: t('common.create'),
    wide: 'm',
    onPrimary: async () => {
      const name = document.getElementById(nameInputId).value.trim();
      const description = document.getElementById(descriptionInputId).value.trim();
      if (!name || !source)
        return;

      closeModal(templateModal);
      await _createTemplate(source, name, description);
      source = null;
    },
  });

  addModalEnterAction(templateModal, { targetId: nameInputId });
  addModalEnterAction(templateModal, { targetId: descriptionInputId });

  eventBus.on('show:modal:createTemplate', ({ project = null, recentProjectId = null } = {}) => {
    const name = project?.name ?? findRecentProject(recentProjectId)?.name;
    if (!project && !recentProjectId) {
      eventBus.emit('toast:show', { message: t('projectModals.template.noProject'), type: 'error' });
      return;
    }

    source = { project, recentProjectId };

    const nameInput = document.getElementById(nameInputId);
    nameInput.value = name ?? t('projectModals.template.newTemplate');
    document.getElementById(descriptionInputId).value = '';

    openModal(templateModal);
    setTimeout(() => {
      nameInput.focus();
      nameInput.select();
    }, 80);
  });

  return templateModal;
}

async function _createTemplate({ project, recentProjectId }, name, description) {
  let sourceProject = project;

  if (!sourceProject) {
    try {
      sourceProject = await loadTargetProject(recentProjectId);
    } catch (error) {
      console.error('[CreateTemplateModal] failed to load project:', error);
    }
  }

  if (!sourceProject) {
    eventBus.emit('toast:show', { message: t('projectModals.template.loadFailed'), type: 'error' });
    return;
  }

  createProjectPreset(sourceProject, { name, description });
  eventBus.emit('toast:show', { message: t('projectModals.template.created', { name }), type: 'success' });
}
