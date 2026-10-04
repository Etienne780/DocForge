import { buildDoneModal, openModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { APP_VERSION, getChangeLogs, getChangeLogGroups } from '@core/AppMeta.js';
import { escapeHTML } from '@common/Common.js';

export function buildChangelogModal() {
  const changelogModal = buildDoneModal('application-changelog-modal', {
    title: 'Changelog',
    bodyHTML: `
      <div class="changelog-modal_history">
        ${getChangeLogs().map(renderEntry).join('')}
      </div>`,
    doneLabel: 'Done',
    wide: 'm',
  });

  eventBus.on('show:modal:changelog', () => {
    // every entry starts collapsed
    changelogModal.querySelectorAll('.changelog-modal_entry')
      .forEach(entry => entry.open = false);
    changelogModal.querySelector('.modal__body').scrollTop = 0;
    openModal(changelogModal);
  });

  return changelogModal;
}

function renderEntry(entry) {
  const isCurrent = entry.version === APP_VERSION;
  const groupsHTML = getChangeLogGroups(entry).map(({ group, items }) => `
    <div class="form-section-label">${escapeHTML(group)}</div>
    <ul class="changelog-modal_list">
      ${items.map(item => `<li>${formatItem(item)}</li>`).join('')}
    </ul>`).join('');

  return `
  <details class="changelog-modal_entry">
    <summary class="changelog-modal_summary">
      <span class="changelog-modal_version">v${escapeHTML(entry.version)}</span>
      ${isCurrent ? '<span class="form-tag">Current</span>' : ''}
      <span class="changelog-modal_date">${escapeHTML(entry.date)}</span>
    </summary>
    <div class="changelog-modal_content">${groupsHTML}</div>
  </details>`;
}

/** Escapes the item and renders `inline code`. */
function formatItem(item) {
  return escapeHTML(item).replace(/`([^`]+)`/g, '<code>$1</code>');
}
