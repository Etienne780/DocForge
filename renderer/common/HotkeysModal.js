import { buildDoneModal, openModal, onModalClose } from '@core/ModalBuilder.js';
import { shortcutManager } from '@core/ShortcutManager.js';
import { escapeHTML } from '@common/Common.js';
import { askChoice } from '@common/BaseModals.js';

/**
 * Modal to change the keys of all shortcuts (File -> Preferences -> Hotkeys, preferences page).
 * Changes are saved right away (ShortcutManager -> state.shortcutOverrides, see InitHotkeys.js).
 *
 * Click a key to record the next key combination (window keydown in capture, nothing else
 * reacts; Esc or a click elsewhere cancels). A key that is already used asks whether to take
 * it from the other shortcut(s), keep both (only for other contexts) or cancel.
 */

const CONTEXT_LABELS = {
  global:              'Everywhere',
  projectHub:          'Project hub',
  docEditor:           'Doc editor',
  appearanceManager:   'Appearance manager',
  themeEditor:         'Theme editor',
  languageEditor:      'Language editor',
  languageStyleEditor: 'Language style editor',
  preferences:         'Preferences',
};

const RESET_ICON = '↺';

let _overlay = null;

/** Opens the hotkeys modal (does nothing if it is already open). */
export function openHotkeysModal() {
  if (_overlay)
    return;

  const overlay = buildDoneModal(`hotkeys-modal-${Date.now()}`, {
    title: 'Hotkeys',
    wide: 'l',
    bodyHTML: `
      <div class="hotkeys">
        <div class="hotkeys__header">
          <input class="form-input hotkeys__search" data-search-input type="text" placeholder="Search hotkeys…"
            autocomplete="off" spellcheck="false" aria-label="Search hotkeys">
          <button type="button" class="button button--secondary" data-reset-all>Reset all</button>
        </div>
        <div class="hotkeys__hint">Click a key and press the new combination (Esc cancels). Shortcuts of a view only work there, the ones under "Everywhere" in every view.</div>
        <div class="hotkeys__list" data-list></div>
      </div>`,
  });
  _overlay = overlay;
  // fixed height, only the list scrolls (doesn't jump while searching)
  overlay.querySelector('.modal')?.classList.add('modal--fixed');

  const state = { recording: null };
  const list = overlay.querySelector('[data-list]');
  const search = overlay.querySelector('[data-search-input]');

  const render = () => {
    _render(list, overlay);
    _applySearch(list, search.value);
  };

  search.addEventListener('input', () => _applySearch(list, search.value));

  overlay.querySelector('[data-reset-all]').addEventListener('click', async () => {
    const choice = await askChoice({
      title: 'Reset all hotkeys?',
      message: 'Every shortcut gets its original key again.',
      choices: [
        { id: 'cancel', label: 'Cancel' },
        { id: 'reset', label: 'Reset', style: 'primary' },
      ],
    });
    if (choice === 'reset') {
      shortcutManager.resetAllShortcuts();
      render();
    }
  });

  list.addEventListener('click', event => {
    const row = event.target.closest('[data-hotkey]');
    if (!row)
      return;
    const [context, name] = _parseId(row.dataset.hotkey);

    if (event.target.closest('[data-key]')) {
      _startRecording(state, row, context, name, render);
    } else if (event.target.closest('[data-remove]')) {
      shortcutManager.setShortcutCombo(context, name, '');
      render();
    } else if (event.target.closest('[data-reset]')) {
      shortcutManager.resetShortcut(context, name);
      render();
    }
  });

  render();
  openModal(overlay);
  search.focus();

  const stopWatching = onModalClose(overlay, () => {
    stopWatching();
    state.recording?.();
    overlay.remove();
    _overlay = null;
  });
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function _render(list) {
  const byContext = shortcutManager.getAllByContext();
  const contexts = [
    ...Object.keys(CONTEXT_LABELS).filter(context => byContext.has(context)),
    ...[...byContext.keys()].filter(context => !CONTEXT_LABELS[context]),
  ];

  list.innerHTML = contexts.map(context => `
    <div class="hotkeys__group" data-group>
      <div class="hotkeys__group-title">${escapeHTML(CONTEXT_LABELS[context] ?? context)}</div>
      ${[...byContext.get(context)]
        .sort(_compareEntries)
        .map(entry => _rowHTML(entry)).join('')}
    </div>`).join('');

  const resetAll = list.closest('.hotkeys').querySelector('[data-reset-all]');
  resetAll.disabled = Object.keys(shortcutManager.getOverrides()).length === 0;
}

/**
 * Related shortcuts stay together: sorted by the family of the name (the part before ':',
 * e.g. 'View', 'Format'), inside a family in registration order (e.g. split, editor, preview).
 */
function _compareEntries(a, b) {
  const family = entry => entry.name.includes(':') ? entry.name.slice(0, entry.name.indexOf(':')) : entry.name;
  return family(a).localeCompare(family(b)) || (a.order ?? 0) - (b.order ?? 0);
}

function _label(entry) {
  return entry.description || entry.name;
}

function _contextLabel(context) {
  return CONTEXT_LABELS[context] ?? context;
}

// context names never contain a line break
function _id(entry) {
  return `${entry.context}\n${entry.name}`;
}

function _parseId(id) {
  const index = id.indexOf('\n');
  return [id.slice(0, index), id.slice(index + 1)];
}

function _rowHTML(entry) {
  const changed = entry.keyCombo !== entry.defaultCombo;
  const conflicts = entry.keyCombo ? shortcutManager.findConflicts(entry.context, entry.keyCombo, entry.name) : [];
  const search = `${_label(entry)} ${entry.name} ${entry.displayCombo} ${_contextLabel(entry.context)}`.toLowerCase();

  return `
    <div class="hotkeys__row${changed ? ' hotkeys__row--changed' : ''}" data-hotkey="${escapeHTML(_id(entry))}" data-search="${escapeHTML(search)}">
      <div class="hotkeys__text">
        <div class="hotkeys__label">${escapeHTML(_label(entry))}${entry.description ? `<span class="hotkeys__name">${escapeHTML(entry.name)}</span>` : ''}</div>
        ${changed ? `<div class="hotkeys__default">Default: ${escapeHTML(shortcutManager.formatCombo(entry.defaultCombo) || 'no key')}</div>` : ''}
        ${conflicts.length ? `<div class="hotkeys__conflict">Same key as: ${escapeHTML(conflicts.map(c => `${_label(c)} (${_contextLabel(c.context)})`).join(', '))}</div>` : ''}
      </div>
      <button type="button" class="hotkeys__key${entry.keyCombo ? '' : ' hotkeys__key--empty'}" data-key title="Click and press the new keys">${escapeHTML(entry.displayCombo || 'No key')}</button>
      <button type="button" class="icon-button icon-button--small" data-remove title="Remove the key"${entry.keyCombo ? '' : ' disabled'}>✕</button>
      <button type="button" class="icon-button icon-button--small hotkeys__reset" data-reset title="Reset to default">${RESET_ICON}</button>
    </div>`;
}

/** Hides rows (and groups without rows) that don't contain the search text. */
function _applySearch(list, value) {
  const query = value.trim().toLowerCase();
  list.querySelectorAll('[data-group]').forEach(group => {
    let visible = 0;
    group.querySelectorAll('[data-search]').forEach(row => {
      const match = !query || row.dataset.search.includes(query);
      row.classList.toggle('hidden', !match);
      if (match)
        visible++;
    });
    group.classList.toggle('hidden', visible === 0);
  });
}

// ─── Recording a key ─────────────────────────────────────────────────────────

function _startRecording(state, row, context, name, render) {
  state.recording?.();
  const button = row.querySelector('[data-key]');
  button.classList.add('hotkeys__key--recording');
  button.textContent = 'Press keys… (Esc cancels)';

  const stop = () => {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('pointerdown', onPointerDown, true);
    state.recording = null;
  };

  const onKeyDown = async event => {
    // the keys must not trigger anything else while recording (also not Esc closing the modal)
    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.key === 'Escape' && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
      stop();
      render();
      return;
    }

    const combo = shortcutManager.comboFromEvent(event);
    if (!combo)
      return; // only a modifier so far

    stop();
    await _assignCombo(context, name, combo);
    render();
  };

  const onPointerDown = event => {
    if (event.target === button)
      return;
    stop();
    render();
  };

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('pointerdown', onPointerDown, true);
  state.recording = stop;
}

/** Sets the combo; if other shortcuts use it, asks whether to take it from them. */
async function _assignCombo(context, name, combo) {
  const conflicts = shortcutManager.findConflicts(context, combo, name);
  if (conflicts.length) {
    const list = conflicts.map(c => `"${_label(c)}" (${_contextLabel(c.context)})`).join(', ');
    // in the same view a key can only have one shortcut; a global one is only hidden there
    const canKeepBoth = conflicts.every(c => c.context !== context);
    const choice = await askChoice({
      title: 'Key already used',
      message: canKeepBoth
        ? `${shortcutManager.formatCombo(combo)} is already used by ${list}.\n\nUse it here and remove it there, or keep both (in the view of the specific shortcut only that one reacts)?`
        : `${shortcutManager.formatCombo(combo)} is already used by ${list}.\n\nUse it here and remove it there?`,
      choices: [
        { id: 'cancel', label: 'Cancel' },
        ...(canKeepBoth ? [{ id: 'both', label: 'Keep both' }] : []),
        { id: 'move', label: 'Use it here', style: 'primary' },
      ],
    });
    if (choice === 'cancel')
      return;
    if (choice === 'move')
      conflicts.forEach(c => shortcutManager.setShortcutCombo(c.context, c.name, ''));
  }
  shortcutManager.setShortcutCombo(context, name, combo);
}
