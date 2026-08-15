import { buildDoneModal, openModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { state } from '@core/State.js';

export function buildOverviewModal() {
  const overviewModal = buildDoneModal('application-overview_modal', {
    title: 'DocForge - Overview',
    bodyHTML: `
<div class="form-group">

  <div class="form-section-label">What is DocForge</div>
  <p class="form-label">
    DocForge is a lightweight desktop application for creating, structuring, and managing 
    technical documentation. It focuses on clarity, speed, and a clean editing experience 
    for structured content.
  </p>

  <div class="form-section-label">Application Structure</div>

  <!-- GRAFIK PLACEHOLDER – hier kannst du dein eigenes HTML rein -->
  <div class="overview-modal_diagram">

    <div class="overview-modal_titlebar">
      <span class="overview-modal_titlebar-label">DocForge</span>
      <div class="overview-modal_titlebar-buttons">
        <div class="overview-modal_nav-btn active">Project</div>
        <div class="overview-modal_nav-btn">Appearance</div>
      </div>
    </div>

    <div class="overview-modal_areas">

      <div class="overview-modal_area">
        <div class="overview-modal_area-label">Project Area</div>
        <div class="overview-modal_area-main">Project Hub</div>
        <div class="overview-modal_area-editors">
          <div class="overview-modal_editor">Project Editor</div>
        </div>
      </div>

      <div class="overview-modal_divider"></div>

      <div class="overview-modal_area">
        <div class="overview-modal_area-label">Appearance Area</div>
        <div class="overview-modal_area-main">Appearance Manager</div>
        <div class="overview-modal_area-editors">
          <div class="overview-modal_editor">Theme Editor</div>
          <div class="overview-modal_editor">Language Editor</div>
          <div class="overview-modal_editor">Style Editor</div>
        </div>
      </div>

    </div>
  </div>

  <div class="form-section-label">Navigation</div>
  <p class="form-label">
    The titlebar always shows buttons to switch between the Project and Appearance area.
    Both areas are accessible at any time without losing your current state.
  </p>

  <div class="form-section-label">Project Area</div>
  <p class="form-label">
    The Project Hub lists your recently opened projects and project presets, 
    where you can start a new project or import an existing one. Opening a project 
    launches the Project Editor, where you create tabs and nodes to structure 
    your content and export the finished project (e.g. as HTML).
  </p>

  <div class="form-section-label">Appearance Area</div>
  <p class="form-label">
    Click "Appearance" from the Project Editor to manage the building blocks used 
    to render your documentation:
  </p>
  <div class="form-tabel">
    <div class="row">
      <span>Doc Themes</span>
      <span class="form-label">Colors, sizing, and layout behavior for the exported output (e.g. whether a header is shown)</span>
    </div>
    <div class="row">
      <span>Languages</span>
      <span class="form-label">Rules that identify tokens in your code (keywords, functions, values, …)</span>
    </div>
    <div class="row">
      <span>Styles</span>
      <span class="form-label">Colors for a language's tokens, and can extend its rules</span>
    </div>
  </div>
  <p class="form-label">
    Presets are available for themes, languages, and styles, and you can create your own. 
    Each opens its own editor (Theme Editor, Language Editor, Style Editor) directly 
    from its card.
  </p>

</div>`,

    doneLabel: 'Close',
    wide: 'xl',
    doneCallback: () => { state.set('hasViewedOverview', true); },
  });

  eventBus.on('show:modal:overview', () => openModal(overviewModal));
  return overviewModal;
}