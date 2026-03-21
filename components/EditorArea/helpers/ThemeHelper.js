import { state } from '../../../core/State.js';
import { getActiveProject, getActiveDocTheme  } from '../../../data/ProjectManager.js';

/**
 * Maps user-facing theme keys to CSS custom property names.
 */
export const THEME_VARIABLES = {
  background:         '--background',
  backgroundElevated: '--background-elevated',
  backgroundRaised:   '--background-raised',
  borderColor:        '--border-color',
  textPrimary:        '--text-primary',
  textMuted:          '--text-muted',
  accentColor:        '--accent-color',
  linkColor:          '--link-color',
  codeBackground:     '--code-background',
  codeText:           '--code-text',
};

/**
 * Applies a single CSS variable override and persists it to state.
 * @param {string} variableName — CSS property name (with or without --)
 * @param {string} value
 */
export function applyDocCSSVariable(variableName, value) {
  document.querySelectorAll('.preview-pane').forEach(el => {
    el.style.setProperty(variableName, value);
  });
  const project = getActiveProject();
  if (!project) return;
  project.docTheme = { ...project.docTheme, [variableName]: value };
  state.set('projects', [...state.get('projects')]);
}

/**
 * Applies all stored theme overrides from state to the preview document.
 * Called on page load to restore user customizations.
 */
export function applyStoredDocTheme() {
  const project = getActiveProject();
  if (!project) return;

  const docTheme = getActiveDocTheme();
  document.querySelectorAll('.preview-pane').forEach(el => {
    Object.entries(docTheme).forEach(([key, value]) => {
      if (key.startsWith('--doc-')) el.style.setProperty(key, value);
    });

    const fontSize = docTheme['--doc-font-size'];
    if (fontSize) 
      el.style.setProperty('--doc-font-size', fontSize);
  });
}

/**
 * Applies the preview pane font size.
 * @param {number} sizeInPixels
 */
export function applyPreviewFontSize(sizeInPixels) {
  const previews = document.querySelectorAll('[data-preview-panel]');
  previews.forEach(el => { el.style.fontSize = `${sizeInPixels}px`; });

  const project = getActiveProject();
  if(!project) return;
  project.docTheme = { ...project.docTheme, 'preview-font-size': sizeInPixels};
  state.set('projects', [...state.get('projects')]);
}

/**
 * Resets all theme overrides to CSS-defined defaults.
 */
export function resetTheme() {
  const project = getActiveProject();
  if (!project) 
    return;
  project.docTheme = {};
  state.set('projects', [...state.get('projects')]);

  const previewEl = document.querySelector('.preview-pane');
  if (previewEl) 
    previewEl.removeAttribute('style');

  applyStoredDocTheme();
}
