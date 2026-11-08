# DocForge — Changelog

## Version X.X.X — 2026-XX-XX

### User Features
- New project settings (File -> Project Settings) with the tab size of the project and an optional format guide that describes the project for tools and AI assistants, new projects use the tab size from the preferences
- C++: more standard types like mutexes, locks and threads are now highlighted
- Search bar and filters in the links tab
- Broken links now list the entries that use them
- Table headers now stay visible while scrolling through a table
- Right click on a link, a recent project or a template opens the same actions as its "⋯" menu
- Doc theme cards in the appearance manager now have a "⋯" menu (also on right click) to export, rename, duplicate or delete the theme
- Export preview now shows a loading indicator while it builds
- Comments in entries that are hidden in the preview and the export. Lines can be commented out with `Ctrl+#`
- Tables can highlight rows, columns and cells, show hover effects and stripes on rows or columns, and have custom column widths, line widths and alignment
- New table colors in the theme editor for highlights, hover effects and stripes
- Code blocks can show a copy button, line numbers and indent guides, and the language label can be changed or hidden
- New color for the indent guides of code blocks in the theme editor
- Syntax highlighting for inline code
- Check marks in lists with `- [ ]` and `- [x]`, also in numbered lists, with a toolbar button and `Ctrl+Shift+X`
- New color for check marks in the theme editor
- Tree blocks (` ```tree `) show folder structures with folder and file icons and comments, folders can be collapsible and start collapsed, with a toolbar button to insert one
- The bullets of a list can be set to disc, circle, square, dash, arrow or none, also per level
- New color for bullets and list numbers in the theme editor
- Footnotes with `[^1]` in the text and `[^1]: text` anywhere in the entry, listed at the end of the entry and shown on hover, with a toolbar button to insert one
- New color for footnote numbers in the theme editor
- Header, sidebar and table of contents can have their own background and text color in the theme editor
- Hovering a color in the theme editor makes it softly pulse in the preview to show where it is used
- Reopening an entry in the doc editor now returns to the scroll position where you left it
- Go back and forward between the opened entries in the doc editor with `Alt+Left` and `Alt+Right`
- Move up and down through the entry tree of the doc editor with `Alt+Up` and `Alt+Down`, with `Ctrl` also into collapsed entries
- The contents tab of the doc editor now lists the entries that link to the open entry
- Entries can be moved to another tab or under another entry with "Move to tab" in their "⋯" menu
- Choosing an entry, e.g. the target of a link, now opens a searchable list grouped by tab
- When creating an entry you can now choose its tab and parent entry
- `Ctrl+N` in the doc editor creates a new entry under the open entry
- `[toc]` on its own line shows a table of contents of the headings below it, in one of four looks, optionally with a title, numbered or only up to a heading level
- Quick open with `Ctrl+P` or the search field in the title bar of the doc editor: search any entry by name and open it, recently opened entries come first
- Pressing Enter in a list item in the doc editor now starts the next list item, Enter in an empty item ends the list
- Numbered list items can be written as `n.` to be numbered automatically, the ordered list button and `Ctrl+Shift+O` now insert `n.`
- When removing a project from the recent projects, its file or folder can now also be moved to the recycle bin
- Leaving a project with unsaved changes (also by closing the app) now asks whether to save or discard them
- A dot next to the project name in the navigation bar shows that the project has unsaved changes
- After a crash, opening the project offers to restore the unsaved changes from its latest backup
- When an open project with unsaved changes is changed outside of DocForge, you can now choose whether to reload it
- Project, theme and language files can now be dragged onto the app to open or import them
- Opening a project, theme or language file from the file explorer now opens it in DocForge, also when the app is already running
- New color picker in the theme editor with a color square, a color wheel and sliders, the colors of the theme for quick reuse and a pipette to pick a color from anywhere on the screen
- Doc editor text input changes:
- - Markdown, links, footnotes, properties and comments are highlighted while writing, broken links and footnotes without text are marked
- - Suggestions for links, footnotes, code block languages, `[toc]` and the properties of tables, code blocks, tree blocks, lists and `[toc]` while writing, also with `Ctrl+Space`
- - Tables, code blocks, tree blocks, lists and `[toc]` get an edit button (also `Ctrl+.`) to set their properties without writing them and to edit tables in a grid, Alt + arrow keys move between its cells
- Undo and redo for all project changes with `Ctrl+Z` and `Ctrl+Y` (also `Ctrl+Shift+Z`) or the new Edit menu, e.g. deleted or moved entries, tabs, theme and language changes. It opens where the change was made and shows what was undone, restoring a backup can be undone too
- Preferences (File -> Preferences or `Ctrl+,`) with all app settings on one page, a search and a section for every area
- Every keyboard shortcut can be changed or removed in the preferences, with a warning when a key is already used
- New shortcuts for word wrap, the doc editor view (split, editor only, preview only, next view) and switching between the doc editor and the appearance manager, without a key until you set one in the preferences
- App themes in the preferences: seven built-in themes (DocForge, High contrast, Soft, Solarized, Nord, Gruvbox, Catppuccin), each with a dark and a light variant
- Own app themes: duplicate a theme and change every color of the app and the doc editor text, copy colors from other themes, export and import them as files
- Find and replace in doc editor:
- - Find and replace in the selection, the entry, the tab or all tabs, with match case, whole word, regular expressions and preserve case
- - Replacing all matches first shows a preview of every change that can be gone through one by one, single tabs, entries and matches can be left out
- - New search tab in the right sidebar that lists all matches by tab and entry

### Changes
- Ctrl+Z in the doc editor text now only undoes the text of the open entry and keeps working after switching between entries
- Entries in the document editor's left sidebar now show a "⋯" menu (also on right click). Hold Shift to show all entry actions as buttons like before
- HTML export: on mobile the sidebar now closes after selecting an entry
- Changed h3 headers to be none uppercase
- The slug in the links tab is now shown in the tooltip to keep the list readable
- The File and Help menus in the title bar are now sorted more clearly and divided into sections
- Projects are no longer saved automatically, changes are saved with Ctrl+S or File -> Save Project
- Backups are now only created while a project has unsaved changes, every 5 minutes, with up to 10 backups per project
- The backup manager now lists the backups by project, and restoring a backup of the open project replaces its content instead of creating a new project
- Restoring a backup of another project now creates a new folder with the project name in the chosen location
- Repeated toast messages are now shown as one with a counter and move to the bottom
- Clicking a doc theme card in the appearance manager now opens the theme editor right away
- Deleting a doc theme now asks for confirmation
- In fullscreen the title bar now hides the minimize, maximize and close buttons like a native title bar
- Numbered lists now show the numbers as they are written, e.g. a list starting with `2.` starts at 2
- Nested bullet lists deeper than three levels now repeat the bullets of the first levels
- Tabs in code blocks now have the same width in the doc editor, the preview and the HTML export, set by the tab size of the project

### Fixes
- Fix Styling of the recent cards in the project hub when window to small
- An escaped pipe (`\|`) in a table cell is now shown as `|` instead of splitting the cell
- Fix Theme language mapping. Showing language project even if open project was selected
- Fix Blank line codeblock interaction
- Fix keyboard shortcuts not working while clicked into a preview
- Fix open menus and popups staying open when clicking into a preview
- Fix search bar on small screens in HTML export
- Fix dropdowns in dialogs staying open when the dialog is closed with Escape
- Fix code blocks being displayed incorrectly after opening a document with Windows line endings
- Fix dropdown menus being cut off at the edge of the window
- Fix links with a custom text inside tables being split into two cells
- Fix long lists in the links tab being squeezed together
- Fix a short flicker in the HTML export when following a link
- Fix the "Override tag text color" toggle in the theme editor not showing its saved state
- Improved scrolling behavior of the doc editor preview in split mode, the preview now also follows the cursor
- Fix unchanged lines in diff code blocks being slightly shifted compared to added and removed lines
- Fix indented added and removed lines in diff code blocks losing their indentation in the preview
- Fix backups created during the same session all containing the latest state instead of the state at the time of the backup
- Fix the Tabs, Doc themes and Languages buttons in the backup manager not switching the shown contents
- Fix restoring a backup in the web version opening another project
- Fix the colors flashing when clicking the dark/light mode button repeatedly
- Fix long tab names stretching the drop down of the tabs
- Fix lines directly below a heading being shown in one row in the preview instead of below each other
- Fix the large space between a list and the text directly above or below it

### Technical Changes
- Menus and dropdowns use the shared `@common/MenuManager.js`; removed the old dropdown helpers from `@common/UIUtils.js`
- `PROJECT_SCHEMA_VERSION` 4: `project.settings.formatGuide` (`{ enabled, preferences }`), generated by `@common/FormatGuideBuilder.js`, and `project.settings.tabSize`
- Added the `defaultTabSize` state key, `setProjectTabSize()` in `ProjectManager.js` and `getProjectTabSize()` / `normalizeTabSize()` in `Common.js`; code blocks get a `code-tab-N` class
- Added the `lineAnchors` option to `parseMarkdownAsync` (`data-line` on blocks) and `docPreview.getLineAnchors()` for the scroll sync
- Added the `comments` transform and `removeMarkdownMeta()` to `MarkdownParser.js`, `toggleComment()` to `ToolbarHelper.js` and the `Format:comment` shortcut
- Added property blocks (`{...}` above an element) to `MarkdownParser.js`: `properties` / `unused-properties` transforms, `ctx.properties` and `codeBlocks[i].properties`
- Added table properties (`createTableLayout()` in `MarkdownParser.js`, `buildTableColumnHoverJs()` in `HtmlBuilder.js`) and the `table-highlight`, `table-hover` and `table-stripe` theme entries
- Added code properties (`buildCodeBlockHTML()`, `addIndentGuides()`, `renderInlineCode()` in `MarkdownParser.js`, `buildCodeCopyJs()` in `HtmlBuilder.js`) the `code-indent-guide` theme entry; the code block cache now only holds the `<pre>`
- Added the `fs:trash` IPC channel, `trashPath()` / `pathExists()` in `Platform.js` and `trashRecentProjectSource()` in `ProjectManager.js`
- Added the dev-only project preset `DocForge Test Project` (`DevTestProjectPreset.js`) that uses every feature
- The open project is no longer a `StorageManager` key; `saveOpenProject()`, `hasUnsavedChanges()` and `project.session.version`/`savedVersion` replace `isDirty`
- Added `viewManager.setNavigationGuard()`, `@common/UnsavedChangesGuard.js`, `askChoice()` in `BaseModals.js` and the `app:close-ack` / `app:close-cancel` IPC channels
- `BACKUP_VERSION` 2: one storage slot per project (`backups:<fileId>`) plus `backups:index`; old backups are moved over on start
- Added `@core/FileImportManager.js` and the `FileDrop` component for dropped and OS-opened files; `show:modal:importProject` accepts `{ data, filePath }`
- Added `getPathForFile()` to the preload and `readTextFile()` / `getPathForFile()` / `getPendingFiles()` to `Platform.js`
- Shortcut actions can return `false` to skip `preventDefault()`
- Added `@common/ColorPicker.js` (own color picker popup, replaces `<input type="color">`) and the `colorPickerMode` state key
- Added the editor highlighting (`EditorHighlighter.js`, `EditorTokenizer.js`) and `@common/EditorColors.js` with the `editorColors` state key
- Added the editor suggestions (`EditorAutocomplete.js`, `EditorCompletions.js`); `TABLE_HOVER_TYPES` and `TABLE_ALIGNS` are exported from `MarkdownParser.js`
- Added the structure edit (`EditorStructureEdit.js`, `EditorStructures.js`, `StructureEditModal.js`, `TableGridEditor.js`), the `Edit:structure` shortcut and `editor:edit-structure`; `parsePropertyBlock()` is exported from `MarkdownParser.js`
- Added find / replace (`FindWidget`, `ReplacePreviewModal.js`, `@common/TextSearch.js`, `@data/ProjectSearch.js`), the `editorSearch` / `isEditorSearchOpen` session keys, the `editor:find:*`, `editor:search:*`, `editor:select-range` and `editor:replace-content` events and `highlighter.setMarks()`
- Added check mark list items (`buildListItemOpen()` in `MarkdownParser.js`), the `checkbox` theme entry and `toggleCheckMark()` in `ToolbarHelper.js`
- Added `n.` list items and `value` attributes in `parseOrderedLists`, `continueListOnEnter()` in `ToolbarHelper.js`
- Added the `header-*`, `sidebar-*` and `toc-*` color theme entries (`buildAreaColorCSS()`), `getThemeColorVar()` and the `themeEditor:preview:flash` event
- Added the `themePreviewHighlightAmount` / `themePreviewHighlightDuration` state keys, `NUMBER_RANGES` and `getStateNumber()` in `State.js`
- `migrateProject()` and `migratePresetTheme()` now run `migrateTheme()` on every theme, so new theme entries are added with their defaults
- Added `@common/EntryPicker.js` (link target, move, create location) and the `location` option of `NodeTypeModal`
- Added the `Entry:new` shortcut and `editor:new-entry`
- Added the `tocs` / `heading-ids-and-tocs` transforms (headings get `id="h-<nodeId>-<slug>"`) and `buildTocLinkJs()` in `HtmlBuilder.js`
- Added `@common/QuickOpen.js`, the `Navigate:quickOpen` shortcut, `editor:quick-open`, `collectProjectEntries()` and `getRecentEntryIds()`
- Added tree blocks (`buildTreeHTML()` in `MarkdownParser.js`), the `bullet` list property (`LIST_BULLETS`) and the `bullet` theme entry
- Added `@data/AppThemeManager.js` (app themes, `appThemeId` state key, `.dfapptheme` files in `<userData>/app-themes`, `APP_THEME_SCHEMA_VERSION`), `@common/AppThemeModal.js` and `AppThemeMigration.js`; `state.editorColors` is migrated into a custom theme
- Added the preferences view (`navigate:preferences`, `@common/PreferencesNav.js`), user keys in `ShortcutManager` (`setOverrides()`, `setShortcutCombo()`, `findConflicts()`, ...) with the `shortcutOverrides` state key, `getStateDefault()` and `viewManager.getPreviousRoute()`
- Added `@data/ProjectHistory.js` (undo / redo, hooked into `notifyProjectChange()`), `EditorTextHistory.js`, the `Edit:undo` / `Edit:redo` shortcuts, the `historySize` state key, `viewManager.getCurrentRoute()` / `show()` and `disabled` menu items; `session.version` numbers are now unique
- Added footnotes (`footnote-definitions` / `footnotes` / `footnote-list` transforms), the `footnote` theme entry, `getFootnoteLabels()` / `insertFootnote()` in `ToolbarHelper.js`
- Added `@data/EntryHistory.js`, the `Navigate:back` / `Navigate:forward` / `Navigate:tree*` shortcuts, `editor:history`, `editor:tree-step`, `findAdjacentTreeNode()`, the `rememberEntryScroll` state key, `getBacklinks()` and `moveNodeToTab()`

<!-- update-meta: minCompatibleVersion="2.0.0"; incompatibilityNote="This version is not compatible with previous versions. Every project that was created needs to be exported as a .dfproj file to avoid being lost. The exported project can be imported into the new version without any loss."; -->

---

## Version 2.3.0 — 2026-10-04

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
- Export preview in the document editor (File -> Preview Export, `Ctrl+Shift+P`)
- Entry types: `Page`, `Folder` (only groups its children) and `Merged` (shows its children on the same page)
- Create templates from your own projects
- Rename projects in the project hub
- Exported themes can include the project's languages
- Reference links between entries (`[[slug]]`, anchors with `{#name}`) with a Links overview that shows broken links
- Formatting hotkeys in the editor (e.g. `Ctrl+B` bold, `Ctrl+I` italic, `Ctrl+K` link), shown on the toolbar tooltips

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
- Project schema changed: `PROJECT_SCHEMA_VERSION` 2 -> 3, nodes have `type` and `mergeDescendants`, projects have `links`
- Added `@data/LinkManager.js` and the `editor:insert`, `editor:open-node` and `links:open-editor` events
- Added `@data/NodeTypes.js`; the HTML export is built from `resolveExportTree()`
- `buildDocument` always rebuilds the cached document script
- Added `ExportPreviewModal` (`show:modal:exportPreview`) and the `PreviewExport` shortcut
- Project preset schema changed: `PRESET_PROJECT_SCHEMA_VERSION` 1 -> 2, presets have `description`, `createdAt` and `projectVersion`
- Added `CreateTemplateModal` (`show:modal:createTemplate`) and `createActionMenu()` in `UIUtils.js`
- `.dftheme` files can carry `languages` (same format as `.dflang`) next to the theme envelope; added `buildLanguageExportEntity()`, `parseImportLanguageEntity()` and `createImportedLanguage()`
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
