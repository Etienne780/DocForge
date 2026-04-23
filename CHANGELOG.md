# DocForge — Changelog

## Version 1.1.0 — 2026-04-23
- Fixed issues when creating new DocThemes

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