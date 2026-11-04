import { buildStandardModal, openModal, closeModal, onModalClose } from '@core/ModalBuilder.js';
import { eventBus } from '@core/EventBus.js';
import { escapeHTML } from '@common/Common.js';
import { getMatchContext } from '@common/TextSearch.js';
import { addCheckboxEventListener, setCheckBox, toggleCheckBox } from '@common/UIUtils.js';

let openCount = 0;

/** @returns {boolean} true while a replace preview is open (it takes over the FindNext / FindPrevious shortcuts) */
export function isReplacePreviewOpen() {
  return openCount > 0;
}

/**
 * Replace preview: lists every match that "Replace all" would change, grouped by tab and entry.
 * Every match shows its line before / after the replacement plus the nearest non-blank line
 * above and below. Tabs, entries and single matches can be unchecked.
 *
 * Tabs and entries can be collapsed; at the start only the first tab and its first entry are open.
 * One match is the current one: the footer buttons and the FindNext / FindPrevious shortcuts (`editor:find:next`)
 * step through the matches, open the entry of the new match and close the one of the previous match.
 * Space checks / unchecks the current match.
 *
 * @param {object} options
 * @param {import('@data/ProjectSearch.js').SearchGroup[]} options.groups - matches with `replacement`
 * @param {(groups: Array<{ tab: Object, node: Object, matches: Object[] }>) => void} options.onApply
 *   - called with the checked matches (only groups with at least one)
 */
export function openReplacePreview({ groups, onApply }) {
  const total = groups.reduce((sum, group) => sum + group.matches.length, 0);
  const overlayId = `replace-preview-${Date.now()}`;

  const modal = buildStandardModal(overlayId, {
    title: 'Replace preview',
    bodyHTML: `
      <div class="replace-preview__summary">
        <b>${total}</b> ${total === 1 ? 'match' : 'matches'} in <b>${groups.length}</b> ${groups.length === 1 ? 'entry' : 'entries'}.
        Uncheck what should stay as it is.
      </div>
      <div class="replace-preview__list">${_buildTree(groups)}</div>`,
    footerHTML: `
      <div class="replace-preview__nav">
        <button class="find-widget__button" data-preview-step="-1" aria-label="Previous match"
          data-shortcut-label="FindPrevious" data-shortcut-context="docEditor" data-shortcut-target="title" data-shortcut-title="Previous match">↑</button>
        <button class="find-widget__button" data-preview-step="1" aria-label="Next match"
          data-shortcut-label="FindNext" data-shortcut-context="docEditor" data-shortcut-target="title" data-shortcut-title="Next match">↓</button>
        <span class="replace-preview__position" data-preview-position title="Space checks / unchecks the current match"></span>
      </div>`,
    primaryLabel: `Replace ${total}`,
    wide: 'l',
    onPrimary: () => {
      const selected = groups
        .map((group, g) => ({
          ...group,
          matches: group.matches.filter((_, m) => checked.has(`${g}:${m}`)),
        }))
        .filter(group => group.matches.length);

      closeModal(modal);
      if (selected.length)
        onApply(selected);
    },
  });

  // ─── checkbox model ─────────────────────────────────────────────────────────
  const checked = new Set(groups.flatMap((group, g) => group.matches.map((_, m) => `${g}:${m}`)));
  const primary = modal.querySelector('[data-modal-primary]');
  const cleanups = [];
  let syncing = false;

  const matchBoxes = Array.from(modal.querySelectorAll('[data-match]'));
  const entryBoxes = Array.from(modal.querySelectorAll('[data-entry]'));
  const tabBoxes = Array.from(modal.querySelectorAll('[data-tab-index]'));

  const keysOf = box => matchBoxes
    .filter(m => box.dataset.tabIndex !== undefined
      ? m.dataset.tab === box.dataset.tabIndex
      : m.dataset.match.startsWith(`${box.dataset.entry}:`))
    .map(m => m.dataset.match);

  /** parents follow their children: checked if all children are */
  const syncAll = () => {
    syncing = true;
    for (const box of matchBoxes) {
      setCheckBox(box, checked.has(box.dataset.match));
      box.closest('.replace-preview__match').classList.toggle('replace-preview__match--off', !checked.has(box.dataset.match));
    }
    for (const box of [...entryBoxes, ...tabBoxes])
      setCheckBox(box, keysOf(box).every(key => checked.has(key)));
    syncing = false;

    primary.textContent = `Replace ${checked.size}`;
    primary.disabled = !checked.size;
  };

  for (const box of matchBoxes) {
    cleanups.push(addCheckboxEventListener(box, value => {
      if (syncing)
        return;
      value ? checked.add(box.dataset.match) : checked.delete(box.dataset.match);
      syncAll();
    }));
  }

  for (const box of [...entryBoxes, ...tabBoxes]) {
    cleanups.push(addCheckboxEventListener(box, value => {
      if (syncing)
        return;
      for (const key of keysOf(box))
        value ? checked.add(key) : checked.delete(key);
      syncAll();
    }));
  }

  // ─── collapsing ─────────────────────────────────────────────────────────────
  const setCollapsed = (group, collapsed) => {
    group.classList.toggle('replace-preview__group--collapsed', collapsed);
    group.querySelector(':scope > .replace-preview__head [data-fold]')?.setAttribute('aria-expanded', String(!collapsed));
  };

  /** tab and entry groups around an element, innermost first */
  const groupsOf = element => {
    const result = [];
    for (let group = element.closest('.replace-preview__group'); group; group = group.parentElement.closest('.replace-preview__group'))
      result.push(group);
    return result;
  };

  modal.querySelectorAll('.replace-preview__group').forEach(group => setCollapsed(group, true));
  modal.querySelector('.replace-preview__list').addEventListener('click', event => {
    const fold = event.target.closest('[data-fold]');
    if (fold) {
      const group = fold.closest('.replace-preview__group');
      setCollapsed(group, !group.classList.contains('replace-preview__group--collapsed'));
      return;
    }

    const match = event.target.closest('.replace-preview__match');
    if (match && !event.target.closest('.checkbox-element'))
      goTo(matchElements.indexOf(match));
  });

  // ─── stepping through the matches ───────────────────────────────────────────
  const matchElements = Array.from(modal.querySelectorAll('.replace-preview__match'));
  const position = modal.querySelector('[data-preview-position]');
  let current = -1;

  const goTo = index => {
    const next = matchElements[index];
    if (!next)
      return;

    // the previous match's entry (and tab) closes, unless the new match is inside
    const previous = matchElements[current];
    if (previous && previous !== next) {
      for (const group of groupsOf(previous)) {
        if (!group.contains(next))
          setCollapsed(group, true);
      }
      previous.classList.remove('replace-preview__match--current');
    }

    for (const group of groupsOf(next))
      setCollapsed(group, false);
    next.classList.add('replace-preview__match--current');
    current = index;

    position.textContent = `Match ${index + 1} of ${matchElements.length}`;
    next.scrollIntoView({ block: 'nearest' });
  };

  const step = direction => goTo((current + direction + matchElements.length) % matchElements.length);

  modal.querySelectorAll('[data-preview-step]').forEach(button => {
    button.addEventListener('click', () => step(Number(button.dataset.previewStep)));
  });
  // FindNext / FindPrevious; the FindWidget ignores them while the preview is open
  cleanups.push(eventBus.on('editor:find:next', ({ direction = 1 } = {}) => step(direction)));

  const onKeyDown = event => {
    if (event.key !== ' ' || event.target.closest?.('button, input, select, textarea'))
      return;
    event.preventDefault();
    const box = matchElements[current]?.querySelector('[data-match]');
    if (box)
      toggleCheckBox(box);
  };
  // on the document: the focus is often outside of the modal (body) after opening it
  document.addEventListener('keydown', onKeyDown);
  cleanups.push(() => document.removeEventListener('keydown', onKeyDown));

  openCount++;
  onModalClose(modal, () => {
    openCount--;
    cleanups.forEach(cleanup => cleanup());
    // after the close transition
    setTimeout(() => modal.remove(), 300);
  });

  openModal(modal);
  goTo(0);
  // the checkboxes are initialized by the DOM observer, sync once they are
  requestAnimationFrame(syncAll);
}

// ─── HTML ────────────────────────────────────────────────────────────────────

function _buildTree(groups) {
  // groups are in tree order: consecutive groups of the same tab belong together
  const tabs = [];
  groups.forEach((group, g) => {
    const last = tabs[tabs.length - 1];
    if (last?.tab === group.tab)
      last.items.push({ group, g });
    else
      tabs.push({ tab: group.tab, items: [{ group, g }] });
  });

  return tabs.map((tab, t) => {
    const count = tab.items.reduce((sum, { group }) => sum + group.matches.length, 0);
    return `
      <div class="replace-preview__group replace-preview__group--tab">
        <div class="replace-preview__head">
          <button class="replace-preview__fold" data-fold aria-label="Show / hide the entries of this tab"></button>
          <button class="checkbox-element" data-checkbox="true" data-tab-index="${t}" aria-label="Replace in this tab"></button>
          <span class="replace-preview__name" data-fold>${escapeHTML(tab.tab.name)}</span>
          <span class="replace-preview__badge">${count}</span>
        </div>
        <div class="replace-preview__entries">
          ${tab.items.map(({ group, g }) => _buildEntry(group, g, t)).join('')}
        </div>
      </div>`;
  }).join('');
}

function _buildEntry(group, g, t) {
  const content = group.node.content ?? '';
  return `
    <div class="replace-preview__group">
      <div class="replace-preview__head">
        <button class="replace-preview__fold" data-fold aria-label="Show / hide the matches of this entry"></button>
        <button class="checkbox-element" data-checkbox="true" data-entry="${g}" aria-label="Replace in this entry"></button>
        <span class="replace-preview__name" data-fold>${escapeHTML(group.node.name)}</span>
        <span class="replace-preview__badge">${group.matches.length}</span>
      </div>
      <div class="replace-preview__matches">
        ${group.matches.map((match, m) => `
          <div class="replace-preview__match">
            <button class="checkbox-element" data-checkbox="true" data-match="${g}:${m}" data-tab="${t}" aria-label="Replace this match"></button>
            ${_buildLines(content, match)}
          </div>`).join('')}
      </div>
    </div>`;
}

function _buildLines(content, match) {
  const { line, before, after } = getMatchContext(content, match);
  const from = match.start - line.start;
  const to = match.end - line.start;
  const changed = escapeHTML(line.text.slice(0, from))
    + `<del>${escapeHTML(match.text)}</del><ins>${escapeHTML(match.replacement ?? '')}</ins>`
    + escapeHTML(line.text.slice(to));

  const lineHTML = (number, html, context) => `
    <div class="replace-preview__line${context ? ' replace-preview__line--context' : ''}">
      <span class="replace-preview__number">${number}</span><span>${html}</span>
    </div>`;

  return `
    <div class="replace-preview__lines">
      ${before ? lineHTML(before.number, escapeHTML(before.text), true) : ''}
      ${lineHTML(line.number, changed, false)}
      ${after ? lineHTML(after.number, escapeHTML(after.text), true) : ''}
    </div>`;
}
