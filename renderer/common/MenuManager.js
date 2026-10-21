const VIEWPORT_MARGIN = 4;
const SUBMENU_OPEN_DELAY = 300;
const SUBMENU_CLOSE_DELAY = 500;

let host = null;
let panels = [];  // open panels, index = depth (0 = root menu)
let trigger = null; // element that opened the root menu (gets the 'open' class)
let onCloseCallback = null;
let submenuTimer = null;
let panelClassName = ''; // extra class for every panel of the open menu

/**
 * Opens a menu. Closes any menu that is already open.
 *
 * Menu item: { name, description?, shortcut?, shortcutContext?, danger?, action?(event), items?: MenuItem[] }
 * or { divider: true }. An item with `items` is a submenu.
 *
 * @param {Array<Object>} items - Menu items.
 * @param {object} position
 * @param {HTMLElement} [position.anchor] - Element the menu is attached to (below it, flipped up if needed).
 * @param {'start'|'end'} [position.align='start'] - Aligns the menu to the left or right edge of the anchor.
 * @param {number} [position.x] - Cursor position (used when no anchor is given).
 * @param {number} [position.y]
 * @param {object} [options]
 * @param {HTMLElement} [options.trigger] - Element marked with the 'open' class while the menu is open.
 * @param {() => void} [options.onClose]
 * @param {string} [options.className] - Extra class for the menu panels (e.g. 'dropdown--compact').
 */
export function openMenu(items, { anchor = null, align = 'start', x = 0, y = 0 } = {}, { trigger: triggerEl = null, onClose = null, className = '' } = {}) {
  closeMenu();
  if (!items?.length)
    return;

  _ensureHost();
  host.showPopover();

  trigger = triggerEl;
  trigger?.classList.add('open');
  onCloseCallback = onClose;
  panelClassName = className;

  const rect = anchor ? anchor.getBoundingClientRect() : { left: x, right: x, top: y, bottom: y };
  _openPanel(items, 0, rect, { side: 'bottom', align });
}

/** Closes the open menu (and all of its submenus). */
export function closeMenu() {
  if (!panels.length)
    return;

  clearTimeout(submenuTimer);
  panels.forEach(panel => panel.remove());
  panels = [];
  host?.hidePopover();

  trigger?.classList.remove('open');
  trigger = null;

  const callback = onCloseCallback;
  onCloseCallback = null;
  callback?.();
}

/** @returns {boolean} true if `element` opened the menu that is currently open. */
export function isMenuOpenFor(element) {
  return Boolean(panels.length && trigger && trigger === element);
}

/**
 * Opens the menu below `anchor`, or closes it if `anchor` already opened it.
 * @param {HTMLElement} anchor
 * @param {Array<Object>|(() => Array<Object>)} items
 * @param {'start'|'end'} [align='start']
 * @param {string} [className] - Extra class for the menu panels.
 */
export function toggleMenu(anchor, items, align = 'start', className = '') {
  if (isMenuOpenFor(anchor)) {
    closeMenu();
    return;
  }
  openMenu(typeof items === 'function' ? items() : items, { anchor, align }, { trigger: anchor, className });
}

/**
 * Opens a menu at the cursor on right click.
 * @param {HTMLElement} element
 * @param {Array<Object>|(() => Array<Object>)} items - Built on each right click if a function is given.
 * @param {string} [className] - Extra class for the menu panels.
 * @returns {() => void} Removes the listener.
 */
export function addContextMenu(element, items, className = '') {
  const handler = event => {
    event.preventDefault();
    event.stopPropagation();
    openMenu(typeof items === 'function' ? items() : items, { x: event.clientX, y: event.clientY }, { className });
  };
  element.addEventListener('contextmenu', handler);
  return () => element.removeEventListener('contextmenu', handler);
}

// ─── Private ─────────────────────────────────────────────────────────────────

function _ensureHost() {
  if (host?.isConnected)
    return;

  host = document.createElement('div');
  host.className = 'menu-host';
  host.setAttribute('popover', 'manual');
  document.body.append(host);

  // Close on any press outside of the menu. A press on the trigger is left to
  // the trigger's own click handler (toggle).
  document.addEventListener('pointerdown', event => {
    if (!panels.length || host.contains(event.target) || trigger?.contains(event.target))
      return;
    closeMenu();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panels.length)
      closeMenu();
  }, true);

  // Anchored positions go stale when something scrolls or the window changes.
  document.addEventListener('scroll', event => {
    if (panels.length && !host.contains(event.target))
      closeMenu();
  }, true);
  window.addEventListener('resize', closeMenu);
  window.addEventListener('blur', closeMenu);
}

function _openPanel(items, depth, rect, placement) {
  _closePanelsFrom(depth);

  const panel = document.createElement('div');
  panel.className = panelClassName ? `dropdown ${panelClassName}` : 'dropdown';
  panel.setAttribute('role', 'menu');
  for (const item of items)
    panel.append(_createItem(item, depth));

  host.append(panel);
  panels[depth] = panel;
  _place(panel, rect, placement);
}

function _closePanelsFrom(depth) {
  panels.splice(depth).forEach(panel => panel.remove());
  panels[depth - 1]?.querySelectorAll('.dropdown-group.open').forEach(g => g.classList.remove('open'));
}

function _createItem(item, depth) {
  if (item.divider) {
    const divider = document.createElement('div');
    divider.className = 'dropdown-divider';
    return divider;
  }

  if (item.items)
    return _createGroup(item, depth);

  const element = document.createElement('div');
  element.className = 'dropdown-item';
  element.setAttribute('role', 'menuitem');
  if (item.description)
    element.title = item.description;
  if (item.danger)
    element.classList.add('dropdown-item--danger');

  const label = document.createElement('span');
  label.textContent = item.name;

  const shortcut = document.createElement('span');
  shortcut.className = 'shortcut';
  if (item.shortcut) {
    // filled in by ShortcutManager (DOM observer)
    shortcut.dataset.shortcutLabel = item.shortcut;
    shortcut.dataset.shortcutContext = item.shortcutContext ?? 'global';
  }

  element.append(label, shortcut);

  element.addEventListener('mouseenter', () => _scheduleSubmenu(() => _closePanelsFrom(depth + 1), SUBMENU_CLOSE_DELAY));
  element.addEventListener('click', event => {
    closeMenu();
    item.action?.(event);
  });

  return element;
}

function _createGroup(item, depth) {
  const group = document.createElement('div');
  group.className = 'dropdown-group';
  group.dataset.group = item.name;

  const label = document.createElement('div');
  label.className = 'dropdown-group-label';
  label.setAttribute('role', 'menuitem');

  const labelText = document.createElement('span');
  labelText.textContent = item.name;

  const arrow = document.createElement('span');
  arrow.className = 'dropdown-group-arrow codicon';

  label.append(labelText, arrow);
  group.append(label);

  const open = () => {
    if (group.classList.contains('open'))
      return;
    _openPanel(item.items, depth + 1, group.getBoundingClientRect(), { side: 'right', align: 'start' });
    group.classList.add('open');
  };

  group.addEventListener('mouseenter', () => _scheduleSubmenu(open, SUBMENU_OPEN_DELAY));
  group.addEventListener('click', () => {
    clearTimeout(submenuTimer);
    open();
  });

  return group;
}

function _scheduleSubmenu(fn, delay) {
  clearTimeout(submenuTimer);
  submenuTimer = setTimeout(fn, delay);
}

/**
 * Positions a panel next to `rect` and keeps it inside the viewport.
 * side 'bottom': below the rect, flipped above if there is more room there.
 * side 'right':  right of the rect, flipped to the left if it doesn't fit.
 * Panels taller than the viewport are capped by CSS (max-height) and scroll.
 */
function _place(panel, rect, { side, align }) {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const { width, height } = panel.getBoundingClientRect();

  let left;
  let top;

  if (side === 'right') {
    left = rect.right;
    if (left + width > viewportWidth - VIEWPORT_MARGIN)
      left = rect.left - width;
    // first item level with the group label
    const style = getComputedStyle(panel);
    top = rect.top - parseFloat(style.paddingTop) - parseFloat(style.borderTopWidth);
  } else {
    left = align === 'end' ? rect.right - width : rect.left;
    if (align === 'end' ? left < VIEWPORT_MARGIN : left + width > viewportWidth - VIEWPORT_MARGIN)
      left = align === 'end' ? rect.left : rect.right - width;

    const spaceBelow = viewportHeight - VIEWPORT_MARGIN - rect.bottom;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    top = height <= spaceBelow || spaceBelow >= spaceAbove ? rect.bottom : rect.top - height;
  }

  panel.style.left = `${_clamp(left, VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN)}px`;
  panel.style.top = `${_clamp(top, VIEWPORT_MARGIN, viewportHeight - height - VIEWPORT_MARGIN)}px`;
}

function _clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
