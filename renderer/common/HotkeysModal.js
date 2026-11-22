import { buildDoneModal, openModal, onModalClose } from '@core/ModalBuilder.js';
import { shortcutManager } from '@core/ShortcutManager.js';
import { escapeHTML } from '@common/Common.js';
import { askChoice } from '@common/BaseModals.js';
import { t, getStringEntry } from '@core/i18n/I18n.js';
import { UI_LANGUAGE_IDS } from '@core/i18n/Languages.js';

/**
 * Modal to change the keys of all shortcuts (File -> Preferences -> Hotkeys, preferences page).
 * Changes are saved right away (ShortcutManager -> state.shortcutOverrides, see InitHotkeys.js).
 *
 * Click a key to record the next key combination (window keydown in capture, nothing else
 * reacts; Esc or a click elsewhere cancels). A key that is already used asks whether to take
 * it from the other shortcut(s), keep both (only for other contexts) or cancel.
 */

/** Contexts in list order, label: hotkeys.contexts.<context> */
const CONTEXT_ORDER = [
  'global',
  'projectHub',
  'docEditor',
  'appearanceManager',
  'themeEditor',
  'languageEditor',
  'languageStyleEditor',
  'preferences',
];

/**
 * Areas inside a context, shown as sub titles (label: hotkeys.families.<family>), in this order.
 * The family of a shortcut is the part of its name before ':' (FAMILY_ALIASES joins related ones),
 * names without ':' are 'general'.
 */
const FAMILY_ORDER = ['general', 'Edit', 'Format', 'Find', 'View', 'Navigate', 'Entry', 'Tab', 'ThemeEditor'];
const FAMILY_ALIASES = { Replace: 'Find', FindNext: 'Find', FindPrevious: 'Find', Editor: 'View' };

// other words a key can be searched with (besides its name and its labels in all languages)
const KEY_SEARCH_ALIASES = { ctrl: ['control', 'cmd', '⌘'], meta: ['cmd', 'command', '⌘'], escape: ['escape'] };

const RESET_ICON = '↺';

let _overlay = null;

/** Opens the hotkeys modal (does nothing if it is already open). */
export function openHotkeysModal() {
  if (_overlay)
    return;

  const overlay = buildDoneModal(`hotkeys-modal-${Date.now()}`, {
    title: t('hotkeys.title'),
    wide: 'l',
    bodyHTML: `
      <div class="hotkeys">
        <div class="hotkeys__header">
          <input class="form-input hotkeys__search" data-search-input type="text" placeholder="${escapeHTML(t('hotkeys.searchPlaceholder'))}"
            autocomplete="off" spellcheck="false" aria-label="${escapeHTML(t('hotkeys.searchLabel'))}">
          <button type="button" class="button button--secondary" data-reset-all>${escapeHTML(t('hotkeys.resetAll'))}</button>
        </div>
        <div class="hotkeys__hint">${escapeHTML(t('hotkeys.hint'))}</div>
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
      title: t('hotkeys.resetAllTitle'),
      message: t('hotkeys.resetAllMessage'),
      choices: [
        { id: 'cancel', label: t('common.cancel') },
        { id: 'reset', label: t('hotkeys.reset'), style: 'primary' },
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
    ...CONTEXT_ORDER.filter(context => byContext.has(context)),
    ...[...byContext.keys()].filter(context => !CONTEXT_ORDER.includes(context)),
  ];

  list.innerHTML = contexts.map(context => {
    const families = new Map(); // family -> entries
    for (const entry of [...byContext.get(context)].sort(_compareEntries)) {
      const family = _family(entry);
      if (!families.has(family))
        families.set(family, []);
      families.get(family).push(entry);
    }

    return `
      <div class="hotkeys__group" data-group>
        <div class="hotkeys__group-title">${escapeHTML(_contextLabel(context))}</div>
        ${[...families].map(([family, entries]) => `
          <div data-family>
            <div class="hotkeys__family-title">${escapeHTML(_familyLabel(family))}</div>
            ${entries.map(entry => _rowHTML(entry)).join('')}
          </div>`).join('')}
      </div>`;
  }).join('');

  const resetAll = list.closest('.hotkeys').querySelector('[data-reset-all]');
  resetAll.disabled = Object.keys(shortcutManager.getOverrides()).length === 0;
}

/** Area of a shortcut: 'general' or a FAMILY_ORDER family (unknown ones are used as they are). */
function _family(entry) {
  if (!entry.name.includes(':'))
    return FAMILY_ALIASES[entry.name] ?? 'general';
  const family = entry.name.slice(0, entry.name.indexOf(':'));
  return FAMILY_ALIASES[family] ?? family;
}

function _familyLabel(family) {
  return FAMILY_ORDER.includes(family) ? t(`hotkeys.families.${family}`) : family;
}

/**
 * Related shortcuts stay together: sorted by area (FAMILY_ORDER, unknown ones after it by name),
 * inside an area in registration order (e.g. split, editor, preview).
 */
function _compareEntries(a, b) {
  const rank = family => FAMILY_ORDER.includes(family) ? FAMILY_ORDER.indexOf(family) : FAMILY_ORDER.length;
  const familyA = _family(a);
  const familyB = _family(b);
  return rank(familyA) - rank(familyB) || familyA.localeCompare(familyB) || (a.order ?? 0) - (b.order ?? 0);
}

/** Texts of a string entry in all UI languages (search finds a shortcut in every language). */
function _allLanguages(key, fallback = '') {
  const entry = getStringEntry(key);
  if (!entry)
    return [fallback];
  return UI_LANGUAGE_IDS.map(id => entry[id]).filter(text => typeof text === 'string');
}

/**
 * Search data of a row: `text` (descriptions, name, area and context in all languages) and
 * `words` (single words of it plus the keys: names, labels in all languages, aliases),
 * both lower case.
 */
function _searchData(entry) {
  const family = _family(entry);
  const texts = [
    ..._allLanguages(`hotkeys.shortcuts.${entry.name}`, _label(entry)),
    entry.name,
    ...(FAMILY_ORDER.includes(family) ? _allLanguages(`hotkeys.families.${family}`) : [family]),
    ...(CONTEXT_ORDER.includes(entry.context) ? _allLanguages(`hotkeys.contexts.${entry.context}`) : [entry.context]),
  ];
  const keys = (entry.keyCombo ? entry.keyCombo.split('+') : []).flatMap(key => [
    key,
    ...(getStringEntry(`hotkeys.keys.${key}`) ? _allLanguages(`hotkeys.keys.${key}`) : []),
    ...(KEY_SEARCH_ALIASES[key] ?? []),
  ]);

  const text = [...texts, ...keys].join(' ').toLowerCase();
  const words = new Set([...text.split(/[^\p{L}\p{N}]+/u), ...keys.map(key => key.toLowerCase())]);
  words.delete('');
  return { text, words: [...words].join(' ') };
}

function _label(entry) {
  return entry.description || entry.name;
}

function _contextLabel(context) {
  return CONTEXT_ORDER.includes(context) ? t(`hotkeys.contexts.${context}`) : context;
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
  const search = _searchData(entry);

  return `
    <div class="hotkeys__row${changed ? ' hotkeys__row--changed' : ''}" data-hotkey="${escapeHTML(_id(entry))}" data-search="${escapeHTML(search.text)}" data-search-words="${escapeHTML(search.words)}">
      <div class="hotkeys__text">
        <div class="hotkeys__label">${escapeHTML(_label(entry))}${entry.description ? `<span class="hotkeys__name">${escapeHTML(entry.name)}</span>` : ''}</div>
        ${changed ? `<div class="hotkeys__default">${escapeHTML(t('hotkeys.default', { combo: shortcutManager.formatCombo(entry.defaultCombo) || t('hotkeys.noKeyLower') }))}</div>` : ''}
        ${conflicts.length ? `<div class="hotkeys__conflict">${escapeHTML(t('hotkeys.sameKey', { list: conflicts.map(c => `${_label(c)} (${_contextLabel(c.context)})`).join(', ') }))}</div>` : ''}
      </div>
      <button type="button" class="hotkeys__key${entry.keyCombo ? '' : ' hotkeys__key--empty'}" data-key title="${escapeHTML(t('hotkeys.keyTitle'))}">${escapeHTML(entry.displayCombo || t('hotkeys.noKey'))}</button>
      <button type="button" class="icon-button icon-button--small" data-remove title="${escapeHTML(t('hotkeys.removeKey'))}"${entry.keyCombo ? '' : ' disabled'}>✕</button>
      <button type="button" class="icon-button icon-button--small hotkeys__reset" data-reset title="${escapeHTML(t('hotkeys.resetToDefault'))}">${RESET_ICON}</button>
    </div>`;
}

/**
 * Hides rows (and areas / groups without rows) that don't match the search. The search is split
 * into words at spaces and '+' ("toolbar table", "strg+shift+t"), every word has to match, in any
 * order: longer words anywhere in the text, single characters only as a whole word (e.g. the key T).
 */
function _applySearch(list, value) {
  const tokens = value.toLowerCase().split(/[\s+]+/).filter(Boolean);
  const matches = row => tokens.every(token => token.length > 1
    ? row.dataset.search.includes(token)
    : ` ${row.dataset.searchWords} `.includes(` ${token} `));

  list.querySelectorAll('[data-group]').forEach(group => {
    let groupVisible = 0;
    group.querySelectorAll('[data-family]').forEach(family => {
      let visible = 0;
      family.querySelectorAll('[data-search]').forEach(row => {
        const match = matches(row);
        row.classList.toggle('hidden', !match);
        if (match)
          visible++;
      });
      family.classList.toggle('hidden', visible === 0);
      groupVisible += visible;
    });
    group.classList.toggle('hidden', groupVisible === 0);
  });
}

// ─── Recording a key ─────────────────────────────────────────────────────────

function _startRecording(state, row, context, name, render) {
  state.recording?.();
  const button = row.querySelector('[data-key]');
  button.classList.add('hotkeys__key--recording');
  button.textContent = t('hotkeys.recording');

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
      title: t('hotkeys.usedTitle'),
      message: t(canKeepBoth ? 'hotkeys.usedMessageBoth' : 'hotkeys.usedMessage', { combo: shortcutManager.formatCombo(combo), list }),
      choices: [
        { id: 'cancel', label: t('common.cancel') },
        ...(canKeepBoth ? [{ id: 'both', label: t('hotkeys.keepBoth') }] : []),
        { id: 'move', label: t('hotkeys.useHere'), style: 'primary' },
      ],
    });
    if (choice === 'cancel')
      return;
    if (choice === 'move')
      conflicts.forEach(c => shortcutManager.setShortcutCombo(c.context, c.name, ''));
  }
  shortcutManager.setShortcutCombo(context, name, combo);
}
