import { buildDoneModal, openModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';

export function buildOverviewModal() {
  const overviewModal = buildDoneModal('application-overview_modal', {
    title: 'Overview',
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
        <div class="overview-modal_nav-btn active">Projects</div>
        <div class="overview-modal_nav-btn">Themes</div>
      </div>
    </div>

    <div class="overview-modal_areas">

      <div class="overview-modal_area">
        <div class="overview-modal_area-label">Project Area</div>
        <div class="overview-modal_area-main">Main View</div>
        <div class="overview-modal_area-editors">
          <div class="overview-modal_editor">Editor</div>
        </div>
      </div>

      <div class="overview-modal_divider"></div>

      <div class="overview-modal_area">
        <div class="overview-modal_area-label">Theme Area</div>
        <div class="overview-modal_area-main">Main View</div>
        <div class="overview-modal_area-editors">
          <div class="overview-modal_editor">DocTheme Editor</div>
          <div class="overview-modal_editor">Language Editor</div>
        </div>
      </div>

    </div>
  </div>

  <div class="form-section-label">Navigation</div>
  <p class="form-label">
    The titlebar always shows buttons to switch between the Project and Theme area.
    Both areas are accessible at any time without losing your current state.
  </p>

  <div class="form-section-label">Project Area</div>
  <p class="form-label">
    The main view lists all your projects. Opening a project launches the 
    Editor where you can write and structure your documentation content.
  </p>

  <div class="form-section-label">Theme Area</div>
  <p class="form-label">
    The main view lists all themes and languages. Two editors are available:
  </p>
  <div class="form-tabel">
    <div class="row">
      <span>DocTheme Editor</span>
      <span class="form-label">Visual styling and layout of documentation output</span>
    </div>
    <div class="row">
      <span>Language Editor</span>
      <span class="form-label">Defines syntax highlighting and visual styling for specific languages</span>
    </div>
  </div>

</div>`,

    doneLabel: 'Close',
    wide: 'xl',
  });

  eventBus.on('show:modal:overview', () => openModal(overviewModal));
  return overviewModal;
}