# DocForge — Changelog

## Version 1.3.0 — 2026-xx-xx
- Visuals changes to the theme select button in project manager
- Create new project is no in the top `File` menu
- Open project button in project manager sidebar

### Technical Changes
- new class ResizeController

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