import { buildDoneModal, openModal } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { APP_VERSION } from '@core/AppMeta.js';
import { getChangeLogs, getChangeLogGroups } from '@core/AppChangeLogs.js';
import { escapeHTML } from '@common/Common.js';
import { t, hasString } from '@core/i18n/I18n.js';

export function buildChangelogModal() {
  const changelogModal = buildDoneModal('application-changelog-modal', {
    title: t('appModals.changelog.title'),
    bodyHTML: `
      <div class="changelog-modal_history">
        ${getChangeLogs().map(renderEntry).join('')}
      </div>`,
    doneLabel: t('common.done'),
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
    <div class="form-section-label">${escapeHTML(_groupLabel(group))}</div>
    <ul class="changelog-modal_list">
      ${items.map(renderItem).join('')}
    </ul>`).join('');

  return `
  <details class="changelog-modal_entry">
    <summary class="changelog-modal_summary">
      <span class="changelog-modal_version">v${escapeHTML(entry.version)}</span>
      ${isCurrent ? `<span class="form-tag">${escapeHTML(t('appModals.changelog.current'))}</span>` : ''}
      <span class="changelog-modal_date">${escapeHTML(entry.date)}</span>
    </summary>
    <div class="changelog-modal_content">${groupsHTML}</div>
  </details>`;
}

/** Heading of a changelog group (the entries themselves stay English). */
function _groupLabel(group) {
  const key = `appModals.changelog.groups.${group}`;
  return hasString(key) ? t(key) : group;
}

/** A changelog item is a string or `{ text, items }` with sub items. */
function renderItem(item) {
  if (typeof item === 'string')
    return `<li>${formatItem(item)}</li>`;

  const subItems = item.items?.length
    ? `<ul class="changelog-modal_list changelog-modal_sublist">${item.items.map(sub => `<li>${formatItem(sub)}</li>`).join('')}</ul>`
    : '';
  return `<li>${formatItem(item.text)}${subItems}</li>`;
}

/** Escapes the item and renders `inline code`. */
function formatItem(item) {
  return escapeHTML(item).replace(/`([^`]+)`/g, '<code>$1</code>');
}
