# DocForge Roadmap

## Version 1.0

### PRIORITY 1 — Project Manager View

- Project overview (list of all projects)
- Create / delete / duplicate projects
- Create project from template
- Search field for projects
- Sorting (recently opened / alphabetical)
- Favorites (optional)
- UI for project metadata (name, theme, createdAt)

---

### PRIORITY 2 — Save locally and web

- Abstract `StorageAdapter` base class (interface)
  - `save(stateSnapshot)`  — persist full state
  - `load()`               — return parsed state object or null
  - `clear()`              — wipe stored data

- Sub-classes:
  - `LocalStorageAdapter`  — web, uses `localStorage`
  - `ElectronAdapter`      — desktop, uses `electron-store` or file system via IPC

- `StorageManager` — coordinates adapters
  - Accepts one or more adapters (e.g. local + cloud)
  - Debounced autosave on `state:change` (800ms)
  - Wires `save:request` → immediate save
  - Emits `save:complete` after successful write
  - On `load()`: tries adapters in priority order, returns first valid result
  - Replaces current save/load logic in `State.js`

---

### PRIORITY 3 — Theme Editor (DocTheme + Syntax Themes)

- Rename to “Theme Editor”

#### Tabs inside the editor:
- Doc Theme
- Syntax Themes
- Custom Languages
- Mappings (DocTheme → SyntaxTheme per language)

#### DocTheme Editor
- Colors, fonts, spacing, layout
- Live preview

#### Syntax Theme Editor
- List of all languages
- List of all themes per language
- Create / copy / delete syntax themes
- Live code preview

#### Custom Languages
- Create new language
- Regex token definitions
- Token types (keyword, string, comment, number, operator, etc.)
- Define example code
- Internal syntax engine
- Multiple themes per language
- Ability to modify existing languages

#### Mapping System
- DocTheme can override SyntaxTheme per language
- Define fallback SyntaxTheme


#### UI
- Live preview in editor

### PRIORITY 4 — Fix HTML export

- Update `ExportHelper.js` to work with the new tab system
  - Export single tab or all tabs (user choice)
  - Multi-tab export generates one HTML file with tab navigation

- DocTheme integration
  - Inject active `project.docThemeId` CSS variables into the exported HTML
  - Export is fully self-contained — no external stylesheets needed

- Regression check
  - Node tree structure (nested children) renders correctly
  - Code blocks, tables, blockquotes all survive the export pipeline

### PRIORITY 5 — Titlebar

- Add menu buttons: File, Help
  - File
    - New Project
    - Open Project Manager
    - Export current Tab as HTML
    - Export all Tabs as HTML
  - Help
    - About DocForge
    - Keyboard Shortcuts overview
    - Open DevTools

- Menu behavior
  - Dropdown opens on click, closes on outside click or Escape
  - Keyboard navigable (arrow keys, Enter, Escape)
  - Disabled entries (e.g. Export when no project is active) are visually greyed out

## Version 2.0

### PRIORITY 1 — Undo / Redo System

- Global history system per project
- Ring buffer (50–100 states)
- Snapshot only when real changes occur
- Debounced editor input

#### Undo/Redo for:
- Node content
- Node structure
- Tabs
- Themes
- Custom languages

---

### PRIORITY 2 — Markdown Parser Extensions  
*(Inline HTML, CSS, JS, Globals, Node References)*

#### Inline HTML Support
- Allow inline HTML inside Markdown:
  - `<div>`, `<span>`, `<section>`, `<details>`, etc.
- Allow HTML attributes (class, id, style, data-*)
- Optional security filters for dangerous tags

#### Inline CSS Support
- `<style>` blocks inside nodes
- CSS scoping per node (optional Shadow DOM)
- Automatic namespacing to avoid conflicts with DocTheme

#### Inline JavaScript Support
- `<script>` blocks inside nodes
- Sandbox environment for safe execution

##### API Hooks:
- `onNodeLoad(node)`
- `onProjectLoad(project)`
- `onThemeApply(theme)`

- Optional global utility functions

#### Custom Markdown Extensions
- `:::component` blocks
- `:::warning`, `:::info`, `:::note`
- Inline components: `<Component prop="value" />`

#### Parser Pipeline
1. Markdown → HTML  
2. HTML → Sanitizer  
3. HTML → Inline Script/CSS Extractor  
4. HTML → Renderer  

#### Export Support
- Inline HTML, CSS, and JS included in exported `.html`
- Optional script execution in export
- Proper scoping so themes still work

#### Security & Control
- Whitelist/blacklist for HTML tags
- Optional warnings for unsafe scripts
- Editor warnings for invalid inline blocks

---

### Globals (Reusable Project-Wide Content)

#### Features:
- Define global reusable content:
  - Text, Markdown, HTML, code
- Variables (e.g., `{{project.name}}`, `{{project.version}}`)
- Snippets (e.g., `{{snippet.apiError}}`)

#### UI:
- Create, edit, delete globals
- Categories: text, code, HTML, variable
- Live preview for snippets

#### Usage inside nodes:
- `{{global.id}}`
- `{{snippet:name}}`
- `{{var:projectName}}`

---

### Cross-Node References

#### Features:
- Insert content from other nodes:
  - `{{node:nodeId}}`
- Insert specific parts of a node:
  - `{{node:nodeId.h2}}` (section starting at heading)
  - `{{node:nodeId.block(code)}}` (only code blocks)
  - `{{node:nodeId.region(name)}}` (custom region markers)

- Auto-update when referenced node changes
- Warnings for invalid or deleted references
- Circular reference protection

#### Export:
- References resolved inline
- Optional: render as links instead of inline content
