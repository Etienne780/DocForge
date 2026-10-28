// ─── DevTestProjectPreset ─────────────────────────────────────────────────────
//
// Dev-only project preset that exercises everything a project can hold in one
// place, to test the editor, preview, export and folder save/load:
//
//  - Markdown: headings, emphasis, lists, quotes, rules, links, comments,
//    unsupported syntax (must stay text)
//  - Tables + table properties (hover, striped, hl, width, line, align)
//  - Code blocks: languages, diff, diff:lang, unknown tags, nested fences,
//    code properties (copy, numbers, label), inline highlighted code
//  - Node types: page, folder, merged (embed + separate), deep nesting
//  - Reference links + anchors, incl. broken / unknown / missing anchors
//  - Several tabs: an empty tab, names that need a filesystem-safe slug
//  - Two project themes (one active) incl. per-theme language styles
//  - Format guide settings

import { createProject, createTab, createNode } from '@data/ProjectManager.js';
import { NODE_TYPE, NODE_MERGE_MODE } from '@data/NodeTypes.js';
import { generateLinkId } from '@data/LinkManager.js';
import { createDocTheme, modifyThemeValue } from '@data/DocThemeManager.js';
import { findSyntaxDefinitionByAlias, getHighlightStylesForLang } from '@data/SyntaxDefinitionManager.js';

export function createDevTestProject() {
  const project = createProject('DocForge Test Project');

  const markdownTab = project.tabs[0];
  markdownTab.name = 'Markdown';
  markdownTab.nodes = _createMarkdownNodes();

  const structureTab = createTab('Structure', project);
  structureTab.nodes = _createStructureNodes();

  const linksTab = createTab('Links', project);
  const { nodes: linkNodes, targets } = _createLinkNodes();
  linksTab.nodes = linkNodes;

  createTab('Empty Tab', project);

  const specialTab = createTab('Special / Chars: *?"<>|', project);
  specialTab.nodes = _createSpecialNameNodes();

  project.links = _createLinks(project, targets);

  const themes = _createThemes();
  project.themes = themes;
  project.settings.isThemePreset = false;
  project.settings.currentThemeId = themes[0].id;

  project.settings.formatGuide = {
    enabled: true,
    preferences: 'Test preferences: write short entries, one topic per entry.',
  };

  return project;
}

// ─── Markdown ───────────────────────────────────────────────────────────────

function _createMarkdownNodes() {
  const text = createNode('Text & Headings', `# Heading 1

Paragraph directly below h1. **Bold**, *italic*, _italic underscore_, ***bold italic*** and \`inline code\`.

## Heading 2

A second paragraph with an [external link](https://example.com) and a long line that should wrap: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

### Heading 3

#### Heading 4

##### Heading 5 (not supported, stays text)

> A single blockquote line.

> First quote line.
> Second quote line with **bold** and \`code\`.

---

## Comments

Text before a comment line.
<!-- this comment line must not render -->
Text after a comment line.

<!--
A multi-line comment
that must not render.
-->

Paragraph after a multi-line comment. Inline <!-- hidden --> comment inside a sentence.

Comment inside inline code stays text: \`<!-- visible -->\`.

Unclosed comment stays text: <!-- never closed

## Unsupported syntax (must stay text)

~~strikethrough~~

![image](https://example.com/image.png)

<b>raw html</b> and <div>block html</div>

- [ ] task list item

Footnote[^1]

Setext heading
==============
`);

  const lists = createNode('Lists', `# Lists

## Unordered

- Item with dash
- Item with **bold**
  - Nested with 2 spaces
    - Nested with 4 spaces
      - Third level
- Back to root

* Item with star
* Second star item

## Ordered

1. First
2. Second
3. Third
   1. Nested ordered
   2. Nested ordered

## Mixed

1. Ordered root
  - Unordered child
  - Unordered child
2. Ordered root again

## Spacing

- Item before a paragraph

Paragraph between two lists.

- Item after a paragraph
`);

  const tables = createNode('Tables', `# Tables

## Basic

| Name | Value | Notes |
|------|-------|-------|
| a    | 1     | first |
| b    | 2     | **bold** and \`code\` |

## Separator alignment

| Left | Center | Right |
|:-----|:------:|------:|
| l    | c      | r     |
| left | center | right |

## All properties

{
  hover=cell,row,col; striped
  row 0: line=3
  row 2: hl
  col 1: hl width=120 align=center line=2
  col 3: width=20%
  cell 3,2: hl align=right
}
| Row | Col 1 (hl, 120px) | Col 2 | Col 3 (20%) |
|-----|-------------------|-------|-------------|
| 1   | a                 | b     | c           |
| 2   | hl row            | hl row| hl row      |
| 3   | d                 | hl cell, right | e  |
| 4   | f                 | g     | h           |

## Hover variants

{hover}
| hover = cell | b |
|---|---|
| 1 | 2 |

{hover=row}
| hover = row | b |
|---|---|
| 1 | 2 |

{hover=col}
| hover = col | b |
|---|---|
| 1 | 2 |

## Properties inside a comment

<!-- {striped; col 0: hl} -->
| Striped | via comment |
|---------|-------------|
| 1       | a           |
| 2       | b           |
| 3       | c           |

## Invalid values (ignored)

{line=12; col 0: width=abc align=diagonal; row 99: hl}
| line=12 clamped/ignored | b |
|---|---|
| 1 | 2 |

## Not property syntax (stays text)

{ "json": 1 }
| a | b |
|---|---|
| 1 | 2 |

## Property block without element (removed)

{striped}

Paragraph after the dangling property block.

## Long table (sticky header)

{striped; hover=row}
| # | Name | Description |
|---|------|-------------|
${Array.from({ length: 40 }, (_, i) => `| ${i + 1} | Row ${i + 1} | Scroll down, the header should stay visible |`).join('\n')}
`);

  const code = createNode('Code', `# Code

## Languages

\`\`\`js
// JavaScript
const answer = 42;
function greet(name) {
  return \`Hello \${name}\`;
}
\`\`\`

\`\`\`cpp
#include <mutex>
std::mutex m;
int main() { std::lock_guard<std::mutex> lock(m); return 0; }
\`\`\`

\`\`\`python
def greet(name: str) -> str:
    return f"Hello {name}"
\`\`\`

\`\`\`json
{ "name": "DocForge", "version": 1, "enabled": true }
\`\`\`

\`\`\`test
// TestLang (dev-only built-in language)
let value = 1;
\`\`\`

## Diff

\`\`\`diff
unchanged line
-removed line
+added line
unchanged line
\`\`\`

\`\`\`diff:js
const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
\`\`\`

## Unknown and missing tags

\`\`\`notalanguage
Unknown tag, no highlighting.
\`\`\`

\`\`\`
No tag at all.
\`\`\`

## Nested fence (4 backticks)

\`\`\`\`md
\`\`\`js
const nested = true;
\`\`\`
\`\`\`\`

## Long line (horizontal scroll)

\`\`\`js
const longLine = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua';
\`\`\`

## Code properties

{copy}
\`\`\`js
// copy button
const copy = true;
\`\`\`

{numbers}
\`\`\`js
// line numbers
const a = 1;
const b = 2;
const c = 3;
\`\`\`

{label="Custom Label"}
\`\`\`js
const label = 'custom';
\`\`\`

{label=none}
\`\`\`js
const label = 'none';
\`\`\`

{
  copy
  numbers
  label="All Properties"
}
\`\`\`diff:js
const a = 1;
-const b = 2;
+const b = 3;
const c = 4;
\`\`\`

<!-- {copy; numbers} -->
\`\`\`python
# properties inside a comment
print("hello")
\`\`\`

## Inline code

Plain \`inline code\`, highlighted {lang=cpp}\`std::vector<int> v;\`, {lang=js}\`const x = 1;\`, unknown {lang=nope}\`still code\`.

Invalid property in front stays text: { nope }\`code\`.

Comment-like text in code: \`<!-- not a comment -->\`.
`);

  return [text, lists, tables, code];
}

// ─── Structure (node types) ─────────────────────────────────────────────────

function _createStructureNodes() {
  const page = createNode('Page Parent', `# Page Parent

Type \`page\`: own page, children are own pages.
`, [
    createNode('Page Child A', '# Page Child A\n\nOwn page.\n', [
      createNode('Page Grandchild', '# Page Grandchild\n\nOwn page, level 3.\n'),
    ]),
    createNode('Page Child B', '# Page Child B\n\nOwn page.\n'),
  ]);

  const folder = createNode('Folder Group', `# Folder Group

THIS CONTENT MUST NOT BE EXPORTED (type folder).
`, [
    createNode('Folder Child A', '# Folder Child A\n\nOwn page inside a folder.\n'),
    createNode('Nested Folder', '# Nested Folder\n\nHidden content.\n', [
      createNode('Nested Folder Child', '# Nested Folder Child\n\nOwn page inside a nested folder.\n'),
    ], { type: NODE_TYPE.FOLDER }),
  ], { type: NODE_TYPE.FOLDER });

  const mergedEmbed = createNode('Merged Embed', `# Merged Embed

Type \`merged\` with \`embed\`: every descendant is a section on this page.
`, [
    createNode('Section A', `# Section A

Heading shifted by one level.

## Sub heading of Section A
`, [
      createNode('Section A.1', `# Section A.1

Heading shifted by two levels.

## Sub heading (capped at h4)

### Deeper sub heading (capped at h4)
`),
    ]),
    createNode('Folder Section', 'THIS CONTENT MUST BE HIDDEN (folder inside merged page).\n', [
      createNode('Section in Folder', '# Section in Folder\n\nShown as a section.\n'),
    ], { type: NODE_TYPE.FOLDER }),
    createNode('Page Typed Section', '# Page Typed Section\n\nType page is ignored inside a merged page.\n', [], { type: NODE_TYPE.PAGE }),
  ], { type: NODE_TYPE.MERGED, mergeDescendants: NODE_MERGE_MODE.EMBED });

  const mergedSeparate = createNode('Merged Separate', `# Merged Separate

Type \`merged\` with \`separate\`: only direct children are sections, their children stay own pages.
`, [
    createNode('Separate Section A', '# Separate Section A\n\nSection on the merged page.\n', [
      createNode('Lifted Page A.1', '# Lifted Page A.1\n\nOwn page, moved one level up in the nav.\n'),
    ]),
    createNode('Separate Section B', '# Separate Section B\n\nSection on the merged page.\n'),
  ], { type: NODE_TYPE.MERGED, mergeDescendants: NODE_MERGE_MODE.SEPARATE });

  let deepest = createNode('Level 6', '# Level 6\n\nDeepest node.\n');
  for (let level = 5; level >= 1; level--)
    deepest = createNode(`Level ${level}`, `# Level ${level}\n\nNesting level ${level}.\n`, [deepest]);

  const emptyNode = createNode('Empty Content', '');

  return [page, folder, mergedEmbed, mergedSeparate, deepest, emptyNode];
}

// ─── Links ──────────────────────────────────────────────────────────────────

function _createLinkNodes() {
  const targetNode = createNode('Link Targets', `# Link Targets

Whole entry is a link target.

## First anchor {#first-anchor}

Text at the first anchor.

${'Filler paragraph to make scrolling visible.\n\n'.repeat(15)}
## Second anchor {#second-anchor}

Text at the second anchor. Inline anchor in a sentence: {#inline-anchor} here.

Duplicate anchor: {#first-anchor}

Invalid anchor stays text: {#Upper_Case}
`);

  const usageNode = createNode('Link Usages', `# Link Usages

- Default text: [[link-targets]]
- Custom text: [[link-targets|custom text]]
- Anchor: [[first-anchor]]
- Anchor with custom text: [[second-anchor|go to second anchor]]
- Inline anchor: [[inline-anchor]]
- Section in merged page: [[merged-section]]
- Page in folder: [[folder-child]]
- Other tab: [[markdown-tables]]
- Folder node (no page): [[folder-node]]
- Missing anchor (broken): [[missing-anchor]]
- Missing entry (broken): [[missing-entry]]
- Unknown slug: [[does-not-exist]]

In a table:

| Case | Usage |
|------|-------|
| Default text | [[link-targets]] |
| Anchor | [[first-anchor]] |

In a paragraph: see [[link-targets]] and [[first-anchor|the first anchor]].

Inside code (ignored): \`[[link-targets]]\`

\`\`\`md
[[link-targets]] {#not-an-anchor}
\`\`\`
`);

  return { nodes: [targetNode, usageNode], targets: { targetNode, usageNode } };
}

function _createLinks(project, { targetNode }) {
  const findNode = (tabName, path) => {
    let nodes = project.tabs.find(t => t.name === tabName)?.nodes ?? [];
    let node = null;
    for (const name of path) {
      node = nodes.find(n => n.name === name);
      nodes = node?.children ?? [];
    }
    return node;
  };

  const link = (slug, name, nodeId, anchor = null) => ({
    id: generateLinkId(),
    slug,
    name,
    target: { nodeId, anchor },
    refs: [],   // rebuilt when the project is opened
  });

  return [
    link('link-targets', 'Link Targets', targetNode.id),
    link('first-anchor', 'First Anchor', targetNode.id, 'first-anchor'),
    link('second-anchor', 'Second Anchor', targetNode.id, 'second-anchor'),
    link('inline-anchor', 'Inline Anchor', targetNode.id, 'inline-anchor'),
    link('merged-section', 'Section A.1', findNode('Structure', ['Merged Embed', 'Section A', 'Section A.1'])?.id),
    link('folder-child', 'Folder Child A', findNode('Structure', ['Folder Group', 'Folder Child A'])?.id),
    link('markdown-tables', 'Tables', findNode('Markdown', ['Tables'])?.id),
    link('folder-node', 'Folder Group', findNode('Structure', ['Folder Group'])?.id),
    link('missing-anchor', 'Missing Anchor', targetNode.id, 'does-not-exist'),
    link('missing-entry', 'Missing Entry', null),
    link('unused-link', 'Unused Link', targetNode.id),
  ];
}

// ─── Special names (folder project slugs) ───────────────────────────────────

function _createSpecialNameNodes() {
  return [
    createNode('Same Name', '# Same Name\n\nFirst node with this name.\n'),
    createNode('Same Name', '# Same Name\n\nSecond node with this name (unique file name needed).\n'),
    createNode('same name', '# same name\n\nOnly differs in case.\n'),
    createNode('Slash / Colon: Star* Question?', '# Special characters\n\nNode name with characters that are invalid in file names.\n'),
    createNode('Umlaute äöü ß', '# Umlaute äöü ß\n\nNon-ASCII characters.\n'),
    createNode('   Spaces   ', '# Spaces\n\nLeading and trailing spaces in the name.\n'),
    createNode('CON', '# CON\n\nReserved file name on Windows.\n'),
  ];
}

// ─── Themes ─────────────────────────────────────────────────────────────────

function _createThemes() {
  const main = createDocTheme('Dev Test Theme');
  _setThemeValues(main, {
    'background':          '#101418',
    'background-surface':  '#161c22',
    'background-elevated': '#1e262e',
    'text-primary':        '#e6edf3',
    'accent':              '#ff7b72',
    'accent-hover':        '#ffa198',
    'link':                '#d2a8ff',
    'heading':             '#ffa657',
    'code-tag-text':       '#79c0ff',
    'header-show':         'sidebar',
    'toc-position':        'left',
    'typography-heading':  'serif',
  });
  // inactive by default, activate to test the custom table colors
  ['table-highlight', 'table-hover', 'table-stripe'].forEach(key => modifyThemeValue(main, key, { active: true }));
  _setThemeValues(main, {
    'table-highlight': '#ffa657',
    'table-hover':     '#79c0ff',
    'table-stripe':    '#8b949e',
  });

  const alt = createDocTheme('Dev Test Theme Alt');
  _setThemeValues(alt, {
    'background':         '#fafaf7',
    'background-surface': '#f0f0eb',
    'text-primary':       '#1f2328',
    'heading':            '#0b0b0b',
    'code-background':    '#eaeef2',
    'code-text':          '#1f2328',
    'header-style':       'blur',
    'toc-show':           'never',
    'content-show-nav':   'never',
    'search-position':    'tab-nav',
    'search-show-in-tab': true,
    'sidebar-width-type': 'percent',
    'sidebar-width-per':  25,
    'typography-body':    'mono',
  });
  _setLastLanguageStyle(alt, 'js');

  return [main, alt];
}

function _setThemeValues(theme, values) {
  Object.entries(values).forEach(([key, value]) => modifyThemeValue(theme, key, { value }));
}

/** Uses the last built-in style of a language, to test the per-theme language style. */
function _setLastLanguageStyle(theme, alias) {
  const lang = findSyntaxDefinitionByAlias(alias);
  const style = lang ? getHighlightStylesForLang(null, lang.id).at(-1) : null;
  if (style)
    theme.settings.langStyleIds[lang.id] = { id: style.id, isBuiltIn: true };
}
