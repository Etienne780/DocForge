# DocForge — Changelog

## Version 2.2.0 — XXXX-XX-XX

### User Features
- Double-clicking a node in the project editor expands it
- External changes to project files/folders are now detected and update the editor automatically
- Added support for nested unordered and ordered lists

### Changes
- Doubled the debounce time in the project editor from 150 ms to 300 ms to prevent flashing while typing.
- Newly created projects now have a default node
- Scrollbars of exported projects now use a different color
- Theme editor rename `Search in project` to `Search in tab`

### Fixes
- Project editor Word wrap not loaded correctly 
- Open external links correctly in System browser
- Fixed an issue where the left sidebar arrow button was not always visible

### Technical Changes
- Change `state`, `PresetProject`, `PresetTheme` and `RecentProject` to use the `wrapEntity / unwrapEntity` structure
- Fixed an issue where some attributes were missing when saving.
- Added new migration files `PresetProjectMigration.js`, `PresetThemeMigration.js` and `RecentProjectMigration.js`

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
- Hierarchical project structure (projects → tabs → nodes)
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