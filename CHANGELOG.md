# DocForge — Changelog

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