# DocForge Roadmap

Last updated: 03.11.2026

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

### PRIORITY 1 — General Purpose [Fin]

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
- Reference nodes using links to connect different parts of the documentation. [Fin]
  - Links are defined once per project (slug, name, target entry + optional `{#anchor}`) and used as `[[slug]]` / `[[slug|Text]]`.
  - Links tab in the right sidebar: status with reason for broken links, usages, unknown slugs; `{#}` in the toolbar creates an anchor + link at the cursor.
- Add hotkeys for bold, italic, inline code, and other formatting options. [Fin]
  - `Ctrl+B` bold, `Ctrl+I` italic, `Ctrl+E` inline code, `Ctrl+Shift+E` code block, `Ctrl+K` link
  - `Ctrl+1/2/3` headings, `Ctrl+Shift+U` / `Ctrl+Shift+O` lists, `Ctrl+Shift+Q` blockquote
- Create project templates from existing projects. [Fin]
- Improve preview scrolling behavior. [Fin]

### Appearance
- Export/import themes and languages/language styles. [Fin]
- Export themes with the option to include languages (select which ones). [Fin]
- Export languages with the option to include language styles (select which ones). [Fin]

#### Theme
- Select a style for a language within a theme. [Fin]
- Stay at the current position when parameters are changed. [Fin]

### PRIORITY 2 — new Custom html elements
- Own color picker [Fin]
- Own input field for the editor with autocomplete suggestions [Fin]
  - Some kind of display of custome elements with simple highlighting (Tabels, Node refs) [Fin] 
 - Implement basic autocompletion for node references and meta props [Fin] 
  - Ctrl+f to search in text element [Fin]
  - Maybe define a codeblock area with regex in the input filed to display the indenting lines
  - combine this with popups to display tables better make it easier to create theme. or a popup for the attributes that shows like all of theme or something. so changes can only be wirtten or made with UI depending on user preferences [Fin]
- MD Checkmards (check marks should not be interactable)
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
  - ~~Collapsible parts in input field~~

### PRIORITY 3 — Undo / Redo System

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

### PRIORITY 4 — Editor & Navigation

#### Editor
- ~~Search & replace across the whole project (with preview of all matches)~~
- Outline of the current entry's headings in the right sidebar, clickable
- Footnotes
- Table of contents block (`[toc]`)

#### Navigation
- Remember the scroll position per entry (should be abel to disabled in the preferences)
- Back / forward between opened entries (`Alt+Left` / `Alt+Right`)
- Backlinks: "Linked from" list per entry
- Quick open for entries (`Ctrl+P`)
- Move entries between tabs

### PRIORITY 5 - Preferenes/Settings
- The preferences tab is an item in the file drop down
- The Preferences tab should have a tab where all settings are on page to scroll down. but some settings open under menus like app-themes or hotkeys dose undermenus can also be accesed from the drop down entry as child element sof the main prefernces item
- Page to customize every hotkey
- Customize the whole theme of the app. Light and darkmode get turned in to themes. there should also be more themens aviablable. 
- - The user should be able to create custome themes and save theme
- - Custome themes are saved in appdata in a seperate folder. In web themes should not be stored. a user can only load a theme from a file
- - custome themes should be exportedable with its own file extensions
- - A theme also customizes the editor colors
- - The Theme page is logically grouped.
- - You can copy colors from other themes so it is easier to create or own. While coping you can select a whole group fo colors to copy and then deselect some or just select theme on by one. 
- - if there are to many colors then there should also be a search bar

## Version 3.0

### PRIORITY 1 — Theme Editor (Syntax Themes)

#### Custom Languages
- `Language editor` and `Language style editor`
- Create new language
- Regex token definitions
- Token types (keyword, string, comment, number, operator, etc.)
- Define example code
- Internal syntax engine
- Multiple themes per language
- Ability to modify existing languages

### PRIORITY 2 — Images & Assets
- General image support in Markdown (`![alt](path)`), in the preview and the HTML export
- `assets/` folder in folder projects, embedded data in `.dfproj` projects
- Add images via drag & drop or paste, stored in the project's assets
- Image properties via the `{...}` property system (width, alignment, caption)
- Images are included in the HTML export

### PRIORITY 3 — Diagrams
- Code blocks with their own language (`diagram:<type>`) so they stay readable as text in other Markdown viewers
- Settings via the `{...}` property system
- `diagram:memory`: bar with colored sections (offset, length, group, text) and a legend
- `diagram:sequence`: calls over time between participants, with labels
- `diagram:flow`: boxes, arrows, labels and groups, automatic layout, `direction=down|right`
- Colors through theme entries

### PRIORITY 4 — Export
- PDF export (page break per entry)
- Multi-page static export (one HTML file per entry, e.g. for GitHub Pages)

### PRIORITY 5 — Project Quality
- Project check: empty entries, missing images, unused anchors
- Statistics: words per entry / tab, last changed
- Git status for folder projects (mark changed files)

## Version 4.0

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
