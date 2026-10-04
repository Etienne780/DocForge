# DocForge — Changelog

## Version 2.3.0 — 2026-XX-XX

### User Features
- Partial syntax highlighting for `Whitespace` (Stack, Arithmetic, Heap, I/O — Flow Control not yet supported)
- Added a toolbar to the left sidebar of the document editor. Entries can now be expanded or collapsed all at once, and creating new entries has been moved into the toolbar.
- Hold Ctrl while collapsing/expanding an entry to collapse/expand its child entries
- Clicking on an already open tab entry scrolls to top
- External changes to `.dfproj` files are now detected
- Doc themes, languages and language styles can now be exported and imported into any project. When importing a language style, the target language is checked against the style and languages that don't fully match show a warning
- New "Languages" tab in the theme editor to choose which style a theme uses for each language
- Custom languages whose name or aliases overlap with a built-in language are marked on their card and in the language popup
- Added more built-in language styles (Light+, One Dark, Monokai, Dracula, GitHub Light) for all built-in languages
- Export preview in the document editor (File → Preview Export, `Ctrl+Shift+P`)
- Entry types: `Page`, `Folder` (only groups its children) and `Merged` (shows its children on the same page)
- Create templates from your own projects
- Rename projects in the project hub
- Formatting hotkeys in the editor (e.g. `Ctrl+B` bold, `Ctrl+I` italic, `Ctrl+K` link), shown in the toolbar tooltips

### Changes
- Made update modal larger
- Project cards in the project hub use a ⋯ menu for their actions

### Fixes
- Selecting another tab entry resets the scroll position correctly
- HTML export could contain outdated entries and search results
- Child entries of a deleted entry no longer reappear after saving a folder project
- Deleted themes and languages no longer reappear after saving a folder project
- External changes to project config, themes and languages are now detected
- After loading external changes, the tab list showed outdated tabs and newly created tabs got lost

### Technical Changes
- Added `underlineStyle` to the `createTokenStyle` function in `SyntaxDefinitionManager.js`. Uses the `text-decoration-style` CSS property.
- Added `@core/InputManager.js` file used in `doc editor ` sidebar left
- Syntax highlighter symbol tables are prototype-less objects (`Object.create(null)`) in `SyntaxHighlightWorker.js`
- Added the `.dflangstyle` file format (`LANGUAGE_STYLE_SCHEMA_VERSION`, `LanguageStyleMigration.js`) and the export/import modals for themes, languages and language styles
- Project schema changed: `PROJECT_SCHEMA_VERSION` 2 -> 3, nodes have `type` and `mergeDescendants`
- Added `@data/NodeTypes.js`; the HTML export is built from `resolveExportTree()`
- `buildDocument` always rebuilds the cached document script
- Added `ExportPreviewModal` (`show:modal:exportPreview`) and the `PreviewExport` shortcut
- Project preset schema changed: `PRESET_PROJECT_SCHEMA_VERSION` 1 -> 2, presets have `description`, `createdAt` and `projectVersion`
- Added `CreateTemplateModal` (`show:modal:createTemplate`) and `createActionMenu()` in `UIUtils.js`
- Added the `editor:format` event and `Format:<action>` shortcuts in the `docEditor` context
- Shortcut labels can target the `title` attribute (`data-shortcut-target="title"`); the initial DOM scan now looks for `data-shortcut-label`
- `APP_CHANGE_LOGS` in `AppMeta.js` now groups `changes` by category (object keyed by group name) instead of a flat list with comments; added `getChangeLogs()` and `getChangeLogGroups()`, fixed `getHTMLFormatedChangeLog()` calling a missing function

<!-- update-meta: minCompatibleVersion="2.0.0"; incompatibilityNote="This version is not compatible with previous versions. Every project that was created needs to be exported as a .dfproj file to avoid being lost. The exported project can be imported into the new version without any loss."; -->

---

## Version 2.2.0 — 2026-09-18

### User Features
- Double-clicking a node in the project editor expands it
- External changes to project files/folders are now detected and update the editor automatically
- Added support for nested unordered and ordered lists
- Added support for diff code blocks. Use `diff` or `diff:langName`  (e.g. `diff:cpp`) instead of `cpp`. Lines starting with `+` or `-` are displayed as added or removed changes.

### Changes
- Doubled the debounce time in the project editor from 150 ms to 300 ms to prevent flashing while typing.
- Newly created projects now have a default node
- Scrollbars of exported projects now use a different color
- Theme editor rename `Search in project` to `Search in tab`
- Show element names on hover in the exported project sidebar.
- Searches now include content from code blocks and inline code.

### Fixes
- Project editor Word wrap not loaded correctly 
- Open external links correctly in System browser
- Fixed an issue where the left sidebar arrow button was not always visible in exported projects
- Removed Auto updater from MacOS
- Faster loading times for languages
- Cpp language highlighting for template functions

### Technical Changes
- Change `state`, `PresetProject`, `PresetTheme` and `RecentProject` to use the `wrapEntity / unwrapEntity` structure
- Fixed an issue where some attributes were missing when saving.
- Added new migration files `PresetProjectMigration.js`, `PresetThemeMigration.js` and `RecentProjectMigration.js`
- Added `TempFileManager` to detect and remove stale temporary files left behind by failed or interrupted write operations
- Added dompurify package
- Added balanced lookahead to syntax definition match

<!-- update-meta: minCompatibleVersion="2.0.0"; incompatibilityNote="This version is not compatible with previous versions. Every project that was created needs to be exported as a .dfproj file to avoid being lost. The exported project can be imported into the new version without any loss."; -->

---

## Version 2.1.0 — 2026-08-23

### User Features
- Visually highlight the active node when viewing the exported project

### Fixes
- Fix the title bar briefly appearing on the loading screen during startup
- Fix the app window being unintentionally draggable after startup in `Project-hub` 
- Fix C++ type highlighting for `using` aliases and for undefined variable types
- Fix the project path field appearing empty in the Create Project dialog when the project name is invalid
- Fix split view scrolling synchronization in the project editor
- Fix node preview position not updating after node changes
- Fix theme editor project preview position after updating
- Fix Drop down padding styling

### Technical Changes
- Added base view onLoad function (gets called when the view is finished loading into the DOM)
- Added ability to skip version view

<!-- update-meta: minCompatibleVersion="2.0.0"; incompatibilityNote="This version is not compatible with previous versions. Every project that was created needs to be exported as a .dfproj file to avoid being lost. The exported project can be imported into the new version without any loss."; -->

---

## Version 2.0.0 — 2026-08-16

### User Features
- Projects now live on disk instead of in the appdata folder:
  - New UI for the main page
    - List of presets
    - List of recently opened projects
  - Every project now has one corresponding theme
  - New save type: Folder
    - Stores the files in a folder-like structure
- Syntax highlighting for over 40 languages inside of code blocks (see details below)
- New word wrap toggle in `Doc-editor`
- Extended DocTheme settings:
  - use the currently open project for preview
  - sidebar-min-width
  - sidebar-width-type
    - sidebar-width-px
    - sidebar-width-per
  - toc-min-width
  - toc-width-type
    - toc-width-px
    - toc-width-per
  - search-enabled
    - search-position
    - search-show-in-tab

Supported programming languages for highlighting:
- Assembly
  - aarch64
  - x86_64
  - ...
- Batch (bat)
- Brainfuck
- C
- C++
- C#
- CSS
- Dockerfile
- Go
- GraphQL
- Groovy
- Haskell
- Holy C
- HTML
- Ini
- Java
- JavaScript
- JSON
- Kotlin
- LESS
- Lua
- Objective-C
- Objective-C++
- OTN
- Perl
- PHP
- PL/SQL
- PowerShell (ps1)
- Python
- Ruby
- Rust
- SASS
- Scala
- Shell
- SQL
  - PostgreSQL
  - MySQL
  - SQLite
- Swift
- TOML
- T-SQL
  - SQL Server
- TypeScript
- XML
- YAML

### Fixes
- Fixed inconsistent loading behavior

### Technical Changes
- Introduced versioning for every file type
- New way to open, read, and write projects with the `DocumentManager`
- New migration system
- New file version for projects: v2
  - Themes are now stored inside the project
  - Languages are now stored inside the project
- New file version for themes: v2

---

## Version 1.3.0 — 2026-05-09

### User Features
- Improved visual design of the theme selection button in the project manager
- Added "Create New Project" option to the top `File` menu
- Added "Open Project" button in the project manager sidebar
- Added validation feedback for short names (Create/Rename Project, DocTheme, Language)
- Improved dropdown closing behavior
- Added overview modal

### Improvements
- Improved drag and drop behavior for UI elements
- Extended dropdown system with support for submenus

### Fixes
- Fixed visual issues in drag and drop interactions
- Fixed inconsistencies in dropdown menu behavior

### Technical Changes
- Added `ResizeController` class
- Introduced validation module with centralized validation rules and error definitions
- Moved create project modal styles from `SidebarLeft.css` to `SharedModals.css`
- Added new CSS variable `--list-element-height` in `main.css`
- Extended dropdown system with submenu support
- Added helper functions in `UIUtils.js`:
  - `createDropDownGroup()`
  - `openMenuItem()` / `closeMenuItem()`
  - `openGroup()` / `closeGroup()`
- Added new Overview modal implementation
- Added option to open user data path from the help menu in dev builds

---

## Version 1.2.0 — 2026-04-27

### User Features
- Added include theme button to project export
- Better project import dialog
- Added "Documentation Preview" label above preview area to clarify preview context
- Extended DocTheme settings:
  - list-item-gap
  - table-cell-padding
  - blockquote-border-width
  - blockquote-radius
  - padding-content
  - scrollbar-size
- Added typography controls:
  - line-height
  - code-line-height
- Added layout controls:
  - sidebar-width
  - toc-width

### Improvements
- Improved DocTheme schema structure and consistency

### Fixes
- Fixed macOS titlebar behavior
- Minor stability fixes in theme system
- Theme select sidebar visibility
- `Html` project export

---

## Version 1.1.0 — 2026-04-23
- Fixed issues when creating new DocThemes
- Fixed Release notes display in Update-dialog
- Fixed Saving/Loading

---

## Version 1.0.0 — 2026-04-23

### User Features
- Dynamic tab system: create, delete, and reorder tabs per project
- Split-view editor with live Markdown preview
- Markdown support: tables, lists, blockquotes, and horizontal rules
- Hierarchical project structure (projects -> tabs -> nodes)
- DocTheme system with customizable fonts and colors
- Drag-and-drop reordering for tabs and nodes
- Search for projects and themes
- Sorting by creation date or alphabetical order
- Export tabs as standalone HTML with embedded CSS and sidebar navigation
- Export projects as `.dfproj`

---

### Technical Changes
- Multi-view architecture: Project Manager, Doc Editor, Theme Manager, Theme Editor
- Lazy-loaded views for improved performance
- Central state management for projects, tabs, and nodes
- SessionState for session-scoped data
- Persistent State for data stored across sessions
- StorageManager with platform-specific adapters
- Event-driven architecture for navigation and project updates
- Component system for reusable document elements
- ComponentRegistry with dynamic discovery and lifecycle handling
