import { createSearchRegex, findMatches, getReplacement } from '@common/TextSearch.js';
import { flattenNodes } from '@data/ProjectManager.js';
import { findNodeInProject } from '@data/LinkManager.js';

/**
 * ProjectSearch - search over the content of the project entries (doc editor find / replace).
 *
 * Scopes:
 *   'selection' - a range of the open entry
 *   'entry'     - the open entry
 *   'tab'       - all entries of the active tab
 *   'all'       - all entries of all tabs
 */
export const SEARCH_SCOPES = ['selection', 'entry', 'tab', 'all'];

/**
 * Entries of a scope in tree order.
 * @param {Object} project
 * @param {string} scope
 * @param {{ activeTabId: string|null, activeNodeId: string|null }} context
 * @returns {Array<{ tab: Object, node: Object }>}
 */
export function getScopeEntries(project, scope, { activeTabId, activeNodeId }) {
  if (!project)
    return [];

  if (scope === 'selection' || scope === 'entry') {
    const found = activeNodeId ? findNodeInProject(project, activeNodeId) : null;
    return found ? [{ tab: found.tab, node: found.node }] : [];
  }

  const tabs = scope === 'tab'
    ? project.tabs.filter(tab => tab.id === activeTabId)
    : project.tabs;

  return tabs.flatMap(tab => flattenNodes(tab.nodes).map(node => ({ tab, node })));
}

/**
 * @typedef {Object} SearchGroup
 * @property {Object} tab
 * @property {Object} node
 * @property {Array<import('@common/TextSearch.js').TextMatch & { replacement?: string }>} matches
 */

/**
 * Searches the entries of a scope.
 * @param {Object} project
 * @param {import('@common/TextSearch.js').SearchOptions & { replace?: string }} options
 * @param {object} context
 * @param {string} context.scope
 * @param {string|null} context.activeTabId
 * @param {string|null} context.activeNodeId
 * @param {{ start: number, end: number }|null} [context.selection] - range for the 'selection' scope
 * @param {boolean} [context.withReplacement=false] - adds the replacement text to every match
 * @returns {{ error: string|null, groups: SearchGroup[], total: number }} groups only contain entries with matches
 */
export function searchProject(project, options, { scope, activeTabId, activeNodeId, selection = null, withReplacement = false }) {
  const { regex, error } = createSearchRegex(options);
  if (!regex)
    return { error, groups: [], total: 0 };

  const groups = [];
  let total = 0;

  for (const { tab, node } of getScopeEntries(project, scope, { activeTabId, activeNodeId })) {
    const content = node.content ?? '';
    const range = scope === 'selection' && selection
      ? { from: selection.start, to: selection.end }
      : {};
    const matches = findMatches(content, regex, range);
    if (!matches.length)
      continue;

    if (withReplacement) {
      for (const match of matches)
        match.replacement = getReplacement(match, options.replace ?? '', options);
    }

    groups.push({ tab, node, matches });
    total += matches.length;
  }

  return { error: null, groups, total };
}
