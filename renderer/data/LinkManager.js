import { generateId } from '@common/Common.js';
import { notifyProjectChange, flattenNodes, getNodePath } from '@data/ProjectManager.js';
import { NODE_TYPE, getNodeType } from '@data/NodeTypes.js';

// ─── Reference links ────────────────────────────────────────────────────────
//
// A link is defined once in `project.links` and used in content by its slug:
//
//   [[slug]]          -> text is the link's display name
//   [[slug|Text]]     -> custom text
//   {#anchor}         -> marks a place in an entry a link can point to
//
// Link shape: { id, slug, name, target: { nodeId, anchor|null }, refs: [nodeId] }
// `refs` lists the entries whose content uses the slug and is kept up to date
// (rebuildLinkUsages / updateLinkUsagesForNode / removeNodeIdsFromLinkRefs).

/** [[slug]] / [[slug|Text]] - group 1: slug, group 2: text */
export const LINK_USAGE_REGEX = /\[\[([^\]|\n]+?)(?:\|([^\]\n]*))?\]\]/g;
/** {#anchor} - group 1: anchor name (same characters as slugs, no '_' - it is emphasis) */
export const LINK_ANCHOR_REGEX = /\{#([a-z0-9-]+)\}/g;

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function generateLinkId() {
  return 'link_' + generateId();
}

/** 'Name Test' -> 'name-test' */
export function slugifyLinkName(name) {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isLinkSlugValid(slug) {
  return SLUG_REGEX.test(slug ?? '');
}

/** Anchor names follow the same rules as slugs. */
export function isLinkAnchorValid(anchor) {
  return isLinkSlugValid(anchor);
}

export function getProjectLinks(project) {
  return project?.links ?? [];
}

export function findLink(project, linkId) {
  return getProjectLinks(project).find(l => l.id === linkId) ?? null;
}

export function findLinkBySlug(project, slug) {
  return getProjectLinks(project).find(l => l.slug === slug) ?? null;
}

/** HTML id of an anchor; prefixed with the node id so it is unique on merged pages. */
export function getLinkAnchorElementId(nodeId, anchor) {
  return `a-${nodeId}-${anchor}`;
}

// ─── Content scanning ───────────────────────────────────────────────────────

/** Content without fenced and inline code, where the syntax is plain text. */
function _stripCode(content) {
  return (content ?? '')
    .replace(/(`{3,}|~{3,})[\s\S]*?(\1|$)/g, '\n')
    .replace(/`[^`\n]*`/g, '');
}

/** @returns {Array<{ slug: string, text: string|null }>} */
export function findLinkUsagesInContent(content) {
  return [..._stripCode(content).matchAll(LINK_USAGE_REGEX)]
    .map(m => ({ slug: m[1].trim(), text: m[2]?.trim() || null }));
}

/** @returns {string[]} anchor names in order (duplicates included) */
export function findAnchorsInContent(content) {
  return [..._stripCode(content).matchAll(LINK_ANCHOR_REGEX)].map(m => m[1]);
}

/**
 * Plain text of content with link syntax resolved (search index, TOC).
 * @param {string} text
 * @param {Object|null} project
 */
export function stripLinkSyntax(text, project = null) {
  return (text ?? '')
    .replace(LINK_ANCHOR_REGEX, '')
    .replace(LINK_USAGE_REGEX, (_, slug, label) =>
      label?.trim() || findLinkBySlug(project, slug.trim())?.name || slug.trim());
}

/**
 * Finds a node in any tab of the project.
 * @returns {{ node: Object, tab: Object, path: Object[] } | null}
 */
export function findNodeInProject(project, nodeId) {
  for (const tab of project?.tabs ?? []) {
    const path = getNodePath(nodeId, tab.nodes);
    if (path)
      return { node: path[path.length - 1], tab, path };
  }
  return null;
}

// ─── Status ─────────────────────────────────────────────────────────────────

/**
 * Whether a link works and why not. Always computed, never stored.
 * @returns {{ ok: boolean, reason: string|null, warning: string|null }}
 */
export function getLinkStatus(project, link) {
  const result = (ok, reason = null, warning = null) => ({ ok, reason, warning });

  const found = link?.target?.nodeId ? findNodeInProject(project, link.target.nodeId) : null;
  if (!found)
    return result(false, 'Target entry was deleted');

  const anchor = link.target.anchor;
  if (!anchor)
    return result(true);

  if (getNodeType(found.node) === NODE_TYPE.FOLDER)
    return result(false, `'${found.node.name}' is a folder, its content is not exported`);

  const count = findAnchorsInContent(found.node.content).filter(a => a === anchor).length;
  if (count === 0)
    return result(false, `Anchor '#${anchor}' not found in '${found.node.name}'`);
  if (count > 1)
    return result(true, null, `Anchor '#${anchor}' exists ${count} times in '${found.node.name}'`);

  return result(true);
}

/**
 * Slugs used in content that have no link definition.
 * @returns {Array<{ slug: string, nodes: Object[] }>}
 */
export function getUnknownLinkUsages(project) {
  const unknown = new Map();

  for (const tab of project?.tabs ?? []) {
    for (const node of flattenNodes(tab.nodes)) {
      for (const { slug } of findLinkUsagesInContent(node.content)) {
        if (findLinkBySlug(project, slug))
          continue;
        if (!unknown.has(slug))
          unknown.set(slug, []);
        const nodes = unknown.get(slug);
        if (!nodes.includes(node))
          nodes.push(node);
      }
    }
  }

  return [...unknown].map(([slug, nodes]) => ({ slug, nodes }));
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * @param {Object} project
 * @param {{ name: string, slug: string, target: { nodeId: string, anchor: string|null } }} data
 * @returns {Object} the new link
 */
export function createLink(project, { name, slug, target }) {
  const link = {
    id: generateLinkId(),
    slug,
    name,
    target: { nodeId: target?.nodeId ?? null, anchor: target?.anchor || null },
    refs: [],
  };

  notifyProjectChange(project, p => {
    p.links ??= [];
    p.links.push(link);
    link.refs = _collectRefs(p, link.slug);
  }, 'links');

  return link;
}

/**
 * @param {Object} project
 * @param {string} linkId
 * @param {{ name?: string, slug?: string, target?: Object }} changes
 * @param {Object} [options]
 * @param {boolean} [options.updateUsages] - on slug change, rewrite [[old ...]] to [[new ...]] in all usages
 */
export function updateLink(project, linkId, changes, { updateUsages = false } = {}) {
  const link = findLink(project, linkId);
  if (!link)
    return false;

  const oldSlug = link.slug;
  const slugChanged = changes.slug !== undefined && changes.slug !== oldSlug;

  notifyProjectChange(project, p => {
    if (slugChanged && updateUsages) {
      for (const nodeId of link.refs ?? []) {
        const node = findNodeInProject(p, nodeId)?.node;
        if (node)
          node.content = _replaceSlugInContent(node.content, oldSlug, changes.slug);
      }
    }

    if (changes.name !== undefined)
      link.name = changes.name;
    if (changes.slug !== undefined)
      link.slug = changes.slug;
    if (changes.target !== undefined)
      link.target = { nodeId: changes.target.nodeId ?? null, anchor: changes.target.anchor || null };

    if (slugChanged)
      link.refs = _collectRefs(p, link.slug);
  }, slugChanged && updateUsages ? 'tabs:nodes' : 'links');

  return true;
}

export function removeLink(project, linkId) {
  notifyProjectChange(project, p => {
    p.links = getProjectLinks(p).filter(l => l.id !== linkId);
  }, 'links');
}

/** Recomputes every link's `refs` (e.g. after opening or external changes). */
export function rebuildLinkUsages(project) {
  const links = getProjectLinks(project);
  const next = links.map(link => _collectRefs(project, link.slug));
  const changed = links.some((link, i) => !_sameList(link.refs, next[i]));
  if (!changed)
    return false;

  notifyProjectChange(project, () => {
    links.forEach((link, i) => { link.refs = next[i]; });
  }, 'links');
  return true;
}

/** Updates `refs` for one edited node. */
export function updateLinkUsagesForNode(project, nodeId) {
  const node = findNodeInProject(project, nodeId)?.node;
  if (!node)
    return false;

  const used = new Set(findLinkUsagesInContent(node.content).map(u => u.slug));
  const updates = [];

  for (const link of getProjectLinks(project)) {
    const refs = link.refs ?? [];
    const has = refs.includes(nodeId);
    const should = used.has(link.slug);
    if (has !== should)
      updates.push([link, should ? [...refs, nodeId] : refs.filter(id => id !== nodeId)]);
  }

  if (!updates.length)
    return false;

  notifyProjectChange(project, () => {
    updates.forEach(([link, refs]) => { link.refs = refs; });
  }, 'links');
  return true;
}

/**
 * Removes deleted nodes from every link's `refs`. Mutates directly - meant to
 * run inside the change that deletes the nodes.
 */
export function removeNodeIdsFromLinkRefs(project, nodeIds) {
  const ids = new Set(nodeIds);
  for (const link of getProjectLinks(project))
    link.refs = (link.refs ?? []).filter(id => !ids.has(id));
}

function _collectRefs(project, slug) {
  const refs = [];
  for (const tab of project?.tabs ?? []) {
    for (const node of flattenNodes(tab.nodes)) {
      if (findLinkUsagesInContent(node.content).some(u => u.slug === slug))
        refs.push(node.id);
    }
  }
  return refs;
}

const CODE_SEGMENT_REGEX = /(`{3,}|~{3,})[\s\S]*?(?:\1|$)|`[^`\n]*`/g;

/** Rewrites [[oldSlug ...]] to [[newSlug ...]], leaving code (where it is plain text) untouched. */
function _replaceSlugInContent(content, oldSlug, newSlug) {
  const replace = (text) => text.replace(LINK_USAGE_REGEX, (match, slug, label) => {
    if (slug.trim() !== oldSlug)
      return match;
    return label !== undefined ? `[[${newSlug}|${label}]]` : `[[${newSlug}]]`;
  });

  const source = content ?? '';
  let result = '';
  let last = 0;
  for (const code of source.matchAll(CODE_SEGMENT_REGEX)) {
    result += replace(source.slice(last, code.index)) + code[0];
    last = code.index + code[0].length;
  }
  return result + replace(source.slice(last));
}

function _sameList(a = [], b = []) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
