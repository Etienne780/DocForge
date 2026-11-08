# DocForge - Developer Reference

Quick lookup for state keys, events, data shapes, and all exported APIs.
Written for day-to-day use during development - structural overview, not a tutorial.

---

## Table of Contents

1. [Path Aliases](#1-path-aliases)
2. [State](#2-state)
3. [Session State](#3-session-state)
4. [Events](#4-events)
5. [Data - ProjectManager](#5-data--projectmanager)
6. [Core Modules](#6-core-modules)
7. [View System](#7-view-system)
7.1 [Navbar Component & navContext](#71-navbar-component--navcontext)
8. [Component API](#8-component-api)
9. [Modal Builder](#9-modal-builder)
10. [DocTheme System](#10-doctheme-system)
11. [Syntax Definitions & Highlight Styles](#11-syntax-definitions--highlight-styles)
12. [Editor Helpers](#12-editor-helpers)
13. [Tree, Tabs & DragDrop](#13-tree-tabs--dragdrop)
14. [Markdown, HTML & Export](#14-markdown-html--export)
15. [Data Shapes](#15-data-shapes)
16. [Persistence, Envelopes & Migration](#16-persistence-envelopes--migration)
17. [Electron / IPC](#17-electron--ipc)
18. [UI Utilities](#18-ui-utilities)
19. [Validation](#19-validation)
20. [Publishing a Release](#20-publishing-a-release)

---

## 1. Path Aliases

Configured in `vite.config.js`. Use these everywhere inside `renderer/`.

| Alias | Resolves to |
|---|---|
| `@core` | `renderer/core/` |
| `@common` | `renderer/common/` |
| `@data` | `renderer/data/` |
| `@migration` | `renderer/migration/` |
| `@views` | `renderer/views/` |
| `@ui` | `renderer/ui/` |

```js
import { state }                from '@core/State.js';
import { session }              from '@core/SessionState.js';
import { eventBus }             from '@core/EventBus.js';
import { componentLoader }      from '@core/ComponentLoader.js';
import { parseMarkdownAsync }   from '@core/MarkdownParser.js';
import { getOpenProject }       from '@data/ProjectManager.js';
```

---

## 2. State

Persisted, app-level state.

**Import:** `import { state } from '@core/State.js'`

```js
state.get(key)        // read a value (falls back to DEFAULT_STATE[key])
state.set(key, value) // write + fires state:change and state:change:<key>
state.notify(key, {   // fire change events without writing to state
  value,              // use when you mutate a nested object directly
  previousValue
}, extension?)
state.snapshot()      // shallow copy of the entire state object
state.reset()         // resets the state to DEFAULT_STATE

// Used by the StorageManager subscriptions in init/InitStorage.js:
state.uiStateSnapshot()       / state.load(raw)                / state.uiStateReset()
state.recentProjectsSnapshot() / state.loadRecentProjects(raw) / state.resetRecentProjects()
state.projectPresetsSnapshot() / state.loadProjectPresets(raw) / state.resetProjectPresets()
state.themePresetsSnapshot()   / state.loadThemePresets(raw)   / state.resetThemePresets()
```

### State Keys

| Key | Type | Default | Persisted in | Notes |
|---|---|---|---|---|
| `isFirstLaunch` | `bool` | `true` | `state` | First launch after installation |
| `hasViewedOverview` | `bool` | `false` | `state` | Overview modal dismissed at least once |
| `isDarkMode` | `bool` | `true` | `state` | App-level dark/light mode |
| `projectEditorMode` | `string` | `'split'` | `state` | `'split'` \| `'editor'` \| `'preview'` |
| `appereanceSortAction` | `string` | `'none'` | `state` | Sort mode in the Appearance Manager (`SortingActions` component) |
| `hideWebProjectLimitWarn` | `bool` | `false` | `state` | Web only: hides the warning when opening a project would exceed `MAX_NUMBER_OF_RECENT_PROJECTS` |
| `docEditorWordWrapEnabled` | `bool` | `false` | `state` | Word wrap in the doc editor textarea |
| `skippedUpdateVersion` | `string\|null` | `null` | `state` | Version the user chose to skip in the update modal |
| `editorColors` | `Object` | `{ dark: {}, light: {} }` | `state` | Legacy: doc editor colors from before app themes. If set, `initAppThemes()` turns them into the custom theme "My editor colors", selects it and empties the key |
| `appThemeId` | `string` | `'docforge'` | `state` | Selected app theme (`@data/AppThemeManager.js`), the variant follows `isDarkMode`; an unknown id falls back to `docforge` on start |
| `colorPickerMode` | `string` | `'sv-square'` | `state` | View of every color picker: `'sv-square'` \| `'hsl-wheel'` \| `'hsl-sliders'` \| `'rgb-sliders'` (`@common/ColorPicker.js`) |
| `themePreviewHighlightAmount` | `number` | `10` | `state` | % white mixed into the hovered color in the theme editor preview (0 - 100, 0 = off) |
| `themePreviewHighlightDuration` | `number` | `1200` | `state` | ms of one pulse step of that color (200 - 2000) |
| `rememberEntryScroll` | `bool` | `true` | `state` | Doc editor: reopening an entry restores the editor / preview scroll position of its last visit (session only, `project.session.entryScroll`) |
| `historySize` | `number` | `100` | `state` | Max undo steps of the open project (10-500, `NUMBER_RANGES`), see Undo / Redo in §5 |
| `defaultTabSize` | `number` | `2` | `state` | `settings.tabSize` of new projects (1-16, `TAB_SIZE_RANGE`), Preferences -> Editor |
| `shortcutOverrides` | `object` | `{}` | `state` | User keys of the shortcuts: `{ "<context>:<name>": combo \| '' }` (`''` = no key), only the ones that differ from the registered combo. Applied by `shortcutManager.setOverrides()` in `InitHotkeys.js`, saved on every change |
| `recentProjects` | `Array` | `[]` | `recentProjects` | See [RecentProject](#recentproject) |
| `projectPresets` | `Array` | `[]` | `projectPresets` | See [Project Preset](#project-preset-in-stateprojectpresets) |
| `themePresets` | `Array` | `[]` | `themePresets` | User-saved theme templates |

Keys marked `state` are in `PERSISTED_KEYS` and saved together via
`state.uiStateSnapshot()`. The others have their own `StorageManager` slot.

Number keys with a range are listed in `NUMBER_RANGES` (exported, `{ key: { min, max } }`, e.g. for a
preferences UI). Loading clamps them; read them with `getStateNumber(key)`, which clamps a value set at runtime too.

---

## 3. Session State

Runtime-only state, never persisted.

**Import:** `import { session } from '@core/SessionState.js'`

```js
session.get(key)              // read a value
session.set(key, value)       // write + fires session:change and session:change:<key>
session.notify(key, {         // fire change events without writing
  value, previousValue
}, extension?)
session.snapshot()            // shallow copy of the entire session object
session.openProjectSnapshot() // shallow copy of just the open project
session.reset()               // resets to default
```

### Session State Keys

| Key | Type | Default | Notes |
|---|---|---|---|
| `isDev` | `bool` | `null` | Set once in `Bootstrap.js` |
| `openProject` | `Object\|null` | `null` | The single currently open [Project](#project) |
| `activeTabId` | `string\|null` | `null` | Selected tab within `openProject` |
| `activeNodeId` | `string\|null` | `null` | Selected node within the active tab |
| `collapsedNodes` | `Object` | `{}` | `{ [nodeId]: true }` - collapsed nodes in the tree |
| `appearanceManagerDisplay` | `string` | `'all'` | Filter of the Appearance Manager gallery |
| `docThemePresets` | `Array` | `[]` | Built-in [DocThemes](#doctheme) (registered in `init/InitPresets.js`) |
| `languagePresets` | `Array` | `[]` | Built-in [SyntaxDefinitions](#syntaxdefinition) |
| `languageStylePresets` | `Array` | `[]` | Built-in [HighlightStyles](#highlightstyle) |
| `projectHubSearchQuery` | `string` | `''` | Search string on the Project Hub |
| `editorSearch` | `Object` | `{ query: '', replace: '', matchCase, wholeWord, useRegex, preserveCase: false, scope: 'entry' }` | Find / replace options of the doc editor (`FindWidget`), always set as a new object. `scope`: `'selection'` \| `'entry'` \| `'tab'` \| `'all'` |
| `isEditorSearchOpen` | `bool` | `false` | The find box of the doc editor is open (the option shortcuts only act then) |
| `linksSearchQuery` | `string` | `''` | Search string of the Links tab in the doc editor right sidebar (free text over name + slug, optional `name:` / `slug:` prefixes) |
| `activeView` | `string\|null` | `null` | `viewId` of the active view (set by `ViewManager`) |
| `navContext` | `Object\|null` | `null` | Breadcrumb override for sub-views, see [§7.1](#71-navbar-component--navcontext) |
| `isRightProjectEditorSidebarCollapsed` | `bool` | `false` | Doc editor right sidebar (TOC) collapsed |

### Common Patterns

```js
// Switch tab - always reset node
session.set('activeTabId', tab.id);
session.set('activeNodeId', null);

// Collapse a node in the tree
session.set('collapsedNodes', { ...session.get('collapsedNodes'), [nodeId]: true });

// Mutate the open project in place and notify listeners
notifyOpenProjectChange(project => {
  project.name = 'New Name';
}, 'name');
// Emits: session:change:openProject:name
```

---

## 4. Events

**Import:** `import { eventBus } from '@core/EventBus.js'`

```js
eventBus.emit(event, payload)  // fire an event (handler errors are caught and logged)
eventBus.on(event, handler)    // returns an unsubscribe function
eventBus.off(event, handler)   // remove specific handler
eventBus.clearEvent(event)     // remove all handlers for one event
this.subscribe(event, handler) // inside Component/BaseView - auto-cleaned on destroy
```

### State / Session Events
Emitted automatically by `state.set()` / `session.set()` / `.notify()` - never emit manually.

| Event | Payload |
|---|---|
| `state:change` | `{ key, value, previousValue }` |
| `state:change:<key>` | `{ value, previousValue }` |
| `session:change` | `{ key, value, previousValue }` |
| `session:change:<key>` | `{ value, previousValue }` |
| `session:change:openProject:<extension>` | Fired by `notifyOpenProjectChange` / `notifyProjectChange`, e.g. `:tabs`, `:tabs:nodes`, `:tabs:nodes:name`, `:tabs:nodes:type`, `:name`, `:themes`, `:settings`, `:languages`, `:languagesStyles` |

`state:change` also schedules a debounced autosave (800 ms) in `StorageManager`.

### Storage Events

Storage keys: `state`, `recentProjects`, `projectPresets`, `themePresets` (see `init/InitStorage.js`).
The open project is **not** a storage key and is never auto-saved: `save:request:openProject`
(Ctrl+S, Save All) calls `saveOpenProject()` (`@common/ProjectPersistence.js`, not ProjectManager: the
syntax highlight worker imports ProjectManager and must not pull in StorageManager). `save:request` saves the app state only.

| Event | Payload | Notes |
|---|---|---|
| `save:request` | - | Save every slot now (app state, not the open project) |
| `save:request:<key>` | - | Save one slot now. `save:request:openProject` saves the open project |
| `save:complete` / `save:complete:<key>` | - | Emitted by `StorageManager` |
| `reset:complete` / `reset:complete:<key>` | - | Emitted by `StorageManager` |

### Application Events

| Event | Payload | Emitted by | Received by |
|---|---|---|---|
| `editor:content-changed` | `{ markdown }` | `EditorArea` | `SidebarRight` |
| `editor:stats-updated` | `{ wordCount, charCount }` | `EditorArea` | `SidebarRight` |
| `editor:format` | `{ action }` (toolbar action, e.g. `'bold'`) | formatting shortcuts (`Format:<action>`, `InitHotkeys.js`) | `EditorArea` (only while the input has focus) |
| `editor:insert` | `{ text }` | links tab, link modal | `EditorArea` (inserts at the cursor) |
| `editor:open-node` | `{ nodeId, anchor? }` (anchor = element id) | links tab | `EditorArea` (selects the entry in any tab) |
| `editor:tree-step` | `{ direction: -1 \| 1, all }` | `Navigate:treeUp` / `treeDown` (Alt+Up / Down, visible entries) and `Navigate:treeUpAll` / `treeDownAll` (Ctrl+Alt+Up / Down, also collapsed ones, expands them) | doc editor `SidebarLeft` (`findAdjacentTreeNode()` in `TreeHelper.js`) |
| `editor:quick-open` | - | `Navigate:quickOpen` shortcut (Ctrl+P, not while a modal is open) | `DocEditorView` (`QuickOpen`, opens via `editor:open-node`) |
| `editor:new-entry` | - | `Entry:new` shortcut (Ctrl+N, not while a modal is open) | doc editor `SidebarLeft` (create dialog with the open entry as parent, top level of the tab without one) |
| `editor:history` | `{ direction: -1 \| 1 }` | `Navigate:back` / `Navigate:forward` shortcuts (Alt+Left / Alt+Right, not while a modal is open) | `DocEditorView` -> `navigateEntryHistory()` |
| `editor:select-range` | `{ nodeId, start, end, focus? }` | `FindWidget`, search tab | `EditorArea` (opens the entry, selects the range, scrolls to it) |
| `editor:replace-content` | `{ nodeId, content }` | `FindWidget` (replace all) | `EditorArea` (replaces the open entry like typing: undo history) |
| `editor:edit-structure` | - | `Edit:structure` shortcut | `EditorArea` (property modal of the table / code block at the cursor) |
| `editor:find:open` | `{ scope?, replace? }` | `Find:<scope>` / `Replace:<scope>` shortcuts | `FindWidget` |
| `editor:find:next` | `{ direction: 1 \| -1 }` | `FindNext` / `FindPrevious` | `FindWidget` (opens it when closed) |
| `editor:find:toggle` | `{ option }` (`matchCase`, `wholeWord`, `useRegex`, `preserveCase`) | `Find:<option>` shortcuts (only while open) | `FindWidget` |
| `editor:find:replace-all` | - | `Find:replaceAll` (only while open) | `FindWidget` (opens the replace preview) |
| `editor:search:results` | `{ error, groups, total, options } \| null` (null = closed) | `FindWidget` (after every search) | `SidebarRight` (search tab) |
| `editor:search:show` | - | `FindWidget` (tab / all tabs scope) | `SidebarRight` (switches to the search tab) |
| `links:open-editor` | `{ linkId?, anchorAt?, slug? }` | editor toolbar (`{#}`) | `SidebarRight` (link modal) |
| `zoom:changed` | `factor` | `ElectronBridge` | `InitEvents` |
| `window:fullscreen-changed` | `isFullScreen` | `ElectronBridge` | `Titlebar` (hides the window controls) |
| `toast:show` | `{ message, type = 'success', durationMS? }` | anywhere | `Toast` |
| `modal:open` | `{ overlay }` | `openModal()` (`@core/ModalBuilder.js`) | `EditorAutocomplete` (closes its popover, it is in the top layer above modals) |
| `syntaxDefinitionManager:removedStyle` | `{ langId, styleIds }` | `SyntaxDefinitionManager` | `SyntaxHighlighter` |
| `themeEditor:update:display` | - | Theme editor sidebar | `DocThemePreview` |
| `themeEditor:preview:language` | `{ langId \| null }` | `ContentMapping` | `DocThemePreview` (shows the language's example code in the showcase tab, `null` restores the showcase) |
| `themeEditor:preview:flash` | `{ key \| null }` | `ContentAppearance` (hover over a color) | `DocThemePreview` (the color's CSS variable slowly pulses a bit brighter via the animated `--df-flash-amount`, mixed with white, with black for light colors (`getFlashMixColor()` in `@common/ColorFlash.js`), strength / speed from `themePreviewHighlightAmount` / `themePreviewHighlightDuration`, `getThemeColorVar()`; `null` restores it) |
| `appearanceManager:openModal:<section>` | `{ id, builtIn }` (`lang`, `styleList`) | Language cards | `AppearanceManagerView` |
| `backupManager:change` | - | `BackupManager` | `BackupManagerModal` |
| `project:unsavedChange` | `{ project, unsaved }` (only when the flag flips) | `notifyProjectChange`, `markProjectSaved`, `setProjectVersion` | `Navbar`, `BackupManager` |
| `appThemes:change` | - | `@data/AppThemeManager.js` (theme added, renamed, deleted, colors changed) | `PreferencesView` |
| `preferences:show-section` | `{ section \| null }` | `openPreferences()` while the preferences are open | `PreferencesView` (scrolls to the section) |
| `history:change` | `{ project }` | `@data/ProjectHistory.js` (step recorded / merged, undo, redo, cleared) | - (for undo / redo buttons) |
| `updater:status` | `status` | `UpdateManager` | `UpdateModal` |
| `updater:progress` | `percent` (int) | `UpdateManager` | |
| `updater:ready` | `info` | `UpdateManager` | |

### Navigation Events
Handled by `ViewManager`. Routes are lazy imports in the `VIEW_ROUTES` object in
`@core/Navigation.js` - register new views there.

| Event | View | Props |
|---|---|---|
| `navigate:appLoader` | `AppLoaderView` | - |
| `navigate:projectHub` | `ProjectHubView` | - |
| `navigate:docEditor` | `DocEditorView` | - |
| `navigate:appearanceManager` | `AppearanceManagerView` | - |
| `navigate:themeEditor` | `ThemeEditorView` | `{ themeId }` |
| `navigate:languageEditor` | `LanguageEditorView` | `{ langId }` |
| `navigate:languageStyleEditor` | `LanguageStyleEditorView` | `{ project, styleId, ... }` |
| `navigate:preferences` | `PreferencesView` | `{ section? }` (use `openPreferences(section)` from `@common/PreferencesNav.js`) |

### Modal Events

Modals are built once in `initSharedModals()` (`@core/SharedModal.js`).

| Modal | Event | Payload | Overlay ID |
|---|---|---|---|
| `InfoModal` | `show:modal:info` | - | `application-info-modal` |
| `UpdateModal` | `show:modal:update` | `info?` | `application-update_modal` |
| `CreateProjectModal` | `show:modal:createProject` | `{ preset? }` | `application-create_project-modal` |
| `CreateTemplateModal` | `show:modal:createTemplate` | `{ project? , recentProjectId? }` | `application-create_template-modal` |
| `OverviewModal` | `show:modal:overview` | - | `application-overview_modal` |
| `ChangelogModal` | `show:modal:changelog` | - | `application-changelog-modal` |
| `BackupManagerModal` | `show:modal:backupManager` | - | `application-backup_manager-modal` |
| `ProjectSettingsModal` | `show:modal:projectSettings` | `{ project }` | `application-project_settings-modal` |
| `ExportProjectModal` | `show:modal:exportProject` | `{ project }` | `application-export_project-modal` |
| `ExportPreviewModal` | `show:modal:exportPreview` | `{ project }` | `application-export_preview-modal` |
| `ImportProjectModal` | `show:modal:importProject` | `{ data?, filePath? }` | `application-import_project-modal` |
| `ExportDocThemeModal` | `show:modal:exportDocTheme` | `{ project, themeId }` | `application-export_doc_theme-modal` |
| `ExportLanguageModal` | `show:modal:exportLanguage` | `{ project, langId }` | `application-export_language-modal` |
| `ExportLanguageStyleModal` | `show:modal:exportLanguageStyle` | `{ project, styleId }` | `application-export_language_style-modal` |
| `ImportDocThemeModal` | `show:modal:importDocTheme` | `{ projectId?, data?, filePath? }` | `application-import_doc_theme-modal` |
| `ImportLanguageModal` | `show:modal:importLanguage` | `{ projectId?, data?, filePath? }` | `application-import_language-modal` |
| `ImportLanguageStyleModal` | `show:modal:importLanguageStyle` | `{ projectId?, langId?, data?, filePath? }` | `application-import_language_style-modal` |

The theme/language/style import modals let the user pick the target project (open project + recents,
see `ProjectPersistence.js`). `projectId`/`langId` only preselect. Passing `data` (file content as string
or parsed object) skips the file picker and goes straight to the preview, e.g. for files opened via the OS.
Shared parts live in `core/modal/import/ImportModalHelper.js`. The export modals use `zIndex: 1002` so
they open above the appearance manager modals.

The style import lists the language included in the file, all built-in languages and the target
project's languages. Each option is checked with `matchHighlightStyleToLang()`; languages that don't
match every style element are marked with a warning but can still be selected.

---

## 5. Data - ProjectManager

**Import:** `import { ... } from '@data/ProjectManager.js'`

```js
export const MAX_NUMBER_OF_RECENT_PROJECTS = 10;
```

### Creating Data

```js
generateProjectId() / generateTabId() / generateNodeId()  // -> 'project_…' / 'tab_…' / 'node_…'

createProject(name)            // -> Project (see §15)
createDefaultTab()             // -> { id, name: 'Dokumentation', nodes: [createNode('New Entry', '# New Entry\n\n')] }
createTab(tabname, project?)   // creates a tab, pushes it onto project.tabs if given
createNode(name, content = '', children = [], { type?, mergeDescendants? } = {})  // -> Node (see §15)
createProjectSettings()        // -> { isThemePreset: true, currentThemeId: <first doc theme preset id>, formatGuide, tabSize: DEFAULT_TAB_SIZE }
                               //    (also the fallback when loading; only createProject() sets tabSize = state defaultTabSize)
createFormatGuideSettings()    // -> { enabled: false, preferences: '' } (project.settings.formatGuide)
createProjectSession()         // -> project.session (see §15)
createRecentProject(project)   // -> RecentProject (platform-dependent shape, see §15)
```

### Opening / Closing / Recents

```js
openProject(project, { addToRecents = true })   // sets session.openProject, emits navigate:docEditor
openProjectInEditor(project, { addToRecents })
openRecentProject(projectId)                    // async - reloads from sourcePath (desktop) or snapshot (web)
closeProject()                                  // emits navigate:projectHub (does not save the project)
// web: openProject() opens cloneProject(project); the recents entry keeps the saved state until saveOpenProject()
revealOpenProject() / revealRecentProject(id)   // show in OS file explorer
hasTrashableProjectSource(recentProject)        // desktop file/folder project with a sourcePath
trashRecentProjectSource(id)                    // async - moves the .dfproj file / project folder (only if it holds the config) to the OS trash
addRecentProject(project) / removeRecentProject(id) / findRecentProject(id)
updateProjectLastOpenedAt(projectId, lastOpenedAt?)
getAllProjectPresets()
// -> [...built-in (builtIn: true), ...state.projectPresets (builtIn: false)]
//    each: { id, name, description, builtIn, factory: () => Project }
//    user presets: factory() runs migrateProject(snapshot, preset.projectVersion)
//    built-ins with devOnly: true (PROJECT_PRESETS) are only listed when isDevelopment(),
//    e.g. 'dev-test' (core/presets/DevTestProjectPreset.js): a project that uses every feature
createProjectPreset(project, { name, description? })  // saves a copy (cleanExportProject) as user template
renameProjectPreset(id, name) / removeProjectPreset(id)
```

### Cleaning for Save / Export

```js
cleanSaveProject(project)    // strips `session` only
cleanExportProject(project)  // strips id, session, createdAt, sourcePath, sourceKind; deep-copies tabs/nodes
```

### Reading Active Data

```js
getOpenProject()       // session.openProject or null
getOpenProjectTheme()  // current theme of the open project or null
getActiveTab()         // Tab or null (via session.activeTabId)
```

### Mutating Projects

```js
notifyOpenProjectChange(mutateFn, extension = null)
// mutateFn(project) mutates the open project in place, then fires
// session:change:openProject(:extension). Returns false if no project is open.
// PREFER THIS over session.set('openProject', ...) for in-place edits.

notifyProjectChange(project, mutateFn, extension = null, { trackChange = true, history = null } = {})
// Same, for a given project object. notifyOpenProjectChange takes the same options.
// Every tracked change gives project.session.version a new unique number and is an undo
// step of the open project (see Undo / Redo). Pass trackChange: false for changes the user
// didn't make (rebuildLinkUsages, lastOpenedAt), they never count as unsaved and can't be undone.
// history: { key } - changes with the same key in quick succession are one undo step
// (EditorArea: 'content:<nodeId>' for typing).
setProjectVersion(project, version)          // used by undo / redo, emits project:unsavedChange

// Unsaved changes: version !== savedVersion
hasUnsavedChanges(project)                   // -> boolean
markProjectSaved(project, version?)          // savedVersion = version (default: current)
cloneProject(project)                        // deep copy (cleanSaveProject) with a fresh session

setFormatGuideSettings(project, { enabled?, preferences? })  // merges into settings.formatGuide, emits :settings
setProjectTabSize(project, size)                              // settings.tabSize (normalized), emits :settings

// @common/Common.js: DEFAULT_TAB_SIZE (2), TAB_SIZE_RANGE ({ min: 1, max: 16 }), normalizeTabSize(value),
// getProjectTabSize(project) -> settings.tabSize normalized, DEFAULT_TAB_SIZE without a project.
// The tab size is used by: the Tab key in the doc editor (addTabIndenting(input, getTabSize), inserts spaces),
// --editor-tab-size on the editor container (tab width of the textarea + highlight layer, EditorArea
// re-renders the preview on :settings), ctx.tabSize in MarkdownParser (indent=tab, tabs in tree blocks,
// code-tab-N class on .code-block-wrapper -> --code-tab-size from buildBaseCSS, also read by the worker css).
```

### Tabs

```js
findTab(tabID, tabs?)                       // tabs defaults to the open project's tabs
renameTabById(tabID, project, newName)      // records the old folderName in session.renamedTabIds
removeTabById(tabID, project)               // records folderName in session.deletedTabIds, fixes activeTabId
```

### Node Tree

```js
findNodeContext(nodeId, nodes, parentNode?)  // -> { node, parentNode, siblings } | null
findNode(nodeId, nodes?)                     // nodes defaults to the active tab's nodes
getNodePath(nodeId, nodes?)                  // -> [root, ..., target] | null
nodeMatchesSearch(node, query)               // name of node or any descendant
renameNodeById(nodeId, nodes, project, tabFolderName, newName)  // records session.renamedNodeIds
removeNodeById(nodeId, nodes, project?, tabFolderName?)         // records session.deletedNodeIds
moveNodeToTab(project, nodeId, targetTabId, targetParentId?)    // with children, appended; old files -> session.deletedNodeIds; false if into itself
flattenNodes(nodes)                          // depth-first flat array
```

### Entry History (`@data/EntryHistory.js`)

Back / forward between the entries opened in the doc editor, kept in `project.session.entryHistory`
(`{ entries: nodeId[], index, navigating }`, max 100, runtime only). `DocEditorView` records every
`activeNodeId` change and handles `editor:history`.

```js
recordEntryVisit(project, nodeId)          // drops the forward part, ignored while navigating
navigateEntryHistory(project, -1 | 1)      // opens the entry (switches the tab), skips deleted ones; -> boolean
getEntryHistoryState(project)              // -> { back, forward }
getRecentEntryIds(project)                 // -> node ids, most recent first, each once (Quick open)
```

### Node Types (`@data/NodeTypes.js`)

A node's `type` only changes how it ends up in the exported document, never the editor tree.

| `type` | Export |
|---|---|
| `page` (default) | own page, children are own pages |
| `folder` | no page, content is never exported; groups its children in the nav (click toggles) |
| `merged` | own page, children are appended as sections |

`mergeDescendants` (only used by `merged`): `embed` (default) puts every descendant on the page,
`separate` only the direct children - their children move one level up and stay own entries in the nav.
Inside a merged page a section's own type is ignored, except that a folder's content stays hidden
(only its name is shown as a heading). Section headings are shifted down by their depth
(`# ` -> `## ` ...), capped at h4 (`MAX_SECTION_HEADING_LEVEL`).

```js
NODE_TYPE / NODE_MERGE_MODE / NODE_TYPE_INFO / NODE_MERGE_MODE_INFO   // enums + UI labels
getNodeType(node) / getNodeMergeMode(node)          // normalized, defaults for missing values
resolveExportTree(nodes)   // -> { nav, pages, aliases } - what the export shows for a tab
//   nav:     [{ node, kind: 'page'|'folder', children }]
//   pages:   [{ node, sections: [{ node, depth, showContent }] }]  (first section = the page node)
//   aliases: { [nodeId]: { pageId, anchor } }  nodes without an own page -> page (+ section to scroll to)
getChildExportContext(node, context)   // context of the children ({ embedded, embedAll }), root: ROOT_EXPORT_CONTEXT
stripUnusedNodeTypeFields(node)         // drops mergeDescendants unless merged - used by cleanSaveProject/cleanExportProject and the folder config
getNodeExportRole(path)                // -> { type, embedded, mergedInto } for the last node of getNodePath()
```

Type changes are emitted as `session:change:openProject:tabs:nodes:type`.

### Reference Links (`@data/LinkManager.js`)

A link is defined once in `project.links` and used in content by its slug. If the target breaks,
it is fixed once in the link instead of in every text.

| Syntax | Meaning |
|---|---|
| `[[slug]]` | link, text = the link's `name` |
| `[[slug\|Text]]` | link with custom text |
| `{#name}` | anchor: a place in an entry a link can point to (`[a-z0-9-]`, same rules as slugs) |

Code (fenced and inline) is never scanned. The parser renders working links as
`<a class="doc-ref" data-ref-node data-ref-anchor>`, broken/unknown ones as
`<span class="doc-ref doc-ref--broken" title="<reason>">`, anchors as `<span class="doc-anchor" id="a-<nodeId>-<name>">`
(`options.nodeId` of `parseMarkdownAsync`).

```js
LINK_USAGE_REGEX / LINK_ANCHOR_REGEX
slugifyLinkName(name) / isLinkSlugValid(slug) / isLinkAnchorValid(anchor)
getProjectLinks(project) / findLink(project, id) / findLinkBySlug(project, slug)
findNodeInProject(project, nodeId)        // -> { node, tab, path } | null (any tab)
findLinkUsagesInContent(content)          // -> [{ slug, text }]
findAnchorsInContent(content)             // -> ['name', ...] (duplicates included)
stripLinkSyntax(text, project?)           // plain text for search index / TOC
getLinkAnchorElementId(nodeId, anchor)    // 'a-<nodeId>-<anchor>'
getLinkStatus(project, link)              // -> { ok, reason, warning } - computed, never stored
getUnknownLinkUsages(project)             // -> [{ slug, nodes }] used slugs without a link
createLink(project, { name, slug, target }) / removeLink(project, id)
updateLink(project, id, { name?, slug?, target? }, { updateUsages })  // slug change can rewrite usages
rebuildLinkUsages(project)                // all refs (DocEditorView mount + external changes)
updateLinkUsagesForNode(project, nodeId)  // after an edit (EditorArea)
getBacklinks(project, nodeId)             // -> [{ nodeId, name, tabName, links }] entries using a link to nodeId ("Linked from" in the contents tab)
removeNodeIdsFromLinkRefs(project, ids)   // inside node/tab deletion (removeNodeById / removeTabById)
```

Changes are emitted as `session:change:openProject:links` (a slug rename with `updateUsages` as `:tabs:nodes`).
The editor preview posts `{ source: 'doc-preview', type: 'ref', nodeId, anchor }` on link clicks and accepts
`{ type: 'scroll:anchor', anchor }`; the export script opens the page via `openNode()` and scrolls to the anchor.

The `deleted*` / `renamed*` bookkeeping in `project.session` tells the folder
save which files on disk it must delete or rename. See §15.

### Undo / Redo (`@data/ProjectHistory.js`)

Every tracked `notifyProjectChange()` of the open project is recorded: `prepareHistoryStep()` runs
before `mutateFn`, `commitHistoryStep()` after it. Nothing has to be done at the call sites.

- A step stores the project **before** the change as JSON (`cleanSaveProject`), its version and
  where the user was (`viewManager.getCurrentRoute()`, `activeTabId`, `activeNodeId`).
- Steps without a change (same JSON before / after) are dropped.
- `options.history.label` gives a step a fixed description instead of the computed one (never merged),
  e.g. `'Restore backup'`.
- Changes with the same key are merged into the last step: key from `options.history.key` within
  1500 ms of the last change (typing: `content:<nodeId>`), otherwise `auto:<extension>` within 300 ms
  (slider / color picker drags). Only the step that was just recorded can grow.
- Stored in `project.session.history` (`{ undo, redo, open, chars }`, runtime only): saving keeps it,
  opening the project again starts empty, `clearProjectHistory()` empties it.
  Max `historySize` steps (state) and about 150 M characters of JSON, the oldest are dropped.
- `version` numbers are unique (`_nextProjectVersion()`), so undoing back to the saved state shows
  "saved" again and a later change never gets a version that was saved before.

Undo: the current state goes on the redo stack, the step's state is written back with
`_reconcileObject()`: the live project object stays, nested objects with the same `id` (tabs, nodes,
themes, languages, ...) or, without an id, at the same position stay the same objects; only their
fields change. `id`, `sourcePath`, `sourceKind` and `session` are never restored. Then
`rebuildLinkUsages()` and `session:change:openProject` plus every extension the views listen to
(`tabs`, `tabs:name`, `tabs:nodes`, `tabs:nodes:name`, `tabs:nodes:type`, `links`, `themes`,
`themes:entries`, `languages`, `settings`). Redo is the same with the stored state after the step.

Folder projects: the restore adds every tab / entry it removes or moves to another file to
`deletedTabIds` / `deletedNodeIds` (key `<id>@<location>`), and removed themes / languages to
`deletedThemeIds` / `deletedLanguageIds`. Entries are only added: the explicit deletes run before
the files are written (`ElectronDocumentIOAdapter._writeFolder`), so a file the restored state
needs again is simply written new, and without the entry `_absorbNewDiskContent()` would bring a
removed file back on the next save.

Jumping to the change (`_reveal`): `describeChange(before, after)` returns a label
("Delete entry 'Setup'", "Edit text in 'Intro'", "Change theme 'Dark'", ...) and a target. Entry / tab
targets select the entry (or its parent / the tab if it no longer exists) and open the doc editor.
Changes made in the theme / language / language style editor open that editor again with
`viewManager.show(event, props, { force: true })` so its controls show the restored values (the
appearance manager if the item no longer exists). Each undo / redo shows a toast with the label.

```js
undoProjectChange(project?) / redoProjectChange(project?)   // -> false if nothing to do
canUndo(project?) / canRedo(project?)
getUndoLabel(project?) / getRedoLabel(project?)             // e.g. "Delete entry 'Setup'" | null
describeChange(stateBefore, stateAfter) -> { label, target }
clearProjectHistory(project?)
setHistoryRouteProvider(fn)                                 // set by ViewManager.init
replaceProjectContent(project, data)  // inside a notifyProjectChange mutateFn: whole content in place (keeps id,
                                      // location, session, objects with the same id) + folder bookkeeping
notifyProjectReplaced(project)        // after it: rebuildLinkUsages + every openProject change event
```

Shortcuts (`InitHotkeys.js`, global): `Edit:undo` (`Ctrl+Z`), `Edit:redo` (`Ctrl+Y`), `Edit:redoAlt`
(`Ctrl+Shift+Z`). They do nothing (browser undo) while a text field has the focus (`input` text types,
`textarea`, contenteditable) or a modal is open. The doc editor input stops these keys itself and uses
its text history (§12). The title bar's Edit menu (`EDIT_DROP_DOWN_ITEMS`) always undoes project
changes; its names and disabled states are functions evaluated when the menu opens.

### Search

```js
recentProjectMatchesSearch(recentProject, query)
projectPresetMatchesSearch(projectPreset, query)
```

---

## 6. Core Modules

### StorageManager

**Import:** `import { storageManager } from '@core/storage/StorageManager.js'`

```js
storageManager.init()
storageManager.subscribe(key, { save, load, reset, merge? }, {
  autoSaveOnChange = true,   // state:change triggers a debounced save of this key
  selfPersisted = false,     // save() writes itself and returns a success bool
})
storageManager.unsubscribe(key)
await storageManager.saveNow(key = null)
await storageManager.loadNow(key = null)
await storageManager.reset(key = null)
await storageManager.saveOnce(key, data) / loadOnce(key) / clearOnce(key)
```

Adapters: `ElectronAdapter` (userData folder via IPC) and `LocalStorageAdapter` (web).

### DocumentManager / DocumentIO

**Import:** `import { ... } from '@core/DocumentManager.js'`

```js
await openDocument(kind, directPath = null, options = {})  // kind: 'file' | 'folder' | 'both'
await saveDocument(project)
await exportProjectAsFolder(project, targetFolderPath)
await readFolderProjectData(folderPath)
getSaveCapabilities(project)   // -> { canSave, canSaveAs, canSaveAsFolder }
serializeProject(project, kind)
slugify(name) / uniqueSlug(name, usedNames)  // filesystem-safe names (collision -> "Name (2)")
```

`DocumentIOAdapter` (`core/documentIO/`) is the interface that each platform implements:
`supportsLiveSave()`, `supportsFolders()`, `open(kind)`, `read(ref, kind)`,
`write(ref, kind, data)`, `pickSaveTarget(kind, suggestedName)`.
There are two implementations: `ElectronDocumentIOAdapter` and `WebDocumentIOAdapter`.

### Platform

**Import:** `import { ... } from '@core/Platform.js'`

```js
getPlatform()          // 'win' | 'linux' | 'macOS' | 'web'
isPlatformWeb() / isDevelopment()
onAppClose(cb) / confirmAppSaveComplete()
watcherAPI.watchProject(project) / unwatchProject(id) / ignoreNextChange(project)
watcherAPI.ignorePathTree(project) / releasePathTree(project) / isPathIgnored(project)
watcherAPI.isWatching(id) / onFileChanged(cb) / onError(cb)   // no-ops on web
trashPath(path) / pathExists(path)   // -> Promise<boolean>, false on web
readTextFile(path)     // -> Promise<string|null>, null on web
getPathForFile(file)   // path of a dropped File, null on web
getPendingFiles()      // -> Promise<string[]>, files the app was started with (call once), [] on web
```

### FileImportManager

**Import:** `import { ... } from '@core/FileImportManager.js'`

Single entry point for files coming from outside: dropped onto the window (`FileDrop` component)
or opened via the OS (`file:open` / `getPendingFiles`, wired in `ElectronBridge` and `AppLoaderView`).
Files are queued until `startFileImports()` (after the loader) and handled one after another; the next
file waits until no modal is open.

```js
startFileImports()                 // marks the app ready, pulls the pending files, handles the queue
importFiles([{ name, path, read }])   // path null on web, read() -> Promise<string|null>
importFilePaths(paths)             // desktop: same, built from absolute paths
isImportableFile(fileName)
```

By extension: `.dfproj` opens the project on desktop (added to recents, asks about unsaved changes first)
and shows `show:modal:importProject` with `{ data }` on web. `.dftheme` / `.dflang` / `.dflangstyle` show
their import modal with `{ projectId: open project, data, filePath }`. Folders are not supported.

### AsyncRenderer

**Import:** `import { AsyncRenderer } from '@core/AsyncRenderer.js'`

Renders a list one item per animation frame (used for the language cards).

```js
const renderer = new AsyncRenderer({
  parent,                  // container element
  itemCB,                  // () => items, already filtered and sorted
  renderItemCB,            // async item => html (one root element)
  keyCB?,                  // item => stable key, enables keyed mode
  hashCB?,                 // item => value that changes when the item has to be rebuilt
});
await renderer.render();   // reads itemCB() and renders
renderer.cancelRender() / clear() / isRendering()
```

Without `keyCB` every render rebuilds the whole list. With `keyCB` elements are cached by key and only
rebuilt when new or when `hashCB` changed; on every render they are moved into the order of `itemCB()`
and items no longer in the list are detached (they stay cached, e.g. for a cleared search).

### ResizeController

**Import:** `import { ResizeController } from '@core/ResizeController.js'`

```js
const resize = new ResizeController(containerEl, {
  direction,            // 'left' | 'right' | 'top' | 'bottom'
  initialSize,          // px number or '50%' string
  minSize, maxSize, stateName,
  enabled = true, visible = true, keepRatio = true, resetOnDblClick = true,
  onResizeStart, onResize, onResizeEnd,
});
resize.enable() / disable() / getSize() / setSize(px) / destroy()
```

### InputManager

**Import:** `import { inputManager } from '@core/InputManager.js'`

```js
inputManager.isKeyPressed('ctrl')                              // bool
inputManager.isKeyPressed(['ctrl', 'shift'], { mode: 'any' })  // mode: 'every' (default) | 'any'
const unsub = inputManager.onKey(['ctrl', 'k'], cb)            // order-independent combo
```

Key names are lowercased, and `Control` becomes `ctrl`.

### ShortcutManager

**Import:** `import { shortcutManager } from '@core/ShortcutManager.js'`

```js
shortcutManager.register('ctrl+s', action, { context: 'global' | [...], name, description })   // action returns false -> no preventDefault()
// 'ctrl' maps to ⌘ on macOS. App shortcuts are registered in init/InitHotkeys.js.
// `name` is the stable id of a shortcut (labels, dispatch, user keys), `description` is shown in the preferences.

// user keys (preferences -> Hotkeys), stored in state.shortcutOverrides by InitHotkeys.js
shortcutManager.setOverrides({ 'docEditor:Format:bold': 'ctrl+alt+b', 'global:Save': '' })  // also applied on register()
shortcutManager.getOverrides()                        // only the keys that differ from the registered combo
shortcutManager.setShortcutCombo(context, name, combo) // '' = no key; setKeyComb(oldCombo, newCombo, ctx) does the same by combo
shortcutManager.resetShortcut(context, name) / resetAllShortcuts()
shortcutManager.onChange(overrides => ...)            // after setShortcutCombo / resets -> returns unsubscribe
shortcutManager.findConflicts(context, combo, exceptName?)  // same context or global ones (a context shortcut hides a global one)
shortcutManager.comboFromEvent(keyboardEvent)         // 'ctrl+shift+k', '' for a modifier only
shortcutManager.formatCombo(combo)                    // 'Ctrl + Shift + K'
```

`register('', action, opts)` registers a shortcut without a default key (it does nothing until the user
sets one), e.g. `Editor:wordWrapOn` / `Off` / `Toggle` and `View:cycle` / `split` / `editor` / `preview`
of the doc editor. Entries keep `defaultCombo` (registered) next to `keyCombo` (current). Shortcuts without a key are kept
in a separate map: they never react, `getAll()` / `getAllByContext()` include them, labels show only
the base title. In one context a key can only have one shortcut (the map key is `context:combo`).

Never write a combo into the UI by hand - shortcuts are meant to become customizable. Mark the
element instead; `ShortcutManager` binds it via the DOM observer and updates it when the combo changes:

```html
<span data-shortcut-label="SaveOpenProject" data-shortcut-context="docEditor"></span>  <!-- textContent = combo -->
<button data-shortcut-label="Format:bold" data-shortcut-context="docEditor"
  data-shortcut-target="title" data-shortcut-title="Bold">B</button>                     <!-- title = "Bold (Ctrl + B)" -->
```

### Preferences (`views/preferences/PreferencesView.js`)

Own view (`navigate:preferences`, `Ctrl+,` = `OpenPreferences`, File -> Preferences submenu with one
entry per section, a click on "Preferences" itself opens all: `MENU_GROUPS` in `Titlebar.js`, groups with an `action` in `MenuManager`). `@common/PreferencesNav.js`: `PREFERENCE_SECTIONS` (`general`, `editor`,
`app-theme`, `theme-editor`, `hotkeys`) and `openPreferences(section?)` (only scrolls if already open,
`'hotkeys'` opens the hotkeys modal).
Layout: section list on the left (follows the scroll position), back button (`getPreviousRoute()`,
hub if none) and a search field (filters rows and hides empty sections) above the scrolling list.
Shortcut context `preferences`.

- Simple settings are entries of `SETTINGS` in the view: `{ section, key, type: toggle | select | number | range,
  label, description, options?, unit?, step?, web?, apply? }`, one state key each. Every change is
  saved right away; the reset button (only shown when the value differs) sets `getStateDefault(key)`
  (`State.js`). Numbers use `NUMBER_RANGES`. Changes made elsewhere update the rows (`state:change`).
- Theme editor: below the settings a small sample (`_renderFlashPreview()`): the clicked color (background first)
  keeps pulsing with the current strength / speed while the values change (like `DocThemePreview`, animated
  `--pref-flash-amount`), hovering another color pulses that one for a moment. It is rebuilt when the app theme or mode changes.
- App theme: theme select (built-in / custom), Edit (built-in: "Show") colors, Duplicate, Rename,
  Delete, Import, Export; see App themes below.
- Hotkeys: only a row with the number of changed shortcuts and "Edit hotkeys…", which opens
  `openHotkeysModal()` from `@common/HotkeysModal.js` (also File -> Preferences -> Hotkeys, as
  `openPreferences('hotkeys')` opens the modal over the current view). The modal lists the shortcuts
  grouped by context (`CONTEXT_LABELS`), inside sorted by the name family (`View:`, `Format:`, ...) and
  registration order (`entry.order`), with a search; click records the next key combination (window
  keydown in capture, nothing else reacts, also not Esc closing the modal; Esc or a click elsewhere
  cancels). A key that is already used asks: take it from the other shortcut(s), keep both (only for
  other contexts) or cancel. Rows show the default if changed and other shortcuts with the same key.
  Styles `.hotkeys__*` in main.css.

To add a setting: state key (+ `NUMBER_RANGES` for numbers) in `State.js`, then an entry in `SETTINGS`.

### App themes (`@data/AppThemeManager.js`)

Colors of the app UI (not the doc themes of a project). A theme:
`{ id, name, builtIn?, baseId?, colors: { dark: { '<css var without -->': value }, light: { ... } } }`.

- Built-in themes: `@core/presets/AppThemePresets.js` (`DocForge`, `High contrast`, `Soft`, `Solarized`).
  DocForge has no colors of its own: its values are the `[data-theme]` blocks of `main.css`. Any color a
  theme doesn't have falls back to its `baseId` theme, then to DocForge (read from the hidden
  `.app-theme-probe` element with `data-theme="<mode>"`).
- `applyAppTheme()` sets the colors of the active theme (`state.appThemeId`) and variant (`state.isDarkMode`)
  as inline variables on `<html>` (above the main.css blocks) and removes the ones it set before; for
  DocForge it sets none. Runs on start (`initAppThemes()` in `Bootstrap.js`), on `state:change:appThemeId`
  / `isDarkMode` and after a color of the active theme changed.
- `APP_THEME_GROUPS`: the editable colors, grouped (backgrounds, text, accent, borders, danger, links and
  code, scrollbars, color picker, doc editor highlighting = `--editor-color-<token>`). A new app color
  must be added to the main.css blocks **and** to a group, otherwise themes can't change it.
- Built-in themes are read-only. `duplicateAppTheme(id, name)` copies every color of both variants
  (`baseId` = the built-in theme, used by "reset"). Custom themes: `setAppThemeColor(id, mode, var, value | null)`
  (null = base value), `copyAppThemeColors(targetId, targetMode, sourceId, sourceMode, vars)`,
  `renameAppTheme()`, `deleteAppTheme()` (the active one falls back to its base theme).
- Storage: desktop = one file per custom theme `<userData>/app-themes/<id>.dfapptheme`
  (`wrapEntity('appTheme', APP_THEME_SCHEMA_VERSION, theme)`, written 400 ms after the last change,
  loaded by `initAppThemes()`); web = only in memory for the session.
- Files: `exportAppTheme(id)` writes all colors of both variants (also of a built-in theme),
  `importAppTheme()` / `importAppThemeFromText(text)` add it as a new custom theme (new id, unique name,
  `migrateAppTheme()` in `@migration/AppThemeMigration.js`). Dropped / OS-opened `.dfapptheme` files are
  imported and selected (`FileImportManager`).

```js
getAppThemes() / getAppTheme(id) / getActiveAppTheme() / setActiveAppTheme(id) / isAppThemeBuiltIn(id)
getAppThemeColor(themeOrId, mode, var)      // with fallbacks
getAppThemeBaseColor(themeOrId, mode, var)  // value "reset" sets
getDefaultAppThemeColor(mode, var)          // DocForge value from main.css
getCurrentMode()                            // 'dark' | 'light'
```

`@common/AppThemeModal.js`: `openAppThemeColorsModal(themeId)` (all colors of a theme for the dark or
light variant, search, swatches with the color picker; a built-in theme shows a notice and every change
offers a copy first), `openCopyColorsModal(targetId, mode)` (pick a source theme + variant, check whole
groups and uncheck single colors, current -> new preview) and `askAppThemeName()`. The CSS variable
names of the colors are shown and searchable only in development (`isDevelopment()`). Both modals use
`.modal--fixed` (fixed height, the list scrolls).

### Other singletons

| Module | Export | Purpose |
|---|---|---|
| `@core/BackupManager.js` | `backupManager`, `initBackup()`, `BACKUP_VERSION`, `getBackupProjectKey()`, `getSlotProject()`, `restoreBackupIntoOpenProject()` | Crash backups, see §16 Backups |
| `@core/BlobManager.js` | `blobManager` | Cached blob URLs (theme CSS etc.), sections e.g. `DOC_THEME_BLOB_SECTION` |
| `@core/UpdateManager.js` | `updateManager` | Wraps `electronAPI.updater`, drives `UpdateModal` |
| `@core/DOMObserver.js` | `domObserver` | Global DOM mutation observer |
| `@core/syntaxHighlighter/SyntaxHighlighter.js` | `syntaxHighlighter` | Worker-pool highlighter: `warmpUp()`, `highlightTextAsHTML({ langId, styleId, text })`, `splitHighlightedHtmlIntoLines(html)` |

---

## 7. View System

### ViewManager

**Import:** `import { viewManager } from '@core/ViewManager.js'`

```js
viewManager.init(container)
await viewManager.switchTo(ViewClass, props = {}, event = null)
viewManager.setNavigationGuard((event, props) => boolean | Promise<boolean>)  // false cancels the navigation
viewManager.getCurrentRoute()                       // { event: 'navigate:<view>', props } | null
viewManager.getPreviousRoute()                      // route of the view before (back button of the preferences)
await viewManager.show(event, props = {}, { force }) // opens a view without the guard; force: builds it again if already shown
```

`@common/UnsavedChangesGuard.js` sets the guard: `navigate:projectHub` with unsaved changes asks
Save / Don't save / Cancel. Use `await confirmLeaveOpenProject()` before anything else that replaces
the open project (new project, restore as copy, reload, app close).

Navigation is event-driven. Emit an event instead of calling `switchTo()` directly.
The views crossfade over 220 ms. If a new navigation arrives mid-transition, only the most recent one is queued.

### BaseView

```js
class MyView extends BaseView {
  static viewId = 'myView';               // becomes session.activeView

  _viewPath() { return 'views/myView/MyView'; }  // loads MyView.html + MyView.css

  async mount(componentLoader) {
    await componentLoader.load('...', this.slot('my-slot'));
    this.subscribe('session:change:activeTabId', ({ value }) => this._refresh(value));
  }

  onDestroy() {}
}
```

**BaseView API:** `this.container`, `this.props`, `this.slot(name)`, `this.element(id)`, `this.subscribe(event, handler)`.
**Lifecycle:** `initialize()` -> `mount(componentLoader)` -> `onLoad(componentLoader)` -> … -> `destroy()` -> `onDestroy()`.

---

## 7.1 Navbar Component & navContext

`common/components/navbar/Navbar.js` is mounted once above the view container.
It renders the breadcrumb and quick actions for the active view and reacts
only to session state.

| `session.activeView` | Segments shown |
|---|---|
| `projectHub` / no project | `Hub` |
| `docEditor` | `Hub › ProjectName › TabName › Node › …` (via `getNodePath`) |
| anything else | `Hub › ProjectName › <navContext.path>` (fallback label if no `navContext`) |

The Navbar can't know a sub-view's label or where "back" should go, so **each sub-view sets `session.navContext` in `mount()`**:

```js
session.set('navContext', {
  path: [
    { label: 'Appearance', event: 'navigate:appearanceManager' },
    { label: this._theme?.name ?? 'Theme' },   // last segment = current
  ],
});
```

Clicking a non-current segment emits its `event` with its `props`. Node segments set `activeNodeId` instead.

**Quick actions:**

| View | Button | Emits |
|---|---|---|
| `docEditor` | Appearance | `navigate:appearanceManager` |
| `appearanceManager` | Editor | `navigate:docEditor` |

### EntryPicker (`@common/EntryPicker.js`)

Use it wherever an entry (or a place in the tree) is chosen, instead of a `<select>` with all entries.
A select-like button opens a panel with a search field and the entries grouped by tab (tree, while
searching flat with their path). Plain class, no component: works inside modals. The panel is appended
to `document.body` (z-index above modals), closes on outside click, scroll, resize, Escape (stopped, so
the modal stays open) and Tab. Keyboard: Up / Down, Enter. Styles: `.entry-picker__*` in `main.css`.

```js
const picker = new EntryPicker(container, {
  getProject: () => project,
  selectTabs: false,        // true: tab rows are pickable = top level of that tab ({ tabId, nodeId: null })
  excludeIds: null,         // Set | () => Set, hidden with their children (e.g. the entry being moved)
  placeholder: 'Choose an entry…',
  id: null,                 // button id for <label for>
  onChange: value => {},    // { tabId, nodeId } on pick
});
picker.setValue({ tabId, nodeId }) / picker.getValue() / picker.refresh() / picker.destroy()
```

Used in: link modal (target), "Move to tab" and the create entry dialog (`NodeTypeModal` `location`).
`collectProjectEntries(project)` (same module) returns every entry in tree order with `tabId`, `tabName`,
`path` (parent names) and `depth`.

### QuickOpen (`@common/QuickOpen.js`)

Search field near the top of the window to open any entry (`Navigate:quickOpen`, Ctrl+P, or the
"Search entries…" field centered in the `Titlebar`, shown only while `activeView` is `docEditor`; both emit
`editor:quick-open`), created by `DocEditorView`. Reuses the `.entry-picker__*` styles (`.quick-open` on the panel). Without a query the
recently opened entries (`getRecentEntryIds()`) come first, then the others in tree order; with a query:
name starts with it, name contains it, tab / path contains it (max 100). The open entry is left out.

```js
new QuickOpen({ getProject, getRecentIds, getActiveId, onOpen: ({ tabId, nodeId }) => {} })
quickOpen.open() / close() / isOpen() / destroy()
```

---

## 8. Component API

**Import:** `import { Component } from '@core/Component.js'` (default-export your subclass)

```js
this.element('local-name')          // element with id="{{id:local-name}}"
this.elementId('local-name')        // full prefixed ID, e.g. 'topbar-1__local-name'
this.elementById(globalId)
this.globalElement(localName, container?)
this.query(selector, container?) / this.queryAll(selector, container?)
this.subscribe(event, handler)      // auto-unsubscribed on destroy
this.instanceId / this.container / this.props
```

**Lifecycle:** `onLoad()`, `onUpdate(newProps)`, `onDestroy()`.

**ComponentLoader:** `await componentLoader.load(componentPath, container, props)`, `destroy(instanceId)`, `getInstance(instanceId)`.

---

## 9. Modal Builder

**Import:** `import { ... } from '@core/ModalBuilder.js'`

```js
buildModal(overlayId, { headerHTML, bodyHTML, footerHTML, onPrimary, extraClass, zIndex })
buildStandardModal(overlayId, { title, bodyHTML, footerHTML, primaryLabel = 'Save', secondaryLabel = 'Cancel', wide = 's', onPrimary, zIndex })
buildDoneModal(overlayId,     { title, bodyHTML, footerHTML, doneLabel = 'Done', wide = 's', doneCallback, zIndex })
buildConfirmModal(overlayId,  { title, message, footerHTML, confirmLabel = 'Delete', cancelLabel = 'Cancel', wide = 's', onConfirm, zIndex })
openModal(overlay) / closeModal(overlay) / closeModals(query?) / isModalOpen(overlay)
isAnyModalOpen()   // any .modal-overlay--open; openModal() emits modal:open
onModalClose(overlay, cb)                   // cb on every close (button, backdrop, Escape); returns stop fn. Use it to abort async work
```

Loading spinner for any container (`@common/UIUtils.js`), e.g. while its content is fetched or built:

```js
createLoadingOverlay(container, { label? })   // -> { show, hide, isShown, destroy }; starts hidden
await runWithLoading(container, signal => task(signal), { label?, signal? })  // shows it while task runs, removes it afterwards
```

All builders return the overlay element, which they have already appended to `document.body`.

One-off choice dialog (`@common/BaseModals.js`), built on call and removed on close:

```js
await askChoice({ title, message, choices: [{ id, label, style? }], cancelId = 'cancel', zIndex = '1100' })
// -> id of the clicked button, cancelId when closed otherwise
```

---

## 10. DocTheme System

A project owns **several** user themes (`project.themes[]`) and selects one
of them through `project.settings`:

- `isThemePreset: true`: `currentThemeId` is an ID from `session.docThemePresets`.
- `isThemePreset: false`: `currentThemeId` is an ID from `project.themes`.

The theme's values live in `theme.settings.entries`, a flat array of
`{ name, value, active }` entries. They are checked against `THEME_SCHEMA`, which `_buildThemeSchema()` builds.

**Import:** `import { ... } from '@data/DocThemeManager.js'`

### Creating & Cloning

```js
generateDocThemeId()                       // -> 'docTheme_…'
createDocTheme(name, entries = null)       // -> DocTheme (see §15)
createBuiltInTheme(name, overrides = {})   // id: 'theme_<name>', builtIn: true
createDefaultDocThemeEntries()
dublicateDocThemeById(project, id, nameFactory?)
cleanDocTheme(docTheme)                    // strips runtime fields for export
mergeDocThemeEntries(defaultEntries, oldEntries)  // schema-driven merge (drops unknown entries)
```

Every loaded theme goes through `migrateTheme()` (also the themes inside a project file via `migrateProject()`
and stored theme presets via `migratePresetTheme()`), so a new `THEME_SCHEMA` entry is added with its default
(e.g. `active: false` for overrides) without a schema version bump.

### Project Themes

```js
getDocThemes(project)                  // project.themes
getPresetDocThemes()                   // session.docThemePresets
findDocTheme(id, list?)                // searches list, then presets
findDocThemeByName(name, list?)
addDocTheme(project, theme)
removeDocThemeById(project, id)        // unsets currentThemeId if it was active
updateDocTheme(project, id, changes)   // not for built-ins
docThemeMatchesSearch(theme, query)

getCurrentTheme(project)               // resolved via project.settings, or null
setCurrentTheme(project, themeId, builtIn)
ResolveProjectTheme(project)           // current theme, or fallback (first preset), or {}
getFallbackTheme()
openDocThemeEditor(project, theme)     // emits navigate:themeEditor { themeId }
```

### Reading & Writing Values

```js
getThemeValue(theme, key)     // resolved value, or null if inactive/missing
getStoredEntry(theme, key)    // raw stored entry
getSchemaEntry(name)          // { name, type, value, active, min?/max?/options?/group? }
getEntry(theme, key)          // { ...schema, ...stored }
getThemeGroup(theme, group)
modifyThemeValue(theme, key, { value, active })   // validates against schema; wrap in notify*Change
resetThemeSettings(project, theme, resetParams?)
```

### Language Styles per Theme

The theme stores which [HighlightStyle](#highlightstyle) to use for each language. If there is no entry, or the stored style no longer exists, the first available style for that language is used.

```js
getLanguageStyle(project, theme, langDef) / getLanguageStyleId(project, theme, langDef)
getLanguageStyleByLangName(project, theme, name) / getLanguageStyleIdByLangName(project, theme, name)
setLanguageStyleId(project, theme, langId, styleId)
// writes theme.settings.langStyleIds[langId] = { id: styleId, isBuiltIn }
resetLanguageStyleIds(project, theme)
// clears theme.settings.langStyleIds, every language falls back to its first style
// UI: theme editor tab "Languages" (themeEditor/.../contentMapping/ContentMapping)
```

### Theme Schema

Entry types: `color`, `number` (`min`/`max`), `select` (`options`), `toggle`.

| Group / Area | Entries |
|---|---|
| `background` | `background`, `background-surface`, `background-elevated` |
| `text` | `text-primary`, `text-secondary`, `text-muted` |
| `accent` | `accent`, `accent-hover`, `link`, `link-underline` |
| `border` | `border` |
| `code` | `code-background`, `code-border`, `code-text`, `code-tag-text`, `code-diff-add`, `code-diff-removed`, `code-indent-guide` |
| `table` | `table-highlight`, `table-hover`, `table-stripe` (inactive by default: fall back to `--text`) |
| `list` | `checkbox` (`--checkbox`, inactive by default: falls back to `--accent`), `bullet` (`--bullet`, `li::marker` of both list types, inactive: falls back to `--text`) |
| `footnote` | `footnote` (`--footnote`, reference numbers and list markers, inactive: falls back to `--link`) |
| `header` / `sidebar` / `toc` | `<area>-background`, `<area>-text` (`--<area>-bg`, `--<area>-text`, inactive by default). Active: `buildAreaColorCSS()` overrides `--bg`, `--bg1`, `--bg2`, `--brd` / `--text`, `--text2`, `--muted`, `--heading-color` inside `.doc-header` / `.nav-container` / `.toc` (shades mixed from the area colors) |
| `heading` | `heading` |
| *spacing* | `gap-paragraph`, `gap-heading`, `code-block-gap`, `list-item-gap`, `table-cell-padding`, `blockquote-border-width`, `blockquote-radius`, `padding-content`, `scrollbar-size`, `code-radius` |
| *typography* | `font-size`, `font-size-code`, `heading-h1`–`heading-h4`, `line-height`, `code-line-height`, `typography-heading`, `typography-body` (`system`\|`serif`\|`mono`) |
| *header* | `header-show` (`top`\|`sidebar`\|`never`), `header-style` (`solid`\|`blur`\|`transparent`), `header-height` |
| *layout* | `toc-show` (`always`\|`desktop`\|`never`), `toc-position` (`left`\|`right`), `content-max-width`, `content-show-nav` (`always`\|`never`) |
| *sidebar / toc width* | `sidebar-width-type`, `sidebar-width-px`, `sidebar-width-per`, `sidebar-min-width`, `toc-width-type`, `toc-width-px`, `toc-width-per`, `toc-min-width` (type: `pixels`\|`fit-content`\|`percent`) |
| *search* | `search-enabled` (toggle), `search-position` (`header`\|`tab-nav`), `search-show-in-tab` (toggle) |

Only the entries in the first six rows have a `group` property.

---

## 11. Syntax Definitions & Highlight Styles

**Import:** `import { ... } from '@data/SyntaxDefinitionManager.js'`

A language has two independent parts:
- **SyntaxDefinition**: the lexer (a stack of states, each with rules). Stored in `project.languages`, with built-ins in `session.languagePresets`.
- **HighlightStyle**: the colors for one language, linked to it by `langId`. Stored in `project.languagesStyles`, with built-ins in `session.languageStylePresets`.

Styles are separate from definitions, so a project can add its own styles to a built-in language.

### Enums

```js
TokenType       // keyword, identifier, type, variable, function, parameter, property, operator,
                // punctuation, number, string, comment, regexp, escape, interpolation, decorator,
                // namespace, literal, whitespace, other, linebreak
RuleType        // 'match' | 'beginEnd' | 'include'
PatternType     // 'regex' | 'keywords' (String[] -> \b(a|b)\b) | 'word'
TransitionType  // 'push' | 'pop' | 'set'
RegisterScope   // 'global' | 'state'
OnUnmatched     // 'character' (emit OTHER token) | 'skip'
```

### Factories

```js
createSyntaxDefinition(name)          // incl. a 'root' state
createSyntaxState(name)
createSyntaxStateRule(name)
createSyntaxRuleAction()
createSyntaxCaptureMap()
createSymbolRegister(tokenType, scope = 'global')
createSyntaxStateTransition(type = 'push', targetStateId = null, popCount = 1)
createBalancedLookahead(open, close, after, { skipWhitespaceBeforeOpen, skipWhitespaceAfterClose })
createDynamicEnd(captureGroup, template)
createPredefinedSymbol(name, tokenType)
createHighlightStyle(langId, name)
createTokenStyle(tokenType, color, { bold, italic, underline, underlineStyle })
createStateTokenStyle(stateId, tokenType, color, { bold, italic, underline })
createStyleOverride(stateId, ruleId, tokenStyle)
```

### Accessors / Mutators

```js
getLanguages(project) / getPresetLanguages()
findSyntaxDefinition(id, list?) / findSyntaxDefinitionByAlias(alias, list?) / findSyntaxDefinitionByName(name, list?)
getBuiltInLanguageOverlaps(name, aliases)     // [{ lang, matches }] built-ins sharing a name/alias (case insensitive)
// custom languages are searched first, so an overlap replaces the built-in language for those tags;
// shown as "Overrides built-in" tag on the language card and as warning in the language modal
addSyntaxDefinition(project, def) / removeSyntaxDefinition(project, id) / updateSyntaxDefinition(project, id, changes)
dublicateSyntaxDefinitionById(project, id, nameFactory?)
syntaxDefinitionMatchesSearch(def, query)

findSyntaxState(def, stateId) / findRootSyntaxState(def) / findSyntaxStateByName(def, name)
addSyntaxState(project, defId, name) / removeSyntaxState(project, defId, stateId)
findSyntaxStateRule(state, ruleId)
addSyntaxStateRule(project, defId, stateId, name) / removeSyntaxStateRule(...) / updateSyntaxStateRule(..., changes)

findHighlightStyle(project, styleId) / isHighlightStylesBuiltIn(styleId)
getHighlightStylesForLang(project, langId)     // [...project styles, ...presets]
addHighlightStyle(project, langId, name) / removeHighlightStyle(project, styleId)
setHighlightStyleTokenStyle(project, styleId, tokenType, color, opts)
setHighlightStyleStateTokenStyle(project, styleId, stateId, tokenType, color, opts)
setStyleOverride(project, styleId, stateId, ruleId, tokenStyle)
highlightStyleIdToIndex(project, langId, styleId)
buildHighlightStyleRefs(style, lang)           // { langName, states: {[stateId]: name}, rules: {[ruleId]: name} }
matchHighlightStyleToLang(style, lang, refs?)  // { style (copy, ids remapped onto lang), total, missing }
openSyntaxDefinitionEditor(project, lang)     // emits navigate:languageEditor { langId }
```

### Built-in Language Presets

Built-in languages live in `core/presets/LanguagePresets/<Name>LanguagePreset.js`. Each file exports
`create<Name>Language()` and `create<Name>LanguageStyles(langDef)`, and must be registered in the
`LANGUAGE_PRESETS` list in `LanguagePresets.js`.

Presets are rebuilt on every start. `registerLanguagePresets()` (`init/InitPresets.js`) therefore replaces
the random state/rule ids with stable ones derived from the names:
`syntaxState_<langId>_<stateName>`, `syntaxStateRule_<langId>_<stateName>_<ruleName>` and, for the preset
styles (themes store the selected style by id), `highlightStyle_<langId>_<styleName>` (characters
outside `A-Za-z0-9_-` become `_`, duplicates get `_2`, `_3`, …). All references (`rootStateId`,
transitions, `innerStateId`, `includeStateId`, preset styles) are rewritten too. Renaming a state or
rule in a preset changes its id, which breaks user styles that reference it.

`registerPresets()` registers the languages before the doc themes, because built-in themes get their
`settings.langStyleIds` from `DOC_THEME_PRESET_LANG_STYLES` (`core/presets/DocThemePresets.js`):
theme id -> list of preferred style names, each language uses the first one it has (e.g. light themes
use `Light+`). Languages without a match fall back to their first style.

---

## 12. Editor Helpers

`views/docEditor/components/editorArea/helpers/ToolbarHelper.js`

```js
insertLinePrefix(textarea, prefix, onChange)
wrapSelection(textarea, before, after, onChange)
insertCodeBlock(textarea, onChange)
insertTable(textarea, onChange)
insertTree(textarea, onChange)      // ```tree template on its own lines
insertFootnote(textarea, onChange)  // [^n] at the cursor (next free number), `[^n]: ` at the end of the entry (cursor there)
getFootnoteLabels(lines) -> { defined: Map<label, text>, used: Set<label> }   // outside of code
insertLink(textarea, text, url, onChange)
getSelectedText(textarea)
toggleComment(textarea, onChange)   // wraps the selected lines in <!-- --> or unwraps them (Ctrl+#)
toggleCheckMark(textarea, onChange) // adds `[ ] ` to the selected lines (`- [ ] ` if no list item) or toggles [ ] / [x] (Ctrl+Shift+X)
continueListOnEnter(textarea)       // Enter in a list item: next item (`3.` -> `4.`, `n.` stays, `[ ]` after a check mark), empty item ends the list; false = not handled
syncScrollPosition(editorElement, previewIframe)
```

Scroll sync (split mode only, editor -> preview): editor line tops are measured in a hidden copy of the
textarea (cached per content, width and styles), the preview's `docPreview.getLineAnchors()` returns
`[{ line, top }]` for every `[data-line]` block. A reference position of the editor is mapped to the
preview by interpolating between the anchors around it (framed by start 0 and end = content height) and
placed at the same relative viewport height in the preview. The reference is the cursor line if it is
visible, otherwise a point that moves from the viewport top (scrolled to the start) to the viewport
bottom (scrolled to the end). Synced on editor scroll, on `keyup`/`mouseup` (only when the content equals
the last rendered one, otherwise the next render syncs) and after a re-render. Without anchors it falls
back to the scroll ratio.

### Text history (undo / redo while typing)

`helpers/EditorTextHistory.js`: own undo / redo for the doc editor input, one history per entry
(`Map<nodeId, { undo, redo, last, time, kind }>`, max 300 steps, lost when the view is left).
`Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` on the textarea (keydown, capture) and Undo / Redo of the context
menu (`beforeinput` `historyUndo` / `historyRedo`) are handled here and never reach the browser undo or
the project undo shortcuts.

- Typing is one step until a pause of 1 s, a switch between writing and deleting, a line break, a
  click or a cursor jump. A step stores the text and the selection before it.
- Changes from code (toolbar, structure edit, autocomplete, replace) are their own step:
  `sync()` runs at the start of `EditorArea._renderPreview()`, where every content change ends.
- `load(nodeId, value)` in `_loadActiveNode()`: keeps the history of the entry if its text is unchanged,
  otherwise starts a new one (content changed from outside: project undo, replace in all entries, reload).
- Undo / redo sets the text and selection, dispatches `input` (the editor saves the content, which is
  a project change with the key `content:<nodeId>`) and scrolls to the cursor (`highlighter.scrollToPosition`).

```js
const textHistory = new EditorTextHistory(textarea, () => activeNodeId, { scrollToPosition? })
textHistory.load(nodeId, value)
textHistory.sync()
textHistory.undo() / textHistory.redo()   // -> false if nothing to do
textHistory.destroy()
```

### Highlighting

`helpers/EditorHighlighter.js` + `helpers/EditorTokenizer.js`: the textarea stays the input (undo, selection,
IME and the helpers above keep working) but its text is transparent. `.editor-highlight` lies behind it in
`.editor-input-container` with the same font, padding and wrapping (shared rule in `EditorArea.css`), sized to
the textarea's client area and moved with its scroll position. One `.editor-highlight__line` per source line.

```js
const highlighter = new EditorHighlighter(textarea, { isRefValid?(slug) })  // inserts the layer before the textarea
highlighter.update()    // renders the changed lines; `input` events call it, after textarea.value = ... call it yourself
highlighter.refresh()   // renders every line again (link states changed, other project)
highlighter.destroy()
tokenizeLine(line, state, { isRefValid?, isFootnoteValid? }) -> { html, state }   // INITIAL_LINE_STATE, lineStateKey(state)
```

`update()` compares the lines with the last ones (unchanged start and end), tokenizes the changed lines and
continues with the following lines only while their start state differs (`{ fence, comment, props }`: open
code fence, `<!--` comment, multi-line `{ }` property block). In `EditorArea` every change goes through
`_renderPreview()`, which calls `update()`.
Footnotes: `update()` collects the defined labels (`getFootnoteLabels()`); when the set changes, every line is
tokenized again, so `[^label]` without a definition is `ref-broken`, otherwise `ref` (definition prefix too).

Tokens are `<span class="ehl-<token>">`, the token names are the ids of `EDITOR_COLOR_TOKENS`. The syntax
follows `MarkdownParser.js` (headings h1-h4, `**`/`*`/`_`, inline code with `{props}`, fences, `[text](url)`,
`[[slug|Text]]`, `{#anchor}`, property blocks, comments, lists, quotes, `---`, table pipes).
Code block content gets one color, it is not highlighted per language.

`@common/EditorColors.js`: the highlighting tokens. Their colors are `--editor-color-<id>` in the dark and light
blocks of `main.css`, the active app theme overrides them on `<html>` (group "Doc editor highlighting" of
`@data/AppThemeManager.js`, editable in Preferences -> App theme).

### Find & Replace

`components/findWidget/FindWidget` (component in `.editor-find-slot`, top right of the split pane, so a narrow editor
doesn't clip it; props `{ textarea, highlighter, getProject }`):
find / replace box like in VS. Options in `session.editorSearch`: match case, whole word, regex (`$1`, `$<name>`, `$&`,
`$$` in the replacement), preserve case. Scope ("Look in"): selection, this entry, this tab, all tabs.

- `entry` is the default scope. The selection scope (shortcut or dropdown) searches in the selected text; otherwise a
  selection inside one line becomes the query. The selection range moves along while typing and is shown with a
  `range` mark. Opening another entry switches back to `entry`.
- The box is at most 340px wide and only shrinks with the whole split pane (the input fields shrink first).
- Matches of the open entry are shown with `highlighter.setMarks()` (max 1000, the current one as `active`).
- Next / previous (`Enter` / `Shift+Enter`, `F3` / `Shift+F3`) continues in the next entry with matches in the tab
  and all-tabs scopes (`editor:select-range`, then the match is selected after the entry opened).
- Replace (`Enter` in the replace field): the first press selects the current match, the next one replaces it
  through `execCommand` (undo history) and selects the next match.
- Replace all (`Ctrl+Alt+Enter`): always shows `helpers/ReplacePreviewModal.js` first, also for one entry. It lists
  every match with its line before / after and the nearest non-blank line above and below, tabs, entries and single
  matches can be unchecked. Tabs and entries are collapsible, at the start only the first tab and its first entry are
  open. The footer arrows and `FindNext` / `FindPrevious` step through the matches (the entry of the new match opens,
  the previous one closes), `Space` checks / unchecks the current match. While it is open, `isReplacePreviewOpen()`
  is true and the `FindWidget` ignores `editor:find:next`. Applying: the open entry via `editor:replace-content`, the others in one
  `notifyOpenProjectChange(..., 'tabs:nodes')`, then `rebuildLinkUsages()`. Other entries can't be undone (no undo
  system yet), they stay unsaved changes.
- Every search publishes `editor:search:results`; the "Search" tab of the right sidebar lists them by tab and entry
  (max 500, click selects the match).

Shortcuts (`InitHotkeys.js`, context `docEditor`, one per scope so they can get own combos):
`Find:entry` `Ctrl+F`, `Find:selection` `Ctrl+Alt+Shift+F`, `Find:tab` `Ctrl+Alt+F`, `Find:all` `Ctrl+Shift+F`,
`Replace:<scope>` the same with `H`, `FindNext` `F3`, `FindPrevious` `Shift+F3`, `Find:matchCase` `Alt+C`,
`Find:wholeWord` `Alt+W`, `Find:regex` `Alt+R`, `Find:preserveCase` `Alt+P`, `Find:replaceAll` `Ctrl+Alt+Enter`.

```js
// @common/TextSearch.js (pure)
createSearchRegex({ query, matchCase?, wholeWord?, useRegex? }) -> { regex, error }   // flags gmu(+i)
findMatches(text, regex, { from?, to?, limit? }) -> [{ start, end, text, groups, named }]  // empty matches skipped
getReplacement(match, template, { useRegex?, preserveCase? }) -> string
applyReplacements(text, [{ start, end, replacement }]) -> string
getMatchContext(text, match) -> { line: { number, text, start }, before, after }   // before/after: nearest non-blank lines

// @data/ProjectSearch.js
SEARCH_SCOPES                                                   // ['selection', 'entry', 'tab', 'all']
getScopeEntries(project, scope, { activeTabId, activeNodeId }) -> [{ tab, node }]   // tree order
searchProject(project, options, { scope, activeTabId, activeNodeId, selection?, withReplacement? })
  -> { error, groups: [{ tab, node, matches }], total }        // only entries with matches

// EditorHighlighter
highlighter.setMarks([{ start, end, type: 'match' | 'active' | 'range' }])   // behind the text, set again after edits
highlighter.scrollToPosition(position)
```

### Structure Edit (properties of tables, code blocks, tree blocks, lists and [toc])

`helpers/EditorStructureEdit.js`: while the cursor is in a table, a code block, a `[toc]` line, a bullet list or the property block above it, an
edit button (`.editor-structure-edit`) sits in the left padding next to the first line (the property block or the
element). The button or `Edit:structure` (`Ctrl+.`, `editor:edit-structure`) opens `helpers/StructureEditModal.js`.
Applying replaces the property block and the opening fence line in one `execCommand` (undo history); an empty
result removes the block. Unknown properties are kept.

- `[toc]`: title, look (`style`, default `card` is left out), headings (`depth` 1-3, all = left out), `numbered`.
- Tree block (code block with the language `tree`, type `'tree'`): `collapsible`, `collapsed` (all open = left out, `1`-`3`).
- Bullet list (consecutive `-` / `*` lines, type `'list'`): bullet style for level 1-3, written as `bullet=a,b,c` up to the
  last chosen level (levels in between get the default, or level 1's style); nothing chosen = left out.
- Code block: language (with suggestions), `copy`, `numbers`, language tag (language name / custom `label` / `label=none`), indent guides (off / `indent=N` / `indent=tab`).
- Table: a grid of the content (`helpers/TableGridEditor.js`) above the properties (Alt + arrow keys move between cells): body rows move up / down,
  rows and columns can be inserted and deleted, columns moved and their alignment (separator row) cycled. The modal
  is at most 680px high and its body doesn't scroll (`.structure-edit-modal--table`): the grid (rest of the height)
  and the properties (max 160px) share it and scroll in their own boxes; after a change the scroll position stays and the
  changed row / column is scrolled into view. Properties: `striped` (row, col; only rows is written as plain `striped`), `hover` (cell, row, col) and a list of
  `col` / `row` / `cell` targets with `hl`, `align`, `width`, `line` (only the fields of the type are shown, the
  index is validated). Targets follow moved / inserted / deleted rows and columns (`onReorder` index maps, cells that
  are no longer one range are split, targets without index are removed). With a changed grid the whole table is
  written again with aligned columns; otherwise only the property block changes.

```js
// helpers/EditorStructures.js
findStructureAt(lines, lineIndex, getLineState) -> { type: 'table' | 'code' | 'toc', elementStart, elementEnd,
  props: { start, end } | null, firstLine, fence?: { indent, ticks, lang, rest } } | null
readStructureProperties(lines, structure) -> { props, targets: [{ type, index: '0,2-4', props }] }
formatStructureProperties(properties, indent?) -> string   // '' without properties, one line up to 80 chars
buildStructureHead(structure, lines, propertiesText, lang?) -> string   // new text for firstLine..elementStart
parseMarkdownTable(tableLines) -> { header, aligns, rows }   // split like the parser ([[a|b]], inline code), '\|' -> '|'
formatMarkdownTable(table, indent?) -> string                // aligned columns, '|' in cells escaped as '\|'

highlighter.getLineBox(lineIndex) -> { top, height }   // in the textarea's client area
```

`parsePropertyBlock()` is exported from `MarkdownParser.js` for this. Table cells may contain an escaped `\|`
(the parser doesn't split there and shows a `|`).

### Suggestions

`helpers/EditorAutocomplete.js`: list at the cursor (popover `.editor-suggest`, positioned with
`highlighter.getCaretRect()`). Opens on `input` when the context has suggestions and the query is long enough,
or with `Ctrl+Space`. Arrow keys select, `Enter` / `Tab` insert, `Escape`, arrow left/right, a click into the
textarea or blur close it. A list that opened by itself with an empty query (`minQuery` 0, e.g. after `{`) lets
`Enter` through as a line break until an item is chosen with the arrow keys (`Tab` still inserts). The keydown listener is a capture listener, so it runs before `addTabIndenting` /
`addLineBreakIndenting`. Inserting uses `execCommand('insertText')` (undo history, fires `input`).

```js
const autocomplete = new EditorAutocomplete(textarea, highlighter, { getProject })
autocomplete.open(manual?) / close() / isOpen() / destroy()
highlighter.getLineStartState(lineIndex)   // { fence, comment, props } at the start of a line
highlighter.getCaretRect(position)         // { left, top, bottom } on screen, measured in the highlighted line
```

`helpers/EditorCompletions.js`: `getCompletions({ lines, lineIndex, column, lineState, project })` ->
`{ from, query, minQuery, items: [{ label, detail?, insert, reopen? }] } | null`. Items are filtered by the
query (prefix matches first, max 50).

| Context | Suggestions | Opens after |
|---|---|---|
| `[[slug` | project links (slug, name -> target), adds `]]` if missing | `[[` |
| ` ```lang `, ` ```diff:lang ` | project and preset languages (name + aliases), `diff` and `diff:` (keeps the list open for the language); a final choice with nothing behind the cursor closes a still open block (`

` + fence, cursor in the empty line) | 1 character, after `diff:` right away |
| `[^label` | footnote labels of the entry (definition text / "No definition yet"), adds `]`; at the start of a line it writes a definition (`label]: `) and undefined labels come first | `[^` |
| `[` at the start of a line | `[toc]` (adds `]` if missing) | `[`, closes when nothing matches |
| `{lang=` | languages (inline code) | `=` |
| `{ ... }` on its own line(s) | properties of the element below (table / code block / ` ```tree ` / `[toc]` / unindented `-` `*` list; table + code if unknown), `col` / `row` / `cell` targets, values of `hover`, `striped`, `align`, `label`, `style`, ... | right away at a fresh position (after `{`, `;`, a `col 1:` target, an empty line of a multi-line block), else 1 character; values right after `=` |

The property definitions are in `EditorCompletions.js` (`TABLE_PROPERTIES`, `CODE_PROPERTIES`, `TOC_PROPERTIES`, `TREE_PROPERTIES`, `LIST_PROPERTIES`), keep them in sync
with `MarkdownParser.js` and the format guide (`FormatGuideBuilder.js`).

```js
EDITOR_COLOR_TOKENS                    // [{ id, name }]: text, markup, heading, bold, italic, code, code-block, link, link-url,
                                       // ref, ref-broken, anchor, property, property-value, comment, list, quote, table, selection,
                                       // search-match, search-active, search-active-border, search-range
applyEditorColors(element)             // removes old inline --editor-color-* variables (the colors come from the app theme)
getEditorColorVar(id)                  // '--editor-color-<id>'
```

---

## 13. Tree, Tabs & DragDrop

```js
// views/docEditor/components/sidebarLeft/helpers/TreeHelper.js
renderTree(nodes, { activeNodeId, collapsedNodes, searchQuery, componentInstanceId })
setupDragAndDrop(container, onReorder)

// views/docEditor/components/sidebarLeft/helpers/TabManagerHelper.js
const tabManager = new TabManager(containerEl, { onRenameTab, onDeleteTab });
tabManager.render() / tabManager.destroy()

// @common/DragDropHelper.js
const dnd = new DragDropHelper(containerEl, {
  itemSelector, handleSelector, idAttribute, placeHolderClass,
  nestable = false, nestZoneRatio = 0.25, onReorder,
});
dnd.destroy()
```

---

## 14. Markdown, HTML & Export

### MarkdownParser (`@core/MarkdownParser.js`)

```js
await parseMarkdownAsync(source, theme?, project?, options?)
setCodeHighlighter(fn) / clearCodeHighlighter()             // wired to syntaxHighlighter in Bootstrap
setHtmlCodeLineSplitter(fn) / clearHtmlCodeLineSplitter()
cleanupCodeBlockCache(cache)                                 // project.session.codeBlockCache
removeMarkdownMeta(markdown)                                 // without comments and property blocks (export search index)
addTransform(name, fn, pos = {}) / removeTransform(name) / getPipelineNames()
```

Code fences: `lang` or `diff` / `diff:lang` (lines starting with `+`/`-` become added/removed; `parseDiffLines()`: `+x` -> `x`, `+ x` -> `  x` (the marker becomes a space, the column stays), git format (every non-empty context line starts with a space) removes the first character of every line).

Comments: `<!-- -->` (also multi-line) outside of fenced and inline code are removed by the first
transform `comments`. Lines that only hold a comment are dropped (plus one blank line if the comment
stood between two), so they never render as empty lines. `ctx.lineMap` keeps the source line of every
remaining line for `lineAnchors`. An unclosed `<!--` stays text.

Property blocks: `{...}` on its own line(s) directly above an element (no blank line between), or the
same inside `<!-- {...} -->`. Entries are separated by `;` or new lines, each one is
`[target:] name name=value name="quoted value"`. Targets: `col 1,3-5:`, `row 2:`, `cell 2-3,1:`
(row,col; 0-based, row 0 is the table header). Content that isn't valid property syntax (e.g. `{#anchor}`)
stays text. A valid block without an element below is removed in the `comments` transform.

```js
/** BlockProperties */
{
  props: { hover: 'row,col', copy: true },        // no target: the whole element (switches are `true`)
  targets: [
    { type: 'col', indices: [1, 3, 4, 5], props: { hl: true, width: '120px' } },
    { type: 'cell', rows: [2, 3], cols: [1], props: { hl: true } },
  ],
}
```

The `properties` transform attaches them: a code block gets `codeBlocks[i].properties`, any other
element gets a placeholder line `\x03P<i>\x03` (data in `ctx.properties[i]`) directly above it, which
the element's transform has to consume. `unused-properties` removes the leftover placeholders.

Table properties (`parseTables` / `createTableLayout`):

| Property | Target | Output |
|---|---|---|
| `hover=cell,row,col` (`hover` = `cell`) | table | `data-hover="..."` on `<table>`; col hover is set by `buildTableColumnHoverJs()` (`.tbl-hover-col`) |
| `striped=row,col` (`striped` = `row`) | table | `data-striped="..."` on `<table>` (`TABLE_STRIPE_TYPES`) |
| `hl` | row / col / cell | `.tbl-hl-row` on `<tr>`, `.tbl-hl-col` / `.tbl-hl-cell` on the cell |
| `width=120` / `120px` / `20%` | col | `width` attribute on the header cell |
| `line=3` (px, 1 - `MAX_TABLE_LINE_WIDTH` = 10) | row / col | `.tbl-line-b-N` / `.tbl-line-r-N` (`buildTableLineCSS()`) |
| `align=left\|center\|right` | col / cell | `.tbl-align-*` (cell > col > `:---:` of the separator row) |

Code block properties (`buildCodeBlockHTML`, applied after the highlight cache, which only holds the `<pre>`):

| Property | Output |
|---|---|
| `copy` | `.code-copy` (zero height) with `.code-copy-btn` at the top right, moved along while scrolling by `buildStickyCodeCopyJs()` (`position: sticky` doesn't work there); click handled by `buildCodeCopyJs()` (copies without line numbers, diff blocks without removed lines) |
| `label="Text"` / `label=none` | overrides the language tag text / removes the tag (`--no-tag`) |
| `numbers` | `.code-block-wrapper--numbered` becomes a grid: the tag (in the flow) sits above the number column `.code-line-numbers` in the same grid column, so both have the same width; the `<pre>` is unchanged next to it. Diff blocks get old/new numbers like git (`getDiffLineNumbers()`) |
| `indent=N` (1-16 spaces, `indent` alone = 4) / `indent=tab` (= project tab size, `getProjectTabSize()` from `@common/Common.js`, also used by the Tab key) | `addIndentGuides()` walks the rendered `<pre>` (lines end at `
` and between diff groups) and wraps the first whitespace character of every complete level in `.code-indent-guide` (inline-block, 1px inset box-shadow on the left in `--code-indent-guide`, inactive = `--ctext` at 35%). A tab is always one level. Blank lines keep the guides of their own whitespace; missing levels (like the deeper neighbour line, at most one level deeper than the line below) are added as empty `.code-indent-guide--virtual` spans that show the whitespace of that neighbour (`data-ws`) through `::before` (not copied) |

Inline code: `{lang=cpp}\`code\`` (properties directly in front, no space) is highlighted by
`renderInlineCode()` as `<code class="syntax-definition-highlight code-inline-highlight">`. A `{...}` that
isn't valid property syntax stays text. `_getLanguageTagsByText()` in `HtmlBuilder.js` also collects these
languages for the language CSS.

No `style` attributes: the app's CSP (`style-src 'self' blob:`) also applies to the blob preview
iframe and blocks them. Use classes or plain HTML attributes for generated markup.

Every highlight kind sets its own `--tbl-*` variable that is drawn as its own background layer, so
crossings stack and get brighter (stripes: `--tbl-stripe-row` / `--tbl-stripe-col`). Colors: `--table-hl`, `--table-hover`, `--table-stripe`.

Table of contents: a `[toc]` line (case-insensitive, with an optional property block above) becomes a
`\x04TOC<i>\x04` placeholder (`extractTocs`, `ctx.tocs`). After the inline transforms `buildTocs` gives every
`h1`-`h4` an `id="h-<nodeId>-<slug>"` (unique per entry, `-2`, `-3` ... for repeats) and replaces the placeholder
with `<div class="doc-toc">` (one line): the headings after it, nested by level relative to the highest one.
Properties: `depth=1-4` (lowest level, default 4), `title="..."` (`.doc-toc__title`), `numbered` (numbers like
`1.1` as `.doc-toc__num`), `style=card|tree|outline|leader` (`TOC_STYLES`, default `card`; class `.doc-toc--<style>`,
each style is its own CSS block in `buildBaseCSS()`; `outline` always shows numbers, `leader` adds
`.doc-toc__leader` + `.doc-toc__arrow`).
Links are `.doc-toc__link[data-toc-target]`; `buildTocLinkJs()` (preview + export) scrolls to the heading
instead of changing the hash.

Tree blocks: a fenced code block with the language `tree` (not `diff:`) is rendered by `buildTreeHTML()` in
`renderFencedCodeBlock()` instead of the code html (no highlighting, not cached), with its property block.
`parseTreeEntries()`: one entry per non-empty line; the prefix of whitespace, box drawing characters (U+2500-257F)
and `|` / `` ` `` with following `-` counts as indentation (tab = project tab size), the level is relative to the
lines above (stack of widths). `+ ` / `- ` / `! ` after the prefix = marker (starts collapsed / open / never
collapses), text after whitespace + `#` = comment. A trailing `/` or `\` (removed) or children make a folder.
Output: `.doc-tree` > nested `ul.doc-tree__list` > `li.doc-tree__item[--folder]` with a `.doc-tree__row`
(icon svg `.doc-tree__icon--folder|file`, `.doc-tree__name`, `.doc-tree__comment`). Collapsible folders are
`<details class="doc-tree__details" [open]>` with the row as `<summary>` (toggles without script, also in the export);
then every row gets a `.doc-tree__chevron` slot (`.doc-tree--collapsible`). Collapsible: `collapsible` or `collapsed`
for all folders with children, `+` for one folder; `!` never. Closed at the start: `+`, or with `collapsed=N`
(`collapsed` alone = 1) every folder at depth >= N - 1 unless it has `-`.

Bullets: `parseUnorderedLists` reads the property block above the list. `bullet=a[,b,...]` (`LIST_BULLETS`: disc,
circle, square, dash, arrow, none) sets `class="md-bullets--<style>"` on the `<ul>` of every level (level % count).
Without it the CSS default applies: disc, circle, square, repeating from level 4.

Footnotes: `[^label]: text` lines (label = no `]` / whitespace) get a `\x05FN<i>\x05` prefix
(`footnote-definitions`, after `tocs`, `ctx.footnoteLabels`), so the text runs through escaping and the inline
transforms. `footnotes` (after `links`) removes these lines (with the line marker in front and one blank line after),
the first definition of a label wins, and replaces `[^label]` (not followed by `:`) by
`<sup class="fn-ref" id="fn-<nodeId>-<label>-ref"><a class="fn-ref__link" href="#fn-..." data-toc-target data-fn-text>N</a></sup>`
(numbered by first use, the id only on the first reference, `data-fn-text` = plain text for the CSS tooltip
`::after`). Without a definition: `<sup class="fn-ref fn-ref--missing">[^label]</sup>`. Unused definitions are
dropped. `footnote-list` (after `paragraphs`) appends `<section class="doc-footnotes"><ol>` with
`li#fn-<nodeId>-<label>` and a `.doc-footnotes__back` link. `buildTocLinkJs()` handles every `a[data-toc-target]`
(scrolls instead of changing the hash); `buildTocs` strips the refs from the TOC text. On merged pages every
section has its own list.

Check marks: a list item (`-`, `*` or `1.`) whose text starts with `[ ]` / `[x]` / `[X]` (followed by a
space or the end) becomes `<li class="task-item [task-item--checked]">` with a
`<span class="task-box [task-box--checked]">` in front of the text (`buildListItemOpen()`). The box can't
be clicked; in `ul` it replaces the bullet, in `ol` the number stays.

Ordered lists: items are `1.` (shown as written) or `n.` (previous number + 1, first item 1). An item
gets `value="<n>"` only when its number is not the previous one + 1. Lists and headings directly next
to text (no blank line) are split out of the paragraph in `parseParagraphs`.

`options`: `codeBlockCache` (Map), `nodeId` (unique link anchor ids), `lineAnchors` (boolean, adds
`data-line="<source line, 0-based>"` to every top-level block). For `lineAnchors` the `line-markers`
transform puts a `\x01L<n>\x01` marker line in front of every block after a blank line,
`parseParagraphs` moves it onto the next block, code blocks get it on restore. Only
`buildNodePreview` sets it, the export has no `data-line`.

### HtmlBuilder (`@core/HtmlBuilder.js`)

Builds both the live preview and the self-contained HTML export.

```js
await buildDocument(project, theme?, { signal? })             // full export HTML; aborting signal rejects with AbortError
await buildNodePreview(content, codeBlockCache, theme?, project?)
buildThemeCSS(theme) / buildBaseCSS() / buildLanguageCssForProject(project, theme, type)
getCachedThemeStyleUrl(theme) / revokeThemeCache(id)
revokeScriptCache(id)   // drops the cached doc script (node list + search index) for createTabId(tabs)
getPopulatedTabs(project)   // tabs with at least one node (what buildDocument renders)
shiftMarkdownHeadings(markdown, by)   // shifts ATX headings outside code fences, capped at h4
buildScript(tabs, { fresh? })         // buildDocument always passes fresh: true (script holds pages/aliases/search index)
// The export follows resolveExportTree() (see §5 Node Types): templates per page, nav from `nav`, search per section.
// plus the building blocks: buildHead, buildHeader, buildSidebar, buildTabNav, buildToc, buildSearchBar, buildScript, assembleDocument
```

### ExportHelper (`@common/ExportHelper.js`)

```js
await exportProjectAsFolder(project, folderName?)   // -> { success, message }
exportProjectAsJSON(project)                        // .dfproj string (wrapped envelope)
await exportProjectAsHTML(project, fileName?)
```

### FormatGuideBuilder (`@common/FormatGuideBuilder.js`)

Builds `docforge.README.md`: an English description of the folder-project format for tools and AI
assistants (layout, config fields, entry files, entry types, supported Markdown, comments and
properties, reference links, languages, how to make changes). Keep the Markdown and Properties sections
in sync with the parser when syntax changes. Dynamic parts are read from the code: `NODE_TYPE_INFO` /
`NODE_MERGE_MODE_INFO`, the language presets and project languages (name + aliases usable as code fence
tags, overrides marked), the theme preset ids, the project links and `APP_VERSION` / `PROJECT_SCHEMA_VERSION`.
The entry tree is left out on purpose so the file doesn't change on every rename. When you change the
format, the parser or the folder reconciliation, update the matching text here as well.

```js
buildFormatGuide(project)          // -> markdown, starts with FORMAT_GUIDE_MARKER (@core/AppMeta.js)
isFormatGuideEnabled(project)      // settings.formatGuide.enabled === true
isGeneratedFormatGuide(text)       // file content starts with the marker
```

Written on every folder save (see §15 Folder-Project Layout). The project settings modal
(File -> Project Settings) toggles it, edits `preferences` and exports the guide with a save dialog
for any project kind.

### ProjectPersistence (`@common/ProjectPersistence.js`)

```js
await saveProject(project)                   // write (desktop) + add to recents -> project id
await saveOpenProject()                      // desktop: saveDocument, web: recents entry; marks saved, emits save:complete:openProject
getImportTargetProjects()                    // [{ id, name, isOpen }] - open project first, then recents
await loadTargetProject(projectId)           // open project, web snapshot, or read from disk (not opened)
await commitTargetProject(project, mutateFn, extension)
// open project -> notifyOpenProjectChange (stays unsaved until Ctrl+S); otherwise mutate + saveDocument / recents save
await renameRecentProject(projectId, newName)  // renames + saves the project (name only, not the file/folder) and its recents entry
```

---

## 15. Data Shapes

### Project

```js
{
  id:              'project_lf3k2abc9',
  name:            'New Project',
  createdAt:       1710000000000,
  tabs:            [ /* Tab, ... */ ],
  themes:          [ /* DocTheme, ... */ ],        // user themes owned by this project
  languages:       [ /* SyntaxDefinition, ... */ ],// project-specific languages
  languagesStyles: [ /* HighlightStyle, ... */ ],  // project-specific styles (any language)
  links:           [ /* Link, ... */ ],            // reference links (see §5 Reference Links)
  settings: {
    isThemePreset:  true,          // true -> currentThemeId refers to a built-in preset
    currentThemeId: 'theme_Dark',  // null = fallback theme
    formatGuide: {                 // generated docforge.README.md (folder projects), see §14 FormatGuideBuilder
      enabled:     false,
      preferences: '',             // author's documentation preferences, included in the guide
    },
    tabSize:        2,             // 1-16, spaces per Tab / tab width (see §5 setProjectTabSize); new projects: state defaultTabSize
  },

  sourcePath: null,   // absolute path; null on web
  sourceKind: null,   // 'file' | 'folder' | 'in-app' (web) | null

  // runtime only - stripped on save (cleanSaveProject)
  session: {
    builtIn:        false,
    codeBlockCache: new Map(),
    version:        0,     // unique number of the current state, new on every tracked notifyProjectChange
    savedVersion:   0,     // version at the last save -> hasUnsavedChanges()
    history:        null,  // { undo, redo, open, chars } undo steps, @data/ProjectHistory.js
    recoveryChecked: false, // DocEditorView already offered the crash backup
    entryScroll:    Map,   // set by EditorArea: { [nodeId]: { editor, preview } } scroll positions (rememberEntryScroll)
    entryHistory:   { entries, index, navigating },  // set by @data/EntryHistory.js
    // desktop folder-project bookkeeping, consumed by the next save:
    deletedTabIds:  {},  // { [tabId]: folderName }
    deletedNodeIds: {},  // { [nodeId]: { tabFolderName, fileName } }
    renamedTabIds:  {},  // { [tabId]: oldFolderName }
    renamedNodeIds: {},  // { [nodeId]: { tabFolderName, fileName } }
    deletedThemeIds:    {},  // { [themeId]: true }
    deletedLanguageIds: {},  // { [langId]: true }
  },
}
```

### Tab

```js
{
  id:         'tab_lf3k2tab1',
  name:       'Dokumentation',
  folderName: 'Dokumentation',   // folder projects only - on-disk folder slug
  nodes:      [ /* Node, ... */ ],
}
```

### Node

```js
{
  id:       'node_lf3k2def4',
  name:     'display',
  fileName: 'display',           // folder projects only - on-disk .md slug
  content:  '# display\n\nThe display property...',
  type:     'page',              // 'page' | 'folder' | 'merged' (see §5 Node Types)
  mergeDescendants: 'embed',     // 'embed' | 'separate' - only used and saved for 'merged'
  children: [ /* Node, ... */ ],
}
```

### Link

```js
{
  id:     'link_…',
  slug:   'name-test',                          // [a-z0-9-], unique in the project
  name:   'Name Test',                          // text of [[slug]]
  target: { nodeId: 'node_…', anchor: null },   // anchor: null = whole entry, else name of {#name}
  refs:   ['node_…'],                           // entries whose content uses the slug (kept up to date)
}
```

### DocTheme

```js
{
  id:           'docTheme_lf3k2thm1',   // built-ins: 'theme_<name>'
  name:         'Dark Teal',
  builtIn:      false,
  createdAt:    1710000000000,
  lastOpenedAt: 1710000000000,
  settings: {
    entries: [
      { name: 'accent', value: '#22d4a8', active: true },
      // ... one per THEME_SCHEMA entry, see §10
    ],
    langStyleIds: {
      // [langId]: { id: styleId, isBuiltIn: bool }
    },
  },
}
```

### SyntaxDefinition

```js
{
  id:                'syntaxDefinition_…',
  name:              'C++',
  aliases:           ['cpp', 'c++'],   // used to match code fence language names
  builtIn:           false,
  createdAt, lastOpenedAt,
  exampleCode:       '',
  symbolHoisting:    false,   // true -> pre-scan so symbols are known before declaration
  rootStateId:       'syntaxState_…',
  states:            [ /* SyntaxState */ ],
  predefinedSymbols: [ { name: 'std', tokenType: 'namespace' } ],
}
```

### SyntaxState / SyntaxStateRule

```js
// SyntaxState
{ id: 'syntaxState_…', name: 'root', rules: [ /* Rule - first match wins */ ], onUnmatched: 'character' }

// SyntaxStateRule
{
  id: 'syntaxStateRule_…', name, type: 'match' | 'beginEnd' | 'include',
  caseInsensitive: false,
  context: { afterTokenType: TokenType[] | null, notAfterTokenType: TokenType[] | null },

  // type 'match'
  patternType: 'regex' | 'keywords' | 'word',
  pattern:     '' | [],
  action:      RuleAction,
  balancedLookahead: { open, close, after, skipWhitespaceBeforeOpen, skipWhitespaceAfterClose } | null,

  // type 'beginEnd'
  begin: '', end: '',
  dynamicEnd:       { captureGroup, template } | null,  // overrides `end`
  beginAction:      RuleAction,
  endAction:        RuleAction,
  contentTokenType: TokenType | null,
  innerStateId:     string | null,

  // type 'include'
  includeStateId:   string | null,
}

// RuleAction
{
  tokenType:  TokenType | null,
  captures:   { groups: { [idx]: { tokenType, register: SymbolRegister | null } } } | null,
  register:   { tokenType, scope: 'global' | 'state' } | null,
  transition: { type: 'push' | 'pop' | 'set', targetStateId, popCount } | null,
}
```

### HighlightStyle

```js
{
  id:               'highlightStyle_…',
  langId:           'syntaxDefinition_…',
  name:             'Default',
  tokenStyles:      [ { tokenType, color, bold, italic, underline, underlineStyle } ], // global per TokenType
  stateTokenStyles: [ { stateId, tokenType, color, bold, italic, underline } ],        // per state
  overrides:        [ { stateId, ruleId, style: TokenStyle } ],                        // per rule
}
```

### RecentProject

```js
// Desktop
{ id, name, lastOpenedAt, sourcePath, sourceKind: 'file' | 'folder' }
// Web - full snapshot, no file on disk
{ id, name, lastOpenedAt, project: <Project>, sourceKind: 'in-app' }
```

### Project Preset (in `state.projectPresets`)

```js
{
  id, name, description,
  createdAt,
  projectVersion,   // PROJECT_SCHEMA_VERSION the snapshot was saved with
  project: { /* Project snapshot, see cleanExportProject */ },
}
```

### Folder-Project Layout (`sourceKind === 'folder'`)

Constants in `@core/AppMeta.js`. Tab folders and node files are named after
their names, made filesystem-safe with `uniqueSlug()` (collisions become
`Name (2)`), not after their IDs. That slug is stored as `tab.folderName` /
`node.fileName`.

```
<projectFolder>/
  docforge.config.json     <- FILE_EXTENSION_PROJECT_CONFIG
                              { id, name, settings, languagesStyles, links, tabs: [{ id, name, folderName,
                                nodes: [{ id, name, fileName, type, mergeDescendants?, children }] }] }  - no content
  docforge.README.md       <- FORMAT_GUIDE_FILE, only if settings.formatGuide.enabled (generated, never read)
  themes/                  <- PROJECT_THEMES_DIR, one <slug>.dftheme per project.themes[]
  languages/               <- PROJECT_LANGUAGES_DIR, one <slug>.dflang per project.languages[]
  tabs/                    <- PROJECT_TABS_DIR
    <tab folderName>/
      <node fileName>.md     flat, one file per node regardless of tree depth
```

Node files carry `id` and `name` in frontmatter:

```md
---
id: node_lf3k2def4
name: display
---

# display
```

**Loading is driven by what's on disk** (`ElectronDocumentIOAdapter._readFolder()` -> `DocumentManager._reconcileFolderProject()`):
- The config file only supplies the hierarchy and display names. Node files are matched to it by `folderName`/`fileName`, not by ID.
- A `.md` file that isn't referenced in the tab's tree is appended at the tab's root. Its ID comes from the frontmatter if present, and a new one is generated otherwise.
- An unknown subfolder of `tabs/` becomes a new tab named after the folder.
- Every `*.dftheme` / `*.dflang` file is loaded in full. The filename doesn't matter because the ID is stored inside the file.

**Saving** (`saveDocument()`):
1. `_absorbNewDiskContent()` re-reads the folder and pulls in tabs, nodes, themes and languages that were added on disk outside the app. It skips anything that has a pending delete or rename.
2. `serializeProject()` recomputes the slugs and writes everything.
3. The adapter deletes the explicitly deleted folders/files listed in `session.deleted*`, then removes any orphaned `.md`/`.dflang`/`.dftheme` files and tab folders.
4. `__formatGuide` (from `buildFormatGuide()`, or `null` when disabled) is written to `docforge.README.md`.
   When it is `null`, an existing file is removed only if it starts with `FORMAT_GUIDE_MARKER`.
   The file watcher ignores this file.

While saving, the project path is excluded from the file watcher (`watcherAPI.ignorePathTree` / `releasePathTree`).

---

## 16. Persistence, Envelopes & Migration

Everything written to disk or storage is wrapped in an envelope (`@core/Envelope.js`):

```js
wrapEntity(kind, version, data)          // -> { kind, storageVersion, data }
unwrapEntity(raw, migrateFn, currentVersion)
// -> migrateFn(data, storedVersion, currentVersion). Handles un-enveloped legacy data (version 0).
```

Schema versions live in `@core/AppMeta.js`:

| Constant | Migration (`@migration/…`) |
|---|---|
| `PROJECT_SCHEMA_VERSION` | `ProjectMigration.js` |
| `RECENT_PROJECT_SCHEMA_VERSION` | `RecentProjectMigration.js` |
| `PRESET_PROJECT_SCHEMA_VERSION` | `PresetProjectMigration.js` |
| `THEME_SCHEMA_VERSION` | `ThemeMigration.js` |
| `PRESET_THEME_SCHEMA_VERSION` | `PresetThemeMigration.js` |
| `SYNTAX_DEFINITION_SCHEMA_VERSION` | `SyntaxDefinitionMigration.js` |
| `LANGUAGE_STYLE_SCHEMA_VERSION` | `LanguageStyleMigration.js` |
| `UI_STATE_SCHEMA_VERSION` | `State._migrateUIState` |

`ProjectMigration`, `ThemeMigration` and `SyntaxDefinitionMigration` use a
`migrationSteps` map keyed by **target** version, of the form `{ 2: (old) => new, … }`.
The others merge the stored data with fresh defaults. When you change a persisted
shape, bump its constant and add a step.

Folder projects store no `storageVersion` in their config, so `migrateProject` runs
**every** step on each load of a folder project - project steps must keep values that
are already in the new shape (e.g. step 3 only sets `type` when it is missing, step 4 keeps an existing
`settings.formatGuide`).

File extensions: `.dfproj` (project), `.dftheme` (DocTheme), `.dflang` (SyntaxDefinition),
`.dflangstyle` (exported HighlightStyle).

A `.dflangstyle` file is `wrapEntity('languageStyle', LANGUAGE_STYLE_SCHEMA_VERSION, { style, refs, language })`.
`refs` comes from `buildHighlightStyleRefs()` and stores the names of the referenced states/rules, because
built-in languages get new state/rule ids on every app start. `language` is the wrapped custom language
(`wrapEntity('language', …)`), or `null` for built-in languages.

An exported `.dflang` file can carry the styles chosen in the export modal next to the envelope:
`{ ...wrapEntity('language', …), styles: [{ style, refs }] }`. `unwrapEntity` ignores the extra key, so
the file stays a valid plain language file (folder projects never write `styles`). On import every style
is remapped onto the new language id via `matchHighlightStyleToLang()`.

An exported `.dftheme` file can carry the project languages chosen in the export modal the same way:
`{ ...wrapEntity('theme', …), languages: [ /* .dflang entity, see buildLanguageExportEntity() */ ] }`
(each with all its project styles). On import the languages get new ids (`createImportedLanguage()` in
`ImportModalHelper.js`) and the theme's `settings.langStyleIds` is remapped to the new language/style ids.

### Unsaved Changes & Backups

Projects are only written on an explicit save. `@common/UnsavedChangesGuard.js` asks before the open
project is left with unsaved changes: navigation to the Hub (navigation guard), a new project from the
editor, Ctrl+R, app close (`onAppClose` -> `confirmAppSaveComplete()` or `cancelAppClose()`; main waits
for the ack only 500 ms, then without a timeout) and, on web, `beforeunload` (browser prompt).
`DocEditorView` asks before reloading external changes while the project has unsaved changes.

`@core/BackupManager.js` (`BACKUP_VERSION` 2) backs up the open project every 5 minutes while
`hasUnsavedChanges()` and its version changed since the last backup. Storage slots:

```js
'backups:index'     // { version, projects: [{ fileId, projectKey, projectName, sourcePath, lastBackupAt, resolvedAt }] }
'backups:<fileId>'  // { version, slots: [{ id, date, label, data: { project: wrapEntity('project', …) } }] }  newest first, max 10
```

`projectKey` (`getBackupProjectKey()`) is `<sourceKind>:<sourcePath>` on desktop, `id:<projectId>` on web.
`resolvedAt` is set on save, "Don't save", reloading external changes and a declined recovery. If
`lastBackupAt` is newer (`findRecoverySlot()`), the app most likely crashed and `DocEditorView` offers
`restoreBackupIntoOpenProject()` once per opened project (the result stays unsaved). It writes the
backup into the open project in place (`replaceProjectContent()`), as one undo step "Restore backup". Version 1 kept
all slots in the `backup` slot; they are moved into per-project files on start (always resolved).
Read slot projects with `getSlotProject(slot)`, which also migrates them.

---

## 17. Electron / IPC

### `window.electronAPI` (preload)

```js
getPlatform() / getVersions() / ping()
minimize() / maximize() / close() / toggleDevTools()
isFullScreen() / onFullScreenChanged(cb)      // cb(isFullScreen), forwarded as eventBus 'window:fullscreen-changed'
onZoomChanged(cb)
onBeforeClose(cb) / confirmSaveComplete() / cancelClose()   // onBeforeClose acks right away (app:close-ack)
getPendingFiles() / onFileOpen(cb)            // files opened via OS (double-click / "open with")
getPathForFile(file)                          // path of a dropped File (webUtils)
updater.checkForUpdates() / downloadUpdate() / installNow()
updater.onChecking / onAvailable / onNotAvailable / onProgress / onDownloaded / onError (cb)
getUserDataPath() / getExePath() / joinPath(...segments)
writeFile(path, data)        // -> { ok, error }
readFile(path)               // -> { ok, data, error }
readDir(path, options)       // -> { ok, entries: [{ name, isDirectory }], error }
mkdir(path) / removePath(path, options) / deleteFile(path)   // -> { ok, error }
pathExists(path)             // -> { ok, exists }
openDialog(options)          // { type: 'file'|'folder'|'both', filters, defaultPath, promptToCreate, … } -> { canceled, filePaths }
saveDialog(options)
openFolder(path) / showInFolder(path)
trashPath(path)              // moves to the OS trash -> { ok, error }
send(channel, data) / receive(channel, cb)
```

### `window.watcherAPI` (preload, chokidar in `main/fs/ProjectWatcherManager.js`)

Use it through the `watcherAPI` wrapper in `@core/Platform.js`, which becomes a no-op on web.

```js
watchProject(projectId, path) / unwatchProject(projectId) / isWatching(projectId)
ignoreNextChange(projectId, filePath)
ignorePathTree(projectId, dir) / releasePathTree(projectId, dir) / isPathIgnored(projectId, dir)
onFileChanged(cb) / onError(cb)   // return an unsubscribe fn
```

### IPC Channels (`main/ipc/`)

| Group | Channels |
|---|---|
| misc | `ping`, `file:getPendingFiles`, `app:save-complete` / `app:close-cancel` / `app:close-ack` (on), `app:before-close` (-> renderer), `file:open` (-> renderer), `zoom:changed` (-> renderer) |
| window | `window:minimize`, `window:maximize`, `window:close`, `window:toggleDevTools`, `window:isFullScreen` (+ event `window:fullscreen-changed`) |
| path | `path:userData`, `path:exe`, `path:join` |
| fs | `fs:write`, `fs:read`, `fs:readdir`, `fs:mkdir`, `fs:rm`, `fs:exists`, `fs:delete`, `fs:trash` |
| dialog / shell | `dialog:open`, `dialog:save`, `folder:open`, `folder:show` |
| updater | `updater:checkForUpdates`, `updater:download`, `updater:installNow` (+ events `updater:checking/available/notAvailable/progress/downloaded/error`) |
| watcher | `watcher:watch-project`, `watcher:unwatch-project`, `watcher:ignore-next-change`, `watcher:ignore-path-tree`, `watcher:release-path-tree`, `watcher:is-path-ignored`, `watcher:is-watching` (+ events `watcher:file-changed`, `watcher:error`) |

---

## 18. UI Utilities

`@common/UIUtils.js`

```js
createActionMenu([{ name, description?, danger?, action }], { title? })   // "⋯" button, opens its items via MenuManager
deselectAllTabs({ element, isParent, condition }) / selectTab({ element, tabAction, isParent })
addCheckboxEventListener / removeCheckboxEventListener / isCheckedBoxActive / toggleCheckBox / setCheckBox / setCheckboxDisabled
addTabIndenting(input) / addLineBreakIndenting(input)
```

`@common/MenuManager.js`: one shared menu host for all dropdowns and context menus. The host is a `popover` in the top layer, so menus are never clipped by an `overflow` of the opening element and show above modals. Panels are built on open and removed on close. Each panel is placed next to its anchor (or the cursor), flipped/shifted to stay inside the viewport and capped at the viewport height (then it scrolls).

```js
// MenuItem: { name, description?, shortcut?, shortcutContext?, danger?, action?(event), items?: MenuItem[] } | { divider: true }
// items -> submenu (opens on hover after 300 ms or on click)
openMenu(items, { anchor?, align?: 'start'|'end', x?, y? }, { trigger?, onClose?, className? })
closeMenu()
isMenuOpenFor(element)
toggleMenu(anchor, items | () => items, align = 'start', className?)   // below anchor, second click closes
addContextMenu(element, items | () => items, className?)               // right click at the cursor, returns remove fn
```

Closes on a press outside, `Escape`, scrolling outside the menu, resize and window blur. `className: 'dropdown--compact'` uses the smaller font of the "⋯" menus.

`@common/ColorPicker.js`: own color picker, used instead of `<input type="color">`. It opens as a popup in its own top layer `popover` (like MenuManager). The views (SV square + hue, HSL wheel + lightness, HSL sliders, RGB sliders) are drawn on canvases; the dropdown at the top right switches them and stores the choice in `state.colorPickerMode`, so it applies to every picker and survives a restart. A hex field accepts any CSS color. The pipette uses the Chromium `EyeDropper` API (whole screen) and is hidden where it is missing (Firefox, Safari).

```js
// a color input is a <button class="color-swatch"> (styles/ColorPicker.css), the color is set via setSwatchColor()
bindColorSwatch(swatch, options)        // click opens the picker with the swatch color, second click closes; returns remove fn
setSwatchColor(swatch, value)           // shows the color (checkerboard under transparent colors), stored in swatch.dataset.color
openColorPicker(anchor, {
  value?,                               // start color, any CSS color
  allowAlpha? = false,                  // alpha slider; values with alpha < 1 are '#rrggbbaa', otherwise always '#rrggbb'
  palette?,                             // [{ color, name? }] | () => [...]; shown below the picker, name = tooltip
  placement? = 'bottom',                // 'bottom' | 'top' | 'right' | 'left', then opposite side, then the two others, clamped to the viewport
  align? = 'start',                     // 'start' | 'end' edge of the anchor
  onInput?(value),                      // every change while picking
  onChange?(value),                     // on close, only if the color changed
  onClose?(),
})
closeColorPicker() / isColorPickerOpenFor(element)
parseColor(value)                       // any CSS color -> { r, g, b, a } | null
```

Closes on a press outside, `Escape` and scrolling outside the picker; follows the anchor on resize. Components that use it call `closeColorPicker()` in `onDestroy()`. The theme editor (`ThemeContentHelper.js`) opens it to the right with `allowAlpha: false` and all theme colors as palette (`"<header>: <label>"`).

---

## 19. Validation

`@common/Validations.js`

```js
getValidation(type, rule)       // type: 'PROJECT' | 'THEME' | 'LANGUAGE'
getValidationError(type, rule)
```

| Type | Rule | Value |
|---|---|---|
| `PROJECT` | `NAME_MIN_LENGTH` | `3` |
| `THEME` | `NAME_MIN_LENGTH` | `3` |
| `LANGUAGE` | `NAME_MIN_LENGTH` | `2` |

---

## 20. Publishing a Release

1. Bump `version` in `package.json`. Run `npm i`.
2. Finalize the `CHANGELOG.md` date.
3. Change `APP_VERSION` in `AppMeta.js` and add a new entry to `APP_CHANGE_LOGS`. Its `changes` is an object keyed by group
   (`User Features`, `Changes`, `Fixes`, …); the groups are shown in the Changelog modal (Help menu).
4. Merge `dev` into `main` and run `npm i` on `main`.
5. Commit, then tag on `main`: `git tag v1.4.0 && git push origin v1.4.0`.
6. The workflow builds win/mac/linux and publishes a **draft** GitHub Release.
7. **If this release breaks compatibility with older versions** (e.g. a changed storage
   format or an incompatible state schema), add this HTML comment anywhere in the
   draft's release notes on GitHub:

```md
  <!-- update-meta: minCompatibleVersion="2.0.0"; incompatibilityNote="note"; -->
```

  - `minCompatibleVersion`: the oldest version that may still auto-update to this
    release. Older installs will see the update in the modal, but the "Update" button
    will be disabled.
  - `incompatibilityNote`: a short, user-facing explanation of why the update can't
    be installed automatically and what the user should do instead. Keep it on one
    line and avoid the literal pattern `word=` inside the text.

  Repeat both fields in every later release's notes for as long as the
  incompatibility applies. Only the notes of the version being updated *to* are checked.
  Skip this step if the release is backward-compatible.

8. Review the draft, verify the artifacts, and publish it manually.
9. Existing installs pick it up via `electron-updater`.

To test the build locally:
```bash
npm run build
npm run dist:win   # or dist:mac / dist:linux / dist
```
