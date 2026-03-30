# DocForge — Changelog

**Version 1.0 — 2026-XX-XX**

---

### User-Facing Features
- Dynamic tab system: each project can have multiple tabs; tabs can be created, deleted, and reordered.
- Split-view editor with live Markdown preview.
- Markdown support: tables, lists, blockquotes, and horizontal rules.
- Hierarchical project structure: projects contain tabs, tabs contain nodes.
- Per-project DocTheme system: customize themes including fonts and colors.
- Component loader: embed reusable building blocks in documents.
- Drag-and-drop reordering for tabs and nodes.
- Export tabs as standalone HTML files with embedded CSS and a navigable sidebar.

---

#### Full Technical Changes
- Multi-view navigation implemented: Editor, Project Manager, Theme Editor.
- Views are lazy-loaded for performance.
- TabManager handles tab creation, removal, and drag-and-drop internally.
- DocThemeHelper manages per-project CSS variables and font sizes.
- StateManager tracks active projects, tabs, and nodes.
- Event-driven architecture for navigation and project changes.
- MarkdownParser supports tables, blockquotes, lists, horizontal rules.
- ComponentRegistry with dynamic component discovery and lifecycle hooks.