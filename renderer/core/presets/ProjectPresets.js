import { createProject, createTab, createNode } from '@data/ProjectManager.js';

/**
 * Creates the default example project demonstrating the documentation
 * structure with real-world Markdown usage across multiple nodes.
 * @returns {Object}
 */
export function createDefaultProject() {
  const project = createProject('CSS Reference');
  project.builtIn = true;

  // ── Root node: style attribute ──────────────────────────────────────────
  const styleNode = createNode('style', `# style

The \`style\` attribute applies inline CSS directly to an HTML element, bypassing the cascade.

## Syntax

\`\`\`html
<element style="property: value; property: value;">
\`\`\`

## When to use inline styles

Use sparingly — inline styles carry the highest specificity and are hard to override:

- Dynamic values set via JavaScript
- One-off overrides with no reusable intent
- Email HTML (where external sheets are stripped)

> **Tip:** Prefer a CSS class for anything you might reuse more than once.

## Specificity order

| Source            | Specificity |
|-------------------|-------------|
| Inline \`style\`   | Highest     |
| \`<style>\` block  | Medium      |
| External sheet    | Lower       |
| Browser default   | Lowest      |
`);

  // ── Child: all attributes overview ─────────────────────────────────────
  const allAttributesNode = createNode('all attributes', `# all attributes

A quick reference of commonly used CSS properties available via the \`style\` attribute.

## Layout

| Property    | Type              | Description                        |
|-------------|-------------------|------------------------------------|
| \`display\`   | keyword           | Block, inline, flex, grid, …       |
| \`position\`  | keyword           | static, relative, absolute, fixed  |
| \`width\`     | \`<length>\` / %   | Element width                      |
| \`height\`    | \`<length>\` / %   | Element height                     |
| \`margin\`    | \`<length>\`       | Outer spacing (shorthand)          |
| \`padding\`   | \`<length>\`       | Inner spacing (shorthand)          |

## Typography

| Property       | Type              | Description             |
|----------------|-------------------|-------------------------|
| \`color\`        | \`<color>\`        | Text color              |
| \`font-size\`    | \`<length>\`       | Font size               |
| \`font-weight\`  | keyword / number  | Boldness                |
| \`line-height\`  | number / \`<length>\` | Line spacing         |
| \`text-align\`   | keyword           | left, center, right     |

## Visual

| Property      | Type        | Description             |
|---------------|-------------|-------------------------|
| \`background\`  | \`<color>\`  | Background shorthand    |
| \`border\`      | shorthand   | Width, style, color     |
| \`opacity\`     | 0–1         | Transparency            |
| \`box-shadow\`  | shorthand   | Drop shadow             |
`);

  // ── Child: color ────────────────────────────────────────────────────────
  const colorNode = createNode('color', `# color

Sets the foreground (text) color of an element.

## Syntax

\`\`\`css
color: <color>;
\`\`\`

## Value formats

| Format    | Example                       |
|-----------|-------------------------------|
| Keyword   | \`color: red;\`                |
| Hex       | \`color: #e63946;\`            |
| RGB       | \`color: rgb(230, 57, 70);\`   |
| RGBA      | \`color: rgba(230, 57, 70, .5);\` |
| HSL       | \`color: hsl(355, 78%, 56%);\` |
| OKLCH     | \`color: oklch(60% 0.2 15);\`  |

## Inheritance

\`color\` is **inherited** — child elements adopt the parent's color unless they override it.

\`\`\`html
<!-- All children inherit red unless overridden -->
<div style="color: red;">
  <p>This text is red.</p>
  <span style="color: blue;">This is blue.</span>
</div>
\`\`\`

## Accessibility

Ensure sufficient contrast between foreground and background.
WCAG AA requires a ratio of at least **4.5 : 1** for body text.
`);

  // ── Child: font-size ────────────────────────────────────────────────────
  const fontSizeNode = createNode('font-size', `# font-size

Controls the size of text within an element.

## Syntax

\`\`\`css
font-size: <length> | <percentage> | keyword;
\`\`\`

## Absolute length units

\`\`\`css
font-size: 16px;   /* pixels — most common */
font-size: 1.2pt;  /* points — print contexts */
\`\`\`

## Relative length units

\`\`\`css
font-size: 1rem;   /* relative to :root font size */
font-size: 1.25em; /* relative to parent font size */
font-size: 2vw;    /* 2% of viewport width */
\`\`\`

## Keyword values

| Keyword      | Approximate size |
|--------------|-----------------|
| \`xx-small\`  | ~9px             |
| \`x-small\`   | ~10px            |
| \`small\`     | ~13px            |
| \`medium\`    | ~16px (default)  |
| \`large\`     | ~18px            |
| \`x-large\`   | ~24px            |
| \`xx-large\`  | ~32px            |

> **Best practice:** Use \`rem\` for font sizes to respect user browser settings.
`);

  styleNode.children.push(allAttributesNode, colorNode, fontSizeNode);
  project.tabs[0].nodes.push(styleNode);

  // ── Root node: Markdown editor features demo ────────────────────────────
  const editorFeaturesNode = createNode('Editor Features', `# Editor Features

This node demonstrates every Markdown element supported by this editor.
Use it as a reference when writing documentation.

---

## Inline formatting

**Bold** is written with \`**double asterisks**\`.
*Italic* is written with \`*single asterisks*\`.
***Bold and italic*** combines both: \`***triple asterisks***\`.
~~Strikethrough~~ uses \`~~tildes~~\`.

Inline \`code\` is wrapped in single backticks.

---

## Headings

\`\`\`
# H1 — document title
## H2 — major section
### H3 — subsection
#### H4 — detail level
\`\`\`

---

## Lists

### Unordered

- First item
- Second item
  - Nested item
  - Another nested item
- Third item

### Ordered

1. Install dependencies
2. Configure environment
3. Run the dev server
   1. Check the console for errors
   2. Open localhost:3000

---

## Code blocks

\`\`\`javascript
// Arrow function with default parameter
const greet = (name = 'World') => \`Hello, \${name}!\`;

console.log(greet('Claude')); // → Hello, Claude!
\`\`\`

\`\`\`css
/* Custom property with fallback */
.button {
  color: var(--color-accent, #6c47ff);
  padding: 0.5rem 1rem;
  border-radius: 6px;
}
\`\`\`

\`\`\`html
<button class="button" type="button">
  Click me
</button>
\`\`\`

---

## Blockquote

> This is a blockquote. It can span multiple sentences.
> Use it for tips, warnings, or notable quotes.

---

## Table

| Feature                  | Supported | Planned | Notes                    |
|--------------------------|-----------|---------|--------------------------|
| Bold / Italic            | ✓         |         | Standard Markdown        |
| Tables                   | ✓         |         | GFM-style                |
| Code blocks              | ✓         |         |                          |
| Code Syntax Highlighting | —         | yes     |                          |
| Images                   | —         | yes     | Not supported inline     |
| Diagrams                 | —         | yes     |                          |

---

## Link

[Visit MDN Web Docs](https://developer.mozilla.org)

---

## Horizontal rule

Produced with \`---\` on its own line (shown above and below this section).

---

*End of Editor Features demo.*
`);

  project.tabs[0].nodes.push(editorFeaturesNode);

  // ── Second tab: Selectors reference ────────────────────────────────────
  const selectorsTab = createTab(project, 'Selectors');

  const basicSelectorsNode = createNode('Basic Selectors', `# Basic Selectors

CSS selectors target which HTML elements a rule applies to.

## Element selector

Matches every element of that tag name.

\`\`\`css
p { color: #333; }
\`\`\`

## Class selector

Matches any element with the given class. Prefixed with \`.\`.

\`\`\`css
.card { border-radius: 8px; }
\`\`\`

## ID selector

Matches a single element by its unique ID. Prefixed with \`#\`.

\`\`\`css
#header { position: sticky; top: 0; }
\`\`\`

## Universal selector

Matches every element. Use carefully — it has performance implications.

\`\`\`css
* { box-sizing: border-box; }
\`\`\`

## Specificity comparison

| Selector type | Specificity value |
|---------------|-------------------|
| ID            | 1-0-0             |
| Class         | 0-1-0             |
| Element       | 0-0-1             |
| Universal     | 0-0-0             |
`);

  const combinatorsNode = createNode('Combinators', `# Combinators

Combinators define the relationship between selectors.

## Descendant (\` \`)

Matches elements nested anywhere inside the parent.

\`\`\`css
/* Any <a> inside .nav, regardless of nesting depth */
.nav a { color: white; }
\`\`\`

## Child (\`>\`)

Matches only **direct** children.

\`\`\`css
ul > li { list-style: none; }
\`\`\`

## Adjacent sibling (\`+\`)

Matches the element immediately **after** the first.

\`\`\`css
h2 + p { margin-top: 0; }
\`\`\`

## General sibling (\`~\`)

Matches **all** subsequent siblings.

\`\`\`css
h2 ~ p { color: #555; }
\`\`\`

---

> **Memory aid:** Think of \`>\` as "direct child", \`+\` as "next door", and \`~\` as "all neighbors after".
`);

  basicSelectorsNode.children.push(combinatorsNode);
  selectorsTab.nodes.push(basicSelectorsNode);

  return project;
}

/**
 * Creates a dedicated showcase project that renders every visual aspect
 * of a Doc Theme — one node per theme parameter category so designers can
 * see exactly what each token controls.
 * @returns {Object}
 */
export function createThemeShowcaseProject() {
  const project = createProject('Theme Showcase');
  project.builtIn = true;

  // ── Tab 1: Typography ───────────────────────────────────────────────────
  const typographyTab = project.tabs[0];
  typographyTab.name = 'Typography';

  const headingsNode = createNode('Headings', `# Heading 1 — theme.heading1

The largest heading. Sets the document or page title.

## Heading 2 — theme.heading2

A major section break. Usually the first thing a reader scans.

### Heading 3 — theme.heading3

A subsection. Groups related content within a section.

#### Heading 4 — theme.heading4

Detail level. Rarely used — consider restructuring if needed often.

---

**Theme tokens exercised by this node:**

| Token             | Controls                          |
|-------------------|-----------------------------------|
| \`heading1\`       | font-size, font-weight, color, margin |
| \`heading2\`       | font-size, font-weight, color, margin |
| \`heading3\`       | font-size, font-weight, color, margin |
| \`heading4\`       | font-size, font-weight, color, margin |
| \`headingFont\`    | font-family for all headings       |
| \`headingColor\`   | shared heading text color (if set) |
`);

  const bodyTextNode = createNode('Body Text', `# Body Text

This paragraph uses the base body text style — \`theme.bodyFont\`, \`theme.bodySize\`, \`theme.bodyColor\`, and \`theme.lineHeight\`.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Curabitur pretium tincidunt lacus.

A second paragraph follows to show paragraph spacing (\`theme.paragraphSpacing\`). The gap between these two blocks is controlled by that single token.

**Bold text** is rendered with \`theme.boldWeight\` and optionally \`theme.boldColor\`.
*Italic text* uses the default italic style. ***Bold italic*** combines both.
~~Strikethrough~~ uses the base text color at reduced opacity.

Inline \`code\` within a sentence uses \`theme.inlineCodeFont\`, \`theme.inlineCodeBackground\`, and \`theme.inlineCodeColor\`.

---

**Theme tokens exercised:**

| Token               | Controls                      |
|---------------------|-------------------------------|
| \`bodyFont\`         | Font family for body text     |
| \`bodySize\`         | Base font size                |
| \`bodyColor\`        | Default text color            |
| \`lineHeight\`       | Line spacing                  |
| \`paragraphSpacing\` | Margin between \`<p>\` elements |
| \`boldWeight\`       | Font weight for \`**bold**\`   |
| \`inlineCodeFont\`   | Font family for inline code   |
| \`inlineCodeBackground\` | Chip background           |
| \`inlineCodeColor\`  | Chip text color               |
`);

  const blockquoteNode = createNode('Blockquote', `# Blockquote

> This is a single-line blockquote. It exercises \`theme.blockquoteBorder\`,
> \`theme.blockquoteBackground\`, \`theme.blockquoteTextColor\`, and \`theme.blockquotePadding\`.

Regular body text follows the blockquote, showing the vertical spacing (\`theme.blockquoteMargin\`).

> A multi-line blockquote continues until the \`>\` prefix stops.
> The left border color is \`theme.blockquoteBorderColor\`.
> The border width is \`theme.blockquoteBorderWidth\`.

---

**Theme tokens exercised:**

| Token                   | Controls                              |
|-------------------------|---------------------------------------|
| \`blockquoteBorderColor\` | Color of the left accent bar         |
| \`blockquoteBorderWidth\` | Thickness of the left accent bar     |
| \`blockquoteBackground\`  | Fill behind the quote block          |
| \`blockquoteTextColor\`   | Text color inside the quote          |
| \`blockquotePadding\`     | Inner spacing                        |
| \`blockquoteMargin\`      | Outer vertical spacing               |
`);

  typographyTab.nodes.push(headingsNode, bodyTextNode, blockquoteNode);

  // ── Tab 2: Code ─────────────────────────────────────────────────────────
  const codeTab = createTab(project, 'Code Blocks');

  const codeBlockNode = createNode('Code Block Styles', `# Code Block Styles

The block below uses the default \`theme.codeBackground\`, \`theme.codeFont\`, \`theme.codeFontSize\`, and \`theme.codeBorderRadius\`.

\`\`\`javascript
// JavaScript — tests syntax highlight token colors
const fetchUser = async (id) => {
  const res = await fetch(\`/api/users/\${id}\`);
  if (!res.ok) throw new Error('Not found');
  return res.json();
};
\`\`\`

\`\`\`css
/* CSS — tests at-rule, selector, property, and value colors */
:root {
  --accent: oklch(60% 0.2 270);
}

@media (prefers-color-scheme: dark) {
  :root { --accent: oklch(80% 0.15 270); }
}

.card {
  background: var(--accent);
  border-radius: 8px;
}
\`\`\`

\`\`\`html
<!-- HTML — tests tag, attribute, and value highlight colors -->
<section class="card" aria-label="Featured">
  <h2>Title</h2>
  <p>Description text goes here.</p>
</section>
\`\`\`

\`\`\`bash
# Shell — tests comment and command colors
npm install && npm run build
echo "Build complete"
\`\`\`

---

**Theme tokens exercised:**

| Token                   | Controls                              |
|-------------------------|---------------------------------------|
| \`codeBackground\`       | Block background fill                 |
| \`codeBorderColor\`      | Border around the block (if any)      |
| \`codeBorderRadius\`     | Corner rounding                       |
| \`codeFont\`             | Monospace font family                 |
| \`codeFontSize\`         | Font size inside blocks               |
| \`codeLineHeight\`       | Line spacing inside blocks            |
| \`codePadding\`          | Inner spacing                         |
| \`syntaxComment\`        | Color for \`/* comments */\`           |
| \`syntaxKeyword\`        | Color for \`const\`, \`if\`, \`return\` |
| \`syntaxString\`         | Color for string literals             |
| \`syntaxNumber\`         | Color for number literals             |
| \`syntaxFunction\`       | Color for function names              |
| \`syntaxVariable\`       | Color for variable names              |
| \`syntaxOperator\`       | Color for operators (\`=\`, \`+\`, …)   |
| \`syntaxPunctuation\`    | Color for brackets and braces         |
`);

  codeTab.nodes.push(codeBlockNode);

  // ── Tab 3: Lists & Tables ───────────────────────────────────────────────
  const listsTab = createTab(project, 'Lists & Tables');

  const listsNode = createNode('Lists', `# Lists

## Unordered list

- First item — \`theme.listBulletColor\` and \`theme.listBulletSize\`
- Second item
  - Nested item — \`theme.listIndent\` controls the indent depth
  - Another nested item
    - Third level nesting
- Third item

## Ordered list

1. First step — \`theme.listNumberColor\`
2. Second step
   1. Sub-step A
   2. Sub-step B
3. Third step

---

**Theme tokens exercised:**

| Token               | Controls                               |
|---------------------|----------------------------------------|
| \`listBulletColor\`  | Color of unordered bullet markers      |
| \`listBulletSize\`   | Size of bullet markers                 |
| \`listNumberColor\`  | Color of ordered list numbers          |
| \`listIndent\`       | Horizontal indent per nesting level    |
| \`listSpacing\`      | Vertical gap between list items        |
| \`listMargin\`       | Outer vertical margin around the list  |
`);

  const tablesNode = createNode('Tables', `# Tables

## Basic table

| Column A      | Column B       | Column C       |
|---------------|----------------|----------------|
| Row 1, Cell A | Row 1, Cell B  | Row 1, Cell C  |
| Row 2, Cell A | Row 2, Cell B  | Row 2, Cell C  |
| Row 3, Cell A | Row 3, Cell B  | Row 3, Cell C  |

The header row uses \`theme.tableHeaderBackground\` and \`theme.tableHeaderColor\`.
Body rows alternate with \`theme.tableRowBackground\` and \`theme.tableRowAltBackground\`.

## Alignment columns

| Left-aligned | Centered     | Right-aligned |
|:-------------|:------------:|--------------:|
| Apple        | Banana       | Cherry        |
| Dog          | Elephant     | Fox           |
| 1            | 2            | 3             |

## Wide table (tests horizontal overflow / scroll)

| ID   | Name            | Role           | Department    | Location    | Status   |
|------|-----------------|----------------|---------------|-------------|----------|
| 001  | Alice Hoffmann  | Lead Engineer  | Platform      | Berlin      | Active   |
| 002  | Ben Carter      | Designer       | Product       | London      | Active   |
| 003  | Chloé Dupont    | PM             | Growth        | Paris       | On leave |

---

**Theme tokens exercised:**

| Token                    | Controls                             |
|--------------------------|--------------------------------------|
| \`tableHeaderBackground\` | Header row fill                      |
| \`tableHeaderColor\`      | Header row text color                |
| \`tableHeaderWeight\`     | Header font weight                   |
| \`tableBorderColor\`      | Border color between cells/rows      |
| \`tableBorderWidth\`      | Border thickness                     |
| \`tableRowBackground\`    | Body row fill                        |
| \`tableRowAltBackground\` | Alternating row fill (striped)       |
| \`tableCellPadding\`      | Inner spacing per cell               |
| \`tableBorderRadius\`     | Corner rounding of the whole table   |
`);

  listsTab.nodes.push(listsNode, tablesNode);

  // ── Tab 4: Layout ───────────────────────────────────────────────────────
  const layoutTab = createTab(project, 'Layout');

  const dividerNode = createNode('Dividers & Spacing', `# Dividers & Spacing

## Horizontal rule

A full-width divider produced with \`---\`.

---

Another divider follows after this paragraph.

---

The vertical space above and below each divider is \`theme.hrMargin\`.
The line itself uses \`theme.hrColor\` and \`theme.hrThickness\`.

## Document spacing

The outer document padding is \`theme.documentPadding\`.
The maximum content width is \`theme.contentMaxWidth\`.

\`\`\`
┌─────────────────────────────────────────┐
│           documentPadding               │
│  ┌───────────────────────────────────┐  │
│  │       contentMaxWidth             │  │
│  │                                   │  │
│  │   Your markdown content here      │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│           documentPadding               │
└─────────────────────────────────────────┘
\`\`\`

---

**Theme tokens exercised:**

| Token               | Controls                              |
|---------------------|---------------------------------------|
| \`hrColor\`          | Divider line color                    |
| \`hrThickness\`      | Divider line height / thickness       |
| \`hrMargin\`         | Vertical spacing around \`---\`        |
| \`documentPadding\`  | Outer padding of the whole document   |
| \`contentMaxWidth\`  | Maximum width of the content column   |
| \`documentBackground\` | Background color of the document    |
| \`documentColor\`    | Default text color (root level)       |
`);

  const linksNode = createNode('Links', `# Links

Inline links appear throughout documentation. This node tests link styling.

## Inline links

Visit the [MDN Web Docs](https://developer.mozilla.org) for CSS reference.
Check the [CSS Tricks almanac](https://css-tricks.com/almanac) for practical examples.
The [W3C specification](https://www.w3.org/TR/css/) is the authoritative source.

## Link states (hover and visited)

Click any link above to test \`theme.linkVisitedColor\`.
Hover over a link to test \`theme.linkHoverColor\` and \`theme.linkHoverDecoration\`.

## Link inside a table

| Resource       | URL                               | Type  |
|----------------|-----------------------------------|-------|
| MDN            | [mdn](https://developer.mozilla.org) | Docs  |
| Can I Use      | [caniuse](https://caniuse.com)    | Compatibility |

---

**Theme tokens exercised:**

| Token                 | Controls                              |
|-----------------------|---------------------------------------|
| \`linkColor\`          | Default link text color               |
| \`linkDecoration\`     | Default underline style               |
| \`linkHoverColor\`     | Link color on hover                   |
| \`linkHoverDecoration\` | Underline style on hover             |
| \`linkVisitedColor\`   | Color after the link has been visited |
| \`linkWeight\`         | Font weight of links                  |
`);

  layoutTab.nodes.push(dividerNode, linksNode);

  return project;
}