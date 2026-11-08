import { session } from '@core/SessionState.js';
import { eventBus } from '@core/EventBus.js';
import { getStateNumber } from '@core/State.js';
import { cleanSaveProject, getOpenProject, setProjectVersion } from '@data/ProjectManager.js';
import { rebuildLinkUsages } from '@data/LinkManager.js';
import { t } from '@core/i18n/I18n.js';

/**
 * ProjectHistory - undo / redo of project changes.
 *
 * Every tracked change goes through notifyProjectChange() (ProjectManager.js), which calls
 * prepareHistoryStep() before and commitHistoryStep() after the change. A step stores the
 * project as it was BEFORE the change (JSON of cleanSaveProject), its version and where the
 * user was (view route, active tab / entry). Changes with the same key in quick succession
 * are one step (typing in an entry, dragging a slider).
 *
 * Undo puts the current state on the redo stack and writes the step's state back into the
 * live project object (reconcile: objects with the same id stay the same objects, so views
 * holding a theme / tab keep working), then jumps to where the change happened.
 * The description ("Delete entry 'Setup'") and the target are computed by comparing the two
 * states (describeChange), so callers don't have to label their changes.
 *
 * The history lives in project.session.history (runtime only): saving keeps it, closing or
 * reopening the project starts a new one. Max steps: state 'historySize'.
 */

/** Same key within this time = same step. Keys given by the caller (e.g. typing) get longer. */
const COALESCE_AUTO_MS = 300;
const COALESCE_KEYED_MS = 1500;
/** Total size of all stored states (characters), the oldest steps are dropped above it. */
const MAX_HISTORY_CHARS = 150_000_000;

/** Every change event the views listen to; a restore emits all of them. */
const RESTORE_EXTENSIONS = [
  'tabs', 'tabs:name', 'tabs:nodes', 'tabs:nodes:name', 'tabs:nodes:type',
  'links', 'themes', 'themes:entries', 'languages', 'settings',
];

/** Fields of the project that are not part of the history (where it is stored). */
const KEEP_KEYS = new Set(['session', 'id', 'sourcePath', 'sourceKind']);

let _routeProvider = () => null;
let _restoring = false;

// ─── Setup ────────────────────────────────────────────────────────────────────

/**
 * Where the user is, stored with every step (ViewManager registers it).
 * @param {() => ({ event: string, props: Object }|null)} provider
 */
export function setHistoryRouteProvider(provider) {
  _routeProvider = provider ?? (() => null);
}

/**
 * @typedef {Object} HistoryStep
 * @property {string} before   - project JSON before the change
 * @property {number} version  - project.session.version before the change
 * @property {string|null} key - steps with the same key in quick succession are merged
 * @property {number} time     - last change merged into the step
 * @property {{ event: string, props: Object }|null} route
 * @property {string|null} tabId
 * @property {string|null} nodeId
 */

/**
 * @typedef {Object} RedoStep
 * @property {string} state    - project JSON after the change
 * @property {number} version
 * @property {string} label
 * @property {Object|null} target
 * @property {{ event: string, props: Object }|null} route
 */

function _history(project) {
  if (!project?.session)
    return null;
  project.session.history ??= { undo: [], redo: [], open: null, chars: 0 };
  return project.session.history;
}

function _serialize(project) {
  return JSON.stringify(cleanSaveProject(project));
}

// ─── Recording (called by notifyProjectChange) ───────────────────────────────

/**
 * Called before a tracked change. Returns what commitHistoryStep needs.
 * @param {Object} project
 * @param {string|null} extension - change extension of notifyProjectChange
 * @param {{ key?: string, label?: string }|null} [options] - key: merge with the previous step of this key
 *        (e.g. 'content:<nodeId>'); label: fixed description instead of the computed one (never merged)
 * @returns {Object|null}
 */
export function prepareHistoryStep(project, extension, options = null) {
  const history = _history(project);
  if (!history || _restoring)
    return null;

  const now = Date.now();
  const keyed = Boolean(options?.key);
  const label = options?.label ?? null;
  const key = options?.key ?? (label ? `label:${now}` : `auto:${extension ?? ''}`);
  const top = history.undo[history.undo.length - 1];

  // only the step that was just recorded can grow (not one that came back with redo / undo)
  if (top && top === history.open && top.key === key && now - top.time < (keyed ? COALESCE_KEYED_MS : COALESCE_AUTO_MS))
    return { merge: top, time: now };

  return {
    step: {
      before: _serialize(project),
      version: project.session.version,
      key,
      label,
      time: now,
      route: _routeProvider(),
      tabId: session.get('activeTabId') ?? null,
      nodeId: session.get('activeNodeId') ?? null,
    },
  };
}

/**
 * Called after the change. Stores the step if something actually changed.
 * @param {Object} project
 * @param {Object|null} prepared - result of prepareHistoryStep
 */
export function commitHistoryStep(project, prepared) {
  const history = _history(project);
  if (!history || !prepared)
    return;

  if (prepared.merge) {
    prepared.merge.time = prepared.time;
    eventBus.emit('history:change', { project });
    return;
  }

  const { step } = prepared;
  if (_serialize(project) === step.before)
    return;

  history.undo.push(step);
  history.chars += step.before.length;
  history.open = step;
  history.redo = [];
  _trim(history);
  eventBus.emit('history:change', { project });
}

function _trim(history) {
  const max = getStateNumber('historySize');
  while (history.undo.length > max || (history.chars > MAX_HISTORY_CHARS && history.undo.length > 1)) {
    const dropped = history.undo.shift();
    history.chars -= dropped.before.length;
  }
}

/** Empties the history. */
export function clearProjectHistory(project = getOpenProject()) {
  if (!project?.session)
    return;
  project.session.history = null;
  eventBus.emit('history:change', { project });
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function canUndo(project = getOpenProject()) {
  return Boolean(project?.session?.history?.undo.length);
}

export function canRedo(project = getOpenProject()) {
  return Boolean(project?.session?.history?.redo.length);
}

/** @returns {string|null} what the next undo reverts, e.g. "Delete entry 'Setup'" */
export function getUndoLabel(project = getOpenProject()) {
  const top = project?.session?.history?.undo.at(-1);
  if (!top)
    return null;
  return top.label ?? describeChange(JSON.parse(top.before), cleanSaveProject(project)).label;
}

/** @returns {string|null} what the next redo repeats */
export function getRedoLabel(project = getOpenProject()) {
  return project?.session?.history?.redo.at(-1)?.label ?? null;
}

// ─── Undo / Redo ──────────────────────────────────────────────────────────────

/**
 * Reverts the last step of the open project and jumps to where it happened.
 * @returns {boolean} false if there is nothing to undo
 */
export function undoProjectChange(project = getOpenProject()) {
  const history = _history(project);
  const step = history?.undo.pop();
  if (!step)
    return false;

  history.chars -= step.before.length;
  const current = _serialize(project);
  const before = JSON.parse(step.before);
  const described = describeChange(before, JSON.parse(current));
  const label = step.label ?? described.label;
  const { target } = described;

  history.redo.push({ state: current, version: project.session.version, label, fixedLabel: step.label ?? null, target, route: step.route });
  history.open = null;
  _applyState(project, before, JSON.parse(current), step.version);
  _reveal(project, step.route, target, step).catch(error => console.error('[ProjectHistory] reveal failed:', error));

  eventBus.emit('toast:show', { message: `Undo: ${label}`, type: 'info' });
  eventBus.emit('history:change', { project });
  return true;
}

/**
 * Repeats the last undone step.
 * @returns {boolean} false if there is nothing to redo
 */
export function redoProjectChange(project = getOpenProject()) {
  const history = _history(project);
  const redo = history?.redo.pop();
  if (!redo)
    return false;

  const current = _serialize(project);
  const step = {
    before: current,
    version: project.session.version,
    key: null,
    label: redo.fixedLabel ?? null,
    time: 0,
    route: redo.route,
    tabId: session.get('activeTabId') ?? null,
    nodeId: session.get('activeNodeId') ?? null,
  };
  history.undo.push(step);
  history.chars += current.length;
  history.open = null;
  _trim(history);

  _applyState(project, JSON.parse(redo.state), JSON.parse(current), redo.version);
  _reveal(project, redo.route, redo.target, null).catch(error => console.error('[ProjectHistory] reveal failed:', error));

  eventBus.emit('toast:show', { message: `Redo: ${redo.label}`, type: 'info' });
  eventBus.emit('history:change', { project });
  return true;
}

// ─── Restoring a state ────────────────────────────────────────────────────────

/**
 * Writes `next` into the live project and tells every view.
 * @param {Object} project - live project (stays the same object)
 * @param {Object} next    - state to restore (cleanSaveProject shape)
 * @param {Object} current - state before the restore (for the folder bookkeeping)
 * @param {number} version - version of `next`, so undoing back to the saved state is "saved" again
 */
function _applyState(project, next, current, version) {
  _restoring = true;
  try {
    _reconcileObject(project, next, KEEP_KEYS);
    _updateFolderBookkeeping(project, current, next);
    setProjectVersion(project, version);
    rebuildLinkUsages(project);
  } finally {
    _restoring = false;
  }

  _notifyAll(project);
}

function _notifyAll(project) {
  session.notify('openProject', { value: project, previousValue: project });
  for (const extension of RESTORE_EXTENSIONS)
    session.notify('openProject', { value: project, previousValue: project }, extension);
}

/**
 * Replaces the content of the live project with `data` (cleanSaveProject shape) in place,
 * inside a notifyProjectChange mutate function, so it is one undo step (e.g. restoring a
 * backup). Keeps id, location and session; adds the folder bookkeeping like an undo.
 * Call notifyProjectReplaced(project) after the change.
 * @param {Object} project
 * @param {Object} data
 */
export function replaceProjectContent(project, data) {
  // a copy: cleanSaveProject shares the theme / language objects that the reconcile changes
  const current = JSON.parse(_serialize(project));
  _reconcileObject(project, structuredClone(data), KEEP_KEYS);
  _updateFolderBookkeeping(project, current, data);
}

/** Tells every view that the whole project content changed (after replaceProjectContent). */
export function notifyProjectReplaced(project) {
  rebuildLinkUsages(project);
  _notifyAll(project);
}

const _isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Makes `target` equal to `source`, keeping nested objects that have the same id (or position). */
function _reconcileObject(target, source, skip = null) {
  for (const key of Object.keys(target)) {
    if (!skip?.has(key) && !(key in source))
      delete target[key];
  }
  for (const [key, value] of Object.entries(source)) {
    if (!skip?.has(key))
      target[key] = _reconcileValue(target[key], value);
  }
}

function _reconcileValue(current, next) {
  if (Array.isArray(next)) {
    if (!Array.isArray(current))
      return next;

    const byId = new Map(current.filter(item => _isObject(item) && item.id != null).map(item => [item.id, item]));
    const result = next.map((item, i) => {
      if (!_isObject(item))
        return item;
      // with an id: the object with this id; without: the object at the same position
      const match = item.id != null
        ? byId.get(item.id)
        : (_isObject(current[i]) && current[i].id == null ? current[i] : null);
      if (!match)
        return item;
      _reconcileObject(match, item);
      return match;
    });
    current.length = 0;
    current.push(...result);
    return current;
  }

  if (_isObject(next)) {
    if (!_isObject(current))
      return next;
    _reconcileObject(current, next);
    return current;
  }

  return next;
}

/**
 * Folder projects delete / rename files only on save, from project.session.deletedTabIds /
 * deletedNodeIds / deletedThemeIds / deletedLanguageIds. Everything that the restore removes
 * or moves to another file is added there with its current location. The explicit deletes
 * run before the files are written (ElectronDocumentIOAdapter._writeFolder), so a file that
 * the restored state writes again is simply written new. Entries are only added, never
 * removed (an extra delete is harmless, a missing one lets the save bring old files back).
 */
function _updateFolderBookkeeping(project, current, next) {
  const projectSession = project.session;
  if (project.sourceKind !== 'folder' || !projectSession)
    return;

  const folderOf = tab => tab.folderName ?? tab.name;
  const nextTabs = new Map((next.tabs ?? []).map(tab => [tab.id, tab]));
  const nextNodes = new Map();
  for (const tab of next.tabs ?? []) {
    for (const node of _flatten(tab.nodes))
      nextNodes.set(node.id, `${folderOf(tab)}/${node.fileName ?? node.name}`);
  }

  for (const tab of current.tabs ?? []) {
    const folder = folderOf(tab);
    const nextTab = nextTabs.get(tab.id);
    if (!nextTab || folderOf(nextTab) !== folder)
      projectSession.deletedTabIds[`${tab.id}@${folder}`] = folder;

    for (const node of _flatten(tab.nodes)) {
      const fileName = node.fileName ?? node.name;
      if (nextNodes.get(node.id) !== `${folder}/${fileName}`)
        projectSession.deletedNodeIds[`${node.id}@${folder}/${fileName}`] = { tabFolderName: folder, fileName };
    }
  }

  const nextThemeIds = new Set((next.themes ?? []).map(theme => theme.id));
  for (const theme of current.themes ?? []) {
    if (!nextThemeIds.has(theme.id))
      projectSession.deletedThemeIds[theme.id] = true;
  }

  const nextLanguageIds = new Set((next.languages ?? []).map(lang => lang.id));
  for (const lang of current.languages ?? []) {
    if (!nextLanguageIds.has(lang.id))
      projectSession.deletedLanguageIds[lang.id] = true;
  }
}

function _flatten(nodes) {
  return (nodes ?? []).flatMap(node => [node, ..._flatten(node.children)]);
}

// ─── Jumping to the change ────────────────────────────────────────────────────

const EDITOR_VIEWS = ['navigate:themeEditor', 'navigate:languageEditor', 'navigate:languageStyleEditor'];

/**
 * Opens where the change happened: the entry / tab in the doc editor, or the theme /
 * language editor the change was made in (reloaded, so its controls show the restored values).
 */
async function _reveal(project, route, target, step) {
  const { viewManager } = await import('@core/ViewManager.js');
  const currentRoute = viewManager.getCurrentRoute();
  const event = route?.event ?? null;

  const isDocTarget = target?.type === 'node' || target?.type === 'tab';
  if (isDocTarget || event === 'navigate:docEditor') {
    _selectInDocEditor(project, target, step);
    if (currentRoute?.event !== 'navigate:docEditor')
      viewManager.show('navigate:docEditor');
    return;
  }

  if (EDITOR_VIEWS.includes(event)) {
    // the edited item may be gone (e.g. undo of creating a theme)
    const exists = _routeItemExists(project, route.props ?? {});
    if (!exists) {
      viewManager.show('navigate:appearanceManager');
      return;
    }
    viewManager.show(event, route.props ?? {}, { force: true });
    return;
  }

  if (EDITOR_VIEWS.includes(currentRoute?.event)) {
    // the open editor shows values that may have changed
    if (_routeItemExists(project, currentRoute.props ?? {}))
      viewManager.show(currentRoute.event, currentRoute.props ?? {}, { force: true });
    else
      viewManager.show('navigate:appearanceManager');
    return;
  }

  if (event && event !== currentRoute?.event)
    viewManager.show(event, route.props ?? {});
}

function _routeItemExists(project, { themeId, langId, styleId }) {
  if (themeId && !(project.themes ?? []).some(theme => theme.id === themeId))
    return false;
  if (langId && !(project.languages ?? []).some(lang => lang.id === langId))
    return false;
  if (styleId && !(project.languagesStyles ?? []).some(style => style.id === styleId))
    return false;
  return true;
}

function _selectInDocEditor(project, target, step) {
  const findTab = nodeId => (project.tabs ?? []).find(tab => _flatten(tab.nodes).some(node => node.id === nodeId));

  // the changed entry if it exists in the restored state, else the entry the user was in
  for (const nodeId of [target?.nodeId, target?.parentId, step?.nodeId]) {
    const tab = nodeId ? findTab(nodeId) : null;
    if (tab) {
      if (session.get('activeTabId') !== tab.id)
        session.set('activeTabId', tab.id);
      if (session.get('activeNodeId') !== nodeId)
        session.set('activeNodeId', nodeId);
      return;
    }
  }

  const tabId = [target?.tabId, step?.tabId].find(id => (project.tabs ?? []).some(tab => tab.id === id));
  if (tabId && session.get('activeTabId') !== tabId)
    session.set('activeTabId', tabId);
}

// ─── Describing a change ──────────────────────────────────────────────────────

function _indexNodes(state) {
  const index = new Map();
  for (const tab of state.tabs ?? []) {
    const walk = (nodes, parentId) => (nodes ?? []).forEach((node, position) => {
      index.set(node.id, { node, tabId: tab.id, parentId, position });
      walk(node.children, node.id);
    });
    walk(tab.nodes, null);
  }
  return index;
}

const _same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const MAX_LABEL_NAME = 40;
const _quote = name => {
  const text = String(name ?? '');
  return `'${text.length > MAX_LABEL_NAME ? `${text.slice(0, MAX_LABEL_NAME - 1)}…` : text}'`;
};
const _more = items => items.length > 1 ? t('data.history.more', { count: items.length - 1 }) : '';
/** Label in the current UI language; noun: key of data.history.nouns */
const _label = (verb, noun, vars) => t(`data.history.${verb}`, { noun: t(`data.history.nouns.${noun}`), ...vars });

function _describeList(a, b, noun, { getName = item => item.name, compare = null } = {}) {
  const before = new Map((a ?? []).map(item => [item.id, item]));
  const after = new Map((b ?? []).map(item => [item.id, item]));

  const added = [...after.values()].filter(item => !before.has(item.id));
  if (added.length)
    return { label: _label('create', noun, { name: _quote(getName(added[0])), more: _more(added) }), item: added[0] };

  const removed = [...before.values()].filter(item => !after.has(item.id));
  if (removed.length)
    return { label: _label('delete', noun, { name: _quote(getName(removed[0])), more: _more(removed) }), item: removed[0] };

  for (const [id, item] of after) {
    const old = before.get(id);
    if (getName(old) !== getName(item))
      return { label: _label('rename', noun, { old: _quote(getName(old)), new: _quote(getName(item)) }), item };
  }

  for (const [id, item] of after) {
    if (!_same(compare ? compare(before.get(id)) : before.get(id), compare ? compare(item) : item))
      return { label: _label('change', noun, { name: _quote(getName(item)) }), item };
  }

  if (!_same((a ?? []).map(i => i.id), (b ?? []).map(i => i.id)))
    return { label: t('data.history.reorder', { nouns: t(`data.history.nounsPlural.${noun}`) }), item: null };

  return null;
}

/**
 * What changed from `a` to `b`, as a short text, and where (for jumping there).
 * @param {Object} a - state before (cleanSaveProject shape)
 * @param {Object} b - state after
 * @returns {{ label: string, target: Object|null }}
 *   target: { type: 'node', tabId, nodeId, parentId } | { type: 'tab', tabId } | { type: 'theme'|'language'|'style', id } | null
 */
export function describeChange(a, b) {
  // ── entries ──
  const nodesA = _indexNodes(a);
  const nodesB = _indexNodes(b);
  const nodeTarget = (info, id) => ({ type: 'node', tabId: info.tabId, nodeId: id, parentId: info.parentId });

  const removed = [...nodesA.keys()].filter(id => !nodesB.has(id) && !(nodesA.get(id).parentId && !nodesB.has(nodesA.get(id).parentId) && nodesA.has(nodesA.get(id).parentId)));
  const tabsRemoved = (a.tabs ?? []).filter(tab => !(b.tabs ?? []).some(t => t.id === tab.id));
  const removedOutsideTabs = removed.filter(id => !tabsRemoved.some(tab => tab.id === nodesA.get(id).tabId));
  if (removedOutsideTabs.length) {
    const info = nodesA.get(removedOutsideTabs[0]);
    return { label: _label('delete', 'entry', { name: _quote(info.node.name), more: _more(removedOutsideTabs) }), target: nodeTarget(info, removedOutsideTabs[0]) };
  }

  const tabsAdded = (b.tabs ?? []).filter(tab => !(a.tabs ?? []).some(t => t.id === tab.id));
  const added = [...nodesB.keys()].filter(id => !nodesA.has(id) && !(nodesB.get(id).parentId && !nodesA.has(nodesB.get(id).parentId) && nodesB.has(nodesB.get(id).parentId)));
  const addedOutsideTabs = added.filter(id => !tabsAdded.some(tab => tab.id === nodesB.get(id).tabId));
  if (addedOutsideTabs.length) {
    const info = nodesB.get(addedOutsideTabs[0]);
    return { label: _label('create', 'entry', { name: _quote(info.node.name), more: _more(addedOutsideTabs) }), target: nodeTarget(info, addedOutsideTabs[0]) };
  }

  const moved = [], renamed = [], edited = [], retyped = [], reordered = [];
  for (const [id, after] of nodesB) {
    const before = nodesA.get(id);
    if (!before)
      continue;
    if (before.tabId !== after.tabId || before.parentId !== after.parentId)
      moved.push(id);
    else if (before.position !== after.position)
      reordered.push(id);
    if (before.node.name !== after.node.name)
      renamed.push(id);
    if (before.node.content !== after.node.content)
      edited.push(id);
    const { content: _c1, children: _k1, name: _n1, ...restA } = before.node;
    const { content: _c2, children: _k2, name: _n2, ...restB } = after.node;
    if (!_same(restA, restB))
      retyped.push(id);
  }

  if (moved.length) {
    const info = nodesB.get(moved[0]);
    return { label: _label('move', 'entry', { name: _quote(info.node.name), more: _more(moved) }), target: nodeTarget(info, moved[0]) };
  }
  if (renamed.length) {
    const id = renamed[0];
    return { label: _label('rename', 'entry', { old: _quote(nodesA.get(id).node.name), new: _quote(nodesB.get(id).node.name) }), target: nodeTarget(nodesB.get(id), id) };
  }
  if (edited.length) {
    const info = nodesB.get(edited[0]);
    const label = edited.length > 1 ? t('data.history.editTextMany', { count: edited.length }) : t('data.history.editText', { name: _quote(info.node.name) });
    return { label, target: nodeTarget(info, edited[0]) };
  }
  if (retyped.length) {
    const info = nodesB.get(retyped[0]);
    return { label: _label('change', 'entry', { name: _quote(info.node.name) }), target: nodeTarget(info, retyped[0]) };
  }
  if (reordered.length) {
    const info = nodesB.get(reordered[0]);
    return { label: _label('move', 'entry', { name: _quote(info.node.name), more: '' }), target: nodeTarget(info, reordered[0]) };
  }

  // ── tabs ──
  const tabs = _describeList(a.tabs, b.tabs, 'tab', { compare: tab => tab && { ...tab, nodes: undefined } });
  if (tabs)
    return { label: tabs.label, target: tabs.item ? { type: 'tab', tabId: tabs.item.id } : null };

  // ── themes, languages, styles ──
  if (a.settings?.currentThemeId !== b.settings?.currentThemeId || a.settings?.isThemePreset !== b.settings?.isThemePreset)
    return { label: t('data.history.activeTheme'), target: null };

  const themes = _describeList(a.themes, b.themes, 'theme');
  if (themes)
    return { label: themes.label, target: themes.item ? { type: 'theme', id: themes.item.id } : null };

  const languages = _describeList(a.languages, b.languages, 'language');
  if (languages)
    return { label: languages.label, target: languages.item ? { type: 'language', id: languages.item.id } : null };

  const styles = _describeList(a.languagesStyles, b.languagesStyles, 'style');
  if (styles)
    return { label: styles.label, target: styles.item ? { type: 'style', id: styles.item.id } : null };

  // ── rest ──
  const links = _describeList(a.links, b.links, 'link', { getName: link => link.slug, compare: link => link && { ...link, refs: undefined } });
  if (links)
    return { label: links.label, target: null };

  if (a.name !== b.name)
    return { label: t('data.history.renameProject', { name: _quote(b.name) }), target: null };
  if (!_same(a.settings, b.settings))
    return { label: t('data.history.projectSettings'), target: null };

  return { label: t('data.history.project'), target: null };
}
