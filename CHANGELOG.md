# DocForge — Changelog

**Version 1.0 — 2026-04-23**

---

### User-Facing Features
- Dynamic tab system: each project can have multiple tabs; tabs can be created, deleted, and reordered.
- Split-view editor with live Markdown preview.
- Markdown support: tables, lists, blockquotes, and horizontal rules.
- Hierarchical project structure: projects contain tabs, tabs contain nodes.
- DocTheme system: customize themes including fonts and colors.
- Drag-and-drop reordering for tabs and nodes.
- Search projects/themes
- Sort project/themes after creation date or alphabetical orderw
- Export tabs as standalone HTML files with embedded CSS and a navigable sidebar.
- Export project as '.dfproj'

---

#### Full Technical Changes
- Multi-view navigation implemented: Project Manager, Doc Editor, Theme manager, Theme Editor.
- Views are lazy-loaded for performance.
- StateManager tracks active projects, tabs, and nodes.
- SessionState for managing vars each session
- State for data that should exceedes a session
- Storage manager saves data and loads data depending on the platform
- storage adaptgers for abstracting platform specific saves
- Event-driven architecture for navigation and project changes.
- Component loader: embed reusable building blocks in documents.
- ComponentRegistry with dynamic component discovery and lifecycle hooks.