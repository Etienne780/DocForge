# DocForge Roadmap

## PRIORITY 1 — Project Manager View

- Project overview (list of all projects)
- Create / delete / duplicate projects
- Create project from template
- Search field for projects
- Sorting (recently opened / alphabetical)
- Favorites (optional)
- UI for project metadata (name, theme, createdAt)

---

## PRIORITY 2 — Theme Editor (DocTheme + Syntax Themes)

- Rename to “Theme Editor”

### Tabs inside the editor:
- Doc Theme
- Syntax Themes
- Custom Languages
- Mappings (DocTheme → SyntaxTheme per language)

### DocTheme Editor
- Colors, fonts, spacing, layout
- Live preview

### Syntax Theme Editor
- List of all languages
- List of all themes per language
- Create / copy / delete syntax themes
- Live code preview

### Custom Languages
- Create new language
- Regex token definitions
- Token types (keyword, string, comment, number, operator, etc.)
- Define example code

### Mapping System
- DocTheme can override SyntaxTheme per language
- Define fallback SyntaxTheme

---

## PRIORITY 3 — Undo / Redo System

- Global history system per project
- Ring buffer (50–100 states)
- Snapshot only when real changes occur
- Debounced editor input

### Undo/Redo for:
- Node content
- Node structure
- Tabs
- Themes
- Custom languages

---

## PRIORITY 4 — Syntax Highlighting System (Upgrade)

- Internal syntax engine (optional extension to Prism)
- Multiple themes per language
- Full support for custom languages
- Live preview in editor

### Export:
- Inline syntax styles
- Or external CSS

### Additional:
- Ability to modify existing languages

---

## PRIORITY 5 — Consistent Theme System

### DocTheme:
- CSS variables
- SyntaxTheme overrides per language

### SyntaxTheme:
- Token → color mapping

### Language:
- Token definitions
- Example code

### Unified data model for:
- DocThemes
- SyntaxThemes
- Languages

---

## PRIORITY 6 — Markdown Parser Extensions  
*(Inline HTML, CSS, JS, Globals, Node References)*

### Inline HTML Support
- Allow inline HTML inside Markdown:
  - `<div>`, `<span>`, `<section>`, `<details>`, etc.
- Allow HTML attributes (class, id, style, data-*)
- Optional security filters for dangerous tags

### Inline CSS Support
- `<style>` blocks inside nodes
- CSS scoping per node (optional Shadow DOM)
- Automatic namespacing to avoid conflicts with DocTheme

### Inline JavaScript Support
- `<script>` blocks inside nodes
- Sandbox environment for safe execution

#### API Hooks:
- `onNodeLoad(node)`
- `onProjectLoad(project)`
- `onThemeApply(theme)`

- Optional global utility functions

### Custom Markdown Extensions
- `:::component` blocks
- `:::warning`, `:::info`, `:::note`
- Inline components: `<Component prop="value" />`

### Parser Pipeline
1. Markdown → HTML  
2. HTML → Sanitizer  
3. HTML → Inline Script/CSS Extractor  
4. HTML → Renderer  

### Export Support
- Inline HTML, CSS, and JS included in exported `.html`
- Optional script execution in export
- Proper scoping so themes still work

### Security & Control
- Whitelist/blacklist for HTML tags
- Optional warnings for unsafe scripts
- Editor warnings for invalid inline blocks

---

## Globals (Reusable Project-Wide Content)

### Features:
- Define global reusable content:
  - Text, Markdown, HTML, code
- Variables (e.g., `{{project.name}}`, `{{project.version}}`)
- Snippets (e.g., `{{snippet.apiError}}`)

### UI:
- Create, edit, delete globals
- Categories: text, code, HTML, variable
- Live preview for snippets

### Usage inside nodes:
- `{{global.id}}`
- `{{snippet:name}}`
- `{{var:projectName}}`

---

## Cross-Node References

### Features:
- Insert content from other nodes:
  - `{{node:nodeId}}`
- Insert specific parts of a node:
  - `{{node:nodeId.h2}}` (section starting at heading)
  - `{{node:nodeId.block(code)}}` (only code blocks)
  - `{{node:nodeId.region(name)}}` (custom region markers)

- Auto-update when referenced node changes
- Warnings for invalid or deleted references
- Circular reference protection

### Export:
- References resolved inline
- Optional: render as links instead of inline content