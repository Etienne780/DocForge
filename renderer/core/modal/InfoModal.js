import { buildDoneModal, openModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { APP_VERSION } from '@core/AppMeta.js';
import { escapeHTML } from '@common/Common.js';
import { t } from '@core/i18n/I18n.js';

const tx = key => escapeHTML(t(`appModals.info.${key}`));

export function buildInfoModal() {
    
  const infoModal = buildDoneModal('application-info-modal', {
    title: t('appModals.info.title'),
    bodyHTML: `
<div class="form-group">

  <div class="form-tabel">

   <div class="row">
      <span class="form-label form--accent">${tx('version')} </span>
      <span class="form-tag">${APP_VERSION}</span>
    </div>

    <div class="row">
      <span class="form-label form--accent">${tx('sourceCode')} </span>
      <p class="form-label">
        <a href="https://github.com/Etienne780/DocForge" target="_blank">
          https://github.com/Etienne780/DocForge
        </a>
      </p>
    </div>

    <div class="row">
      <span class="form-label form--accent">${tx('author')} </span>
      <span class="form-tag">Brot780</span>
    </div>

  </div>

  <div class="form-section-label">${tx('license')}</div>
  <p class="form-label">
    ${tx('licenseText')}
  </p>

</div>`,
    doneLabel: t('common.done'),
    wide: 'm',
  });

  eventBus.on('show:modal:info', () => openModal(infoModal));
  
  return infoModal;
}