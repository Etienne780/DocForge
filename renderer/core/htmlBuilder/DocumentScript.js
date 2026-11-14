import { blobManager } from '@core/BlobManager.js';
import { resolveExportTree } from '@data/NodeTypes.js';
import { stripLinkSyntax } from '@data/LinkManager.js';
import { removeMarkdownMeta, ESCAPE_REGEX } from '@core/markdownParser/MarkdownParser.js';
import { normalizeLineEndings } from '@common/Common.js';
import sharedRuntimeRaw from './runtime/SharedRuntime.js?raw';
import documentRuntimeRaw from './runtime/DocumentRuntime.js?raw';
import previewRuntimeRaw from './runtime/PreviewRuntime.js?raw';

// line endings depend on the checkout (git autocrlf), the output must not
const sharedRuntime = normalizeLineEndings(sharedRuntimeRaw);
const documentRuntime = normalizeLineEndings(documentRuntimeRaw);
const previewRuntime = normalizeLineEndings(previewRuntimeRaw);

const HTML_BUILDER_SCRIPT_BLOB_SECTION = 'html_builder-blob_section';

// ─── Search Index Builder ─────────────────────────────────────────────────────

/**
 * Builds a flat, serialisable search index from all nodes across every tab.
 * Called at export time so the result can be embedded as a JSON literal inside
 * the generated script — no DOM access required at search time.
 *
 * Each entry contains:
 *   nodeId   {string}   – node identifier
 *   tabId    {string}   – owning tab identifier
 *   title    {string}   – node display name
 *   headings {string[]} – markdown headings extracted from node.content
 *   content  {string}   – plain-text body with markdown stripped
 *
 * @param   {Array} tabs  Populated tab array (same shape used by createScript).
 * @returns {Array}       Flat array of search index entries.
 */
function extractSearchIndex(tabs, project = null) {
  const stripCodeFences = (text) => text.replace(/```[\s\S]*?```/g, '\n');

  // \* -> * (the parser shows escaped characters as text)
  const unescape = (text) => text.replace(ESCAPE_REGEX, '$1');

  const stripMd = (text) => unescape(stripLinkSyntax(text, project)
    .replace(/^#{1,6}\s+.+/gm, ' '))           // headings (already indexed)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // links -> label text
    .replace(/[*_~>]+/g, ' ')                  // emphasis / blockquote markers
    .replace(/\s+/g, ' ')
    .trim();

  const entries = [];

  const addEntry = (node, tabId) => {
      // comments and property blocks are not exported, so they must not be found either
      const raw = removeMarkdownMeta(node.content || '');

      // Extract heading text in document order — from a code-fence-free
      // copy, so a '#'-led line inside a fenced code block (a C
      // preprocessor directive, a shell shebang, a Python comment, ...)
      // is never mistaken for a Markdown heading.
      const headings = [];
      let m;
      const re = /^#{1,6}\s+(.+)/gm;
      const rawNoCode = stripCodeFences(raw);
      while ((m = re.exec(rawNoCode)) !== null)
        headings.push(unescape(stripLinkSyntax(m[1], project)).trim());

      entries.push({
        nodeId:   node.id,
        tabId,
        title:    node.name   || '',
        headings,
        content:  stripMd(raw),
      });
  };

  // every exported section; merged children resolve to their page via nodeAliases
  for (const tab of tabs) {
    for (const page of resolveExportTree(tab.nodes).pages) {
      for (const section of page.sections) {
        if (section.showContent)
          addEntry(section.node, tab.id);
      }
    }
  }

  return entries;
}

// ─── Inline Script Builder ────────────────────────────────────────────────────

export function createTabId(tabs) {
  if (!tabs || tabs.length === 0)
    return '__default__';

  const combined = tabs
    .map(t => t.id)
    .filter(Boolean)
    .join('|');

  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }

  return `tab_${Math.abs(hash)}`;
}

export function createScript(tabs, project = null) {
  // Flat list of all pages with their tab id for quick lookup, plus the
  // nodes without an own page (folders, merged children) -> their page.
  const allNodes = [];
  const nodeAliases = {};
  for (const tab of tabs) {
    const tree = resolveExportTree(tab.nodes);
    for (const page of tree.pages)
      allNodes.push({ id: page.node.id, tabId: tab.id });
    Object.assign(nodeAliases, tree.aliases);
  }

  const firstNode = allNodes[0] || null;

  // Build the static search index at export time.
  const searchIndex = extractSearchIndex(tabs, project);

  return `(() => {
var allNodes = ${JSON.stringify(allNodes)};
var nodeAliases = ${JSON.stringify(nodeAliases)};
var firstNode = ${JSON.stringify(firstNode)};
var searchIndex = ${JSON.stringify(searchIndex)};
${sharedRuntime}
${documentRuntime}
})();`;
}

function createNodePreviewScript() {
  return `(() => {
var scrollEl = document.querySelector('.preview-root');
if (!scrollEl)
  return;
${sharedRuntime}
${previewRuntime}
})();`;
}

export function getCachedScriptEntry({id, createContent}) {  
  const entry = blobManager.get(HTML_BUILDER_SCRIPT_BLOB_SECTION, id);
  if (entry)
    return entry;

  const js = createContent();

  const newEntry = blobManager.add(HTML_BUILDER_SCRIPT_BLOB_SECTION, id, { 
    data: js, 
    type: 'application/javascript',
  });
  return newEntry;
}

/** Tabs that contain at least one node — the tabs an exported document shows. */
export function getPopulatedTabs(project) {
  return project.tabs.filter(t => t.nodes.length > 0);
}

export function revokeScriptCache(id) {
  blobManager.remove(HTML_BUILDER_SCRIPT_BLOB_SECTION, id);
}

export function getCachedThemeScriptContent(tabs, project = null) {
  return getCachedScriptEntry({
    id: createTabId(tabs),
    createContent: () => createScript(tabs, project),
  });
}

/**
 * @param {Array} tabs
 * @param {Object} [options]
 * @param {boolean} [options.fresh] - rebuild instead of reusing the cached script
 *   (it holds a snapshot of the pages, aliases and search index)
 * @param {Object|null} [options.project] - resolves link names in the search index
 */
export function buildScript(tabs, { fresh = false, project = null } = {}) {
  if (fresh)
    revokeScriptCache(createTabId(tabs));
  const entry = getCachedThemeScriptContent(tabs, project);
  return `<script src="${entry.url}"></script>`;
}

export function getCachedPreviewNodeScriptConent() {
  return getCachedScriptEntry({
    id: 'node_preview-id',
    createContent: createNodePreviewScript,
  });
}

export function buildNodePreviewScript() {
  const entry = getCachedPreviewNodeScriptConent();
  return `<script src="${entry.url}"></script>`;
}
