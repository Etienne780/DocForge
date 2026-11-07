import { session } from '@core/SessionState.js';
import { findNodeInProject } from '@data/LinkManager.js';

/**
 * EntryHistory - back / forward between the entries opened in the doc editor.
 *
 * The history lives in project.session.entryHistory (runtime only):
 * { entries: string[] (node ids), index: number, navigating: boolean }.
 * Opening an entry drops the forward part, like a browser.
 */

const MAX_ENTRIES = 100;

function _getHistory(project) {
  if (!project?.session)
    return null;
  project.session.entryHistory ??= { entries: [], index: -1, navigating: false };
  return project.session.entryHistory;
}

/**
 * Adds an opened entry to the history (ignored while going back / forward).
 * @param {Object} project
 * @param {string|null} nodeId
 */
export function recordEntryVisit(project, nodeId) {
  const history = _getHistory(project);
  if (!history || !nodeId || history.navigating)
    return;
  if (history.entries[history.index] === nodeId)
    return;

  history.entries = history.entries.slice(0, history.index + 1);
  history.entries.push(nodeId);
  if (history.entries.length > MAX_ENTRIES)
    history.entries.shift();
  history.index = history.entries.length - 1;
}

/**
 * Opens the previous (-1) or next (+1) entry of the history. Entries that
 * no longer exist are skipped and removed.
 * @param {Object} project
 * @param {-1|1} direction
 * @returns {boolean} true if an entry was opened
 */
export function navigateEntryHistory(project, direction) {
  const history = _getHistory(project);
  if (!history)
    return false;

  let index = history.index + direction;
  while (index >= 0 && index < history.entries.length) {
    const found = findNodeInProject(project, history.entries[index]);
    if (found) {
      history.index = index;
      _openEntry(history, found.tab.id, found.node.id);
      return true;
    }

    // deleted entry
    history.entries.splice(index, 1);
    if (index < history.index)
      history.index--;
    if (direction < 0)
      index--;
  }
  return false;
}

/**
 * Opened entries, the most recent first, each once (e.g. for Quick open).
 * @param {Object} project
 * @returns {string[]} node ids (may contain deleted entries)
 */
export function getRecentEntryIds(project) {
  const history = _getHistory(project);
  if (!history)
    return [];

  // the entry at the current position is the newest visit
  const ordered = [...history.entries.slice(0, history.index + 1).reverse(), ...history.entries.slice(history.index + 1)];
  return [...new Set(ordered)];
}

/** @returns {{ back: boolean, forward: boolean }} */
export function getEntryHistoryState(project) {
  const history = _getHistory(project);
  return {
    back: !!history && history.index > 0,
    forward: !!history && history.index < history.entries.length - 1,
  };
}

function _openEntry(history, tabId, nodeId) {
  history.navigating = true;
  try {
    if (session.get('activeTabId') !== tabId)
      session.set('activeTabId', tabId);
    session.set('activeNodeId', nodeId);
  } finally {
    history.navigating = false;
  }
}
