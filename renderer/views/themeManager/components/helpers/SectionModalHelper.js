import { buildStandardModal, openModal, closeModal } from '@core/ModalBuilder.js';

export const themeSectionName = 'theme';
export const langSectionName = 'lang';

export function buildSectionModal(themeId, langId) {
  const themeModal = _buildSection(themeId, _getThemeConfig());
  const langModal = _buildSection(langId, _getLangConfig());

  return { theme: themeModal, lang: langModal };
}

function _buildSection(id, config) {
  return buildStandardModal(id, config);
}

export function openThemeSectionModal(element, id) {
  openModal(element);
}

export function openLangSectionModal(element, id) {
  openModal(element);
}

export function closeThemeSectionModal(element) {
  closeModal(element);
}

export function closeLangSectionModal(element) {
  closeModal(element);
}

function _getThemeConfig() {
  return {
    title: 'Theme',
    bodyHTML: '<div>Theme settings</div>',
    primaryLabel: 'Save',
    secondaryLabel: 'Cancel',
    wide: true,
    onPrimary: null,
  };
}

function _getLangConfig() {
  return {
    title: 'Language',
    bodyHTML: '<div>Language settings</div>',
    primaryLabel: 'Save',
    secondaryLabel: 'Cancel',
    wide: true,
    onPrimary: null,
  };
}