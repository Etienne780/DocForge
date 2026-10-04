# DocForge Roadmap

## Version 1.0

### PRIORITY 1 — Project Manager View [Fin]

- Project overview (list of all projects)
- Create / delete / duplicate projects
- Search field for projects
- Sorting (recently opened / alphabetical)
- Favorites (optional)
- UI for project metadata (name, theme, createdAt)

### PRIORITY 2 — Save locally and web [Fin]

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
  - Wires `save:request` -> immediate save
  - Emits `save:complete` after successful write
  - On `load()`: tries adapters in priority order, returns first valid result
  - Replaces current save/load logic in `State.js`

### PRIORITY 3 — Theme Manager/Editor (DocTheme + Syntax Themes base) [Fin]

#### Tabs inside the manager:
- Doc Theme
- Syntax Themes (base)

#### DocTheme Editor
- Colors, fonts, spacing, layout
- Live preview

#### UI
- Live preview in editor

### PRIORITY 4 — Fix HTML export [Fin]

- Update `ExportHelper.js` to work with the new tab system
  - Export single tab or all tabs (user choice)
  - Multi-tab export generates one HTML file with tab navigation

- DocTheme integration
  - Inject active `project.docThemeId` CSS variables into the exported HTML
  - Export is fully self-contained — no external stylesheets needed

- Regression check
  - Node tree structure (nested children) renders correctly
  - Code blocks, tables, blockquotes all survive the export pipeline

### PRIORITY 5 — Titlebar [Fin]

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

### PRIORITY 1 — General Purpose

### Doc Editor
- Entry types — customize how an entry and its children are exported [Fin]
  - Type is chosen when creating an entry and can be changed later (tree action button).
  - `Page` (default): own page, children are own pages (previous behavior).
  - `Folder`: no own page, only groups its children in the navigation (click expands/collapses).
    Its content is kept in the editor but never exported.
  - `Merged`: children are shown as sections on this page instead of own pages.
    - Children of children: include all descendants, or keep them as own entries (moved one level up in the navigation).
    - Section headings are shifted down by their depth (`#` -> `##` ...), capped at h4.
    - Links, search results and the URL hash of merged children open the page and scroll to the section.
  - Inside a merged page the own type of a section is ignored (a folder only shows its name as heading).
  - Editor: icon per type in the tree, merged sections shown in italics, a permanent notice above
    the input when the content is not exported as its own page.
  - Optional preview in the type dialog (navigation + pages of the export).
- Reference nodes using links to connect different parts of the documentation.
- Add hotkeys for bold, italic, inline code, and other formatting options. [Fin]
  - `Ctrl+B` bold, `Ctrl+I` italic, `Ctrl+E` inline code, `Ctrl+Shift+E` code block, `Ctrl+K` link
  - `Ctrl+1/2/3` headings, `Ctrl+Shift+U` / `Ctrl+Shift+O` lists, `Ctrl+Shift+Q` blockquote
- Create project templates from existing projects. [Fin]
- Improve preview scrolling behavior. [Fin]

### Appearance
- Export/import themes and languages/language styles. [Fin]
- Export themes with the option to include languages (select which ones).
- Export languages with the option to include language styles (select which ones). [Fin]

#### Theme
- Select a style for a language within a theme. [Fin]
- Stay at the current position when parameters are changed. [Fin]

### PRIORITY 2 — new Custom html elements
- Own color picker
- Own input field for the editor with autocomplete suggestions
  - Some kind of display of custome elements with simple highlighting (Tabels, Node refs)
  - Implement basic autocompletion for node references
  - Ctrl+f to search in text element
  - Maybe define a codeblock area with regex in the input filed to display the indenting lines
- MD Tree element (Used to display folder structures can have custome props to change behavior like if a certain element or the whole element is collapsible)
  -  ```
     |-Top
     |-|-sub
     |-|-|-child of sub
     |
     |-|-sub 2
     |-|-|-child of sub
     ```
  - Better bullet points
  - Collapsible parts in input field

### PRIORITY 3 — Theme Editor (Syntax Themes)

#### Custom Languages
- `Language editor` and `Language style editor`
- Create new language
- Regex token definitions
- Token types (keyword, string, comment, number, operator, etc.)
- Define example code
- Internal syntax engine
- Multiple themes per language
- Ability to modify existing languages

### PRIORITY 4 — Undo / Redo System

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

## Version 3.0

### PRIORITY 1 — Markdown Parser Extensions  
*(Inline HTML, CSS, JS, Globals)*

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
1. Markdown -> HTML  
2. HTML -> Sanitizer  
3. HTML -> Inline Script/CSS Extractor  
4. HTML -> Renderer  

#### Export Support
- Inline HTML, CSS, and JS included in exported `.html`
- Optional script execution in export
- Proper scoping so themes still work

#### Security & Control
- Whitelist/blacklist for HTML tags
- Optional warnings for unsafe scripts
- Editor warnings for invalid inline blocks

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
