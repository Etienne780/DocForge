import { state } from '@core/State.js';
import { getActiveProject, getActiveTab, flattenNodes, getActiveDocTheme  } from '@data/ProjectManager.js';
import { parseMarkdown } from './MarkdownParser.js';

// ─── HTML Export ──────────────────────────────────────────────────────────────

/**
 * Builds a nested <nav> HTML string for the export sidebar.
 * @param {Array} nodes
 * @param {number} [depth]
 * @returns {string}
 */
function buildExportNavigation(nodes, depth = 0) {
  const paddingLeft = 16 + depth * 14;
  
  return nodes.map(node => {
    const parentClass = node.children.length ? ' export-nav__item--parent' : '';
    const link = `<a class="export-nav__item${parentClass}" style="--indent:${paddingLeft}px" href="#${node.id}">${escapeHTML(node.name)}</a>`;
    const children = node.children.length ? buildExportNavigation(node.children, depth + 1) : '';
    return link + children;
  }).join('');
}

/**
 * Builds the main content HTML for the export document.
 * @param {Array} nodes
 * @param {number} [depth]
 * @returns {string}
 */
function buildExportContent(nodes, depth = 0) {
  return nodes.map(node => {
    const content = (node.content || '').trim();
    const hasHeading = /^#{1,6}\s/.test(content);
    const headingHTML = hasHeading ? '' : `<h1>${escapeHTML(node.name)}</h1>\n`;
    const childClass = depth > 0 ? ' export-section--child' : '';
    const childrenHTML = node.children.length ? buildExportContent(node.children, depth + 1) : '';
    return `<section id="${node.id}" class="export-section${childClass}">${headingHTML}<div class="export-section__body">${parseMarkdown(content)}</div></section>${childrenHTML}`;
  }).join('');
}

/**
 * Generates and triggers download of a standalone HTML export of the current tab.
 */
export function exportCurrentTabAsHTML() {
  const project = getActiveProject();
  if (!project) return { success: false, message: 'No active project.' };

  const tab = getActiveTab();
  if (!tab) return { success: false, message: 'No active tab.' };

  if (!tab.nodes.length) return { success: false, message: 'No entries to export.' };

  return null /*leckei*/;

  const tabLabels = { explanation: 'Explanation', examples: 'Examples', reference: 'Reference' };
  const activeTab = state.get('activeTab');
  const tabLabel = tabLabels[activeTab] ?? activeTab;

  const navigationHTML = buildExportNavigation(tab.nodes);
  const contentHTML    = buildExportContent(tab.nodes);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(project.name)} - ${tabLabel}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0c0c12;--bg1:#111119;--bg2:#181826;--brd:#252538;--text:#e0dbd0;--muted:#9898b0;--accent:#22d4a8;--link:#78a8ff;--cbg:#07070f;--ctext:#80d89a}
body{font-family:Georgia,serif;background:var(--bg);color:var(--text);font-size:15px;line-height:1.8}
.layout{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
.nav{background:var(--bg1);border-right:1px solid var(--brd);padding:20px 0;position:sticky;top:0;height:100vh;overflow-y:auto}
.nav-brand{padding:0 16px 16px;font-size:18px;color:var(--accent);font-family:Georgia,serif;font-style:italic;border-bottom:1px solid var(--brd);margin-bottom:8px}
.nav-brand small{display:block;font-size:11px;color:var(--muted);margin-top:3px;font-style:normal}
.export-nav__item{display:block;padding:4px 0;color:var(--muted);text-decoration:none;font-family:monospace;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.export-nav__item:hover{color:var(--accent)}
.export-nav__item--parent{color:var(--text);font-weight:600;margin-top:8px}
.main{padding:40px 52px;max-width:820px}
h1{font-size:26px;font-weight:600;margin:0 0 18px;border-bottom:1px solid var(--brd);padding-bottom:12px}
h2{font-size:20px;font-weight:600;margin:26px 0 10px}
h3{font-family:monospace;font-size:11px;font-weight:700;color:var(--accent);margin:22px 0 8px;text-transform:uppercase;letter-spacing:.08em}
h4{font-family:monospace;font-size:11px;color:var(--muted);margin:18px 0 6px}
p{margin:0 0 12px}
a{color:var(--link);text-decoration:none;border-bottom:1px solid rgba(120,168,255,.3)}
a:hover{border-color:var(--link)}
strong{font-weight:600}
em{color:#ffad45;font-style:italic}
code{font-family:monospace;font-size:12px;background:var(--cbg);color:var(--ctext);padding:2px 6px;border-radius:3px;border:1px solid #1e1e30}
pre{background:var(--cbg);border:1px solid #1e1e30;border-radius:5px;padding:14px 16px;margin:12px 0;overflow-x:auto;position:relative}
pre code{background:none;border:none;padding:0;font-size:12.5px;line-height:1.65}
.code-language-tag{position:absolute;top:8px;right:10px;font-family:monospace;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
ul,ol{padding-left:22px;margin:8px 0 12px}
li{margin:3px 0}
blockquote{border-left:3px solid var(--accent);margin:12px 0;padding:8px 14px;background:rgba(34,212,168,.08);color:var(--muted);border-radius:0 5px 5px 0}
hr{border:none;border-top:1px solid var(--brd);margin:22px 0}
table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px}
th{background:var(--bg2);border:1px solid var(--brd);padding:7px 11px;text-align:left;font-family:monospace;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
td{border:1px solid var(--brd);padding:7px 11px}
.export-section{margin-bottom:48px;padding-bottom:48px;border-bottom:2px solid var(--brd)}
.export-section:last-child{border-bottom:none}
.export-section--child{margin-left:24px;padding-left:20px;border-left:2px solid var(--brd);border-bottom:1px solid var(--brd);margin-bottom:32px;padding-bottom:32px}
.export-section__body{max-width:680px}
</style>
</head>
<body>
<div class="layout">
  <nav class="nav">
    <div class="nav-brand">${escapeHTML(project.name)}<small>${tabLabel}</small></div>
    ${navigationHTML}
  </nav>
  <main class="main">${contentHTML}</main>
</div>
</body>
</html>`;

  const safeName = project.name.replace(/[^a-z0-9]/gi, '_');
  const blob = new Blob([html], { type: 'text/html' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `${safeName}_${activeTab}.html`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);

  return { success: true, message: 'HTML exported.' };
}

function escapeHTML(string) {
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
