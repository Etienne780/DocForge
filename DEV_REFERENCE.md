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
| `recentProjects` | `Array` | `[]` | `recentProjects` | See [RecentProject](#recentproject) |
| `projectPresets` | `Array` | `[]` | `projectPresets` | See [Project Preset](#project-preset-in-stateprojectpresets) |
| `themePresets` | `Array` | `[]` | `themePresets` | User-saved theme templates |

Keys marked `state` are in `PERSISTED_KEYS` and saved together via
`state.uiStateSnapshot()`. The others have their own `StorageManager` slot.

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
| `session:change:openProject:<extension>` | Fired by `notifyOpenProjectChange` / `notifyProjectChange`, e.g. `:tabs`, `:name`, `:themes`, `:settings`, `:languages`, `:languagesStyles` |

`state:change` also schedules a debounced autosave (800 ms) in `StorageManager`.

### Storage Events

Storage keys: `state`, `recentProjects`, `projectPresets`, `themePresets`, `openProject` (see `init/InitStorage.js`).

| Event | Payload | Notes |
|---|---|---|
| `save:request` | - | Save every slot now |
| `save:request:<key>` | - | Save one slot now |
| `save:complete` / `save:complete:<key>` | - | Emitted by `StorageManager` |
| `reset:complete` / `reset:complete:<key>` | - | Emitted by `StorageManager` |

### Application Events

| Event | Payload | Emitted by | Received by |
|---|---|---|---|
| `editor:content-changed` | `{ markdown }` | `EditorArea` | `SidebarRight` |
| `editor:stats-updated` | `{ wordCount, charCount }` | `EditorArea` | `SidebarRight` |
| `zoom:changed` | `factor` | `ElectronBridge` | `InitEvents` |
| `toast:show` | `{ message, type = 'success', durationMS? }` | anywhere | `Toast` |
| `syntaxDefinitionManager:removedStyle` | `{ langId, styleIds }` | `SyntaxDefinitionManager` | `SyntaxHighlighter` |
| `themeEditor:update:display` | - | Theme editor sidebar | `DocThemePreview` |
| `appearanceManager:openModal:<section>` | `{ id, builtIn }` | Theme/Language cards | `AppearanceManagerView` |
| `backupManager:change` | - | `BackupManager` | `BackupManagerModal` |
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

### Modal Events

Modals are built once in `initSharedModals()` (`@core/SharedModal.js`).

| Modal | Event | Payload | Overlay ID |
|---|---|---|---|
| `InfoModal` | `show:modal:info` | - | `application-info-modal` |
| `UpdateModal` | `show:modal:update` | `info?` | `application-update_modal` |
| `CreateProjectModal` | `show:modal:createProject` | `{ preset? }` | `application-create_project-modal` |
| `OverviewModal` | `show:modal:overview` | - | `application-overview_modal` |
| `BackupManagerModal` | `show:modal:backupManager` | - | `application-backup_manager-modal` |
| `ExportProjectModal` | `show:modal:exportProject` | `{ project }` | `application-export_project-modal` |
| `ImportProjectModal` | `show:modal:importProject` | - | `application-import_project-modal` |

`ExportDocThemeModal` is an unfinished stub: it isn't registered, it listens to the wrong event, and it reuses the import modal's ID.

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
createNode(name, content = '', children = [])  // -> { id, name, content, children }
createProjectSettings()        // -> { isThemePreset: true, currentThemeId: <first doc theme preset id> }
createProjectSession()         // -> project.session (see §15)
createRecentProject(project)   // -> RecentProject (platform-dependent shape, see §15)
```

### Opening / Closing / Recents

```js
openProject(project, { addToRecents = true })   // sets session.openProject, emits navigate:docEditor
openProjectInEditor(project, { addToRecents })
openRecentProject(projectId)                    // async - reloads from sourcePath (desktop) or snapshot (web)
closeProject()                                  // emits navigate:projectHub
revealOpenProject() / revealRecentProject(id)   // show in OS file explorer
addRecentProject(project) / removeRecentProject(id) / findRecentProject(id)
updateProjectLastOpenedAt(projectId, lastOpenedAt?)
getAllProjectPresets()
// -> [...built-in (builtIn: true), ...state.projectPresets (builtIn: false)]
//    each: { id, name, description, builtIn, factory: () => Project }
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

notifyProjectChange(project, mutateFn, extension = null)
// Same, for a given project object.
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
flattenNodes(nodes)                          // depth-first flat array
```

The `deleted*` / `renamed*` bookkeeping in `project.session` tells the folder
save which files on disk it must delete or rename. See §15.

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
```

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
shortcutManager.register('ctrl+s', action, { context: 'global' | [...], name, description })
// 'ctrl' maps to ⌘ on macOS. App shortcuts are registered in init/InitHotkeys.js.
```

### Other singletons

| Module | Export | Purpose |
|---|---|---|
| `@core/BackupManager.js` | `backupManager`, `initBackup()`, `BACKUP_VERSION` | Periodic/on-close backups (Backup Manager modal) |
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
await viewManager.switchTo(ViewClass, props = {})
```

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
**Lifecycle:** `initialize()` → `mount(componentLoader)` → `onLoad(componentLoader)` → … → `destroy()` → `onDestroy()`.

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
```

All builders return the overlay element, which they have already appended to `document.body`.

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
```

### Theme Schema

Entry types: `color`, `number` (`min`/`max`), `select` (`options`), `toggle`.

| Group / Area | Entries |
|---|---|
| `background` | `background`, `background-surface`, `background-elevated` |
| `text` | `text-primary`, `text-secondary`, `text-muted` |
| `accent` | `accent`, `accent-hover`, `link`, `link-underline` |
| `border` | `border` |
| `code` | `code-background`, `code-border`, `code-text`, `code-tag-text`, `code-diff-add`, `code-diff-removed` |
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
openSyntaxDefinitionEditor(project, lang)     // emits navigate:languageEditor { langId }
```

### Built-in Language Presets

Built-in languages live in `core/presets/LanguagePresets/<Name>LanguagePreset.js`. Each file exports
`create<Name>Language()` and `create<Name>LanguageStyles(langDef)`, and must be registered in the
`LANGUAGE_PRESETS` list in `LanguagePresets.js`.

---

## 12. Editor Helpers

`views/docEditor/components/editorArea/helpers/ToolbarHelper.js`

```js
insertLinePrefix(textarea, prefix, onChange)
wrapSelection(textarea, before, after, onChange)
insertCodeBlock(textarea, onChange)
insertTable(textarea, onChange)
insertLink(textarea, text, url, onChange)
getSelectedText(textarea)
syncScrollPosition(editorElement, previewIframe)
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
addTransform(name, fn, pos = {}) / removeTransform(name) / getPipelineNames()
```

Code fences: `lang` or `diff` / `diff:lang` (lines starting with `+`/`-` become added/removed).

### HtmlBuilder (`@core/HtmlBuilder.js`)

Builds both the live preview and the self-contained HTML export.

```js
await buildDocument(project, theme?)                          // full export HTML
await buildNodePreview(content, codeBlockCache, theme?, project?)
buildThemeCSS(theme) / buildBaseCSS() / buildLanguageCssForProject(project, theme, type)
getCachedThemeStyleUrl(theme) / revokeThemeCache(id)
// plus the building blocks: buildHead, buildHeader, buildSidebar, buildTabNav, buildToc, buildSearchBar, buildScript, assembleDocument
```

### ExportHelper (`@common/ExportHelper.js`)

```js
await exportProjectAsFolder(project, folderName?)   // -> { success, message }
exportProjectAsJSON(project)                        // .dfproj string (wrapped envelope)
await exportProjectAsHTML(project, fileName?)
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
  settings: {
    isThemePreset:  true,          // true -> currentThemeId refers to a built-in preset
    currentThemeId: 'theme_Dark',  // null = fallback theme
  },

  sourcePath: null,   // absolute path; null on web
  sourceKind: null,   // 'file' | 'folder' | 'in-app' (web) | null

  // runtime only - stripped on save (cleanSaveProject)
  session: {
    builtIn:        false,
    codeBlockCache: new Map(),
    isDirty:        true,
    // desktop folder-project bookkeeping, consumed by the next save:
    deletedTabIds:  {},  // { [tabId]: folderName }
    deletedNodeIds: {},  // { [nodeId]: { tabFolderName, fileName } }
    renamedTabIds:  {},  // { [tabId]: oldFolderName }
    renamedNodeIds: {},  // { [nodeId]: { tabFolderName, fileName } }
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
  children: [ /* Node, ... */ ],
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
{ id, name, description, project: { /* Project snapshot */ } }
```

### Folder-Project Layout (`sourceKind === 'folder'`)

Constants in `@core/AppMeta.js`. Tab folders and node files are named after
their names, made filesystem-safe with `uniqueSlug()` (collisions become
`Name (2)`), not after their IDs. That slug is stored as `tab.folderName` /
`node.fileName`.

```
<projectFolder>/
  docforge.config.json     <- FILE_EXTENSION_PROJECT_CONFIG
                              { id, name, settings, tabs: [{ id, name, folderName,
                                nodes: [{ id, name, fileName, children }] }] }  - no content
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

**Loading is driven by what's on disk** (`ElectronDocumentIOAdapter._readFolder()` → `DocumentManager._reconcileFolderProject()`):
- The config file only supplies the hierarchy and display names. Node files are matched to it by `folderName`/`fileName`, not by ID.
- A `.md` file that isn't referenced in the tab's tree is appended at the tab's root. Its ID comes from the frontmatter if present, and a new one is generated otherwise.
- An unknown subfolder of `tabs/` becomes a new tab named after the folder.
- Every `*.dftheme` / `*.dflang` file is loaded in full. The filename doesn't matter because the ID is stored inside the file.

**Saving** (`saveDocument()`):
1. `_absorbNewDiskContent()` re-reads the folder and pulls in tabs, nodes, themes and languages that were added on disk outside the app. It skips anything that has a pending delete or rename.
2. `serializeProject()` recomputes the slugs and writes everything.
3. The adapter deletes the explicitly deleted folders/files listed in `session.deleted*`, then removes any orphaned `.md`/`.dflang`/`.dftheme` files and tab folders.

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
| `UI_STATE_SCHEMA_VERSION` | `State._migrateUIState` |

`ProjectMigration`, `ThemeMigration` and `SyntaxDefinitionMigration` use a
`migrationSteps` map keyed by **target** version, of the form `{ 2: (old) => new, … }`.
The others merge the stored data with fresh defaults. When you change a persisted
shape, bump its constant and add a step.

File extensions: `.dfproj` (project), `.dftheme` (DocTheme), `.dflang` (SyntaxDefinition).

---

## 17. Electron / IPC

### `window.electronAPI` (preload)

```js
getPlatform() / getVersions() / ping()
minimize() / maximize() / close() / toggleDevTools()
onZoomChanged(cb)
onBeforeClose(cb) / confirmSaveComplete()
getPendingFiles() / onFileOpen(cb)            // files opened via OS (double-click / "open with")
updater.checkForUpdates() / installNow()
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
| misc | `ping`, `file:getPendingFiles`, `app:save-complete` (on), `app:before-close` (→ renderer), `file:open` (→ renderer), `zoom:changed` (→ renderer) |
| window | `window:minimize`, `window:maximize`, `window:close`, `window:toggleDevTools` |
| path | `path:userData`, `path:exe`, `path:join` |
| fs | `fs:write`, `fs:read`, `fs:readdir`, `fs:mkdir`, `fs:rm`, `fs:exists`, `fs:delete` |
| dialog / shell | `dialog:open`, `dialog:save`, `folder:open`, `folder:show` |
| updater | `updater:checkForUpdates`, `updater:installNow` (+ events `updater:checking/available/notAvailable/progress/downloaded/error`) |
| watcher | `watcher:watch-project`, `watcher:unwatch-project`, `watcher:ignore-next-change`, `watcher:ignore-path-tree`, `watcher:release-path-tree`, `watcher:is-path-ignored`, `watcher:is-watching` (+ events `watcher:file-changed`, `watcher:error`) |

---

## 18. UI Utilities

`@common/UIUtils.js`

```js
createDropDownItem(name, { description, shortcut, shortcutContext = 'global' })
createDropDownGroup(name)
openMenuItem(el) / closeMenuItem(el) / openGroup(el) / closeGroup(el)
closeAllDropDowns(selector = '.menu-item.open')
addDropdownEventListener(item, cb) / removeDropdownEventListener(item, cb) / dropdownItemClick(item, e)
deselectAllTabs({ element, isParent, condition }) / selectTab({ element, tabAction, isParent })
addCheckboxEventListener / removeCheckboxEventListener / isCheckedBoxActive / toggleCheckBox / setCheckBox / setCheckboxDisabled
addTabIndenting(input) / addLineBreakIndenting(input)
```

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
3. Change `APP_VERSION` in `AppMeta.js` and add a new entry to `APP_CHANGE_LOGS`.
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
