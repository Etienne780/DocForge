import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { FORMAT_GUIDE_FILE } from '@core/AppMeta.js';
import { exportWithSaveDialog } from '@core/Platform.js';
import { createFormatGuideSettings, setFormatGuideSettings, setProjectTabSize } from '@data/ProjectManager.js';
import { getProjectTabSize, normalizeTabSize, TAB_SIZE_RANGE } from '@common/Common.js';
import { buildFormatGuide } from '@common/FormatGuideBuilder.js';
import { setCheckBox, isCheckedBoxActive } from '@common/UIUtils.js';

const modalId = 'application-project_settings-modal';
const guideEnabledId = `${modalId}-guide_enabled`;
const guidePreferencesId = `${modalId}-guide_preferences`;
const guideExportId = `${modalId}-guide_export`;
const tabSizeId = `${modalId}-tab_size`;

export function buildProjectSettingsModal() {
  let activeProject = null;

  const settingsModal = buildStandardModal(modalId, {
    title: 'Project Settings',
    bodyHTML: `
      <div class="form-section-label">Editor</div>
      <div class="form-group">
        <label class="form-label" for="${tabSizeId}">Tab size (spaces)</label>
        <input id="${tabSizeId}" type="number" class="form-input project-settings__number"
          min="${TAB_SIZE_RANGE.min}" max="${TAB_SIZE_RANGE.max}" step="1">
      </div>
      <span class="body-label text-muted">
        Spaces the Tab key inserts and the width of tabs in the editor, code blocks, tree blocks and indent guides.
        New projects start with the value from the preferences.
      </span>
      <div class="form-section-label form-group--spaced">Format Guide</div>
      <div class="form-row">
        <button id="${guideEnabledId}" class="checkbox-element" data-checkbox="true"></button>
        <span>Generate ${FORMAT_GUIDE_FILE} on save</span>
      </div>
      <span class="body-label text-muted">
        Folder projects only. Written next to the config, it describes the project format,
        entry types and languages for tools and AI assistants.
      </span>
      <div class="form-group form-group--spaced">
        <label class="form-label" for="${guidePreferencesId}">Documentation preferences (optional)</label>
        <textarea id="${guidePreferencesId}" class="form-input project-settings__textarea" rows="8"
          placeholder="Rules for new and changed content, e.g. writing style, language, structure of an entry..."></textarea>
      </div>
      <div class="form-row form-group--spaced">
        <button id="${guideExportId}" class="button button--secondary">Export guide...</button>
      </div>`,
    primaryLabel: 'Save',
    wide: 'm',
    onPrimary: () => {
      if (!activeProject)
        return;

      setFormatGuideSettings(activeProject, _readForm());
      setProjectTabSize(activeProject, _readTabSize(activeProject));
      activeProject = null;
      closeModal(settingsModal);
    },
  });

  document.getElementById(guideExportId).addEventListener('click', async () => {
    if (!activeProject)
      return;

    // export what is in the form, even if it is not saved yet
    const project = {
      ...activeProject,
      settings: { ...activeProject.settings, formatGuide: _readForm() },
    };

    const name = FORMAT_GUIDE_FILE.replace(/\.md$/, '');
    const ok = await exportWithSaveDialog(buildFormatGuide(project), name, '.md', 'text/markdown');
    if (ok)
      eventBus.emit('toast:show', { message: 'Format guide exported.', type: 'success' });
  });

  eventBus.on('show:modal:projectSettings', ({ project = null } = {}) => {
    if (!project) {
      eventBus.emit('toast:show', { message: 'No project open.', type: 'error' });
      return;
    }

    activeProject = project;
    const formatGuide = { ...createFormatGuideSettings(), ...project.settings?.formatGuide };
    setCheckBox(document.getElementById(guideEnabledId), formatGuide.enabled);
    document.getElementById(guidePreferencesId).value = formatGuide.preferences;
    document.getElementById(tabSizeId).value = String(getProjectTabSize(project));

    openModal(settingsModal);
  });

  return settingsModal;
}

/** Tab size from the form, the current one if the field is empty or invalid. */
function _readTabSize(project) {
  const raw = document.getElementById(tabSizeId).value.trim();
  return raw && Number.isFinite(Number(raw)) ? normalizeTabSize(raw) : getProjectTabSize(project);
}

function _readForm() {
  return {
    enabled: isCheckedBoxActive(document.getElementById(guideEnabledId)),
    preferences: document.getElementById(guidePreferencesId).value,
  };
}
