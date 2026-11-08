import { buildDoneModal, openModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { state } from '@core/State.js';
import { escapeHTML } from '@common/Common.js';
import { t } from '@core/i18n/I18n.js';

const tx = key => escapeHTML(t(`appModals.overview.${key}`));

export function buildOverviewModal() {
  const overviewModal = buildDoneModal('application-overview_modal', {
    title: t('appModals.overview.title'),
    bodyHTML: `
<div class="form-group">

  <div class="form-section-label">${tx('whatIs')}</div>
  <p class="form-label">
    ${tx('whatIsText')}
  </p>

  <div class="form-section-label">${tx('structure')}</div>

  <div class="overview-modal_diagram">

    <div class="overview-modal_titlebar">
      <span class="overview-modal_titlebar-label">DocForge</span>
      <div class="overview-modal_titlebar-buttons">
        <div class="overview-modal_nav-btn active">${tx('project')}</div>
        <div class="overview-modal_nav-btn">${tx('appearance')}</div>
      </div>
    </div>

    <div class="overview-modal_areas">

      <div class="overview-modal_area">
        <div class="overview-modal_area-label">${tx('projectArea')}</div>
        <div class="overview-modal_area-main">${tx('projectHub')}</div>
        <div class="overview-modal_area-editors">
          <div class="overview-modal_editor">${tx('projectEditor')}</div>
        </div>
      </div>

      <div class="overview-modal_divider"></div>

      <div class="overview-modal_area">
        <div class="overview-modal_area-label">${tx('appearanceArea')}</div>
        <div class="overview-modal_area-main">${tx('appearanceManager')}</div>
        <div class="overview-modal_area-editors">
          <div class="overview-modal_editor">${tx('themeEditor')}</div>
          <div class="overview-modal_editor">${tx('languageEditor')}</div>
          <div class="overview-modal_editor">${tx('styleEditor')}</div>
        </div>
      </div>

    </div>
  </div>

  <div class="form-section-label">${tx('navigation')}</div>
  <p class="form-label">
    ${tx('navigationText')}
  </p>

  <div class="form-section-label">${tx('projectArea')}</div>
  <p class="form-label">
    ${tx('projectAreaText')}
  </p>

  <div class="form-section-label">${tx('appearanceArea')}</div>
  <p class="form-label">
    ${tx('appearanceAreaText')}
  </p>
  <div class="form-tabel">
    <div class="row">
      <span>${tx('docThemes')}</span>
      <span class="form-label">${tx('docThemesText')}</span>
    </div>
    <div class="row">
      <span>${tx('languages')}</span>
      <span class="form-label">${tx('languagesText')}</span>
    </div>
    <div class="row">
      <span>${tx('styles')}</span>
      <span class="form-label">${tx('stylesText')}</span>
    </div>
  </div>
  <p class="form-label">
    ${tx('presetsText')}
  </p>

</div>`,

    doneLabel: t('common.close'),
    wide: 'xl',
    doneCallback: () => { state.set('hasViewedOverview', true); },
  });

  eventBus.on('show:modal:overview', () => openModal(overviewModal));
  return overviewModal;
}